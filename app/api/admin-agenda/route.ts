import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { calcularValorFinal, syncAutoClosedAgendamentos } from "@/lib/agendamento";
import { canCancelAppointment, canConcludeAppointment, canMarkNoShow } from "@/lib/agendamento-rules";
import { requireAdminSession, resolveAdminBarbeiroScope } from "@/lib/admin-auth";
import {
  calcularValorFinalDosItens,
  decidirCobrancaItens,
  liquidarCreditosDoAgendamento,
  registrarReceitaAvulsaDoAgendamento,
  reservarCreditosDoAgendamento,
} from "@/lib/agendamento-planos";
import { getBusyIntervals, overlaps, parseTimeToMinutes } from "@/lib/agenda-conflicts";
import { minutesToTime } from "@/lib/agenda";
import { encontrarServicoAtivo } from "@/lib/servicos";
import { normalizePhone } from "@/lib/phone";

function buildCancelavelAte(data: string, horaInicio: string) {
  const [year, month, day] = data.split("-").map(Number);
  const [hour, minute] = horaInicio.slice(0, 5).split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute - 20).toISOString();
}

function describeConflictType(tipo: "agendamento" | "horario_customizado" | "bloqueio") {
  if (tipo === "agendamento") {
    return "Ja existe um agendamento nesse intervalo.";
  }
  if (tipo === "horario_customizado") {
    return "Ja existe uma reserva manual nesse intervalo.";
  }
  return "Existe um bloqueio ativo nesse intervalo.";
}

function getRouteErrorStatus(message: string) {
  if (message === "Nao autorizado") {
    return 401;
  }
  if (message === "Sem permissao") {
    return 403;
  }
  if (message === "Barbeiro nao encontrado.") {
    return 404;
  }
  return 500;
}

