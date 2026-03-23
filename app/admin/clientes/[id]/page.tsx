"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getTodayInputValue } from "@/lib/format";

type Plano = {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  cortes_incluidos: number;
  barbas_incluidas: number;
  sobrancelhas_incluidas: number;
};

type ClienteDetalhe = {
  cliente: { id: string; nome: string; telefone: string; data_nascimento: string; whatsapp_link: string };
  assinatura: {
    id: string;
    plano_id: string;
    tipo_renovacao: "manual" | "automatica";
    inicio_ciclo: string;
    fim_ciclo: string;
    proxima_renovacao: string;
    cortes_restantes: number;
    barbas_restantes: number;
    sobrancelhas_restantes: number;
    observacoes_internas?: string | null;
  } | null;
  plano: Plano | null;
  reservas: Array<Record<string, unknown>>;
  reservas_periodo: Array<Record<string, unknown>>;
  faltas_periodo: number;
  cancelamentos_periodo: number;
  financeiro: Array<Record<string, unknown>>;
  historico_telefone: Array<Record<string, unknown>>;
  historico_uso: Array<Record<string, unknown>>;
};

export default function ClienteDetalhePage() {
  const params = useParams<{ id: string }>();
  const clienteId = String(params?.id ?? "");
  const [detalhe, setDetalhe] = useState<ClienteDetalhe | null>(null);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [planoId, setPlanoId] = useState("");
  const [tipoRenovacao, setTipoRenovacao] = useState<"manual" | "automatica">("manual");
  const [inicioCiclo, setInicioCiclo] = useState(getTodayInputValue());
  const [fimCiclo, setFimCiclo] = useState(getTodayInputValue());
  const [observacoes, setObservacoes] = useState("");
  const [categoriaUso, setCategoriaUso] = useState<"corte" | "barba" | "sobrancelha">("corte");
  const [quantidadeUso, setQuantidadeUso] = useState(1);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    const [detalheRes, planosRes] = await Promise.all([fetch(`/api/admin/clientes/${clienteId}`), fetch("/api/planos")]);
    const [detalheJson, planosJson] = await Promise.all([detalheRes.json(), planosRes.json()]);

    if (!detalheRes.ok) {
      setErro(detalheJson.erro || "Erro ao carregar cliente.");
      setLoading(false);
      return;
    }
    if (!planosRes.ok) {
      setErro(planosJson.erro || "Erro ao carregar planos.");
      setLoading(false);
      return;
    }

    setDetalhe(detalheJson);
    setPlanos(planosJson.planos ?? []);
    if ((planosJson.planos ?? []).length > 0) {
      setPlanoId(planosJson.planos[0].id);
    }
    setObservacoes(String(detalheJson.assinatura?.observacoes_internas ?? ""));
    setLoading(false);
  }, [clienteId]);

  useEffect(() => {
    if (!clienteId) return;
    const timer = window.setTimeout(() => {
      void carregar();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [carregar, clienteId]);

  async function acaoPlano(acao: "adicionar_plano" | "renovar_plano" | "troca_imediata") {
    const payload: Record<string, unknown> = {
      acao,
      cliente_id: clienteId,
      plano_id: planoId,
      tipo_renovacao: tipoRenovacao,
      inicio_ciclo: inicioCiclo,
      fim_ciclo: fimCiclo,
      observacoes,
    };

    if (detalhe?.assinatura?.id) {
      payload.assinatura_id = detalhe.assinatura.id;
    }

    const res = await fetch("/api/admin/assinaturas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) {
      setErro(json.erro || "Erro ao atualizar plano.");
      return;
    }

    setMsg("Plano atualizado com sucesso.");
    await carregar();
  }

  async function salvarObservacoes() {
    if (!detalhe?.assinatura?.id) return;
    const res = await fetch(`/api/admin/clientes/${clienteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        acao: "atualizar_observacoes_assinatura",
        assinatura_id: detalhe.assinatura.id,
        observacoes,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErro(json.erro || "Erro ao salvar observacoes.");
      return;
    }
    setMsg("Observacoes internas atualizadas.");
    await carregar();
  }

  async function cancelarPlano() {
    if (!detalhe?.assinatura?.id) return;
    const res = await fetch(`/api/admin/clientes/${clienteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "cancelar_plano", assinatura_id: detalhe.assinatura.id }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErro(json.erro || "Erro ao cancelar plano.");
      return;
    }
    setMsg("Plano cancelado.");
    await carregar();
  }

  async function registrarUsoManual() {
    const res = await fetch("/api/admin/assinaturas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        acao: "registrar_uso_manual",
        cliente_id: clienteId,
        categoria: categoriaUso,
        quantidade: quantidadeUso,
        observacao: "Uso manual registrado pelo barbeiro",
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErro(json.erro || "Erro ao registrar uso manual.");
      return;
    }
    setMsg("Uso manual registrado.");
    await carregar();
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link href="/admin/clientes" className="text-[var(--muted)] hover:text-white">Voltar para clientes</Link>
        </div>

        {erro && <div className="mb-6 border border-red-700 bg-red-950/60 px-4 py-3 text-red-200">{erro}</div>}
        {msg && <div className="mb-6 border border-emerald-700 bg-emerald-950/40 px-4 py-3 text-emerald-200">{msg}</div>}
        {loading && <p className="text-[var(--muted)]">Carregando perfil...</p>}

        {!loading && detalhe && (
          <div className="space-y-6">
            <section className="grid gap-6 border border-white/10 bg-white/[0.03] p-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <h1 className="text-4xl font-semibold">{detalhe.cliente.nome}</h1>
                <p className="mt-3 text-[var(--muted)]">Telefone: {detalhe.cliente.telefone}</p>
                <p className="mt-1 text-[var(--muted)]">Nascimento: {detalhe.cliente.data_nascimento}</p>
              </div>
              <a href={detalhe.cliente.whatsapp_link} target="_blank" rel="noreferrer" className="border border-white/20 px-5 py-3 font-semibold hover:bg-white/10">
                WhatsApp
              </a>
            </section>

            <section className="grid gap-4 sm:grid-cols-6">
              <InfoCard label="Plano" value={detalhe.plano?.nome ?? "Sem plano"} />
              <InfoCard label="Cortes restantes" value={String(detalhe.assinatura?.cortes_restantes ?? 0)} />
              <InfoCard label="Barbas restantes" value={String(detalhe.assinatura?.barbas_restantes ?? 0)} />
              <InfoCard label="Sobrancelhas restantes" value={String(detalhe.assinatura?.sobrancelhas_restantes ?? 0)} />
              <InfoCard label="Faltas no periodo" value={String(detalhe.faltas_periodo ?? 0)} />
              <InfoCard label="Cancelamentos" value={String(detalhe.cancelamentos_periodo ?? 0)} />
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="border border-white/10 bg-white/[0.03] p-6">
                <h2 className="text-2xl font-semibold">Gestao do plano</h2>
                <div className="mt-5 grid gap-4">
                  <select value={planoId} onChange={(event) => setPlanoId(event.target.value)} className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white">
                    {planos.map((plano) => <option key={plano.id} value={plano.id}>{plano.nome}</option>)}
                  </select>
                  <select value={tipoRenovacao} onChange={(event) => setTipoRenovacao(event.target.value as "manual" | "automatica")} className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white">
                    <option value="manual">Renovacao manual</option>
                    <option value="automatica">Renovacao automatica</option>
                  </select>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input type="date" value={inicioCiclo} onChange={(event) => setInicioCiclo(event.target.value)} className="datetime-input rounded-xl border px-4 py-3" />
                    <input type="date" value={fimCiclo} onChange={(event) => setFimCiclo(event.target.value)} className="datetime-input rounded-xl border px-4 py-3" />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {!detalhe.assinatura && <ActionButton label="Adicionar plano" onClick={() => acaoPlano("adicionar_plano")} />}
                    {detalhe.assinatura && <ActionButton label="Renovar plano" onClick={() => acaoPlano("renovar_plano")} />}
                    {detalhe.assinatura && <ActionButton label="Troca imediata" onClick={() => acaoPlano("troca_imediata")} />}
                    {detalhe.assinatura && <ActionButton danger label="Cancelar plano" onClick={cancelarPlano} />}
                  </div>
                </div>
              </div>

              <div className="border border-white/10 bg-white/[0.03] p-6">
                <h2 className="text-2xl font-semibold">Registrar uso manual</h2>
                <p className="mt-2 text-[var(--muted)]">Para atendimento sem agendamento.</p>
                <div className="mt-5 grid gap-4">
                  <select value={categoriaUso} onChange={(event) => setCategoriaUso(event.target.value as "corte" | "barba" | "sobrancelha")} className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white">
                    <option value="corte">Corte</option>
                    <option value="barba">Barba</option>
                    <option value="sobrancelha">Sobrancelha</option>
                  </select>
                  <input type="number" min={1} value={quantidadeUso} onChange={(event) => setQuantidadeUso(Number(event.target.value) || 1)} className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3" />
                  <ActionButton label="Registrar uso do plano" onClick={registrarUsoManual} />
                </div>
              </div>
            </section>

            <section className="border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-2xl font-semibold">Observacoes internas</h2>
              <textarea value={observacoes} onChange={(event) => setObservacoes(event.target.value)} placeholder="Notas internas sobre o assinante" className="mt-4 min-h-[120px] w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3" />
              {detalhe.assinatura && <button type="button" onClick={salvarObservacoes} className="mt-4 bg-[var(--accent)] px-5 py-3 font-semibold text-black hover:bg-[var(--accent-strong)]">Salvar observacoes</button>}
            </section>

            <section className="grid gap-6 lg:grid-cols-4">
              <Box title="Reservas do periodo" items={detalhe.reservas_periodo.map((item) => `${String(item.data ?? "-")} - ${String(item.servico_nome ?? "-")} - ${String(item.status_agendamento ?? "agendado")}`)} />
              <Box title="Historico de uso" items={detalhe.historico_uso.map((item) => `${String(item.tipo_movimentacao ?? "-")} - ${String(item.categoria_servico ?? "-")} - ${String(item.quantidade ?? 1)}`)} />
              <Box title="Historico financeiro" items={detalhe.financeiro.map((item) => `${String(item.descricao ?? "-")} - ${Number(item.valor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`)} />
              <Box title="Historico do telefone" items={detalhe.historico_telefone.map((item) => `${String(item.telefone ?? "-")} - ${String(item.origem ?? "-")}`)} />
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function ActionButton({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return <button type="button" onClick={onClick} className={`px-4 py-2 font-semibold ${danger ? "border border-red-500 text-red-300 hover:bg-red-950/30" : "bg-[var(--accent)] text-black hover:bg-[var(--accent-strong)]"}`}>{label}</button>;
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return <div className="border border-white/10 bg-white/[0.03] p-4"><p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{label}</p><p className="mt-3 text-xl font-semibold">{value}</p></div>;
}

function Box({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="border border-white/10 bg-white/[0.03] p-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-4 space-y-3">
        {items.slice(0, 8).map((item) => <div key={item} className="border border-white/10 bg-black/20 p-3 text-sm text-[var(--muted)]">{item}</div>)}
        {items.length === 0 && <p className="text-[var(--muted)]">Sem registros.</p>}
      </div>
    </div>
  );
}
