"use client";

import { useEffect, useState } from "react";
import { getTodayInputValue } from "@/lib/format";
import {
  AdminActionButton,
  AdminMetric,
  AdminNotice,
  AdminPageHeading,
  AdminPanel,
} from "@/app/admin/_components/AdminUi";

type FinanceResponse = {
  escopo: "meu" | "geral";
  periodo: "dia" | "semana" | "mes";
  faixa: { inicio: string; fim: string; label: string };
  resumo: {
    receita_gerada: number;
    receita_esperada: number;
    receita_planos: number;
    receita_gerada_com_planos: number;
    receita_esperada_com_planos: number;
    concluidos: number;
    pendentes: number;
    faltas: number;
  };
  por_barbeiro: Array<{
    barbeiro_id: string;
    barbeiro_nome: string;
    receita_gerada: number;
    receita_esperada: number;
    concluidos: number;
    pendentes: number;
    faltas: number;
  }>;
  agendamentos: Array<{
    id: string;
    data: string;
    nome_cliente: string;
    servico_nome: string;
    valor_final: number;
    status_agendamento: string;
    status_atendimento: string;
    tipo_cobranca: string;
  }>;
};

export default function AdminFinanceiroPage() {
  const today = getTodayInputValue();
  const [data, setData] = useState(today);
  const [escopo, setEscopo] = useState<"meu" | "geral">("meu");
  const [periodo, setPeriodo] = useState<"dia" | "semana" | "mes">("dia");
  const [snapshot, setSnapshot] = useState<FinanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    async function carregar() {
      setLoading(true);
      setErro("");

      try {
        const params = new URLSearchParams({
          data,
          escopo,
          periodo,
        });

        const res = await fetch(`/api/admin/financeiro?${params.toString()}`, { cache: "no-store" });
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.erro || "Erro ao carregar financeiro.");
        }

        setSnapshot(json);
      } catch (error) {
        setErro(error instanceof Error ? error.message : "Erro ao carregar financeiro.");
      } finally {
        setLoading(false);
      }
    }

    void carregar();
  }, [data, escopo, periodo]);

  const resumo = snapshot?.resumo;
  const receitaPrincipal =
    escopo === "geral" && periodo === "mes"
      ? resumo?.receita_gerada_com_planos ?? 0
      : resumo?.receita_gerada ?? 0;

  const receitaEsperada =
    escopo === "geral" && periodo === "mes"
      ? resumo?.receita_esperada_com_planos ?? 0
      : resumo?.receita_esperada ?? 0;

  return (
    <>
      <AdminPageHeading
        eyebrow="Financeiro"
        title="Renda do barbeiro e visao geral"
        description="Acompanhe a renda gerada pelos atendimentos concluidos, a renda esperada dos horarios ainda pendentes e, na visao geral mensal, some tambem o valor recebido pelos planos."
      />

      <div className="mb-6 flex flex-col gap-4 rounded-[28px] border border-white/10 bg-white/[0.03] p-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <AdminActionButton type="button" tone={escopo === "meu" ? "primary" : "secondary"} onClick={() => setEscopo("meu")}>
            Meu financeiro
          </AdminActionButton>
          <AdminActionButton type="button" tone={escopo === "geral" ? "primary" : "secondary"} onClick={() => setEscopo("geral")}>
            Visao geral
          </AdminActionButton>
        </div>

        <div className="flex flex-wrap gap-2">
          <AdminActionButton type="button" tone={periodo === "dia" ? "primary" : "secondary"} onClick={() => setPeriodo("dia")}>
            Dia
          </AdminActionButton>
          <AdminActionButton type="button" tone={periodo === "semana" ? "primary" : "secondary"} onClick={() => setPeriodo("semana")}>
            Semana
          </AdminActionButton>
          <AdminActionButton type="button" tone={periodo === "mes" ? "primary" : "secondary"} onClick={() => setPeriodo("mes")}>
            Mes
          </AdminActionButton>
        </div>

        <div className="w-full max-w-xs">
          <label className="text-sm text-[var(--muted)]">Data de referencia</label>
          <input
            type="date"
            value={data}
            onChange={(event) => setData(event.target.value)}
            className="datetime-input mt-3 w-full rounded-2xl border px-4 py-3"
          />
        </div>
      </div>

      {erro ? <div className="mb-6"><AdminNotice tone="danger">{erro}</AdminNotice></div> : null}
      {loading ? <p className="mb-6 text-[var(--muted)]">Carregando financeiro...</p> : null}

      {!loading && snapshot ? (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <AdminMetric
              label="Receita gerada"
              value={receitaPrincipal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              note={snapshot.faixa.label}
            />
            <AdminMetric
              label="Receita esperada"
              value={receitaEsperada.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              note="Gerada + horarios ainda pendentes"
            />
            <AdminMetric label="Concluidos" value={String(resumo?.concluidos ?? 0)} />
            <AdminMetric label="Pendentes" value={String(resumo?.pendentes ?? 0)} />
            <AdminMetric label="Faltas" value={String(resumo?.faltas ?? 0)} />
          </div>

          {escopo === "geral" && periodo === "mes" ? (
            <div className="mb-6">
              <AdminNotice>
                Planos no mes: {(resumo?.receita_planos ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}. Nesta visao mensal geral, esse valor ja entra na receita principal.
              </AdminNotice>
            </div>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
            <AdminPanel title="Resumo por barbeiro" description="Na visao geral, voce compara o desempenho dos profissionais. Na visao individual, fica facil entender seu proprio fechamento.">
              <div className="space-y-4">
                {snapshot.por_barbeiro.map((item) => (
                  <div key={item.barbeiro_id} className="grid gap-3 rounded-[24px] border border-white/10 bg-black/20 p-4 lg:grid-cols-[1fr_auto_auto_auto] lg:items-center">
                    <div>
                      <p className="font-semibold">{item.barbeiro_nome}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        Concluidos: {item.concluidos} • Pendentes: {item.pendentes} • Faltas: {item.faltas}
                      </p>
                    </div>
                    <div className="text-sm text-[var(--muted)]">
                      Gerada
                      <p className="mt-1 text-base font-semibold text-white">
                        {item.receita_gerada.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </p>
                    </div>
                    <div className="text-sm text-[var(--muted)]">
                      Esperada
                      <p className="mt-1 text-base font-semibold text-white">
                        {item.receita_esperada.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </p>
                    </div>
                    <div className="rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.16em] text-[var(--accent-strong)]">
                      {item.pendentes > 0 ? "Com agenda ativa" : "Sem pendencia"}
                    </div>
                  </div>
                ))}
              </div>
            </AdminPanel>

            <AdminPanel title="Agendamentos considerados" description="Lista resumida do que esta entrando nas contas do periodo filtrado.">
              {snapshot.agendamentos.length === 0 ? <p className="text-[var(--muted)]">Nenhum agendamento nesse recorte.</p> : null}

              {snapshot.agendamentos.length > 0 ? (
                <div className="space-y-4">
                  {snapshot.agendamentos.slice(0, 14).map((item) => (
                    <div key={item.id} className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">{item.servico_nome}</p>
                        <span className="text-sm text-[var(--accent-strong)]">
                          {Number(item.valor_final ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-[var(--muted)]">{item.nome_cliente}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {item.data} • {item.status_atendimento === "concluido" ? "Concluido" : item.status_agendamento}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        Cobranca: {item.tipo_cobranca === "plano" ? "de graca / plano" : item.tipo_cobranca}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </AdminPanel>
          </div>
        </>
      ) : null}
    </>
  );
}
