"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatarCelular, formatarDataISO, formatarHora } from "@/lib/format";
import { normalizePhone } from "@/lib/phone";

type Agendamento = {
  id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  nome_cliente: string;
  celular_cliente: string;
  servico_nome?: string;
  servico_preco?: number;
  valor_final?: number;
  status_agendamento?: string;
  status_atendimento?: string;
  barbeiros?: { nome?: string | null } | { nome?: string | null }[] | null;
};

export default function MeusAgendamentosPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-[var(--background)] text-white">Carregando...</main>}>
      <MeusAgendamentosContent />
    </Suspense>
  );
}

function MeusAgendamentosContent() {
  const searchParams = useSearchParams();
  const [celular, setCelular] = useState("");
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const celularParam = searchParams.get("celular");
    if (celularParam) {
      setCelular(formatarCelular(celularParam));
    }
  }, [searchParams]);

  async function buscar() {
    if (!celular) {
      setErro("Digite o celular usado na reserva.");
      return;
    }

    setLoading(true);
    setErro("");
    setMsg("");

    try {
      const res = await fetch(`/api/meus-agendamentos?celular=${normalizePhone(celular)}`);
      const json = await res.json();

      if (!res.ok) {
        setErro(json.erro || "Erro ao buscar agendamentos");
        setAgendamentos([]);
        return;
      }

      setAgendamentos(json.agendamentos ?? []);
    } catch {
      setErro("Erro ao conectar com o servidor");
      setAgendamentos([]);
    } finally {
      setLoading(false);
    }
  }

  async function cancelar(id: string) {
    setLoading(true);
    setErro("");
    setMsg("");

    try {
      const res = await fetch("/api/cancelar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          celular: normalizePhone(celular),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setErro(json.erro || "Erro ao cancelar agendamento");
        return;
      }

      setMsg("Agendamento cancelado com sucesso.");
      await buscar();
    } catch {
      setErro("Erro ao conectar com o servidor");
    } finally {
      setLoading(false);
    }
  }

  function resolveBarbeiroNome(item: Agendamento) {
    if (Array.isArray(item.barbeiros)) {
      return item.barbeiros[0]?.nome ?? "Barbeiro";
    }
    return item.barbeiros?.nome ?? "Barbeiro";
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-white">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-10 border-b border-white/10 pb-10 text-center">
          <Link href="/" className="mb-6 inline-flex items-center gap-2 text-[var(--muted)] hover:text-white">
            Voltar
          </Link>
          <h1 className="text-4xl font-semibold">Meus agendamentos</h1>
          <p className="mt-3 text-lg text-[var(--muted)]">Consulte seus horarios usando o celular informado na reserva.</p>
        </div>

        {erro && <div className="mb-6 border border-red-700 bg-red-950/60 px-4 py-3 text-red-200">{erro}</div>}
        {msg && <div className="mb-6 border border-emerald-700 bg-emerald-950/40 px-4 py-3 text-emerald-200">{msg}</div>}

        <section className="mb-10 border border-white/10 bg-white/[0.03] p-6">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              type="tel"
              value={celular}
              onChange={(event) => setCelular(formatarCelular(event.target.value))}
              placeholder="(11) 99999-9999"
              maxLength={15}
              className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3"
            />
            <button
              type="button"
              onClick={buscar}
              disabled={loading}
              className="bg-[var(--accent)] px-6 py-3 font-semibold text-black hover:bg-[var(--accent-strong)] disabled:opacity-50"
            >
              {loading ? "Buscando..." : "Buscar"}
            </button>
          </div>
        </section>

        <section className="space-y-4">
          {agendamentos.length === 0 && celular && !loading && (
            <div className="border border-white/10 bg-white/[0.03] p-8 text-center text-[var(--muted)]">
              Nenhum agendamento encontrado.
            </div>
          )}

          {agendamentos.map((item) => {
            const cancelado = item.status_agendamento === "cancelado";
            const concluido = item.status_atendimento === "concluido";

            return (
              <div key={item.id} className="border border-white/10 bg-white/[0.03] p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xl font-semibold">{formatarDataISO(item.data)}</p>
                    <p className="mt-2 text-[var(--muted)]">
                      {formatarHora(item.hora_inicio)} - {formatarHora(item.hora_fim)}
                    </p>
                    <p className="mt-4 text-white">{item.servico_nome || "Servico nao informado"}</p>
                    <p className="mt-2 text-sm text-[var(--muted)]">Barbeiro: {resolveBarbeiroNome(item)}</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-sm uppercase tracking-[0.2em] text-[var(--accent-strong)]">
                      {cancelado ? "Cancelado" : concluido ? "Concluido" : "Agendado"}
                    </p>
                    <p className="mt-3 text-lg font-semibold">
                      {Number(item.valor_final ?? item.servico_preco ?? 0).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </p>
                  </div>
                </div>

                {!cancelado && !concluido && (
                  <button
                    type="button"
                    onClick={() => cancelar(item.id)}
                    disabled={loading}
                    className="mt-6 border border-red-500 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-950/30 disabled:opacity-50"
                  >
                    Cancelar agendamento
                  </button>
                )}
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
