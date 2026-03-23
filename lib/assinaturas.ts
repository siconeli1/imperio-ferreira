import { supabase } from "@/lib/supabase";
import type { Plano } from "@/lib/planos";

export type AssinaturaAtiva = {
  id: string;
  cliente_id: string;
  plano_id: string;
  status: "ativo" | "cancelado" | "expirado";
  tipo_renovacao: "manual" | "automatica";
  inicio_ciclo: string;
  fim_ciclo: string;
  proxima_renovacao: string;
  cortes_totais: number;
  cortes_restantes: number;
  cortes_reservados: number;
  barbas_totais: number;
  barbas_restantes: number;
  barbas_reservadas: number;
  sobrancelhas_totais: number;
  sobrancelhas_restantes: number;
  sobrancelhas_reservadas: number;
  observacoes_internas: string | null;
  ultimo_alerta_vencimento_em?: string | null;
};

export type CategoriaPlano = "corte" | "barba" | "sobrancelha";
export type TipoMovimentacaoPlano =
  | "reserva_credito"
  | "consumo_credito"
  | "devolucao_credito"
  | "renovacao"
  | "troca_imediata"
  | "uso_manual";

export type AssinaturaMovimentacao = {
  id: string;
  assinatura_id: string;
  cliente_id: string;
  categoria_servico: string;
  tipo_movimentacao: TipoMovimentacaoPlano;
  quantidade: number;
  agendamento_id: string | null;
  observacao: string | null;
  created_at: string;
};

type ClienteNotificacao = {
  nome?: string;
  telefone?: string;
} | null;

type AssinaturaNotificacao = {
  id: string;
  cliente_id: string;
  plano_id: string;
  status: "ativo" | "cancelado" | "expirado";
  tipo_renovacao: "manual" | "automatica";
  inicio_ciclo: string;
  fim_ciclo: string;
  proxima_renovacao: string;
  ultimo_alerta_vencimento_em?: string | null;
  clientes?: ClienteNotificacao | ClienteNotificacao[] | null;
};

