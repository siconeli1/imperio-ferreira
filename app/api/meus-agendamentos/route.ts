import { NextResponse } from "next/server";
import { normalizePhone } from "@/lib/phone";
import { syncAutoClosedAgendamentos } from "@/lib/agendamento";
import { supabase } from "@/lib/supabase";
import { getCustomerAuthFromRequest, getCustomerProfileByAuthUserId } from "@/lib/customer-auth";

export async function GET(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req);

    if (auth) {
      const cliente = await getCustomerProfileByAuthUserId(auth.authUserId);

      if (!cliente) {
        return NextResponse.json({ profile_exists: false, agendamentos: [] });
      }

      const { data: agendamentosRaw, error } = await supabase
        .from("agendamentos")
        .select("id, data, hora_inicio, hora_fim, nome_cliente, celular_cliente, servico_nome, servico_preco, valor_final, status, status_agendamento, status_atendimento, status_pagamento, barbeiro_id, barbeiros(nome)")
        .eq("cliente_id", cliente.id)
        .order("data", { ascending: true })
        .order("hora_inicio", { ascending: true });

      if (error) {
        return NextResponse.json({ erro: error.message }, { status: 500 });
      }

      const data = await syncAutoClosedAgendamentos(agendamentosRaw || []);
      return NextResponse.json({ profile_exists: true, agendamentos: data || [] });
    }

    const { searchParams } = new URL(req.url);
    const celular = normalizePhone(searchParams.get("celular"));

    if (!celular) {
      return NextResponse.json({ erro: "Celular obrigatorio" }, { status: 400 });
    }

    const { data: agendamentosRaw, error } = await supabase
      .from("agendamentos")
      .select("id, data, hora_inicio, hora_fim, nome_cliente, celular_cliente, servico_nome, servico_preco, valor_final, status, status_agendamento, status_atendimento, status_pagamento, barbeiro_id, barbeiros(nome)")
      .eq("celular_cliente", celular)
      .order("data", { ascending: true })
      .order("hora_inicio", { ascending: true });

    if (error) {
      return NextResponse.json({ erro: error.message }, { status: 500 });
    }

    const data = await syncAutoClosedAgendamentos(agendamentosRaw || []);
    return NextResponse.json({ profile_exists: true, agendamentos: data || [] });
  } catch {
    return NextResponse.json({ erro: "Erro interno do servidor" }, { status: 500 });
  }
}
