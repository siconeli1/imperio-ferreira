import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { listarPlanosAtivos, type Plano } from "@/lib/planos";
import { sincronizarAssinaturas } from "@/lib/assinaturas";
import { supabase } from "@/lib/supabase";
import { getWhatsAppLink } from "@/lib/whatsapp";

export async function GET(request: Request) {
  try {
    await requireAdminSession();
    await sincronizarAssinaturas();

    const { searchParams } = new URL(request.url);
    const busca = String(searchParams.get("busca") ?? "").trim().toLowerCase();
    const planoId = String(searchParams.get("plano_id") ?? "").trim();
    const somenteComPlano = searchParams.get("com_plano") === "true";

    const [clientesRes, assinaturasRes, planos] = await Promise.all([
      supabase
        .from("clientes")
        .select("id, nome, telefone, created_at")
        .order("nome", { ascending: true }),
      supabase
        .from("assinaturas")
        .select("id, cliente_id, plano_id, status, fim_ciclo, proxima_renovacao")
        .eq("status", "ativo"),
      listarPlanosAtivos(),
    ]);

    if (clientesRes.error || assinaturasRes.error) {
      throw new Error(clientesRes.error?.message || assinaturasRes.error?.message || "Erro ao carregar clientes.");
    }

    const planoById = new Map((planos as Plano[]).map((item) => [item.id, item]));
    const assinaturaByCliente = new Map((assinaturasRes.data ?? []).map((item) => [item.cliente_id, item]));

    let clientes = await Promise.all((clientesRes.data ?? []).map(async (cliente) => {
      const ultimaVisitaRes = await supabase
        .from("agendamentos")
        .select("data, hora_inicio")
        .eq("cliente_id", cliente.id)
        .order("data", { ascending: false })
        .order("hora_inicio", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ultimaVisitaRes.error) {
        throw new Error(ultimaVisitaRes.error.message);
      }

      const assinatura = assinaturaByCliente.get(cliente.id);
      return {
        ...cliente,
        ultima_visita: ultimaVisitaRes.data?.data ?? null,
        plano_ativo: assinatura?.plano_id ?? null,
        plano_nome: assinatura?.plano_id ? planoById.get(assinatura.plano_id)?.nome ?? assinatura.plano_id : null,
        assinatura_id: assinatura?.id ?? null,
        vencimento: assinatura?.proxima_renovacao ?? null,
        whatsapp_link: getWhatsAppLink(cliente.telefone),
      };
    }));

    if (busca) {
      clientes = clientes.filter((cliente) => cliente.nome.toLowerCase().includes(busca) || cliente.telefone.includes(busca));
    }

    if (planoId) {
      clientes = clientes.filter((cliente) => cliente.plano_ativo === planoId);
    }

    if (somenteComPlano) {
      clientes = clientes.filter((cliente) => Boolean(cliente.plano_ativo));
    }

    return NextResponse.json({ clientes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar clientes.";
    return NextResponse.json({ erro: message }, { status: message === "Nao autorizado" ? 401 : 500 });
  }
}
