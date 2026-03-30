"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CustomerOnboardingCard } from "@/app/_components/CustomerOnboardingCard";
import { formatarDataISO } from "@/lib/format";
import { useCustomerSession } from "@/lib/use-customer-session";

type DashboardPayload = {
  profile: {
    id: string;
    nome: string;
    telefone: string;
  } | null;
  assinatura: {
    plano_id?: string | null;
    proxima_renovacao?: string | null;
    inicio_ciclo?: string | null;
    fim_ciclo?: string | null;
    cortes_restantes?: number | null;
    barbas_restantes?: number | null;
    sobrancelhas_restantes?: number | null;
  } | null;
  plano: {
    nome?: string | null;
  } | null;
  reservas: Array<{
    id: string;
    data: string;
    hora_inicio: string;
    hora_fim: string;
    servico_nome?: string | null;
    status_agendamento?: string | null;
    status_atendimento?: string | null;
    tipo_cobranca?: string | null;
    valor_final?: number | null;
  }>;
  financeiro: Array<{
    id: string;
    descricao: string;
    valor: number;
    competencia: string;
  }>;
  historico_uso: Array<{
    id: string;
    tipo_movimentacao: string;
    categoria_servico: string;
    quantidade: number;
  }>;
};

export default function MinhaContaPage() {
  const { accessToken, profile, refresh, sessionReady, signOut } = useCustomerSession();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);

  useEffect(() => {
    async function loadDashboard() {
      if (!accessToken || !profile) {
        setDashboard(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setErro("");

      try {
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
          reservas: json.reservas ?? [],
          financeiro: json.financeiro ?? [],
          historico_uso: json.historico_uso ?? [],
        });
      } catch {
        setErro("Nao foi possivel carregar sua conta agora.");
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();
  }, [accessToken, profile]);

  const assinatura = dashboard?.assinatura ?? null;
  const plano = dashboard?.plano ?? null;
  const possuiPlanoAtivo = Boolean(assinatura && plano);
  const assinaturaAtiva = possuiPlanoAtivo ? assinatura : null;
  const ultimosUsos = useMemo(() => (dashboard?.historico_uso ?? []).slice(0, 3), [dashboard]);

  return (
    <main className="min-h-screen bg-[var(--background)] text-white">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="text-sm font-medium text-[var(--muted)] hover:text-white">
            Voltar
          </Link>

          {sessionReady && accessToken ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setEditingProfile((current) => !current)}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-5 py-3 text-sm font-semibold hover:bg-white/10"
              >
                {editingProfile ? "Fechar edicao" : "Atualizar cadastro"}
              </button>
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
          <div className="max-w-2xl">
            <h1 className="text-4xl font-semibold">Minha conta</h1>
            <p className="mt-3 text-[var(--muted)]">
              Aqui voce acompanha seus dados, seu plano e o historico mais recente sem precisar navegar entre telas soltas.
            </p>
          </div>

          {erro ? <div className="mt-6 rounded-2xl border border-red-700 bg-red-950/60 px-4 py-3 text-red-200">{erro}</div> : null}
          {!sessionReady ? <p className="mt-6 text-[var(--muted)]">Carregando conta...</p> : null}

          {sessionReady && !accessToken ? (
            <div className="mt-6 rounded-[28px] border border-white/10 bg-black/20 p-5 sm:p-6">
              <h2 className="text-2xl font-semibold">Conta nao conectada</h2>
              <p className="mt-3 text-[var(--muted)]">Entre com Google para acessar seus dados, seu plano e seus agendamentos.</p>
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
              <p className="mt-3 text-[var(--muted)]">Esta conta Google ainda nao foi finalizada no sistema.</p>
              <Link
                href="/login?next=/minha-conta"
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                Completar cadastro
              </Link>
            </div>
          ) : null}

          {sessionReady && accessToken && profile && loading ? <p className="mt-6 text-[var(--muted)]">Carregando dados...</p> : null}

          {sessionReady && accessToken && profile && editingProfile ? (
            <div className="mt-6">
              <CustomerOnboardingCard
                accessToken={accessToken}
                existingProfile={profile}
                title="Atualize seus dados"
                description="Mantenha seu nome e celular atualizados para facilitar contato, historico e novas reservas."
                submitLabel="Salvar alteracoes"
                onSaved={async () => {
                  await refresh();
                  setEditingProfile(false);
                }}
              />
            </div>
          ) : null}

          {sessionReady && accessToken && profile && !loading ? (
            <div className="mt-6 grid gap-5">
              <div className="grid gap-4 lg:grid-cols-3">
                <InfoBox label="Nome" value={String(profile.nome ?? "-")} />
                <InfoBox label="Celular" value={String(profile.telefone ?? "-")} />
                <InfoBox label="Plano atual" value={String(plano?.nome ?? "Sem plano ativo")} />
              </div>

              {assinaturaAtiva ? (
                <section className="rounded-[28px] border border-white/10 bg-black/20 p-5 sm:p-6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent-strong)]">Plano mensal</p>
                    <h2 className="mt-2 text-2xl font-semibold">Resumo do seu ciclo</h2>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <InfoBox label="Plano" value={String(plano?.nome ?? assinaturaAtiva.plano_id ?? "-")} />
                    <InfoBox label="Proxima renovacao" value={formatDateValue(assinaturaAtiva.proxima_renovacao)} />
                    <InfoBox label="Periodo" value={`${formatDateValue(assinaturaAtiva.inicio_ciclo)} ate ${formatDateValue(assinaturaAtiva.fim_ciclo)}`} />
                    <InfoBox label="Cortes restantes" value={String(assinaturaAtiva.cortes_restantes ?? 0)} />
                    <InfoBox label="Barbas restantes" value={String(assinaturaAtiva.barbas_restantes ?? 0)} />
                    <InfoBox label="Sobrancelhas restantes" value={String(assinaturaAtiva.sobrancelhas_restantes ?? 0)} />
                  </div>
                </section>
              ) : null}

              {assinaturaAtiva ? (
                <section className="rounded-[28px] border border-white/10 bg-black/20 p-5 sm:p-6">
                  <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent-strong)]">Uso do plano</p>
                  {ultimosUsos.length === 0 ? (
                    <p className="mt-4 text-[var(--muted)]">Nenhum uso de plano registrado ainda.</p>
                  ) : (
                    <div className="mt-5 space-y-3">
                      {ultimosUsos.map((item) => (
                        <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                          <p className="font-semibold">{item.tipo_movimentacao}</p>
                          <p className="mt-2 text-sm text-[var(--muted)]">
                            {item.categoria_servico} - {item.quantidade} unidade(s)
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              ) : null}
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

function formatDateValue(value?: string | null) {
  if (!value) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return formatarDataISO(value);
  }
  return value;
}
