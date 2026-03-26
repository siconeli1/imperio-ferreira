"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCustomerSession } from "@/lib/use-customer-session";

type DashboardPayload = {
  profile: Record<string, unknown> | null;
  assinatura: Record<string, unknown> | null;
  plano: Record<string, unknown> | null;
};

export default function MinhaContaPage() {
  const { accessToken, profile, sessionReady, signOut } = useCustomerSession();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      if (!accessToken || !profile) {
        setDashboard(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setErro("");

      const res = await fetch("/api/client/dashboard", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();

      if (!res.ok) {
        setErro(json.erro || "Erro ao carregar sua conta.");
        setLoading(false);
        return;
      }

      setDashboard({
        profile: json.profile ?? null,
        assinatura: json.assinatura ?? null,
        plano: json.plano ?? null,
      });
      setLoading(false);
    }

    void loadDashboard();
  }, [accessToken, profile]);

  const assinatura = dashboard?.assinatura ?? null;
  const plano = dashboard?.plano ?? null;

  return (
    <main className="min-h-screen bg-[var(--background)] text-white">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-medium text-[var(--muted)] hover:text-white">
            Voltar
          </Link>
          {sessionReady && accessToken ? (
            <div className="flex items-center gap-3">
              <Link
                href="/login?next=/minha-conta"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-5 py-3 text-sm font-semibold hover:bg-white/10"
              >
                Editar conta
              </Link>
              <button
                type="button"
                onClick={() => void signOut()}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-5 py-3 text-sm font-semibold hover:bg-white/10"
              >
                Sair
              </button>
            </div>
          ) : null}
        </div>
        

        <section className="rounded-[34px] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          <h1 className="text-4xl font-semibold">Minha conta</h1>

          {erro ? <div className="mt-6 rounded-2xl border border-red-700 bg-red-950/60 px-4 py-3 text-red-200">{erro}</div> : null}
          {!sessionReady ? <p className="mt-6 text-[var(--muted)]">Carregando conta...</p> : null}

          {sessionReady && !accessToken ? (
            <div className="mt-6 rounded-[28px] border border-white/10 bg-black/20 p-5 sm:p-6">
              <h2 className="text-2xl font-semibold">Conta nao conectada</h2>
              <p className="mt-3 text-[var(--muted)]">Entre com Google para acessar seus dados e seus agendamentos.</p>
              <Link
                href="/login?next=/minha-conta&autostart=1"
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-black hover:bg-[var(--accent-strong)]"
              >
                Conectar conta Google
              </Link>
            </div>
          ) : null}

          {sessionReady && accessToken && !profile && !loading ? (
            <div className="mt-6 rounded-[28px] border border-white/10 bg-black/20 p-5 sm:p-6">
              <h2 className="text-2xl font-semibold">Cadastro pendente</h2>
              <p className="mt-3 text-[var(--muted)]">Esta conta Google ainda nao foi finalizada.</p>
              <Link
                href="/login?next=/minha-conta"
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                Clique aqui para completar seu cadastro
              </Link>
            </div>
          ) : null}

          {sessionReady && accessToken && profile && loading ? <p className="mt-6 text-[var(--muted)]">Carregando dados...</p> : null}

          {sessionReady && accessToken && profile && !loading ? (
            <div className="mt-6 grid gap-5">
              <section className="rounded-[28px] border border-white/10 bg-black/20 p-5 sm:p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent-strong)]">Dados da conta</p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <InfoBox label="Nome" value={String(profile.nome ?? "-")} />
                  <InfoBox label="Celular" value={String(profile.telefone ?? "-")} />
                </div>
              </section>

              <section className="rounded-[28px] border border-white/10 bg-black/20 p-5 sm:p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent-strong)]">Plano mensal</p>

                {!assinatura ? (
                  <p className="mt-4 text-[var(--muted)]">Voce nao possui plano ativo no momento.</p>
                ) : (
                  <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <InfoBox label="Plano" value={String(plano?.nome ?? assinatura.plano_id ?? "-")} />
                    <InfoBox label="Proxima renovacao" value={String(assinatura.proxima_renovacao ?? "-")} />
                    <InfoBox label="Periodo" value={`${String(assinatura.inicio_ciclo ?? "-")} ate ${String(assinatura.fim_ciclo ?? "-")}`} />
                    <InfoBox label="Cortes restantes" value={String(assinatura.cortes_restantes ?? 0)} />
                    <InfoBox label="Barbas restantes" value={String(assinatura.barbas_restantes ?? 0)} />
                    <InfoBox label="Sobrancelhas restantes" value={String(assinatura.sobrancelhas_restantes ?? 0)} />
                  </div>
                )}
              </section>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <p className="mt-3 text-base font-semibold text-white">{value}</p>
    </div>
  );
}
