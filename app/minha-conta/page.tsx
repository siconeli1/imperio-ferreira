"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type DashboardPayload = {
  profile: Record<string, unknown> | null;
  assinatura: Record<string, unknown> | null;
  plano: Record<string, unknown> | null;
  reservas: Array<Record<string, unknown>>;
  financeiro: Array<Record<string, unknown>>;
  historico_uso: Array<Record<string, unknown>>;
};

export default function MinhaContaPage() {
  const supabase = getSupabaseBrowserClient();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setErro("");

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      setDashboard(null);
      setLoading(false);
      return;
    }

    const res = await fetch("/api/client/dashboard", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();

    if (!res.ok) {
      setErro(json.erro || "Erro ao carregar sua conta.");
      setLoading(false);
      return;
    }

    setDashboard(json);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboard();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  const profile = dashboard?.profile ?? null;
  const assinatura = dashboard?.assinatura ?? null;
  const plano = dashboard?.plano ?? null;
  const reservas = dashboard?.reservas ?? [];
  const financeiro = dashboard?.financeiro ?? [];
  const historicoUso = dashboard?.historico_uso ?? [];

  return (
    <main className="min-h-screen bg-[var(--background)] text-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/" className="text-[var(--muted)] hover:text-white">Voltar</Link>
            <h1 className="mt-4 text-4xl font-semibold">Minha conta</h1>
            <p className="mt-2 text-[var(--muted)]">Plano atual, saldo por servico, historico de uso, reservas e financeiro.</p>
          </div>
          <Link href="/login" className="border border-white/20 px-5 py-3 font-semibold hover:bg-white/10">Gerenciar login</Link>
        </div>

        {erro && <div className="mb-6 border border-red-700 bg-red-950/60 px-4 py-3 text-red-200">{erro}</div>}
        {loading && <p className="text-[var(--muted)]">Carregando...</p>}
        {!loading && !profile && <p className="text-[var(--muted)]">Faca login com Google para acessar sua area.</p>}

        {!loading && profile && (
          <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
            <section className="space-y-6">
              <div className="border border-white/10 bg-white/[0.03] p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent-strong)]">Perfil</p>
                <h2 className="mt-4 text-2xl font-semibold">{String(profile.nome ?? "Cliente")}</h2>
                <p className="mt-2 text-[var(--muted)]">Telefone: {String(profile.telefone ?? "-")}</p>
                <p className="mt-1 text-[var(--muted)]">Nascimento: {String(profile.data_nascimento ?? "-")}</p>
              </div>

              <div className="border border-white/10 bg-white/[0.03] p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent-strong)]">Plano atual</p>
                {!assinatura && <p className="mt-4 text-[var(--muted)]">Voce nao possui plano ativo.</p>}
                {assinatura && (
                  <div className="mt-4 space-y-2 text-sm">
                    <InfoRow label="Plano" value={String(plano?.nome ?? assinatura.plano_id ?? "-")} />
                    <InfoRow label="Periodo" value={`${String(assinatura.inicio_ciclo ?? "-")} ate ${String(assinatura.fim_ciclo ?? "-")}`} />
                    <InfoRow label="Proxima renovacao" value={String(assinatura.proxima_renovacao ?? "-")} />
                    <InfoRow label="Cortes restantes" value={String(assinatura.cortes_restantes ?? 0)} />
                    <InfoRow label="Barbas restantes" value={String(assinatura.barbas_restantes ?? 0)} />
                    <InfoRow label="Sobrancelhas restantes" value={String(assinatura.sobrancelhas_restantes ?? 0)} />
                  </div>
                )}
              </div>

              <div className="border border-white/10 bg-white/[0.03] p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent-strong)]">Historico de uso do plano</p>
                <div className="mt-4 space-y-3">
                  {historicoUso.length === 0 && <p className="text-[var(--muted)]">Sem movimentacoes registradas.</p>}
                  {historicoUso.map((item) => (
                    <div key={String(item.id)} className="border border-white/10 bg-black/20 p-4 text-sm">
                      <p className="font-medium">{String(item.tipo_movimentacao ?? "-")}</p>
                      <p className="mt-1 text-[var(--muted)]">Categoria: {String(item.categoria_servico ?? "-")}</p>
                      <p className="mt-1 text-[var(--muted)]">Quantidade: {String(item.quantidade ?? 1)}</p>
                      <p className="mt-1 text-[var(--muted)]">{String(item.observacao ?? "Sem observacao")}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <div className="border border-white/10 bg-white/[0.03] p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent-strong)]">Minhas reservas</p>
                <div className="mt-4 space-y-3">
                  {reservas.length === 0 && <p className="text-[var(--muted)]">Nenhuma reserva encontrada.</p>}
                  {reservas.map((item) => (
                    <div key={String(item.id)} className="border border-white/10 bg-black/20 p-4">
                      <p className="font-semibold">{String(item.servico_nome ?? "Servico")}</p>
                      <p className="mt-2 text-sm text-[var(--muted)]">{String(item.data ?? "-")} - {String(item.hora_inicio ?? "-")} - {String(item.hora_fim ?? "-")}</p>
                      <p className="mt-2 text-sm text-[var(--muted)]">Status: {String(item.status_agendamento ?? "agendado")}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">Cobranca: {String(item.tipo_cobranca ?? "avulso")}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-white/10 bg-white/[0.03] p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent-strong)]">Financeiro</p>
                <div className="mt-4 space-y-3">
                  {financeiro.length === 0 && <p className="text-[var(--muted)]">Sem movimentacoes registradas.</p>}
                  {financeiro.map((item) => (
                    <div key={String(item.id)} className="flex items-center justify-between gap-4 border border-white/10 bg-black/20 p-4 text-sm">
                      <div>
                        <p className="font-medium">{String(item.descricao ?? "-")}</p>
                        <p className="mt-1 text-[var(--muted)]">{String(item.categoria_financeira ?? "-")} - {String(item.competencia ?? "-")}</p>
                      </div>
                      <div className="font-semibold">
                        {Number(item.valor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/8 pb-2">
      <span className="text-[var(--muted)]">{label}</span>
      <span>{value}</span>
    </div>
  );
}
