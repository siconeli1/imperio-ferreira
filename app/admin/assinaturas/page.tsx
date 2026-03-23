"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Plano = { id: string; nome: string };
type Assinante = {
  id: string;
  plano_id: string;
  plano_nome: string;
  proxima_renovacao: string;
  tipo_renovacao: string;
  clientes?: { id?: string; nome?: string; telefone?: string } | null;
};

type Notificacao = {
  id: string;
  plano_id: string;
  proxima_renovacao: string;
  clientes?: { nome?: string; telefone?: string } | null;
};

export default function AdminAssinaturasPage() {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [assinantes, setAssinantes] = useState<Assinante[]>([]);
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [vencendoHoje, setVencendoHoje] = useState<Notificacao[]>([]);
  const [busca, setBusca] = useState("");
  const [planoId, setPlanoId] = useState("");
  const [vencimento, setVencimento] = useState("todos");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregar() {
      setLoading(true);
      const params = new URLSearchParams();
      if (busca) params.set("busca", busca);
      if (planoId) params.set("plano_id", planoId);
      if (vencimento !== "todos") params.set("vencimento", vencimento);

      const [planosRes, assinaturasRes] = await Promise.all([
        fetch("/api/planos"),
        fetch(`/api/admin/assinaturas?${params.toString()}`),
      ]);
      const [planosJson, assinaturasJson] = await Promise.all([planosRes.json(), assinaturasRes.json()]);

      if (!planosRes.ok) {
        setErro(planosJson.erro || "Erro ao carregar planos.");
        setLoading(false);
        return;
      }
      if (!assinaturasRes.ok) {
        setErro(assinaturasJson.erro || "Erro ao carregar assinaturas.");
        setLoading(false);
        return;
      }

      setPlanos(planosJson.planos ?? []);
      setAssinantes(assinaturasJson.assinantes ?? []);
      setNotificacoes(assinaturasJson.notificacoes_vencimento ?? []);
      setVencendoHoje(assinaturasJson.vencendo_hoje ?? []);
      setLoading(false);
    }

    void carregar();
  }, [busca, planoId, vencimento]);

  const resumo = useMemo(() => ({
    total: assinantes.length,
    hoje: vencendoHoje.length,
    proximos: notificacoes.length,
  }), [assinantes.length, notificacoes.length, vencendoHoje.length]);

  return (
    <main className="min-h-screen bg-[var(--background)] text-white">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/admin" className="text-[var(--muted)] hover:text-white">Voltar ao admin</Link>
            <h1 className="mt-4 text-4xl font-semibold">Assinaturas</h1>
            <p className="mt-2 text-[var(--muted)]">Acompanhe vencimentos, renovacoes e clientes com plano ativo.</p>
          </div>
        </div>

        {erro && <div className="mb-6 border border-red-700 bg-red-950/60 px-4 py-3 text-red-200">{erro}</div>}

        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <Metric title="Assinantes ativos" value={String(resumo.total)} />
          <Metric title="Vencendo hoje" value={String(resumo.hoje)} />
          <Metric title="Proximos alertas" value={String(resumo.proximos)} />
        </section>

        <section className="mb-6 grid gap-4 rounded-none border border-white/10 bg-white/[0.03] p-6 lg:grid-cols-3">
          <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar por nome ou telefone" className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3" />
          <select value={planoId} onChange={(event) => setPlanoId(event.target.value)} className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white">
            <option value="">Todos os planos</option>
            {planos.map((plano) => <option key={plano.id} value={plano.id}>{plano.nome}</option>)}
          </select>
          <select value={vencimento} onChange={(event) => setVencimento(event.target.value)} className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white">
            <option value="todos">Todos os vencimentos</option>
            <option value="hoje">Vencendo hoje</option>
            <option value="proximos_7">Proximos 7 dias</option>
          </select>
        </section>

        {loading && <p className="text-[var(--muted)]">Carregando assinaturas...</p>}

        {!loading && (
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <section className="border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-2xl font-semibold">Notificacoes de vencimento</h2>
              <div className="mt-5 space-y-3">
                {notificacoes.map((item) => (
                  <div key={item.id} className="border border-white/10 bg-black/20 p-4">
                    <p className="font-semibold">{item.clientes?.nome ?? "Cliente"}</p>
                    <p className="mt-2 text-[var(--muted)]">Plano: {item.plano_id}</p>
                    <p className="mt-1 text-[var(--muted)]">Vencimento: {item.proxima_renovacao}</p>
                    <p className="mt-1 text-[var(--accent-strong)]">{item.proxima_renovacao === new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) ? "Alertado hoje" : "Aviso preventivo"}</p>
                  </div>
                ))}
                {notificacoes.length === 0 && <p className="text-[var(--muted)]">Nenhum plano vencendo no filtro atual.</p>}
              </div>
            </section>

            <section className="border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-2xl font-semibold">Painel de assinantes</h2>
              <div className="mt-5 space-y-3">
                {assinantes.map((item) => (
                  <div key={item.id} className="grid gap-3 border border-white/10 bg-black/20 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div>
                      <p className="font-semibold">{item.clientes?.nome ?? "Cliente"}</p>
                      <p className="mt-2 text-[var(--muted)]">{item.clientes?.telefone ?? "-"}</p>
                      <p className="mt-1 text-[var(--muted)]">Plano: {item.plano_nome}</p>
                      <p className="mt-1 text-[var(--muted)]">Vencimento: {item.proxima_renovacao}</p>
                      <p className="mt-1 text-[var(--muted)]">Renovacao: {item.tipo_renovacao}</p>
                    </div>
                    <Link href={`/admin/clientes/${item.clientes?.id ?? ""}`} className="bg-[var(--accent)] px-4 py-2 font-semibold text-black hover:bg-[var(--accent-strong)]">
                      Abrir assinante
                    </Link>
                  </div>
                ))}
                {assinantes.length === 0 && <p className="text-[var(--muted)]">Nenhum assinante encontrado.</p>}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="border border-white/10 bg-white/[0.03] p-5">
      <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent-strong)]">{title}</p>
      <p className="mt-4 text-3xl font-semibold">{value}</p>
    </div>
  );
}
