import type { Servico, ServicePlanCoverage } from "@/lib/servicos";
import { getServicePlanCoverage, hasPlanCoverage } from "@/lib/servicos";
import { buscarAssinaturaAtiva, categoriaPodeUsarPlano, liquidarCreditoPlano, reservarCreditoPlano } from "@/lib/assinaturas";
import { supabase } from "@/lib/supabase";

export type AgendamentoItemPlanoDecision = {
  servico: Servico;
  tipo_cobranca: "plano" | "avulso";
  status_credito: "reservado" | "nao_aplicavel";
  assinatura_id: string | null;
  creditos_plano: ServicePlanCoverage;
};

function hasEnoughCoverage(
  saldos: Record<"corte" | "barba" | "sobrancelha", number>,
  coverage: ServicePlanCoverage
) {
  return (
    saldos.corte >= coverage.corte &&
    saldos.barba >= coverage.barba &&
    saldos.sobrancelha >= coverage.sobrancelha
  );
}

function applyCoverage(
  saldos: Record<"corte" | "barba" | "sobrancelha", number>,
  coverage: ServicePlanCoverage
) {
  saldos.corte -= coverage.corte;
  saldos.barba -= coverage.barba;
  saldos.sobrancelha -= coverage.sobrancelha;
}

function getCoverageEntries(coverage: ServicePlanCoverage) {
  return ([
    ["corte", coverage.corte],
    ["barba", coverage.barba],
    ["sobrancelha", coverage.sobrancelha],
  ] as const).filter(([, quantidade]) => quantidade > 0);
}

export function calcularValorFinalDosItens(itens: AgendamentoItemPlanoDecision[]) {
  return itens.reduce((acc, item) => acc + (item.tipo_cobranca === "avulso" ? Number(item.servico.preco ?? 0) : 0), 0);
}

export async function decidirCobrancaItens(clienteId: string, servicos: Servico[]) {
  const assinatura = await buscarAssinaturaAtiva(clienteId);

  if (!assinatura) {
    return {
      assinatura: null,
      itens: servicos.map((servico) => ({
        servico,
        tipo_cobranca: "avulso" as const,
        status_credito: "nao_aplicavel" as const,
        assinatura_id: null,
        creditos_plano: { corte: 0, barba: 0, sobrancelha: 0 },
      })),
      itensSemSaldo: [],
    };
  }

  const saldos = {
    corte: Number(assinatura.cortes_restantes),
    barba: Number(assinatura.barbas_restantes),
    sobrancelha: Number(assinatura.sobrancelhas_restantes),
  };

  const itensSemSaldo: Servico[] = [];
  const itens: AgendamentoItemPlanoDecision[] = [];

  for (const servico of servicos) {
    const coverage = getServicePlanCoverage(servico);
    if (hasPlanCoverage(servico) && hasEnoughCoverage(saldos, coverage)) {
      applyCoverage(saldos, coverage);
      itens.push({
        servico,
        tipo_cobranca: "plano",
        status_credito: "reservado",
        assinatura_id: assinatura.id,
        creditos_plano: coverage,
      });
    } else {
      if (hasPlanCoverage(servico)) {
        itensSemSaldo.push(servico);
      }
      itens.push({
        servico,
        tipo_cobranca: "avulso",
        status_credito: "nao_aplicavel",
        assinatura_id: null,
        creditos_plano: { corte: 0, barba: 0, sobrancelha: 0 },
      });
    }
  }

  return { assinatura, itens, itensSemSaldo };
}

export async function reservarCreditosDoAgendamento(clienteId: string, agendamentoId: string, itens: AgendamentoItemPlanoDecision[]) {
  for (const item of itens) {
    if (item.tipo_cobranca === "plano" && item.assinatura_id) {
      for (const [categoria, quantidade] of getCoverageEntries(item.creditos_plano)) {
        if (categoriaPodeUsarPlano(categoria)) {
          await reservarCreditoPlano({
            assinaturaId: item.assinatura_id,
            clienteId,
            categoria,
            agendamentoId,
            quantidade,
            observacao: `Reserva do servico ${item.servico.nome}`,
          });
        }
      }
    }
  }
}

export async function liquidarCreditosDoAgendamento(agendamentoId: string, tipo: "consumo_credito" | "devolucao_credito") {
  const { data: agendamento, error: agendamentoError } = await supabase
    .from("agendamentos")
    .select("id, cliente_id")
    .eq("id", agendamentoId)
    .maybeSingle();

  if (agendamentoError || !agendamento?.cliente_id) {
    if (agendamentoError) throw new Error(agendamentoError.message);
    return;
  }

  const { data: itens, error } = await supabase
    .from("agendamento_itens")
    .select("id, assinatura_id, status_credito, creditos_corte, creditos_barba, creditos_sobrancelha")
    .eq("agendamento_id", agendamentoId);

  if (error) {
    throw new Error(error.message);
  }

  for (const item of itens ?? []) {
    const coverage: ServicePlanCoverage = {
      corte: Number(item.creditos_corte ?? 0),
      barba: Number(item.creditos_barba ?? 0),
      sobrancelha: Number(item.creditos_sobrancelha ?? 0),
    };

    if (item.assinatura_id && item.status_credito === "reservado") {
      for (const [categoria, quantidade] of getCoverageEntries(coverage)) {
        if (categoriaPodeUsarPlano(categoria)) {
          await liquidarCreditoPlano({
            assinaturaId: item.assinatura_id,
            clienteId: agendamento.cliente_id,
            categoria,
            agendamentoId,
            tipo,
            quantidade,
          });
        }
      }

      await supabase
        .from("agendamento_itens")
        .update({ status_credito: tipo === "consumo_credito" ? "consumido" : "devolvido" })
        .eq("id", item.id);
    }
  }
}

export async function registrarReceitaAvulsaDoAgendamento(agendamentoId: string) {
  const { data: agendamento, error: agendamentoError } = await supabase
    .from("agendamentos")
    .select("id, cliente_id, data")
    .eq("id", agendamentoId)
    .maybeSingle();

  if (agendamentoError || !agendamento) {
    throw new Error(agendamentoError?.message || "Agendamento nao encontrado.");
  }

  const { data: itens, error } = await supabase
    .from("agendamento_itens")
    .select("servico_nome, servico_preco, tipo_cobranca")
    .eq("agendamento_id", agendamentoId)
    .eq("tipo_cobranca", "avulso");

  if (error) {
    throw new Error(error.message);
  }

  for (const item of itens ?? []) {
    const { data: existente } = await supabase
      .from("financeiro_lancamentos")
      .select("id")
      .eq("agendamento_id", agendamentoId)
      .eq("descricao", `Servico avulso: ${item.servico_nome}`)
      .maybeSingle();

    if (!existente) {
      await supabase.from("financeiro_lancamentos").insert({
        cliente_id: agendamento.cliente_id,
        agendamento_id: agendamentoId,
        categoria_financeira: "receita_servico_avulso",
        descricao: `Servico avulso: ${item.servico_nome}`,
        valor: Number(item.servico_preco ?? 0),
        competencia: agendamento.data,
      });
    }
  }
}
