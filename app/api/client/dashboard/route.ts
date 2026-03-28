import { NextResponse } from "next/server";
import {
  buscarAssinaturaAtiva,
  listarMovimentacoesCliente,
  sincronizarAssinaturas,
} from "@/lib/assinaturas";
import { requireCustomerAuth, getCustomerProfileByAuthUserId } from "@/lib/customer-auth";
import { buscarPlanoPorId } from "@/lib/planos";
import { supabase } from "@/lib/supabase";
import { projectAutoClosedAgendamentos } from "@/lib/agendamento";

export async function GET(request: Request) {
  try {
    await sincronizarAssinaturas();

    const auth = await requireCustomerAuth(request);
    const cliente = await getCustomerProfileByAuthUserId(auth.authUserId);

    if (!cliente) {
      return NextResponse.json({ profile: null, assinatura: null, plano: null, reservas: [], financeiro: [], historico_uso: [] });
    }

    const [assinatura, reservasRes, financeiroRes, historicoTelefoneRes] = await Promise.all([
      buscarAssinaturaAtiva(cliente.id),
      supabase
        .from("agendamentos")
        .select("id, data, hora_inicio, hora_fim, nome_cliente, celular_cliente, servico_nome, servico_preco, valor_final, status_agendamento, status_atendimento, status_pagamento, tipo_cobranca")
        .eq("cliente_id", cliente.id)
        .order("data", { ascending: false })
        .order("hora_inicio", { ascending: false }),
      supabase
        .from("financeiro_lancamentos")
        .select("*")
        .eq("cliente_id", cliente.id)
        .order("competencia", { ascending: false }),
      supabase
        .from("clientes_telefone_historico")
        .select("telefone, alterado_em, origem")
        .eq("cliente_id", cliente.id)
        .order("alterado_em", { ascending: false }),
    ]);

    if (reservasRes.error || financeiroRes.error || historicoTelefoneRes.error) {
      throw new Error(reservasRes.error?.message || financeiroRes.error?.message || historicoTelefoneRes.error?.message || "Erro ao carregar dashboard.");
    }

    const plano = assinatura ? await buscarPlanoPorId(assinatura.plano_id) : null;
    const historicoUso = await listarMovimentacoesCliente(cliente.id);
    const reservas = projectAutoClosedAgendamentos(reservasRes.data ?? []);

    return NextResponse.json({
      profile: cliente,
      assinatura,
      plano,
      reservas,
      financeiro: financeiroRes.data ?? [],
      historico_telefone: historicoTelefoneRes.data ?? [],
      historico_uso: historicoUso,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar dashboard do cliente.";
    return NextResponse.json({ erro: message }, { status: message === "Cliente nao autenticado" ? 401 : 500 });
  }
}
