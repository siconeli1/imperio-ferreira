"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getTodayInputValue } from "@/lib/format";

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
  origem?: "agendamento" | "horario_customizado";
};

type Bloqueio = {
  id: string;
  data: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  tipo_bloqueio: "horario" | "dia_inteiro" | "nao_aceitar_mais";
  motivo: string | null;
};

type HorarioCustomizado = {
  id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  nome_cliente: string | null;
  celular_cliente: string | null;
};

type BarbeiroLogado = {
  id: string;
  nome: string;
  login: string;
};

const TABS = [
  { id: "hoje", label: "Hoje" },
  { id: "agenda", label: "Agenda" },
  { id: "bloqueios", label: "Bloqueios" },
  { id: "horarios", label: "Horarios personalizados" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function AdminPage() {
  const today = getTodayInputValue();
  const [tab, setTab] = useState<TabId>("hoje");
  const [barbeiro, setBarbeiro] = useState<BarbeiroLogado | null>(null);
  const [dataAgenda, setDataAgenda] = useState(today);
  const [dataRangeInicio, setDataRangeInicio] = useState(today);
  const [dataRangeFim, setDataRangeFim] = useState(today);
  const [dataBloqueio] = useState(today);
  const [dataHorario] = useState(today);
  const [agendaDia, setAgendaDia] = useState<AgendaItem[]>([]);
  const [agendaFaixa, setAgendaFaixa] = useState<AgendaItem[]>([]);
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([]);
  const [horarios, setHorarios] = useState<HorarioCustomizado[]>([]);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const metricasHoje = useMemo(() => {
    const reais = agendaDia.filter((item) => item.origem !== "horario_customizado");
    const receita = reais.reduce((acc, item) => acc + Number(item.valor_final ?? item.servico_preco ?? 0), 0);
    return {
      agendados: reais.length,
      personalizados: agendaDia.filter((item) => item.origem === "horario_customizado").length,
      receita,
    };
  }, [agendaDia]);

  useEffect(() => {
    async function carregar() {
      setLoading(true);
      setErro("");

      try {
        const [meRes, diaRes, faixaRes, bloqueiosRes, horariosRes] = await Promise.all([
          fetch("/api/admin/me"),
          fetch(`/api/admin-agenda?data=${encodeURIComponent(dataAgenda)}`),
          fetch(`/api/admin-agenda?date_from=${encodeURIComponent(dataRangeInicio)}&date_to=${encodeURIComponent(dataRangeFim)}`),
          fetch(`/api/bloqueios?data=${encodeURIComponent(dataBloqueio)}`),
          fetch(`/api/horarios-customizados?data=${encodeURIComponent(dataHorario)}`),
        ]);

        const [meJson, diaJson, faixaJson, bloqueiosJson, horariosJson] = await Promise.all([
          meRes.json(),
          diaRes.json(),
          faixaRes.json(),
          bloqueiosRes.json(),
          horariosRes.json(),
        ]);

        if (!meRes.ok) throw new Error(meJson.erro || "Erro ao carregar barbeiro.");
        if (!diaRes.ok) throw new Error(diaJson.erro || "Erro ao carregar agenda do dia.");
        if (!faixaRes.ok) throw new Error(faixaJson.erro || "Erro ao carregar agenda.");
        if (!bloqueiosRes.ok) throw new Error(bloqueiosJson.erro || "Erro ao carregar bloqueios.");
        if (!horariosRes.ok) throw new Error(horariosJson.erro || "Erro ao carregar horarios.");

        setBarbeiro(meJson.barbeiro);
        setAgendaDia(diaJson);
        setAgendaFaixa(faixaJson);
        setBloqueios(bloqueiosJson.bloqueios ?? []);
        setHorarios(horariosJson.horarios ?? []);
      } catch (error) {
        setErro(error instanceof Error ? error.message : "Erro ao carregar dados.");
      } finally {
        setLoading(false);
      }
    }

    void carregar();
  }, [dataAgenda, dataBloqueio, dataHorario, dataRangeFim, dataRangeInicio, reloadToken]);

  async function atualizarStatus(id: string, payload: Record<string, string>) {
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
    setReloadToken((value) => value + 1);
  }

  async function cancelar(id: string) {
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
    setReloadToken((value) => value + 1);
  }

  async function sair() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  async function criarBloqueio(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const res = await fetch("/api/bloqueios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: form.get("data"),
        tipo_bloqueio: form.get("tipo_bloqueio"),
        hora_inicio: form.get("hora_inicio"),
        hora_fim: form.get("hora_fim"),
        dia_inteiro: form.get("tipo_bloqueio") === "dia_inteiro",
        motivo: form.get("motivo"),
      }),
    });
    const json = await res.json();

    if (!res.ok) {
      setErro(json.erro || "Erro ao criar bloqueio.");
      return;
    }

    setMsg("Bloqueio criado.");
    setReloadToken((value) => value + 1);
    event.currentTarget.reset();
  }

  async function removerBloqueio(id: string) {
    const res = await fetch("/api/bloqueios", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const json = await res.json();

    if (!res.ok) {
      setErro(json.erro || "Erro ao remover bloqueio.");
      return;
    }

    setMsg("Bloqueio removido.");
    setReloadToken((value) => value + 1);
  }

  async function criarHorario(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const res = await fetch("/api/horarios-customizados", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: form.get("data"),
        hora_inicio: form.get("hora_inicio"),
        hora_fim: form.get("hora_fim"),
        nome_cliente: form.get("nome_cliente"),
        celular_cliente: form.get("celular_cliente"),
      }),
    });
    const json = await res.json();

    if (!res.ok) {
      setErro(json.erro || "Erro ao salvar horario.");
      return;
    }

    setMsg("Horario personalizado salvo.");
    setReloadToken((value) => value + 1);
    event.currentTarget.reset();
  }

  async function removerHorario(id: string) {
    const res = await fetch("/api/horarios-customizados", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const json = await res.json();

    if (!res.ok) {
      setErro(json.erro || "Erro ao remover horario.");
      return;
    }

    setMsg("Horario removido.");
    setReloadToken((value) => value + 1);
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 grid gap-4 border border-white/10 bg-white/[0.03] p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.26em] text-[var(--accent-strong)]">Area administrativa</p>
            <h1 className="mt-3 text-3xl font-semibold">{barbeiro?.nome ?? "Carregando barbeiro..."}</h1>
            <p className="mt-2 text-[var(--muted)]">Login individual: {barbeiro?.login ?? "-"}</p>
            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              <Link href="/admin/clientes" className="border border-white/20 px-4 py-2 font-semibold hover:bg-white/10">
                Clientes
              </Link>
              <Link href="/admin/assinaturas" className="border border-white/20 px-4 py-2 font-semibold hover:bg-white/10">
                Assinaturas
              </Link>
            </div>
          </div>
          <button type="button" onClick={sair} className="border border-white/20 px-5 py-3 font-semibold hover:bg-white/10">
            Sair
          </button>
        </header>

        {erro && <div className="mb-6 border border-red-700 bg-red-950/60 px-4 py-3 text-red-200">{erro}</div>}
        {msg && <div className="mb-6 border border-emerald-700 bg-emerald-950/40 px-4 py-3 text-emerald-200">{msg}</div>}

        <div className="mb-8 flex flex-wrap gap-3">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`px-5 py-3 font-semibold ${tab === item.id ? "bg-[var(--accent)] text-black" : "border border-white/15 bg-white/[0.03] hover:bg-white/10"}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {loading && <p className="text-[var(--muted)]">Carregando dados...</p>}

        {!loading && tab === "hoje" && (
          <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <MetricCard title="Agendados" value={String(metricasHoje.agendados)} />
                <MetricCard title="Personalizados" value={String(metricasHoje.personalizados)} />
                <MetricCard title="Receita prevista" value={metricasHoje.receita.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
              </div>

              <section className="border border-white/10 bg-white/[0.03] p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Agenda do dia</h2>
                  <input type="date" value={dataAgenda} onChange={(event) => setDataAgenda(event.target.value)} className="datetime-input rounded-xl border px-4 py-2" />
                </div>
                <div className="space-y-3">
                  {agendaDia.length === 0 && <p className="text-[var(--muted)]">Nenhum compromisso para esta data.</p>}
                  {agendaDia.map((item) => (
                    <div key={item.id} className="border border-white/10 bg-black/25 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-lg font-semibold">{item.servico_nome}</p>
                          <p className="mt-2 text-[var(--muted)]">{item.nome_cliente} • {item.celular_cliente}</p>
                          <p className="mt-2 text-sm text-[var(--muted)]">{item.hora_inicio.slice(0, 5)} - {item.hora_fim.slice(0, 5)}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {item.origem !== "horario_customizado" && (
                            <>
                              <ActionButton label="Concluir" onClick={() => atualizarStatus(item.id, { status_atendimento: "concluido", status_pagamento: "pago" })} />
                              <ActionButton label="No-show" onClick={() => atualizarStatus(item.id, { status_agendamento: "no_show" })} />
                            </>
                          )}
                          <ActionButton danger label="Cancelar" onClick={() => cancelar(item.id)} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <section className="border border-white/10 bg-white/[0.03] p-6">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-semibold">Agenda por periodo</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input type="date" value={dataRangeInicio} onChange={(event) => setDataRangeInicio(event.target.value)} className="datetime-input rounded-xl border px-4 py-2" />
                  <input type="date" value={dataRangeFim} onChange={(event) => setDataRangeFim(event.target.value)} className="datetime-input rounded-xl border px-4 py-2" />
                </div>
              </div>
              <div className="space-y-3">
                {agendaFaixa.length === 0 && <p className="text-[var(--muted)]">Sem compromissos no periodo.</p>}
                {agendaFaixa.map((item) => (
                  <div key={`${item.id}-${item.data}`} className="border border-white/10 bg-black/20 p-4">
                    <p className="text-sm uppercase tracking-[0.2em] text-[var(--accent-strong)]">{item.data}</p>
                    <p className="mt-2 text-lg font-semibold">{item.servico_nome}</p>
                    <p className="mt-2 text-[var(--muted)]">{item.nome_cliente} • {item.hora_inicio.slice(0, 5)} - {item.hora_fim.slice(0, 5)}</p>
                  </div>
                ))}
              </div>
            </section>
          </section>
        )}

        {!loading && tab === "agenda" && (
          <section className="border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-xl font-semibold">Visao detalhada da agenda</h2>
            <p className="mt-2 text-[var(--muted)]">Acompanhamento do barbeiro logado sem misturar dados de outros profissionais.</p>
            <div className="mt-6 space-y-3">
              {agendaFaixa.map((item) => (
                <div key={item.id} className="grid gap-2 border border-white/10 bg-black/20 p-4 sm:grid-cols-[140px_1fr_auto] sm:items-center">
                  <div className="text-[var(--accent-strong)]">{item.data}</div>
                  <div>
                    <p className="font-semibold">{item.nome_cliente}</p>
                    <p className="text-sm text-[var(--muted)]">{item.servico_nome} • {item.hora_inicio.slice(0, 5)} - {item.hora_fim.slice(0, 5)}</p>
                  </div>
                  <div className="text-sm text-[var(--muted)]">
                    {Number(item.valor_final ?? item.servico_preco ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading && tab === "bloqueios" && (
          <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <form onSubmit={criarBloqueio} className="border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-xl font-semibold">Novo bloqueio</h2>
              <div className="mt-5 grid gap-4">
                <input name="data" type="date" defaultValue={dataBloqueio} className="datetime-input rounded-xl border px-4 py-3" />
                <select name="tipo_bloqueio" className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3">
                  <option value="horario">Bloquear horario especifico</option>
                  <option value="dia_inteiro">Bloquear dia inteiro</option>
                  <option value="nao_aceitar_mais">Nao aceitar mais horarios</option>
                </select>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input name="hora_inicio" type="time" className="datetime-input rounded-xl border px-4 py-3" />
                  <input name="hora_fim" type="time" className="datetime-input rounded-xl border px-4 py-3" />
                </div>
                <input name="motivo" type="text" placeholder="Motivo" className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3" />
                <button type="submit" className="bg-[var(--accent)] px-6 py-3 font-semibold text-black hover:bg-[var(--accent-strong)]">
                  Salvar bloqueio
                </button>
              </div>
            </form>

            <div className="border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-xl font-semibold">Bloqueios do barbeiro</h2>
              <div className="mt-5 space-y-3">
                {bloqueios.length === 0 && <p className="text-[var(--muted)]">Nenhum bloqueio encontrado.</p>}
                {bloqueios.map((item) => (
                  <div key={item.id} className="flex flex-col gap-3 border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold">{item.data}</p>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        {item.tipo_bloqueio === "horario"
                          ? `${item.hora_inicio?.slice(0, 5)} - ${item.hora_fim?.slice(0, 5)}`
                          : item.tipo_bloqueio === "dia_inteiro"
                            ? "Dia inteiro"
                            : "Nao aceitar mais horarios"}
                      </p>
                      {item.motivo && <p className="mt-2 text-sm text-[var(--muted)]">{item.motivo}</p>}
                    </div>
                    <ActionButton danger label="Remover" onClick={() => removerBloqueio(item.id)} />
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {!loading && tab === "horarios" && (
          <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <form onSubmit={criarHorario} className="border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-xl font-semibold">Novo horario personalizado</h2>
              <div className="mt-5 grid gap-4">
                <input name="data" type="date" defaultValue={dataHorario} className="datetime-input rounded-xl border px-4 py-3" />
                <input name="nome_cliente" type="text" placeholder="Nome do cliente" className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3" />
                <input name="celular_cliente" type="text" placeholder="Celular do cliente" className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input name="hora_inicio" type="time" className="datetime-input rounded-xl border px-4 py-3" />
                  <input name="hora_fim" type="time" className="datetime-input rounded-xl border px-4 py-3" />
                </div>
                <button type="submit" className="bg-[var(--accent)] px-6 py-3 font-semibold text-black hover:bg-[var(--accent-strong)]">
                  Salvar horario
                </button>
              </div>
            </form>

            <div className="border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-xl font-semibold">Horarios personalizados</h2>
              <div className="mt-5 space-y-3">
                {horarios.length === 0 && <p className="text-[var(--muted)]">Nenhum horario personalizado cadastrado.</p>}
                {horarios.map((item) => (
                  <div key={item.id} className="flex flex-col gap-3 border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold">{item.data}</p>
                      <p className="mt-2 text-sm text-[var(--muted)]">{item.hora_inicio.slice(0, 5)} - {item.hora_fim.slice(0, 5)}</p>
                      <p className="mt-2 text-sm text-[var(--muted)]">{item.nome_cliente || "Sem nome"} {item.celular_cliente ? `• ${item.celular_cliente}` : ""}</p>
                    </div>
                    <ActionButton danger label="Remover" onClick={() => removerHorario(item.id)} />
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="border border-white/10 bg-white/[0.03] p-5">
      <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent-strong)]">{title}</p>
      <p className="mt-4 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-sm font-semibold ${danger ? "border border-red-500 text-red-300 hover:bg-red-950/30" : "bg-[var(--accent)] text-black hover:bg-[var(--accent-strong)]"}`}
    >
      {label}
    </button>
  );
}
