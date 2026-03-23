import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import {
  aplicarTrocaImediata,
  atualizarObservacoesAssinatura,
  buscarAssinaturaAtiva,
  criarAssinatura,
  listarNotificacoesAssinatura,
  registrarUsoManualPlano,
  renovarAssinatura,
} from "@/lib/assinaturas";
import { buscarPlanoPorId, listarPlanosAtivos } from "@/lib/planos";
import { supabase } from "@/lib/supabase";

function getClienteRelation(
  relation: { id?: string; nome?: string; telefone?: string } | { id?: string; nome?: string; telefone?: string }[] | null | undefined
) {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }
  return relation ?? null;
}

type AssinanteRow = {
  id: string;
  cliente_id: string;
  plano_id: string;
  status: string;
  tipo_renovacao: string;
  inicio_ciclo: string;
  fim_ciclo: string;
  proxima_renovacao: string;
  observacoes_internas?: string | null;
  clientes?: { id?: string; nome?: string; telefone?: string } | { id?: string; nome?: string; telefone?: string }[] | null;
};

export async function GET(request: Request) {
  try {
    await requireAdminSession();

    const { searchParams } = new URL(request.url);
    const busca = String(searchParams.get("busca") ?? "").trim().toLowerCase();
    const planoId = String(searchParams.get("plano_id") ?? "").trim();
    const vencimento = String(searchParams.get("vencimento") ?? "todos").trim();

    const { hoje, notificacoes, vencendoHoje } = await listarNotificacoesAssinatura();
    const planos = await listarPlanosAtivos();

    let query = supabase
      .from("assinaturas")
      .select("id, cliente_id, plano_id, status, tipo_renovacao, inicio_ciclo, fim_ciclo, proxima_renovacao, observacoes_internas, clientes(id, nome, telefone)")
      .eq("status", "ativo")
      .order("proxima_renovacao", { ascending: true });

    if (planoId) {
      query = query.eq("plano_id", planoId);
    }

    if (vencimento === "hoje") {
      query = query.eq("proxima_renovacao", hoje);
    } else if (vencimento === "proximos_7") {
      const limite = new Date(`${hoje}T00:00:00`);
      limite.setDate(limite.getDate() + 7);
      const limiteIso = `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, "0")}-${String(limite.getDate()).padStart(2, "0")}`;
      query = query.lte("proxima_renovacao", limiteIso);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ erro: error.message }, { status: 500 });
    }

    const rawAssinantes = ((data ?? []) as unknown as AssinanteRow[]).filter((item) => {
      if (!busca) return true;
      const cliente = getClienteRelation(item.clientes);
      const nome = String(cliente?.nome ?? "").toLowerCase();
      const telefone = String(cliente?.telefone ?? "");
      return nome.includes(busca) || telefone.includes(busca);
    });

    const assinantes = rawAssinantes.map((item) => ({
      ...item,
      clientes: getClienteRelation(item.clientes),
      plano_nome: planos.find((plano) => plano.id === item.plano_id)?.nome ?? item.plano_id,
    }));

    return NextResponse.json({
      hoje,
      filtros: {
        busca,
        plano_id: planoId || null,
        vencimento,
      },
      assinantes,
      notificacoes_vencimento: notificacoes,
      vencendo_hoje: vencendoHoje,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar assinaturas.";
    return NextResponse.json({ erro: message }, { status: message === "Nao autorizado" ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminSession();
    const body = await request.json();
    const acao = String(body?.acao ?? "");

    if (acao === "adicionar_plano") {
      const plano = await buscarPlanoPorId(String(body.plano_id));
      if (!plano) {
        return NextResponse.json({ erro: "Plano nao encontrado." }, { status: 404 });
      }

      const assinatura = await criarAssinatura({
        clienteId: String(body.cliente_id),
        plano,
        tipoRenovacao: body.tipo_renovacao === "automatica" ? "automatica" : "manual",
        inicioCiclo: String(body.inicio_ciclo),
        fimCiclo: String(body.fim_ciclo),
        observacoes: body.observacoes ? String(body.observacoes) : undefined,
      });

      await supabase.from("financeiro_lancamentos").insert({
        cliente_id: body.cliente_id,
        assinatura_id: assinatura.id,
        categoria_financeira: "receita_plano_mensal",
        descricao: `Adesao ao plano ${plano.nome}`,
        valor: plano.preco,
        competencia: body.inicio_ciclo,
      });

      return NextResponse.json({ assinatura });
    }

    if (acao === "renovar_plano") {
      const plano = await buscarPlanoPorId(String(body.plano_id));
      if (!plano) {
        return NextResponse.json({ erro: "Plano nao encontrado." }, { status: 404 });
      }

      const assinatura = await renovarAssinatura(String(body.assinatura_id), plano, String(body.inicio_ciclo), String(body.fim_ciclo));

      await supabase.from("financeiro_lancamentos").insert({
        cliente_id: assinatura.cliente_id,
        assinatura_id: assinatura.id,
        categoria_financeira: "receita_plano_mensal",
        descricao: `Renovacao do plano ${plano.nome}`,
        valor: plano.preco,
        competencia: body.inicio_ciclo,
      });

      return NextResponse.json({ assinatura });
    }

    if (acao === "troca_imediata") {
      const plano = await buscarPlanoPorId(String(body.plano_id));
      if (!plano) {
        return NextResponse.json({ erro: "Plano nao encontrado." }, { status: 404 });
      }

      const assinatura = await aplicarTrocaImediata(String(body.assinatura_id), plano);
      return NextResponse.json({ assinatura });
    }

    if (acao === "registrar_uso_manual") {
      const assinatura = await buscarAssinaturaAtiva(String(body.cliente_id));
      if (!assinatura) {
        return NextResponse.json({ erro: "Cliente sem assinatura ativa." }, { status: 409 });
      }

      await registrarUsoManualPlano({
        assinaturaId: assinatura.id,
        clienteId: assinatura.cliente_id,
        categoria: body.categoria,
        quantidade: Number(body.quantidade ?? 1),
        observacao: body.observacao ? String(body.observacao) : "Uso manual registrado pelo admin",
      });

      return NextResponse.json({ ok: true });
    }

    if (acao === "atualizar_observacoes") {
      const assinaturaId = String(body.assinatura_id ?? "");
      if (!assinaturaId) {
        return NextResponse.json({ erro: "assinatura_id obrigatorio." }, { status: 400 });
      }

      const assinatura = await atualizarObservacoesAssinatura(assinaturaId, body.observacoes ? String(body.observacoes) : null);
      return NextResponse.json({ assinatura });
    }

    return NextResponse.json({ erro: "Acao nao suportada." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao processar assinatura.";
    return NextResponse.json({ erro: message }, { status: message === "Nao autorizado" ? 401 : 500 });
  }
}