function addDays(dateIso: string, days: number) {
  const [year, month, day] = dateIso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function diffDaysInclusive(startIso: string, endIso: string) {
  const [startYear, startMonth, startDay] = startIso.split("-").map(Number);
  const [endYear, endMonth, endDay] = endIso.split("-").map(Number);
  const start = Date.UTC(startYear, startMonth - 1, startDay);
  const end = Date.UTC(endYear, endMonth - 1, endDay);
  return Math.max(1, Math.floor((end - start) / 86400000) + 1);
}

function getTodaySaoPauloIso(referenceDate = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(referenceDate);
}

export async function buscarAssinaturaAtiva(clienteId: string) {
  await sincronizarAssinaturas();

  const { data, error } = await supabase
    .from("assinaturas")
    .select("*")
    .eq("cliente_id", clienteId)
    .eq("status", "ativo")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as AssinaturaAtiva | null;
}

export async function buscarAssinaturaPorId(assinaturaId: string) {
  const { data, error } = await supabase
    .from("assinaturas")
    .select("*")
    .eq("id", assinaturaId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as AssinaturaAtiva | null;
}

export async function listarMovimentacoesAssinatura(assinaturaId: string) {
  const { data, error } = await supabase
    .from("assinatura_movimentacoes")
    .select("*")
    .eq("assinatura_id", assinaturaId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as AssinaturaMovimentacao[];
}

export async function listarMovimentacoesCliente(clienteId: string) {
  const { data, error } = await supabase
    .from("assinatura_movimentacoes")
    .select("*")
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as AssinaturaMovimentacao[];
}

async function registrarMovimentacaoAssinatura(params: {
  assinaturaId: string;
  clienteId: string;
  categoriaServico?: string;
  tipoMovimentacao: TipoMovimentacaoPlano;
  quantidade?: number;
  agendamentoId?: string | null;
  observacao?: string | null;
}) {
  const { error } = await supabase.from("assinatura_movimentacoes").insert({
    assinatura_id: params.assinaturaId,
    cliente_id: params.clienteId,
    categoria_servico: params.categoriaServico ?? "outro",
    tipo_movimentacao: params.tipoMovimentacao,
    quantidade: params.quantidade ?? 1,
    agendamento_id: params.agendamentoId ?? null,
    observacao: params.observacao ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function sincronizarAssinaturas(referenceDate = new Date()) {
  const hoje = getTodaySaoPauloIso(referenceDate);

  const { data, error } = await supabase
    .from("assinaturas")
    .select("*")
    .eq("status", "ativo")
    .order("proxima_renovacao", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const assinaturas = (data ?? []) as AssinaturaAtiva[];

  for (const assinatura of assinaturas) {
    if (assinatura.tipo_renovacao === "manual" && assinatura.fim_ciclo < hoje) {
      const { error: updateError } = await supabase
        .from("assinaturas")
        .update({ status: "expirado" })
        .eq("id", assinatura.id);

      if (updateError) {
        throw new Error(updateError.message);
      }
      continue;
    }

    if (assinatura.tipo_renovacao === "automatica" && assinatura.fim_ciclo < hoje) {
      const { data: plano, error: planoError } = await supabase
        .from("planos")
        .select("*")
        .eq("id", assinatura.plano_id)
        .maybeSingle();

      if (planoError || !plano) {
        throw new Error(planoError?.message || "Plano da assinatura nao encontrado.");
      }

      const duracaoCiclo = diffDaysInclusive(assinatura.inicio_ciclo, assinatura.fim_ciclo);
      const novoInicio = addDays(assinatura.fim_ciclo, 1);
      const novoFim = addDays(novoInicio, duracaoCiclo - 1);

      const { error: updateError } = await supabase
        .from("assinaturas")
        .update({
          status: "ativo",
          inicio_ciclo: novoInicio,
          fim_ciclo: novoFim,
          proxima_renovacao: novoFim,
          cortes_totais: plano.cortes_incluidos,
          cortes_restantes: plano.cortes_incluidos,
          cortes_reservados: 0,
          barbas_totais: plano.barbas_incluidas,
          barbas_restantes: plano.barbas_incluidas,
          barbas_reservadas: 0,
          sobrancelhas_totais: plano.sobrancelhas_incluidas,
          sobrancelhas_restantes: plano.sobrancelhas_incluidas,
          sobrancelhas_reservadas: 0,
        })
        .eq("id", assinatura.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      await registrarMovimentacaoAssinatura({
        assinaturaId: assinatura.id,
        clienteId: assinatura.cliente_id,
        tipoMovimentacao: "renovacao",
        observacao: `Renovacao automatica do plano ${plano.nome} para o ciclo ${novoInicio} ate ${novoFim}`,
      });
    }
  }
}

export async function listarNotificacoesAssinatura(referenceDate = new Date()) {
  await sincronizarAssinaturas(referenceDate);

  const hoje = getTodaySaoPauloIso(referenceDate);
  const proximos3 = addDays(hoje, 3);

  const { data, error } = await supabase
    .from("assinaturas")
    .select("id, cliente_id, plano_id, status, tipo_renovacao, inicio_ciclo, fim_ciclo, proxima_renovacao, ultimo_alerta_vencimento_em, clientes(nome, telefone)")
    .eq("status", "ativo")
    .lte("proxima_renovacao", proximos3)
    .order("proxima_renovacao", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const notificacoes = ((data ?? []) as unknown as AssinaturaNotificacao[]).map((item) => ({
    ...item,
    clientes: Array.isArray(item.clientes) ? (item.clientes[0] ?? null) : (item.clientes ?? null),
  }));
  const vencendoHoje = notificacoes.filter((item) => item.proxima_renovacao === hoje);

  for (const item of vencendoHoje) {
    if (item.ultimo_alerta_vencimento_em !== hoje) {
      const { error: updateError } = await supabase
        .from("assinaturas")
        .update({ ultimo_alerta_vencimento_em: hoje })
        .eq("id", item.id);

      if (updateError) {
        throw new Error(updateError.message);
      }
    }
  }

  return {
    hoje,
    notificacoes,
    vencendoHoje,
  };
}

export function categoriaPodeUsarPlano(categoria: string): categoria is CategoriaPlano {
  return categoria === "corte" || categoria === "barba" || categoria === "sobrancelha";
}

function getCamposPorCategoria(categoria: CategoriaPlano) {
  if (categoria === "corte") {
    return { restante: "cortes_restantes", reservado: "cortes_reservados" } as const;
  }
  if (categoria === "barba") {
    return { restante: "barbas_restantes", reservado: "barbas_reservadas" } as const;
  }
  return { restante: "sobrancelhas_restantes", reservado: "sobrancelhas_reservadas" } as const;
}

export async function reservarCreditoPlano(params: {
  assinaturaId: string;
  clienteId: string;
  categoria: CategoriaPlano;
  agendamentoId: string;
  quantidade?: number;
  observacao?: string;
}) {
  const quantidade = params.quantidade ?? 1;
  const assinatura = await buscarAssinaturaAtiva(params.clienteId);

  if (!assinatura || assinatura.id !== params.assinaturaId) {
    throw new Error("Assinatura ativa nao encontrada.");
  }

  const campos = getCamposPorCategoria(params.categoria);
  const restanteAtual = Number(assinatura[campos.restante]);
  const reservadoAtual = Number(assinatura[campos.reservado]);

  if (restanteAtual < quantidade) {
    throw new Error("Saldo insuficiente no plano.");
  }

  const patch: Record<string, number> = {};
  patch[campos.restante] = restanteAtual - quantidade;
  patch[campos.reservado] = reservadoAtual + quantidade;

  const { error: updateError } = await supabase
    .from("assinaturas")
    .update(patch)
    .eq("id", assinatura.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  await registrarMovimentacaoAssinatura({
    assinaturaId: assinatura.id,
    clienteId: params.clienteId,
    categoriaServico: params.categoria,
    tipoMovimentacao: "reserva_credito",
    quantidade,
    agendamentoId: params.agendamentoId,
    observacao: params.observacao ?? null,
  });
}

export async function liquidarCreditoPlano(params: {
  assinaturaId: string;
  clienteId: string;
  categoria: CategoriaPlano;
  agendamentoId: string;
  tipo: "consumo_credito" | "devolucao_credito";
  quantidade?: number;
  observacao?: string;
}) {
  const quantidade = params.quantidade ?? 1;
  const assinatura = await buscarAssinaturaAtiva(params.clienteId);

  if (!assinatura || assinatura.id !== params.assinaturaId) {
    throw new Error("Assinatura ativa nao encontrada.");
  }

  const campos = getCamposPorCategoria(params.categoria);
  const restanteAtual = Number(assinatura[campos.restante]);
  const reservadoAtual = Number(assinatura[campos.reservado]);

  if (reservadoAtual < quantidade) {
    throw new Error("Nao ha creditos reservados suficientes.");
  }

  const patch: Record<string, number> = {};
  patch[campos.reservado] = reservadoAtual - quantidade;
  patch[campos.restante] = params.tipo === "devolucao_credito" ? restanteAtual + quantidade : restanteAtual;

  const { error: updateError } = await supabase
    .from("assinaturas")
    .update(patch)
    .eq("id", assinatura.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  await registrarMovimentacaoAssinatura({
    assinaturaId: assinatura.id,
    clienteId: params.clienteId,
    categoriaServico: params.categoria,
    tipoMovimentacao: params.tipo,
    quantidade,
    agendamentoId: params.agendamentoId,
    observacao: params.observacao ?? null,
  });
}

export async function registrarUsoManualPlano(params: {
  assinaturaId: string;
  clienteId: string;
  categoria: CategoriaPlano;
  quantidade?: number;
  observacao?: string;
}) {
  const quantidade = params.quantidade ?? 1;
  const assinatura = await buscarAssinaturaAtiva(params.clienteId);

  if (!assinatura || assinatura.id !== params.assinaturaId) {
    throw new Error("Assinatura ativa nao encontrada.");
  }

  const campos = getCamposPorCategoria(params.categoria);
  const restanteAtual = Number(assinatura[campos.restante]);

  if (restanteAtual < quantidade) {
    throw new Error("Saldo insuficiente no plano para registrar uso manual.");
  }

  const patch: Record<string, number> = {};
  patch[campos.restante] = restanteAtual - quantidade;

  const { error: updateError } = await supabase
    .from("assinaturas")
    .update(patch)
    .eq("id", assinatura.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  await registrarMovimentacaoAssinatura({
    assinaturaId: assinatura.id,
    clienteId: params.clienteId,
    categoriaServico: params.categoria,
    tipoMovimentacao: "uso_manual",
    quantidade,
    observacao: params.observacao ?? null,
  });
}

export async function criarAssinatura(params: {
  clienteId: string;
  plano: Plano;
  tipoRenovacao: "manual" | "automatica";
  inicioCiclo: string;
  fimCiclo: string;
  observacoes?: string;
}) {
  const assinaturaAtual = await buscarAssinaturaAtiva(params.clienteId);
  if (assinaturaAtual) {
    throw new Error("Cliente ja possui um plano ativo.");
  }

  const payload = {
    cliente_id: params.clienteId,
    plano_id: params.plano.id,
    status: "ativo",
    tipo_renovacao: params.tipoRenovacao,
    inicio_ciclo: params.inicioCiclo,
    fim_ciclo: params.fimCiclo,
    proxima_renovacao: params.fimCiclo,
    cortes_totais: params.plano.cortes_incluidos,
    cortes_restantes: params.plano.cortes_incluidos,
    cortes_reservados: 0,
    barbas_totais: params.plano.barbas_incluidas,
    barbas_restantes: params.plano.barbas_incluidas,
    barbas_reservadas: 0,
    sobrancelhas_totais: params.plano.sobrancelhas_incluidas,
    sobrancelhas_restantes: params.plano.sobrancelhas_incluidas,
    sobrancelhas_reservadas: 0,
    observacoes_internas: params.observacoes ?? null,
  };

  const { data, error } = await supabase.from("assinaturas").insert(payload).select("*").single();
  if (error) {
    throw new Error(error.message);
  }

  await registrarMovimentacaoAssinatura({
    assinaturaId: data.id,
    clienteId: params.clienteId,
    tipoMovimentacao: "renovacao",
    observacao: `Ativacao inicial do plano ${params.plano.nome}`,
  });

  return data as AssinaturaAtiva;
}

export async function renovarAssinatura(assinaturaId: string, plano: Plano, inicioCiclo: string, fimCiclo: string) {
  const { data: assinatura, error: assinaturaError } = await supabase
    .from("assinaturas")
    .select("*")
    .eq("id", assinaturaId)
    .maybeSingle();

  if (assinaturaError || !assinatura) {
    throw new Error(assinaturaError?.message || "Assinatura nao encontrada.");
  }

  const patch = {
    inicio_ciclo: inicioCiclo,
    fim_ciclo: fimCiclo,
    proxima_renovacao: fimCiclo,
    cortes_totais: plano.cortes_incluidos,
    cortes_restantes: plano.cortes_incluidos,
    cortes_reservados: 0,
    barbas_totais: plano.barbas_incluidas,
    barbas_restantes: plano.barbas_incluidas,
    barbas_reservadas: 0,
    sobrancelhas_totais: plano.sobrancelhas_incluidas,
    sobrancelhas_restantes: plano.sobrancelhas_incluidas,
    sobrancelhas_reservadas: 0,
    status: "ativo",
    plano_id: plano.id,
    observacoes_internas: assinatura.observacoes_internas ?? null,
  };

  const { data, error } = await supabase
    .from("assinaturas")
    .update(patch)
    .eq("id", assinaturaId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await registrarMovimentacaoAssinatura({
    assinaturaId,
    clienteId: assinatura.cliente_id,
    tipoMovimentacao: "renovacao",
    observacao: `Renovacao manual do plano ${plano.nome} para o ciclo ${inicioCiclo} ate ${fimCiclo}`,
  });

  return data as AssinaturaAtiva;
}

export async function aplicarTrocaImediata(assinaturaId: string, plano: Plano) {
  const { data: assinatura, error: assinaturaError } = await supabase
    .from("assinaturas")
    .select("*")
    .eq("id", assinaturaId)
    .maybeSingle();

  if (assinaturaError || !assinatura) {
    throw new Error(assinaturaError?.message || "Assinatura nao encontrada.");
  }

  const patch = {
    plano_id: plano.id,
    cortes_totais: Number(assinatura.cortes_totais ?? 0) + plano.cortes_incluidos,
    cortes_restantes: Number(assinatura.cortes_restantes ?? 0) + plano.cortes_incluidos,
    barbas_totais: Number(assinatura.barbas_totais ?? 0) + plano.barbas_incluidas,
    barbas_restantes: Number(assinatura.barbas_restantes ?? 0) + plano.barbas_incluidas,
    sobrancelhas_totais: Number(assinatura.sobrancelhas_totais ?? 0) + plano.sobrancelhas_incluidas,
    sobrancelhas_restantes: Number(assinatura.sobrancelhas_restantes ?? 0) + plano.sobrancelhas_incluidas,
  };

  const { data, error } = await supabase
    .from("assinaturas")
    .update(patch)
    .eq("id", assinaturaId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await registrarMovimentacaoAssinatura({
    assinaturaId,
    clienteId: assinatura.cliente_id,
    tipoMovimentacao: "troca_imediata",
    observacao: `Troca imediata para o plano ${plano.nome}`,
  });

  return data as AssinaturaAtiva;
}

export async function atualizarObservacoesAssinatura(assinaturaId: string, observacoes: string | null) {
  const { data, error } = await supabase
    .from("assinaturas")
    .update({ observacoes_internas: observacoes })
    .eq("id", assinaturaId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as AssinaturaAtiva;
}

export async function cancelarAssinatura(assinaturaId: string) {
  const { data, error } = await supabase
    .from("assinaturas")
    .update({ status: "cancelado", cancelado_em: new Date().toISOString() })
    .eq("id", assinaturaId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as AssinaturaAtiva;
}
