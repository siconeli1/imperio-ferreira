import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { validateBusinessSlot } from "@/lib/agenda-booking";
import { minutesToTime } from "@/lib/agenda";
import { getBusyIntervals, getAnyAvailableBarber, overlaps } from "@/lib/agenda-conflicts";
import { findBarbeiroById } from "@/lib/barbeiros";
import { requireCustomerAuth, getCustomerProfileByAuthUserId } from "@/lib/customer-auth";
import { encontrarServicosAtivosPorIds } from "@/lib/servicos";
import {
  calcularValorFinalDosItens,
  decidirCobrancaItens,
  liquidarCreditosDoAgendamento,
  reservarCreditosDoAgendamento,
} from "@/lib/agendamento-planos";

function buildCancelavelAte(data: string, horaInicio: string) {
  const [year, month, day] = data.split("-").map(Number);
  const [hour, minute] = horaInicio.slice(0, 5).split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute - 20).toISOString();
}

export async function POST(req: Request) {
  try {
    const auth = await requireCustomerAuth(req);
    const cliente = await getCustomerProfileByAuthUserId(auth.authUserId);

    if (!cliente) {
      return NextResponse.json({ erro: "Complete seu cadastro antes de agendar." }, { status: 409 });
    }

    const body = await req.json().catch(() => null);
    const data = body?.data as string | undefined;
    const horaInicio = body?.hora_inicio as string | undefined;
    const barbeiroIdParam = body?.barbeiro_id as string | undefined;
    const confirmarAvulso = Boolean(body?.confirmar_avulso);
    const serviceIds = Array.isArray(body?.service_ids)
      ? body.service_ids.map((item: unknown) => String(item))
      : body?.servico_id
        ? [String(body.servico_id)]
        : [];

    if (!data || !horaInicio || serviceIds.length === 0) {
      return NextResponse.json({ erro: "Campos obrigatorios: data, hora_inicio e service_ids." }, { status: 400 });
    }

    const servicos = await encontrarServicosAtivosPorIds(serviceIds);
    if (servicos.length !== serviceIds.length) {
      return NextResponse.json({ erro: "Um ou mais servicos nao foram encontrados." }, { status: 404 });
    }

    const duracaoTotal = servicos.reduce((acc, servico) => acc + Number(servico.duracao_minutos), 0);
    const valorTabela = servicos.reduce((acc, servico) => acc + Number(servico.preco), 0);
    const slotValidation = validateBusinessSlot(data, horaInicio, duracaoTotal);

    if (!slotValidation.ok) {
      return NextResponse.json({ erro: slotValidation.erro }, { status: 409 });
    }

    const inicioReserva = slotValidation.inicioReserva;
    const fimReserva = slotValidation.fimReserva;

    let barbeiro = null;

    if (barbeiroIdParam && barbeiroIdParam !== "qualquer") {
      barbeiro = await findBarbeiroById(barbeiroIdParam);
      if (!barbeiro || !barbeiro.ativo) {
        return NextResponse.json({ erro: "Barbeiro nao encontrado ou inativo" }, { status: 404 });
      }

      const busyState = await getBusyIntervals(data, barbeiro.id);
      if (busyState.bloqueioDiaInteiro || busyState.naoAceitarMais) {
        return NextResponse.json({ erro: "Barbeiro indisponivel nesta data" }, { status: 409 });
      }

      const hasConflict = busyState.intervalos.some((intervalo) => overlaps(inicioReserva, fimReserva, intervalo.inicio, intervalo.fim));
      if (hasConflict) {
        return NextResponse.json({ erro: "Horario indisponivel para este barbeiro" }, { status: 409 });
      }
    } else {
      barbeiro = await getAnyAvailableBarber(data, inicioReserva, fimReserva);
      if (!barbeiro) {
        return NextResponse.json({ erro: "Nenhum barbeiro disponivel neste horario" }, { status: 409 });
      }
    }

    const cobranca = await decidirCobrancaItens(cliente.id, servicos);
    if (cobranca.itensSemSaldo.length > 0 && !confirmarAvulso) {
      return NextResponse.json({
        erro: "Seu plano nao cobre todos os servicos selecionados com saldo disponivel.",
        requires_avulso_confirmation: true,
        itens_sem_saldo: cobranca.itensSemSaldo.map((servico) => ({ id: servico.id, nome: servico.nome, categoria: servico.categoria })),
      }, { status: 409 });
    }

    const tipoCobranca = cobranca.itens.every((item) => item.tipo_cobranca === "plano")
      ? "plano"
      : cobranca.itens.every((item) => item.tipo_cobranca === "avulso")
        ? "avulso"
        : "misto";

    const valorFinal = calcularValorFinalDosItens(cobranca.itens);
    const servicoResumo = servicos.map((servico) => servico.nome).join(" + ");

    let insertedId: string | null = null;

    try {
      const { data: inserted, error } = await supabase
        .from("agendamentos")
        .insert({
          barbeiro_id: barbeiro.id,
          cliente_id: cliente.id,
          auth_user_id: auth.authUserId,
          assinatura_id: cobranca.assinatura?.id ?? null,
          data,
          hora_inicio: horaInicio,
          hora_fim: minutesToTime(fimReserva),
          nome_cliente: cliente.nome,
          celular_cliente: cliente.telefone,
          servico_id: servicos[0].id,
          servico_nome: servicoResumo,
          servico_duracao_minutos: duracaoTotal,
          servico_preco: valorTabela,
          valor_tabela: valorTabela,
          desconto: 0,
          acrescimo: 0,
          valor_final: valorFinal,
          status: "ativo",
          status_agendamento: "agendado",
          status_atendimento: "pendente",
          status_pagamento: "pendente",
          origem_agendamento: "site",
          tipo_cobranca: tipoCobranca,
          cancelavel_ate: buildCancelavelAte(data, horaInicio),
        })
        .select("id, data, hora_inicio, hora_fim, nome_cliente, celular_cliente, barbeiro_id, servico_nome, servico_preco, valor_final, tipo_cobranca")
        .single();

      if (error) {
        const msg = error.message?.toLowerCase?.() ?? "";
        if (msg.includes("duplicate") || msg.includes("unique") || msg.includes("exclusion") || msg.includes("overlap")) {
          return NextResponse.json({ erro: "Horario ja reservado para esse periodo" }, { status: 409 });
        }
        throw new Error(error.message);
      }

      insertedId = inserted.id;

      const itensPayload = cobranca.itens.map((item, index) => ({
        agendamento_id: inserted.id,
        assinatura_id: item.assinatura_id,
        servico_id: item.servico.id,
        servico_nome: item.servico.nome,
        servico_categoria: item.servico.categoria,
        servico_duracao_minutos: item.servico.duracao_minutos,
        servico_preco: item.servico.preco,
        tipo_cobranca: item.tipo_cobranca,
        status_credito: item.status_credito,
        creditos_corte: item.creditos_plano.corte,
        creditos_barba: item.creditos_plano.barba,
        creditos_sobrancelha: item.creditos_plano.sobrancelha,
        ordem: index + 1,
      }));

      const { error: itemsError } = await supabase.from("agendamento_itens").insert(itensPayload);
      if (itemsError) {
        throw new Error(itemsError.message);
      }

      await reservarCreditosDoAgendamento(cliente.id, inserted.id, cobranca.itens);

      return NextResponse.json({
        ok: true,
        agendamento: inserted,
        barbeiro: {
          id: barbeiro.id,
          nome: barbeiro.nome,
          slug: barbeiro.slug,
        },
        itens: itensPayload,
      });
    } catch (error) {
      if (insertedId) {
        await liquidarCreditosDoAgendamento(insertedId, "devolucao_credito").catch(() => null);
        await supabase.from("agendamento_itens").delete().eq("agendamento_id", insertedId);
        await supabase.from("agendamentos").delete().eq("id", insertedId);
      }

      const message = error instanceof Error ? error.message : "Erro ao confirmar agendamento.";
      return NextResponse.json({ erro: message }, { status: 500 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao confirmar agendamento.";
    return NextResponse.json({ erro: message }, { status: message === "Cliente nao autenticado" ? 401 : 500 });
  }
}
