import { NextResponse } from "next/server";
import { normalizePhone } from "@/lib/phone";
import { canCancelAppointment } from "@/lib/agendamento-rules";
import { supabase } from "@/lib/supabase";
import { getAdminSession } from "@/lib/admin-auth";
import { liquidarCreditosDoAgendamento } from "@/lib/agendamento-planos";
import { getCustomerAuthFromRequest } from "@/lib/customer-auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const id = String(body?.id ?? "");
    const celular = normalizePhone(body?.celular);
    const adminSession = await getAdminSession();
    const customerAuth = await getCustomerAuthFromRequest(req);

    if (!id) {
      return NextResponse.json({ erro: "ID nao informado" }, { status: 400 });
    }

    const { data: agendamento, error: loadError } = await supabase
      .from("agendamentos")
      .select("id, barbeiro_id, auth_user_id, celular_cliente, data, hora_inicio, hora_fim, cancelavel_ate, status, status_agendamento, status_atendimento, status_pagamento, origem_agendamento")
      .eq("id", id)
      .maybeSingle();

    if (loadError) {
      return NextResponse.json({ erro: loadError.message }, { status: 500 });
    }

    if (!agendamento) {
      return NextResponse.json({ erro: "Agendamento nao encontrado" }, { status: 404 });
    }

    if (adminSession) {
      if (agendamento.barbeiro_id !== adminSession.barbeiro_id) {
        return NextResponse.json({ erro: "Nao autorizado a cancelar este agendamento" }, { status: 403 });
      }
    } else if (customerAuth) {
      if (agendamento.auth_user_id !== customerAuth.authUserId) {
        return NextResponse.json({ erro: "Nao autorizado a cancelar este agendamento" }, { status: 403 });
      }
    } else {
      if (!celular) {
        return NextResponse.json({ erro: "Celular obrigatorio" }, { status: 401 });
      }

      if (normalizePhone(agendamento.celular_cliente) !== celular) {
        return NextResponse.json({ erro: "Nao autorizado a cancelar este agendamento" }, { status: 403 });
      }
    }

    if (!canCancelAppointment(agendamento)) {
      return NextResponse.json({ erro: "Este agendamento nao pode mais ser cancelado." }, { status: 409 });
    }

    const { error } = await supabase
      .from("agendamentos")
      .update({
        status: "cancelado",
        status_agendamento: "cancelado",
        cancelado_em: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ erro: error.message }, { status: 500 });
    }

    await liquidarCreditosDoAgendamento(id, "devolucao_credito");

    return NextResponse.json({ sucesso: true });
  } catch {
    return NextResponse.json({ erro: "Erro interno do servidor" }, { status: 500 });
  }
}
