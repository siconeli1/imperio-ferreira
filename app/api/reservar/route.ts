import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { calcularValorFinal } from "@/lib/agendamento";
import { validateBusinessSlot } from "@/lib/agenda-booking";
import { minutesToTime } from "@/lib/agenda";
import { getBusyIntervals, getAnyAvailableBarber, overlaps } from "@/lib/agenda-conflicts";
import { findBarbeiroById } from "@/lib/barbeiros";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { encontrarServicoAtivo } from "@/lib/servicos";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  const data = body?.data as string | undefined;
  const horaInicio = body?.hora_inicio as string | undefined;
  const servicoId = body?.servico_id as string | undefined;
  const servicoCodigo = body?.servico_codigo as string | undefined;
  const barbeiroIdParam = body?.barbeiro_id as string | undefined;
  const nomeCliente = String(body?.nome ?? "").trim();
  const celularCliente = normalizePhone(body?.celular);

  if (!data || !horaInicio || !nomeCliente || !celularCliente || (!servicoId && !servicoCodigo)) {
    return NextResponse.json(
      { erro: "Campos obrigatorios: data, hora_inicio, nome, celular, servico" },
      { status: 400 }
    );
  }

  if (!isValidPhone(celularCliente)) {
    return NextResponse.json({ erro: "Celular invalido" }, { status: 400 });
  }

  const servico = await encontrarServicoAtivo({ id: servicoId, codigo: servicoCodigo });
  if (!servico) {
    return NextResponse.json({ erro: "Servico invalido ou inativo" }, { status: 400 });
  }

  const duracao = Number(servico.duracao_minutos);
  const slotValidation = validateBusinessSlot(data, horaInicio, duracao);

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

    const hasConflict = busyState.intervalos.some((intervalo) =>
      overlaps(inicioReserva, fimReserva, intervalo.inicio, intervalo.fim)
    );

    if (hasConflict) {
      return NextResponse.json({ erro: "Horario indisponivel para este barbeiro" }, { status: 409 });
    }
  } else {
    barbeiro = await getAnyAvailableBarber(
      data,
      inicioReserva,
      fimReserva
    );

    if (!barbeiro) {
      return NextResponse.json({ erro: "Nenhum barbeiro disponivel neste horario" }, { status: 409 });
    }
  }

  const valorTabela = Number(servico.preco ?? 0);
  const valorFinal = calcularValorFinal({ valorTabela });

  const { data: inserted, error } = await supabase
    .from("agendamentos")
    .insert({
      barbeiro_id: barbeiro.id,
      data,
      hora_inicio: horaInicio,
      hora_fim: minutesToTime(fimReserva),
      nome_cliente: nomeCliente,
      celular_cliente: celularCliente,
      servico_id: servico.id,
      servico_nome: servico.nome,
      servico_duracao_minutos: duracao,
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
    })
    .select("id, data, hora_inicio, hora_fim, nome_cliente, celular_cliente, barbeiro_id, servico_nome, servico_preco, valor_final")
    .single();

  if (error) {
    const msg = error.message?.toLowerCase?.() ?? "";
    if (
      msg.includes("duplicate") ||
      msg.includes("unique") ||
      msg.includes("exclusion") ||
      msg.includes("overlap")
    ) {
      return NextResponse.json({ erro: "Horario ja reservado para esse periodo" }, { status: 409 });
    }
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    agendamento: inserted,
    barbeiro: {
      id: barbeiro.id,
      nome: barbeiro.nome,
      slug: barbeiro.slug,
    },
  });
}
