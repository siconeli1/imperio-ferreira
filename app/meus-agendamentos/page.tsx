"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatarDataISO, formatarHora } from "@/lib/format";
import { useCustomerSession } from "@/lib/use-customer-session";

type Agendamento = {
  id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  servico_nome?: string;
  servico_preco?: number;
  valor_final?: number;
  status_agendamento?: string;
  status_atendimento?: string;
  barbeiros?: { nome?: string | null } | { nome?: string | null }[] | null;
};

export default function MeusAgendamentosPage() {
  const { accessToken, profile, sessionReady, signInWithGoogle, signOut } = useCustomerSession();
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [profileExists, setProfileExists] = useState(true);

  useEffect(() => {
    async function buscar() {
      if (!accessToken) {
        setAgendamentos([]);
        return;
      }

      setLoading(true);
      setErro("");
      setMsg("");

      try {
        const res = await fetch("/api/meus-agendamentos", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const json = await res.json();

        if (!res.ok) {
          setErro(json.erro || "Erro ao buscar agendamentos");
          setAgendamentos([]);
          return;
        }

        setProfileExists(json.profile_exists !== false);
        setAgendamentos(json.agendamentos ?? []);
      } catch {
        setErro("Erro ao conectar com o servidor");
        setAgendamentos([]);
      } finally {
        setLoading(false);
      }
    }

    void buscar();
  }, [accessToken]);

  async function handleGoogleLogin() {
    setLoadingLogin(true);
    const { error } = await signInWithGoogle("/meus-agendamentos");
    if (error) {
      setErro(error.message);
      setLoadingLogin(false);
    }
  }

  async function handleLogout() {
    await signOut();
  }

  async function cancelar(id: string) {
    if (!accessToken) {
      setErro("Entre com Google para cancelar.");
      return;
    }

    setLoading(true);
    setErro("");
    setMsg("");

    try {
      const res = await fetch("/api/cancelar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ id }),
      });

      const json = await res.json();
      if (!res.ok) {
        setErro(json.erro || "Erro ao cancelar agendamento");
        return;
      }

      setMsg("Agendamento cancelado com sucesso.");

      const refresh = await fetch("/api/meus-agendamentos", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const refreshJson = await refresh.json();
      setAgendamentos(refreshJson.agendamentos ?? []);
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
          <p className="mt-3 text-lg text-[var(--muted)]">
            Consulte seus horarios usando a mesma conta Google utilizada para reservar.
          </p>
        </div>

        {erro && <div className="mb-6 border border-red-700 bg-red-950/60 px-4 py-3 text-red-200">{erro}</div>}
        {msg && <div className="mb-6 border border-emerald-700 bg-emerald-950/40 px-4 py-3 text-emerald-200">{msg}</div>}

        {!sessionReady && <p className="text-center text-[var(--muted)]">Carregando sessao...</p>}

        {sessionReady && !accessToken && (
          <section className="border border-white/10 bg-white/[0.03] p-8 text-center">
            <h2 className="text-2xl font-semibold">Entre com Google para ver suas reservas</h2>
            <p className="mt-4 text-[var(--muted)]">
              Seus agendamentos nao sao mais buscados por celular. Eles ficam vinculados a sua conta Google.
            </p>
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loadingLogin}
              className="mt-8 bg-[var(--accent)] px-6 py-3 font-semibold text-black hover:bg-[var(--accent-strong)] disabled:opacity-50"
            >
              {loadingLogin ? "Redirecionando..." : "Entrar com Google"}
            </button>
          </section>
        )}

        {sessionReady && accessToken && !profile && !loading && (
          <section className="border border-white/10 bg-white/[0.03] p-8 text-center">
            <h2 className="text-2xl font-semibold">Conta ainda nao cadastrada</h2>
            <p className="mt-4 text-[var(--muted)]">
              Esta conta Google ainda nao foi finalizada no sistema. Se voce nunca reservou com ela, ainda nao existem agendamentos vinculados.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/agendar" className="bg-[var(--accent)] px-6 py-3 font-semibold text-black hover:bg-[var(--accent-strong)]">
                Fazer meu primeiro agendamento
              </Link>
              <Link href="/login?next=/meus-agendamentos" className="border border-white/20 px-6 py-3 font-semibold hover:bg-white/10">
                Completar cadastro
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="border border-white/20 px-6 py-3 font-semibold hover:bg-white/10"
              >
                Sair e trocar conta
              </button>
            </div>
          </section>
        )}

        {sessionReady && accessToken && profile && (
          <section className="space-y-4">
            <div className="border border-white/10 bg-white/[0.03] p-5">
              <p className="text-sm text-[var(--muted)]">
                Consultando como <span className="font-semibold text-white">{profile.nome}</span>
              </p>
            </div>

            {!profileExists && !loading && (
              <div className="border border-white/10 bg-white/[0.03] p-8 text-center text-[var(--muted)]">
                Esta conta Google ainda nao tem cadastro no sistema.
              </div>
            )}

            {loading && <p className="text-[var(--muted)]">Buscando agendamentos...</p>}

            {!loading && profileExists && agendamentos.length === 0 && (
              <div className="border border-white/10 bg-white/[0.03] p-8 text-center text-[var(--muted)]">
                Nenhum agendamento encontrado para esta conta.
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
        )}
      </div>
    </main>
  );
}
