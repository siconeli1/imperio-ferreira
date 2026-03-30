"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [aba, setAba] = useState<"ativos" | "passados">("ativos");
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

    if (!window.confirm("Cancelar este agendamento agora? Essa acao libera o horario para a agenda novamente.")) {
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

  const agendamentosativos = useMemo(() => {
    return [...agendamentos]
      .filter((item) => item.status_agendamento !== "cancelado" && item.status_atendimento !== "concluido")
      .sort((a, b) => `${a.data}T${a.hora_inicio}`.localeCompare(`${b.data}T${b.hora_inicio}`));
  }, [agendamentos]);

  const agendamentosPassados = useMemo(() => {
    return [...agendamentos]
      .filter((item) => item.status_agendamento === "cancelado" || item.status_atendimento === "concluido")
      .sort((a, b) => `${b.data}T${b.hora_inicio}`.localeCompare(`${a.data}T${a.hora_inicio}`))
      .slice(0, 5);
  }, [agendamentos]);

  return (
    <main className="min-h-screen bg-[var(--background)] text-white">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-10 border-b border-white/10 pb-10">
          <Link href="/" className="inline-flex items-center gap-2 text-[var(--muted)] hover:text-white">
            Voltar
          </Link>
          <div className="mt-6 max-w-2xl">
            <h1 className="text-4xl font-semibold">Meus agendamentos</h1>
            <p className="mt-3 text-lg text-[var(--muted)]">
              Consulte, acompanhe e cancele suas reservas usando a mesma conta Google utilizada para agendar.
            </p>
          </div>
        </div>

        {erro ? <div className="mb-6 border border-red-700 bg-red-950/60 px-4 py-3 text-red-200">{erro}</div> : null}
        {msg ? <div className="mb-6 border border-emerald-700 bg-emerald-950/40 px-4 py-3 text-emerald-200">{msg}</div> : null}

        {!sessionReady ? <p className="text-center text-[var(--muted)]">Carregando sessao...</p> : null}

        {sessionReady && !accessToken ? (
          <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-8 text-center">
            <h2 className="text-2xl font-semibold">Entre com Google para ver suas reservas</h2>
            <p className="mx-auto mt-4 max-w-2xl text-[var(--muted)]">
              Seus agendamentos agora ficam vinculados a sua conta Google. Isso deixa a consulta mais segura e evita buscas por telefone.
            </p>
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loadingLogin}
              className="mt-8 inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--accent)] px-6 py-3 font-semibold text-black hover:bg-[var(--accent-strong)] disabled:opacity-50"
            >
              {loadingLogin ? "Redirecionando..." : "Entrar com Google"}
            </button>
          </section>
        ) : null}

        {sessionReady && accessToken && !profile && !loading ? (
          <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-8 text-center">
            <h2 className="text-2xl font-semibold">Conta ainda nao cadastrada</h2>
            <p className="mx-auto mt-4 max-w-2xl text-[var(--muted)]">
              Esta conta Google ainda nao foi finalizada no sistema. Se voce nunca reservou com ela, ainda nao existem agendamentos vinculados.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/login?next=/meus-agendamentos"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--accent)] px-6 py-3 font-semibold text-black hover:bg-[var(--accent-strong)]"
              >
                Completar cadastro
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/20 px-6 py-3 font-semibold hover:bg-white/10"
              >
                Sair e trocar conta
              </button>
            </div>
          </section>
        ) : null}

        {sessionReady && accessToken && profile ? (
          <section className="space-y-4">
            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-[var(--muted)]">Consultando como</p>
                  <p className="mt-1 text-lg font-semibold text-white">{profile.nome}</p>
                </div>
              </div>
            </div>

            {!profileExists && !loading ? (
              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-8 text-center text-[var(--muted)]">
                Esta conta Google ainda nao tem cadastro no sistema.
              </div>
            ) : null}

            {loading ? <p className="text-[var(--muted)]">Buscando agendamentos...</p> : null}

            {!loading && profileExists && agendamentos.length === 0 ? (
              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-8 text-center text-[var(--muted)]">
                Nenhum agendamento encontrado para esta conta.
              </div>
            ) : null}

            {!loading && profileExists && agendamentos.length > 0 ? (
              <div className="space-y-5">
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setAba("ativos")}
                    className={`inline-flex min-h-11 items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition ${
                      aba === "ativos"
                        ? "bg-[var(--accent)] text-black"
                        : "border border-white/15 text-white hover:bg-white/10"
                    }`}
                  >
                    Agendamentos ativos
                  </button>
                  <button
                    type="button"
                    onClick={() => setAba("passados")}
                    className={`inline-flex min-h-11 items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition ${
                      aba === "passados"
                        ? "bg-[var(--accent)] text-black"
                        : "border border-white/15 text-white hover:bg-white/10"
                    }`}
                  >
                    Agendamentos passados
                  </button>
                </div>

                {aba === "ativos" ? (
                  agendamentosativos.length === 0 ? (
                    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-8 text-center text-[var(--muted)]">
                      Nenhum agendamento atual encontrado.
                    </div>
                  ) : (
                    agendamentosativos.map((item) => (
                      <AgendamentoCard
                        key={item.id}
                        item={item}
                        barbeiroNome={resolveBarbeiroNome(item)}
                        loading={loading}
                        onCancelar={cancelar}
                      />
                    ))
                  )
                ) : agendamentosPassados.length === 0 ? (
                  <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-8 text-center text-[var(--muted)]">
                    Nenhum agendamento passado encontrado.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {agendamentosPassados.map((item) => (
                      <AgendamentoCard
                        key={item.id}
                        item={item}
                        barbeiroNome={resolveBarbeiroNome(item)}
                        loading={loading}
                        onCancelar={cancelar}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}

function AgendamentoCard({
  item,
  barbeiroNome,
  loading,
  onCancelar,
}: {
  item: Agendamento;
  barbeiroNome: string;
  loading: boolean;
  onCancelar: (id: string) => void;
}) {
  const cancelado = item.status_agendamento === "cancelado";
  const concluido = item.status_atendimento === "concluido";
  const statusLabel = cancelado ? "Cancelado" : concluido ? "Concluido" : "Agendado";

  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xl font-semibold">{formatarDataISO(item.data)}</p>
          <p className="mt-2 text-[var(--muted)]">
            {formatarHora(item.hora_inicio)} ate {formatarHora(item.hora_fim)}
          </p>
          <p className="mt-4 text-white">{item.servico_nome || "Servico nao informado"}</p>
          <p className="mt-2 text-sm text-[var(--muted)]">Barbeiro: {barbeiroNome}</p>
        </div>

        <div className="text-left sm:text-right">
          <span className="inline-flex rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
            {statusLabel}
          </span>
          <p className="mt-3 text-lg font-semibold">
            {Number(item.valor_final ?? item.servico_preco ?? 0).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </p>
        </div>
      </div>

      {!cancelado && !concluido ? (
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onCancelar(item.id)}
            disabled={loading}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-red-500 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-950/30 disabled:opacity-50"
          >
            Cancelar agendamento
          </button>
        </div>
      ) : null}
    </div>
  );
}