export async function GET(req: Request) {
  try {
    const session = await requireAdminSession();
    const { searchParams } = new URL(req.url);
    const data = searchParams.get("data");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    const targetBarbeiroId = await resolveAdminBarbeiroScope(session, searchParams.get("barbeiro_id"));

    if (!data && !dateFrom) {
      return NextResponse.json({ erro: "Data obrigatoria." }, { status: 400 });
    }

    let agendamentoQuery = supabase
      .from("agendamentos")
      .select("id, data, hora_inicio, hora_fim, nome_cliente, celular_cliente, servico_nome, servico_preco, status, status_agendamento, status_atendimento, status_pagamento, valor_tabela, desconto, acrescimo, valor_final, forma_pagamento, origem_agendamento, observacoes, concluido_em, cancelado_em, tipo_cobranca")
      .eq("barbeiro_id", targetBarbeiroId)
      .order("data", { ascending: true })
      .order("hora_inicio", { ascending: true });

    let customQuery = supabase
      .from("horarios_customizados")
      .select("id, data, hora_inicio, hora_fim, nome_cliente, celular_cliente")
      .eq("barbeiro_id", targetBarbeiroId)
      .order("data", { ascending: true })
      .order("hora_inicio", { ascending: true });

    if (data) {
      agendamentoQuery = agendamentoQuery.eq("data", data);
      customQuery = customQuery.eq("data", data);
    } else {
      agendamentoQuery = agendamentoQuery.gte("data", dateFrom!).lte("data", dateTo || dateFrom!);
      customQuery = customQuery.gte("data", dateFrom!).lte("data", dateTo || dateFrom!);
    }

    const { data: agendamentosRaw, error } = await agendamentoQuery;
    if (error) {
      return NextResponse.json({ erro: error.message }, { status: 500 });
    }

    const agendamentos = await syncAutoClosedAgendamentos(agendamentosRaw || []);
    const { data: horariosCustomizados, error: errorCustom } = await customQuery;
    if (errorCustom) {
      return NextResponse.json({ erro: errorCustom.message }, { status: 500 });
    }

    const todosAgendamentos = [
      ...(agendamentos || []).map((agendamento) => ({ ...agendamento, origem: "agendamento" })),
      ...(horariosCustomizados || []).map((hc) => ({
        id: hc.id,
        data: hc.data,
        hora_inicio: hc.hora_inicio,
        hora_fim: hc.hora_fim,
        nome_cliente: hc.nome_cliente || "Horario reservado",
        celular_cliente: hc.celular_cliente || "",
        servico_nome: "Horario personalizado",
        servico_preco: 0,
        status: "ativo",
        status_agendamento: "confirmado",
        status_atendimento: "concluido",
        status_pagamento: "pendente",
        valor_tabela: 0,
        desconto: 0,
        acrescimo: 0,
        valor_final: 0,
        forma_pagamento: null,
        origem_agendamento: "horario_customizado",
        observacoes: null,
        concluido_em: null,
        cancelado_em: null,
        origem: "horario_customizado",
        tipo_cobranca: "avulso",
      })),
    ];

    return NextResponse.json(todosAgendamentos);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno ao carregar agenda.";
    return NextResponse.json({ erro: message }, { status: getRouteErrorStatus(message) });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireAdminSession();
    const body = await req.json();
    const { id, status_agendamento, status_atendimento, status_pagamento, desconto, acrescimo, valor_final, forma_pagamento, observacoes } = body;

    if (!id) {
      return NextResponse.json({ erro: "ID obrigatorio." }, { status: 400 });
    }

    const { data: atual, error: loadError } = await supabase
      .from("agendamentos")
      .select("id, barbeiro_id, data, hora_inicio, hora_fim, cancelavel_ate, valor_tabela, desconto, acrescimo, status, status_agendamento, status_atendimento, status_pagamento, origem_agendamento")
      .eq("id", id)
      .maybeSingle();

    if (loadError) {
      return NextResponse.json({ erro: loadError.message }, { status: 500 });
    }

    if (!atual) {
      return NextResponse.json({ erro: "Agendamento nao encontrado." }, { status: 404 });
    }

    const targetBarbeiroId = await resolveAdminBarbeiroScope(session, atual.barbeiro_id);

    if (status_agendamento === "cancelado" && !canCancelAppointment(atual)) {
      return NextResponse.json({ erro: "Este agendamento nao pode mais ser cancelado." }, { status: 409 });
    }
    if (status_agendamento === "no_show" && !canMarkNoShow(atual)) {
      return NextResponse.json({ erro: "So e possivel marcar falta apos o horario." }, { status: 409 });
    }
    if (status_atendimento === "concluido" && !canConcludeAppointment(atual)) {
      return NextResponse.json({ erro: "So e possivel concluir o atendimento apos o horario marcado." }, { status: 409 });
    }

    const descontoFinal = desconto === undefined || desconto === null || desconto === "" ? Number(atual.desconto ?? 0) : Number(desconto);
    const acrescimoFinal = acrescimo === undefined || acrescimo === null || acrescimo === "" ? Number(atual.acrescimo ?? 0) : Number(acrescimo);
    const valorFinalCalculado = valor_final === undefined || valor_final === null || valor_final === ""
      ? calcularValorFinal({ valorTabela: Number(atual.valor_tabela ?? 0), desconto: descontoFinal, acrescimo: acrescimoFinal })
      : Number(valor_final);

    const patch: Record<string, string | number | null> = {
      desconto: descontoFinal,
      acrescimo: acrescimoFinal,
      valor_final: Math.max(0, valorFinalCalculado),
    };

    if (status_agendamento) {
      patch.status_agendamento = status_agendamento;
      patch.status = status_agendamento === "cancelado" ? "cancelado" : "ativo";
      if (status_agendamento === "cancelado") {
        patch.cancelado_em = new Date().toISOString();
      }
    }

    if (status_atendimento) {
      patch.status_atendimento = status_atendimento;
      if (status_atendimento === "concluido") {
        patch.concluido_em = new Date().toISOString();
      }
    }

    if (status_pagamento) patch.status_pagamento = status_pagamento;
    if (forma_pagamento !== undefined) patch.forma_pagamento = forma_pagamento || null;
    if (observacoes !== undefined) patch.observacoes = observacoes || null;

    const { data: atualizado, error } = await supabase
      .from("agendamentos")
      .update(patch)
      .eq("id", id)
      .eq("barbeiro_id", targetBarbeiroId)
      .select("id, status, status_agendamento, status_atendimento, status_pagamento, desconto, acrescimo, valor_final, forma_pagamento, observacoes, concluido_em, cancelado_em")
      .single();

    if (error) {
      return NextResponse.json({ erro: error.message }, { status: 500 });
    }

    if (status_agendamento === "cancelado") {
      await liquidarCreditosDoAgendamento(id, "devolucao_credito");
    }

    if (status_atendimento === "concluido") {
      await liquidarCreditosDoAgendamento(id, "consumo_credito");
      await registrarReceitaAvulsaDoAgendamento(id);
    }

    if (status_agendamento === "no_show") {
      await liquidarCreditosDoAgendamento(id, "consumo_credito");
    }

    return NextResponse.json({ ok: true, agendamento: atualizado });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno ao atualizar agendamento.";
    return NextResponse.json({ erro: message }, { status: getRouteErrorStatus(message) });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAdminSession();
    const body = await req.json();
    const data = String(body?.data ?? "").trim();
    const horaInicio = String(body?.hora_inicio ?? "").trim();
    const servicoId = String(body?.servico_id ?? "").trim();
    const targetBarbeiroId = await resolveAdminBarbeiroScope(session, body?.barbeiro_id ? String(body.barbeiro_id) : null);
    const clienteId = body?.cliente_id ? String(body.cliente_id).trim() : "";
    const nomeManual = String(body?.nome_cliente ?? "").trim();
    const celularManual = normalizePhone(body?.celular_cliente) || "";
    const observacoes = body?.observacoes ? String(body.observacoes) : null;

    if (!data || !horaInicio || !servicoId) {
      return NextResponse.json({ erro: "Data, horario e servico sao obrigatorios." }, { status: 400 });
    }

    const servico = await encontrarServicoAtivo({ id: servicoId });
    if (!servico) {
      return NextResponse.json({ erro: "Servico nao encontrado." }, { status: 404 });
    }

    let clienteIdFinal: string | null = null;
    let authUserIdFinal: string | null = null;
    let nomeClienteFinal = nomeManual;
    let celularClienteFinal = celularManual;

    if (clienteId) {
      const { data: cliente, error: clienteError } = await supabase
        .from("clientes")
        .select("id, auth_user_id, nome, telefone")
        .eq("id", clienteId)
        .maybeSingle();

      if (clienteError) {
        return NextResponse.json({ erro: clienteError.message }, { status: 500 });
      }

      if (!cliente) {
        return NextResponse.json({ erro: "Cliente nao encontrado." }, { status: 404 });
      }

      clienteIdFinal = cliente.id;
      authUserIdFinal = cliente.auth_user_id;
      nomeClienteFinal = cliente.nome;
      celularClienteFinal = cliente.telefone;
    }

    if (!nomeClienteFinal || !celularClienteFinal) {
      return NextResponse.json({ erro: "Selecione um cliente cadastrado ou informe nome e celular." }, { status: 400 });
    }

    const inicioReserva = parseTimeToMinutes(horaInicio);
    const fimReserva = inicioReserva + Number(servico.duracao_minutos);

    const busyState = await getBusyIntervals(data, targetBarbeiroId);
    if (busyState.bloqueioDiaInteiro) {
      return NextResponse.json({ erro: "Voce bloqueou o dia inteiro para esta data." }, { status: 409 });
    }
    if (busyState.naoAceitarMais) {
      return NextResponse.json({ erro: "Existe um bloqueio de nao aceitar mais horarios nessa data." }, { status: 409 });
    }

    const conflito = busyState.intervalos.find((intervalo) => overlaps(inicioReserva, fimReserva, intervalo.inicio, intervalo.fim));
    if (conflito) {
      return NextResponse.json({ erro: describeConflictType(conflito.tipo) }, { status: 409 });
    }

    const servicos = [servico];
    const valorTabela = Number(servico.preco);
    const cobranca = clienteIdFinal ? await decidirCobrancaItens(clienteIdFinal, servicos) : {
      assinatura: null,
      itens: [{
        servico,
        tipo_cobranca: "avulso" as const,
        status_credito: "nao_aplicavel" as const,
        assinatura_id: null,
        creditos_plano: { corte: 0, barba: 0, sobrancelha: 0 },
      }],
      itensSemSaldo: [],
    };

    const tipoCobranca = cobranca.itens.every((item) => item.tipo_cobranca === "plano")
      ? "plano"
      : cobranca.itens.every((item) => item.tipo_cobranca === "avulso")
        ? "avulso"
        : "misto";

    const valorFinal = calcularValorFinalDosItens(cobranca.itens);

    const { data: inserted, error } = await supabase
      .from("agendamentos")
      .insert({
        barbeiro_id: targetBarbeiroId,
        cliente_id: clienteIdFinal,
        auth_user_id: authUserIdFinal,
        assinatura_id: cobranca.assinatura?.id ?? null,
        data,
        hora_inicio: horaInicio,
        hora_fim: minutesToTime(fimReserva),
        nome_cliente: nomeClienteFinal,
        celular_cliente: celularClienteFinal,
        servico_id: servico.id,
        servico_nome: servico.nome,
        servico_duracao_minutos: servico.duracao_minutos,
        servico_preco: valorTabela,
        valor_tabela: valorTabela,
        desconto: 0,
        acrescimo: 0,
        valor_final: valorFinal,
        status: "ativo",
        status_agendamento: "confirmado",
        status_atendimento: "pendente",
        status_pagamento: "pendente",
        origem_agendamento: "admin_manual",
        tipo_cobranca: tipoCobranca,
        cancelavel_ate: buildCancelavelAte(data, horaInicio),
        observacoes,
      })
      .select("id, data, hora_inicio, hora_fim, nome_cliente, celular_cliente, servico_nome, valor_final, tipo_cobranca")
      .single();

    if (error) {
      return NextResponse.json({ erro: error.message }, { status: 500 });
    }

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
      return NextResponse.json({ erro: itemsError.message }, { status: 500 });
    }

    if (clienteIdFinal) {
      await reservarCreditosDoAgendamento(clienteIdFinal, inserted.id, cobranca.itens);
    }

    return NextResponse.json({
      ok: true,
      agendamento: inserted,
      aviso:
        clienteIdFinal && cobranca.itensSemSaldo.length > 0
          ? "Cliente com plano sem saldo suficiente. Horario lancado como servico avulso."
          : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno ao criar agendamento manual.";
    return NextResponse.json({ erro: message }, { status: getRouteErrorStatus(message) });
  }
}
