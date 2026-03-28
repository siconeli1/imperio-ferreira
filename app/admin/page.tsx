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
  AdminScopeNotice,
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
  status_pagamento?: string;
  tipo_cobranca?: string;
  origem?: "agendamento" | "horario_customizado";
};

type AdminMeResponse = {
  barbeiro: {
    id: string;
    nome: string;
    cargo: "socio" | "barbeiro";
  };
};

type BarbeiroOption = {
  id: string;
  nome: string;
};

export default function AdminAgendaPage() {
  const today = getTodayInputValue();
  const [data, setData] = useState(today);
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [adminCargo, setAdminCargo] = useState<"socio" | "barbeiro" | "">("");
  const [barbeiros, setBarbeiros] = useState<BarbeiroOption[]>([]);
  const [barbeiroId, setBarbeiroId] = useState("");
  const [contextLoading, setContextLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");

  const carregarContexto = useCallback(async () => {
    setContextLoading(true);
    setErro("");

    try {
      const adminRes = await fetch("/api/admin/me", { cache: "no-store" });
      const adminJson = (await adminRes.json()) as AdminMeResponse & { erro?: string };

      if (!adminRes.ok) {
        throw new Error(adminJson.erro || "Erro ao carregar sessao administrativa.");
      }

      const admin = adminJson.barbeiro;
      setAdminCargo(admin.cargo);

      if (admin.cargo === "socio") {
        const barbeirosRes = await fetch("/api/barbeiros", { cache: "no-store" });
        const barbeirosJson = (await barbeirosRes.json()) as { barbeiros?: BarbeiroOption[]; erro?: string };

        if (!barbeirosRes.ok) {
          throw new Error(barbeirosJson.erro || "Erro ao carregar barbeiros.");
        }

        const options = barbeirosJson.barbeiros ?? [];
        setBarbeiros(options);
        setBarbeiroId((current) => current || admin.id);
      } else {
        setBarbeiros([{ id: admin.id, nome: admin.nome }]);
        setBarbeiroId(admin.id);
      }
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao preparar a agenda.");
    } finally {
      setContextLoading(false);
    }
  }, []);

  const carregarAgenda = useCallback(async () => {
    if (contextLoading) {
      return;
    }

    if (!barbeiroId) {
      setAgenda([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErro("");

    try {
      const search = new URLSearchParams({ data, barbeiro_id: barbeiroId });
      const res = await fetch(`/api/admin-agenda?${search.toString()}`, { cache: "no-store" });
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
  }, [barbeiroId, contextLoading, data]);

  useEffect(() => {
    void carregarContexto();
  }, [carregarContexto]);

  useEffect(() => {
    void carregarAgenda();
  }, [carregarAgenda]);

  const resumo = useMemo(() => {
    const agendamentos = agenda.filter((item) => item.origem !== "horario_customizado");
    const concluidos = agendamentos.filter(
      (item) => item.status_atendimento === "concluido" && item.status_pagamento === "pago"
    );
    const pendentes = agendamentos.filter(
      (item) =>
        item.status_agendamento !== "cancelado" &&
        item.status_agendamento !== "no_show" &&
        item.status_pagamento !== "pago"
    );

    return {
      total: agendamentos.length,
      concluidos: agendamentos.filter((item) => item.status_atendimento === "concluido").length,
      pendentes: pendentes.length,
      receitaGerada: concluidos.reduce((acc, item) => acc + Number(item.valor_final ?? 0), 0),
      receitaEsperada:
        pendentes.reduce((acc, item) => acc + Number(item.valor_final ?? 0), 0) +
        concluidos.reduce((acc, item) => acc + Number(item.valor_final ?? 0), 0),
    };
  }, [agenda]);

  const barbeiroSelecionado = useMemo(
    () => barbeiros.find((item) => item.id === barbeiroId) ?? null,
    [barbeiroId, barbeiros]
  );

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
    if (!window.confirm("Cancelar este agendamento agora? Essa acao afeta a agenda e pode devolver credito de plano.")) {
      return;
    }

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
        title="Agenda do dia"
        description="Veja seus atendimentos da data selecionada, acompanhe atendimento e pagamento separadamente e aja sem sair da tela."
        actions={
          <>
            <Link href="/admin/marcar" className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/10">
              Marcar horario
            </Link>
            <Link href="/admin/bloqueios" className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/10">
              Bloqueios
            </Link>
          </>
        }
      />

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid gap-4 sm:grid-cols-4 lg:flex-1">
          <AdminMetric label="Agendados" value={String(resumo.total)} />
          <AdminMetric label="A receber" value={String(resumo.pendentes)} />
          <AdminMetric label="Concluidos" value={String(resumo.concluidos)} />
          <AdminMetric
            label="Receita prevista"
            value={resumo.receitaEsperada.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            note={`Recebida: ${resumo.receitaGerada.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}
          />
        </div>

        <div className="grid gap-4 rounded-[28px] border border-white/10 bg-white/[0.03] p-5 sm:grid-cols-2">
          <label className="text-sm text-[var(--muted)]">Dia da agenda</label>
          <input
            type="date"
            value={data}
            onChange={(event) => setData(event.target.value)}
            className="datetime-input w-full rounded-2xl border px-4 py-3"
          />
          {adminCargo === "socio" ? (
            <>
              <label className="text-sm text-[var(--muted)] sm:col-start-2 sm:row-start-1">Barbeiro</label>
              <select
                value={barbeiroId}
                onChange={(event) => setBarbeiroId(event.target.value)}
                className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white sm:col-start-2"
              >
                {barbeiros.map((barbeiro) => (
                  <option key={barbeiro.id} value={barbeiro.id}>
                    {barbeiro.nome}
                  </option>
                ))}
              </select>
            </>
          ) : null}
        </div>
      </div>

      {erro ? <div className="mb-6"><AdminNotice tone="danger">{erro}</AdminNotice></div> : null}
      {msg ? <div className="mb-6"><AdminNotice tone="success">{msg}</AdminNotice></div> : null}
      {adminCargo === "socio" && barbeiroSelecionado ? (
        <div className="mb-6">
          <AdminScopeNotice
            title={`Voce esta gerenciando a agenda de ${barbeiroSelecionado.nome}.`}
            description="Todas as acoes desta tela vao valer para o barbeiro selecionado. Revise esse contexto antes de concluir, marcar falta ou cancelar."
          />
        </div>
      ) : null}

        <AdminPanel title="Compromissos da data" description="Aqui ficam seus agendamentos e reservas manuais da data escolhida, organizados em uma unica lista.">
        {contextLoading || loading ? <p className="text-[var(--muted)]">Carregando agenda...</p> : null}

        {!contextLoading && !loading && agenda.length === 0 ? <p className="text-[var(--muted)]">Nenhum compromisso para esta data.</p> : null}

        {!contextLoading && !loading && agenda.length > 0 ? (
          <div className="space-y-4">
            {agenda.map((item) => {
              const isCustom = item.origem === "horario_customizado";
              const statusLabel = isCustom
                ? "Reserva manual"
                : item.status_atendimento === "concluido"
                  ? "Concluído"
                  : item.status_agendamento === "no_show"
                    ? "Não compareceu"
                    : item.status_agendamento === "cancelado"
                      ? "Cancelado"
                      : item.status_agendamento === "confirmado"
                        ? "Confirmado"
                        : "Agendado";

              const pagamentoLabel = item.status_pagamento === "pago" ? "Pago" : "Pendente";
              const podeMarcarPago =
                !isCustom &&
                item.status_agendamento !== "cancelado" &&
                item.status_agendamento !== "no_show" &&
                item.status_atendimento === "concluido" &&
                item.status_pagamento !== "pago";

              return (
                <div key={item.id} className="rounded-[24px] border border-white/10 bg-black/20 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-xl font-semibold">{item.servico_nome}</p>
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs uppercase tracking-[0.16em] text-[var(--accent-strong)]">
                          {statusLabel}
                        </span>
                        {!isCustom ? (
                          <span
                            className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.16em] ${
                              item.status_pagamento === "pago"
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                                : "border-amber-500/30 bg-amber-500/10 text-amber-100"
                            }`}
                          >
                            {pagamentoLabel}
                          </span>
                        ) : null}
                        {!isCustom && item.tipo_cobranca === "plano" ? (
                          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-emerald-200">
                            Plano
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-[var(--muted)]">
                        {item.nome_cliente} - {item.celular_cliente || "sem celular"}
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
                          <AdminActionButton onClick={() => atualizarAgendamento(item.id, { status_atendimento: "concluido" })}>
                            Concluir
                          </AdminActionButton>
                        ) : null}
                        {podeMarcarPago ? (
                          <AdminActionButton tone="secondary" onClick={() => atualizarAgendamento(item.id, { status_pagamento: "pago" })}>
                            Marcar como pago
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

