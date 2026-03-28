import { listAllBarbeiros } from "@/lib/barbeiros";
import { supabase } from "@/lib/supabase";

export type FinancePeriod = "dia" | "semana" | "mes";
export type FinanceScope = "meu" | "geral";

type FinanceRow = {
  id: string;
  barbeiro_id: string;
  data: string;
  nome_cliente: string;
  servico_nome: string;
  valor_final: number | null;
  status_agendamento: string;
  status_atendimento: string;
  status_pagamento: string;
  tipo_cobranca: string;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function getTodaySaoPauloIso(referenceDate = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(referenceDate);
}

function parseIsoDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toIso(date: Date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function getFinanceRange(anchorDate: string, period: FinancePeriod) {
  const anchor = parseIsoDate(anchorDate);

  if (period === "dia") {
    return { inicio: anchorDate, fim: anchorDate, label: anchorDate };
  }

  if (period === "semana") {
    const day = anchor.getUTCDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(anchor);
    monday.setUTCDate(anchor.getUTCDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    return {
      inicio: toIso(monday),
      fim: toIso(sunday),
      label: `${toIso(monday)} ate ${toIso(sunday)}`,
    };
  }

  const firstDay = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
  const lastDay = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0));
  return {
    inicio: toIso(firstDay),
    fim: toIso(lastDay),
    label: `${pad(anchor.getUTCMonth() + 1)}/${anchor.getUTCFullYear()}`,
  };
}

function sumValor(rows: FinanceRow[]) {
  return rows.reduce((acc, row) => acc + Number(row.valor_final ?? 0), 0);
}

function isConcluded(row: FinanceRow) {
  return row.status_atendimento === "concluido" && row.status_pagamento === "pago";
}

function isPending(row: FinanceRow) {
  return row.status_agendamento !== "cancelado" && row.status_agendamento !== "no_show" && row.status_pagamento !== "pago";
}

function isNoShow(row: FinanceRow) {
  return row.status_agendamento === "no_show";
}

function buildMetrics(rows: FinanceRow[]) {
  const concluidos = rows.filter(isConcluded);
  const pendentes = rows.filter(isPending);
  const faltas = rows.filter(isNoShow);

  return {
    receita_gerada: sumValor(concluidos),
    receita_esperada: sumValor(concluidos) + sumValor(pendentes),
    concluidos: concluidos.length,
    pendentes: pendentes.length,
    faltas: faltas.length,
  };
}

export async function getFinanceSnapshot(params: {
  scope: FinanceScope;
  period: FinancePeriod;
  anchorDate: string;
  barbeiroId: string;
}) {
  const range = getFinanceRange(params.anchorDate, params.period);
  const barbers = await listAllBarbeiros();

  let query = supabase
    .from("agendamentos")
    .select("id, barbeiro_id, data, nome_cliente, servico_nome, valor_final, status_agendamento, status_atendimento, status_pagamento, tipo_cobranca")
    .gte("data", range.inicio)
    .lte("data", range.fim)
    .order("data", { ascending: true })
    .order("hora_inicio", { ascending: true });

  if (params.scope === "meu") {
    query = query.eq("barbeiro_id", params.barbeiroId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as FinanceRow[];
  const metrics = buildMetrics(rows);

  let receitaPlanos = 0;
  if (params.scope === "geral") {
    const { data: planosData, error: planosError } = await supabase
      .from("financeiro_lancamentos")
      .select("valor")
      .eq("categoria_financeira", "receita_plano_mensal")
      .neq("status", "estornado")
      .gte("competencia", range.inicio)
      .lte("competencia", range.fim);

    if (planosError) {
      throw new Error(planosError.message);
    }

    receitaPlanos = (planosData ?? []).reduce((acc, row) => acc + Number(row.valor ?? 0), 0);
  }

  const baseBarbers = params.scope === "meu" ? barbers.filter((barbeiro) => barbeiro.id === params.barbeiroId) : barbers;

  const porBarbeiro = baseBarbers.map((barbeiro) => {
    const barberRows = rows.filter((row) => row.barbeiro_id === barbeiro.id);
    const barberMetrics = buildMetrics(barberRows);
    return {
      barbeiro_id: barbeiro.id,
      barbeiro_nome: barbeiro.nome,
      ...barberMetrics,
    };
  });

  return {
    periodo: params.period,
    escopo: params.scope,
    referencia: params.anchorDate,
    faixa: range,
    resumo: {
      ...metrics,
      receita_planos: receitaPlanos,
      receita_gerada_com_planos: metrics.receita_gerada + receitaPlanos,
      receita_esperada_com_planos: metrics.receita_esperada + receitaPlanos,
    },
    por_barbeiro: porBarbeiro,
    agendamentos: rows,
  };
}
