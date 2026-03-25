"use client";

import { useCallback, useEffect, useState } from "react";
import { getTodayInputValue } from "@/lib/format";
import {
  AdminActionButton,
  AdminNotice,
  AdminPageHeading,
  AdminPanel,
} from "@/app/admin/_components/AdminUi";

type Bloqueio = {
  id: string;
  data: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  tipo_bloqueio: "horario" | "dia_inteiro" | "nao_aceitar_mais";
  motivo: string | null;
};

export default function AdminBloqueiosPage() {
  const today = getTodayInputValue();
  const [filtroData, setFiltroData] = useState(today);
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([]);
  const [tipo, setTipo] = useState<Bloqueio["tipo_bloqueio"]>("horario");
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");

  const carregarBloqueios = useCallback(async () => {
    setLoading(true);
    setErro("");

    try {
      const res = await fetch(`/api/bloqueios?data=${encodeURIComponent(filtroData)}`, { cache: "no-store" });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.erro || "Erro ao carregar bloqueios.");
      }

      setBloqueios(json.bloqueios ?? []);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao carregar bloqueios.");
    } finally {
      setLoading(false);
    }
  }, [filtroData]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void carregarBloqueios();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [carregarBloqueios]);

  async function criarBloqueio(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");
    setMsg("");
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
      setErro(json.erro || "Erro ao salvar bloqueio.");
      return;
    }

    setMsg("Bloqueio salvo com sucesso.");
    event.currentTarget.reset();
    setTipo("horario");
    await carregarBloqueios();
  }

  async function removerBloqueio(id: string) {
    setErro("");
    setMsg("");

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
    await carregarBloqueios();
  }

  return (
    <>
      <AdminPageHeading
        eyebrow="Bloqueios"
        title="Controle de indisponibilidade"
        description="Cada bloqueio vale apenas para o barbeiro logado. Se voce bloquear um horario, os outros barbeiros continuam livres normalmente."
      />

      {erro ? <div className="mb-6"><AdminNotice tone="danger">{erro}</AdminNotice></div> : null}
      {msg ? <div className="mb-6"><AdminNotice tone="success">{msg}</AdminNotice></div> : null}

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <AdminPanel title="Novo bloqueio" description="Use para almoco, saidas rapidas, dia inteiro ou para parar de aceitar novos encaixes nessa data.">
          <form onSubmit={criarBloqueio} className="grid gap-4">
            <input name="data" type="date" defaultValue={filtroData} className="datetime-input rounded-2xl border px-4 py-3" />

            <select
              name="tipo_bloqueio"
              value={tipo}
              onChange={(event) => setTipo(event.target.value as Bloqueio["tipo_bloqueio"])}
              className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white"
            >
              <option value="horario">Bloquear horario especifico</option>
              <option value="dia_inteiro">Bloquear dia inteiro</option>
              <option value="nao_aceitar_mais">Nao aceitar mais horarios</option>
            </select>

            {tipo === "horario" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <input name="hora_inicio" type="time" className="datetime-input rounded-2xl border px-4 py-3" />
                <input name="hora_fim" type="time" className="datetime-input rounded-2xl border px-4 py-3" />
              </div>
            ) : null}

            <input
              name="motivo"
              type="text"
              placeholder="Motivo do bloqueio"
              className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3"
            />

            <AdminActionButton type="submit">Salvar bloqueio</AdminActionButton>
          </form>
        </AdminPanel>

        <AdminPanel title="Bloqueios da data" description="Voce escolhe a data para revisar, editar e remover o que nao fizer mais sentido.">
          <div className="mb-5 max-w-xs">
            <label className="text-sm text-[var(--muted)]">Data da consulta</label>
            <input
              type="date"
              value={filtroData}
              onChange={(event) => setFiltroData(event.target.value)}
              className="datetime-input mt-3 w-full rounded-2xl border px-4 py-3"
            />
          </div>

          {loading ? <p className="text-[var(--muted)]">Carregando bloqueios...</p> : null}
          {!loading && bloqueios.length === 0 ? <p className="text-[var(--muted)]">Nenhum bloqueio cadastrado para essa data.</p> : null}

          {!loading && bloqueios.length > 0 ? (
            <div className="space-y-4">
              {bloqueios.map((item) => (
                <div key={item.id} className="rounded-[24px] border border-white/10 bg-black/20 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-lg font-semibold">{item.data}</p>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        {item.tipo_bloqueio === "horario"
                          ? `${item.hora_inicio?.slice(0, 5)} - ${item.hora_fim?.slice(0, 5)}`
                          : item.tipo_bloqueio === "dia_inteiro"
                            ? "Dia inteiro"
                            : "Nao aceitar mais horarios"}
                      </p>
                      <p className="mt-2 text-sm text-[var(--muted)]">{item.motivo || "Sem motivo informado."}</p>
                    </div>
                    <AdminActionButton tone="danger" onClick={() => removerBloqueio(item.id)}>
                      Remover
                    </AdminActionButton>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </AdminPanel>
      </div>
    </>
  );
}
