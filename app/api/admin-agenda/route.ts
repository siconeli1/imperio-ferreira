import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { calcularValorFinal, syncAutoClosedAgendamentos } from "@/lib/agendamento";
import { canCancelAppointment, canConcludeAppointment, canMarkNoShow } from "@/lib/agendamento-rules";
import { requireAdminSession } from "@/lib/admin-auth";
import { liquidarCreditosDoAgendamento, registrarReceitaAvulsaDoAgendamento } from "@/lib/agendamento-planos";

export async function GET(req: Request) {
  try {
    const session = await requireAdminSession();
    const { searchParams } = new URL(req.url);
    const data = searchParams.get("data");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");

    if (!data && !dateFrom) {
      return NextResponse.json({ erro: "Data obrigatoria." }, { status: 400 });
    }

    let agendamentoQuery = supabase
      .from("agendamentos")
      .select("id, data, hora_inicio, hora_fim, nome_cliente, celular_cliente, servico_nome, servico_preco, status, status_agendamento, status_atendimento, status_pagamento, valor_tabela, desconto, acrescimo, valor_final, forma_pagamento, origem_agendamento, observacoes, concluido_em, cancelado_em, tipo_cobranca")
      .eq("barbeiro_id", session.barbeiro_id)
      .order("data", { ascending: true })
      .order("hora_inicio", { ascending: true });

    let customQuery = supabase
      .from("horarios_customizados")
      .select("id, data, hora_inicio, hora_fim, nome_cliente, celular_cliente")
      .eq("barbeiro_id", session.barbeiro_id)
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
    return NextResponse.json({ erro: message }, { status: message === "Nao autorizado" ? 401 : 500 });
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
      .eq("barbeiro_id", session.barbeiro_id)
      .maybeSingle();

    if (loadError) {
      return NextResponse.json({ erro: loadError.message }, { status: 500 });
    }

    if (!atual) {
      return NextResponse.json({ erro: "Agendamento nao encontrado." }, { status: 404 });
    }

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
      .eq("barbeiro_id", session.barbeiro_id)
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
    return NextResponse.json({ erro: message }, { status: message === "Nao autorizado" ? 401 : 500 });
  }
}
