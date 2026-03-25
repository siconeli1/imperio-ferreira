"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getTodayInputValue } from "@/lib/format";
import {
  AdminActionButton,
  AdminMetric,
  AdminNotice,
  AdminPageHeading,
  AdminPanel,
} from "@/app/admin/_components/AdminUi";

type AgendaItem = {
  id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  nome_cliente: string;
  celular_cliente: string;
  servico_nome: string;
  valor_final?: number;
  servico_preco?: number;
  status_agendamento?: string;
  status_atendimento?: string;
  tipo_cobranca?: string;
  origem?: "agendamento" | "horario_customizado";
};

export default function AdminAgendaPage() {
  const today = getTodayInputValue();
  const [data, setData] = useState(today);
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");

  const carregarAgenda = useCallback(async () => {
    setLoading(true);
    setErro("");

    try {
      const res = await fetch(`/api/admin-agenda?data=${encodeURIComponent(data)}`, { cache: "no-store" });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.erro || "Erro ao carregar agenda.");
      }

      setAgenda(json ?? []);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao carregar agenda.");
    } finally {
      setLoading(false);
    }
  }, [data]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void carregarAgenda();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [carregarAgenda]);

  const resumo = useMemo(() => {
    const agendamentos = agenda.filter((item) => item.origem !== "horario_customizado");
    const concluidos = agendamentos.filter((item) => item.status_atendimento === "concluido");
    const pendentes = agendamentos.filter(
      (item) =>
        item.status_atendimento !== "concluido" &&
        (item.status_agendamento === "agendado" || item.status_agendamento === "confirmado")
    );

    return {
      total: agendamentos.length,
      concluidos: concluidos.length,
      pendentes: pendentes.length,
      receitaGerada: concluidos.reduce((acc, item) => acc + Number(item.valor_final ?? 0), 0),
      receitaEsperada: pendentes.reduce((acc, item) => acc + Number(item.valor_final ?? 0), 0) + concluidos.reduce((acc, item) => acc + Number(item.valor_final ?? 0), 0),
    };
  }, [agenda]);

  async function atualizarAgendamento(id: string, payload: Record<string, string>) {
    setErro("");
    setMsg("");

    const res = await fetch("/api/admin-agenda", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...payload }),
    });
    const json = await res.json();

    if (!res.ok) {
      setErro(json.erro || "Erro ao atualizar agendamento.");
      return;
    }

    setMsg("Agenda atualizada com sucesso.");
    await carregarAgenda();
  }

  async function cancelarAgendamento(id: string) {
    setErro("");
    setMsg("");

    const res = await fetch("/api/cancelar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const json = await res.json();

    if (!res.ok) {
      setErro(json.erro || "Erro ao cancelar agendamento.");
      return;
    }

    setMsg("Agendamento cancelado.");
    await carregarAgenda();
  }

  return (
    <>
      <AdminPageHeading
        eyebrow="Agenda"
        title="Cronograma do barbeiro"
        description="Visualize seu dia de trabalho com clareza. Por padrao, a tela abre em hoje, mas voce pode trocar a data quando quiser."
        actions={
          <>
            <Link href="/admin/marcar" className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/10">
              Marcar horario
            </Link>
            <Link href="/admin/bloqueios" className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/10">
              Bloquear horario
            </Link>
          </>
        }
      />

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid gap-4 sm:grid-cols-4 lg:flex-1">
          <AdminMetric label="Agendados" value={String(resumo.total)} />
          <AdminMetric label="Pendentes" value={String(resumo.pendentes)} />
          <AdminMetric label="Concluidos" value={String(resumo.concluidos)} />
          <AdminMetric
            label="Receita do dia"
            value={resumo.receitaEsperada.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            note={`Gerada: ${resumo.receitaGerada.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}
          />
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
          <label className="text-sm text-[var(--muted)]">Dia da agenda</label>
          <input
            type="date"
            value={data}
            onChange={(event) => setData(event.target.value)}
            className="datetime-input mt-3 w-full rounded-2xl border px-4 py-3"
          />
        </div>
      </div>

      {erro ? <div className="mb-6"><AdminNotice tone="danger">{erro}</AdminNotice></div> : null}
      {msg ? <div className="mb-6"><AdminNotice tone="success">{msg}</AdminNotice></div> : null}

      <AdminPanel title="Agenda do dia" description="Tudo que e seu aparece aqui: horarios confirmados, pendentes e qualquer reserva manual legada.">
        {loading ? <p className="text-[var(--muted)]">Carregando agenda...</p> : null}

        {!loading && agenda.length === 0 ? <p className="text-[var(--muted)]">Nenhum compromisso para esta data.</p> : null}

        {!loading && agenda.length > 0 ? (
          <div className="space-y-4">
            {agenda.map((item) => {
              const isCustom = item.origem === "horario_customizado";
              const statusLabel = isCustom
                ? "Reserva manual"
                : item.status_atendimento === "concluido"
                  ? "Concluido"
                  : item.status_agendamento === "no_show"
                    ? "Nao compareceu"
                    : item.status_agendamento === "cancelado"
                      ? "Cancelado"
                      : item.status_agendamento === "confirmado"
                        ? "Confirmado"
                        : "Agendado";

              return (
                <div key={item.id} className="rounded-[24px] border border-white/10 bg-black/20 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-xl font-semibold">{item.servico_nome}</p>
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs uppercase tracking-[0.16em] text-[var(--accent-strong)]">
                          {statusLabel}
                        </span>
                        {!isCustom && item.tipo_cobranca === "plano" ? (
                          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-emerald-200">
                            Plano
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-[var(--muted)]">
                        {item.nome_cliente} • {item.celular_cliente || "sem celular"}
                      </p>
                      <p className="text-sm text-[var(--muted)]">
                        {item.hora_inicio.slice(0, 5)} - {item.hora_fim.slice(0, 5)}
                      </p>
                      {!isCustom ? (
                        <p className="text-sm text-[var(--muted)]">
                          Valor: {Number(item.valor_final ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </p>
                      ) : null}
                    </div>

                    {!isCustom ? (
                      <div className="flex flex-wrap gap-2">
                        {item.status_atendimento !== "concluido" && item.status_agendamento !== "cancelado" ? (
                          <AdminActionButton onClick={() => atualizarAgendamento(item.id, { status_atendimento: "concluido", status_pagamento: "pago" })}>
                            Concluir
                          </AdminActionButton>
                        ) : null}
                        {item.status_agendamento !== "no_show" && item.status_atendimento !== "concluido" ? (
                          <AdminActionButton tone="secondary" onClick={() => atualizarAgendamento(item.id, { status_agendamento: "no_show" })}>
                            Marcar falta
                          </AdminActionButton>
                        ) : null}
                        {item.status_agendamento !== "cancelado" ? (
                          <AdminActionButton tone="danger" onClick={() => cancelarAgendamento(item.id)}>
                            Cancelar
                          </AdminActionButton>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </AdminPanel>
    </>
  );
}
