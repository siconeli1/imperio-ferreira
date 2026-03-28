"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getTodayInputValue } from "@/lib/format";
import {
  AdminActionButton,
  AdminMetric,
  AdminNotice,
  AdminPageHeading,
  AdminPanel,
} from "@/app/admin/_components/AdminUi";

type Plano = {
  id: string;
  nome: string;
};

type ClienteResumo = {
  id: string;
  nome: string;
  telefone: string;
  email_google: string | null;
  plano_ativo: string | null;
};

type Assinante = {
  id: string;
  cliente_id: string;
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

export default function AdminPlanosPage() {
  const today = getTodayInputValue();
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [clientes, setClientes] = useState<ClienteResumo[]>([]);
  const [assinantes, setAssinantes] = useState<Assinante[]>([]);
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [busca, setBusca] = useState("");
  const [planoIdFiltro, setPlanoIdFiltro] = useState("");
  const [vencimento, setVencimento] = useState("todos");
  const [clienteBusca, setClienteBusca] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [planoIdCadastro, setPlanoIdCadastro] = useState("");
  const [tipoRenovacao, setTipoRenovacao] = useState<"manual" | "automatica">("manual");
  const [inicioCiclo, setInicioCiclo] = useState(today);
  const [fimCiclo, setFimCiclo] = useState(today);
  const [observacoes, setObservacoes] = useState("");
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");

    try {
      const params = new URLSearchParams();
      if (busca) params.set("busca", busca);
      if (planoIdFiltro) params.set("plano_id", planoIdFiltro);
      if (vencimento !== "todos") params.set("vencimento", vencimento);

      const [planosRes, clientesRes, assinaturasRes] = await Promise.all([
        fetch("/api/planos", { cache: "no-store" }),
        fetch("/api/admin/clientes", { cache: "no-store" }),
        fetch(`/api/admin/assinaturas?${params.toString()}`, { cache: "no-store" }),
      ]);
      const [planosJson, clientesJson, assinaturasJson] = await Promise.all([planosRes.json(), clientesRes.json(), assinaturasRes.json()]);

      if (!planosRes.ok) throw new Error(planosJson.erro || "Erro ao carregar planos.");
      if (!clientesRes.ok) throw new Error(clientesJson.erro || "Erro ao carregar clientes.");
      if (!assinaturasRes.ok) throw new Error(assinaturasJson.erro || "Erro ao carregar assinaturas.");

      setPlanos(planosJson.planos ?? []);
      setClientes(clientesJson.clientes ?? []);
      setAssinantes(assinaturasJson.assinantes ?? []);
      setNotificacoes(assinaturasJson.notificacoes_vencimento ?? []);

      if (!planoIdCadastro && (planosJson.planos ?? [])[0]) {
        setPlanoIdCadastro(planosJson.planos[0].id);
      }

      const clientesSemPlano = (clientesJson.clientes ?? []).filter((cliente: ClienteResumo) => !cliente.plano_ativo);
      if (!clienteId && clientesSemPlano[0]) {
        setClienteId(clientesSemPlano[0].id);
      }
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao carregar area de planos.");
    } finally {
      setLoading(false);
    }
  }, [busca, planoIdFiltro, vencimento, planoIdCadastro, clienteId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const clientesSemPlano = useMemo(() => clientes.filter((cliente) => !cliente.plano_ativo), [clientes]);
  const clientesFiltrados = useMemo(() => {
    const termo = clienteBusca.trim().toLowerCase();
    const base = clientesSemPlano;
    if (!termo) {
      return base.slice(0, 12);
    }
    return base
      .filter((cliente) => {
        const nome = cliente.nome.toLowerCase();
        return nome.includes(termo) || cliente.telefone.includes(termo) || (cliente.email_google ?? "").toLowerCase().includes(termo);
      })
      .slice(0, 12);
  }, [clienteBusca, clientesSemPlano]);

  async function adicionarPlano(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");
    setMsg("");
    setSalvando(true);

    try {
      const res = await fetch("/api/admin/assinaturas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "adicionar_plano",
          cliente_id: clienteId,
          plano_id: planoIdCadastro,
          tipo_renovacao: tipoRenovacao,
          inicio_ciclo: inicioCiclo,
          fim_ciclo: fimCiclo,
          observacoes,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.erro || "Erro ao adicionar plano.");
      }

      setMsg("Plano adicionado com sucesso.");
      setObservacoes("");
      await carregar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao adicionar plano.");
    } finally {
      setSalvando(false);
    }
  }

  async function cancelarPlano(clienteIdParam: string, assinaturaId: string) {
    if (!window.confirm("Remover este plano agora? O cliente perdera a assinatura ativa imediatamente.")) {
      return;
    }

    setErro("");
    setMsg("");

    const res = await fetch(`/api/admin/clientes/${clienteIdParam}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "cancelar_plano", assinatura_id: assinaturaId }),
    });
    const json = await res.json();

    if (!res.ok) {
      setErro(json.erro || "Erro ao cancelar plano.");
      return;
    }

    setMsg("Plano cancelado.");
    await carregar();
  }

  return (
    <>
      <AdminPageHeading
        eyebrow="Planos"
        title="Gestao de assinaturas"
        description="Acompanhe os assinantes ativos, veja vencimentos e adicione novos planos sem sair desta area."
      />

      {erro ? <div className="mb-6"><AdminNotice tone="danger">{erro}</AdminNotice></div> : null}
      {msg ? <div className="mb-6"><AdminNotice tone="success">{msg}</AdminNotice></div> : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <AdminMetric label="Assinantes ativos" value={String(assinantes.length)} />
        <AdminMetric label="Alertas de vencimento" value={String(notificacoes.length)} />
        <AdminMetric label="Clientes sem plano" value={String(clientesSemPlano.length)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <AdminPanel title="Adicionar plano" description="Escolha o cliente, selecione o plano e defina o tipo de renovacao. O cliente precisa existir no cadastro antes de entrar aqui.">
          {loading ? <p className="text-[var(--muted)]">Carregando formulario...</p> : null}

          {!loading ? (
            <form onSubmit={adicionarPlano} className="grid gap-4">
              <input
                type="text"
                value={clienteBusca}
                onChange={(event) => setClienteBusca(event.target.value)}
                placeholder="Buscar cliente sem plano"
                className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3"
              />

              <select value={clienteId} onChange={(event) => setClienteId(event.target.value)} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white">
                {clientesFiltrados.length === 0 ? <option value="">Nenhum cliente sem plano encontrado</option> : null}
                {clientesFiltrados.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nome} - {cliente.telefone}
                  </option>
                ))}
              </select>

              <select value={planoIdCadastro} onChange={(event) => setPlanoIdCadastro(event.target.value)} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white">
                {planos.map((plano) => (
                  <option key={plano.id} value={plano.id}>
                    {plano.nome}
                  </option>
                ))}
              </select>

              <select value={tipoRenovacao} onChange={(event) => setTipoRenovacao(event.target.value as "manual" | "automatica")} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white">
                <option value="manual">Renovacao manual</option>
                <option value="automatica">Renovacao automatica</option>
              </select>

              <div className="grid gap-3 sm:grid-cols-2">
                <input type="date" value={inicioCiclo} onChange={(event) => setInicioCiclo(event.target.value)} className="datetime-input rounded-2xl border px-4 py-3" />
                <input type="date" value={fimCiclo} onChange={(event) => setFimCiclo(event.target.value)} className="datetime-input rounded-2xl border px-4 py-3" />
              </div>

              <textarea
                value={observacoes}
                onChange={(event) => setObservacoes(event.target.value)}
                placeholder="Observacoes internas sobre essa assinatura"
                className="min-h-[110px] rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3"
              />

              <AdminActionButton type="submit" disabled={salvando || !clienteId || !planoIdCadastro}>
                {salvando ? "Adicionando..." : "Adicionar plano"}
              </AdminActionButton>
            </form>
          ) : null}
        </AdminPanel>

        <AdminPanel title="Painel de assinantes" description="Filtre por nome, plano ou vencimento. Ao abrir o cliente, voce entra no detalhe completo do assinante.">
          <div className="mb-5 grid gap-3 lg:grid-cols-3">
            <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar nome ou telefone" className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3" />
            <select value={planoIdFiltro} onChange={(event) => setPlanoIdFiltro(event.target.value)} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white">
              <option value="">Todos os planos</option>
              {planos.map((plano) => (
                <option key={plano.id} value={plano.id}>
                  {plano.nome}
                </option>
              ))}
            </select>
            <select value={vencimento} onChange={(event) => setVencimento(event.target.value)} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white">
              <option value="todos">Todos os vencimentos</option>
              <option value="hoje">Vencendo hoje</option>
              <option value="proximos_7">Proximos 7 dias</option>
            </select>
          </div>

          {loading ? <p className="text-[var(--muted)]">Carregando assinantes...</p> : null}
          {!loading && assinantes.length === 0 ? <p className="text-[var(--muted)]">Nenhum assinante encontrado.</p> : null}

          {!loading && assinantes.length > 0 ? (
            <div className="space-y-4">
              {assinantes.map((item) => (
                <div key={item.id} className="grid gap-4 rounded-[24px] border border-white/10 bg-black/20 p-5 xl:grid-cols-[1fr_auto] xl:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-lg font-semibold">{item.clientes?.nome ?? "Cliente"}</p>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs uppercase tracking-[0.16em] text-[var(--accent-strong)]">
                        {item.plano_nome}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[var(--muted)]">{item.clientes?.telefone ?? "-"}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">Vencimento: {item.proxima_renovacao}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">Renovacao: {item.tipo_renovacao}</p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {item.clientes?.id ? (
                      <>
                        <Link href={`/admin/clientes/${item.clientes.id}`} className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/10">
                          Abrir cliente
                        </Link>
                        <AdminActionButton tone="danger" onClick={() => cancelarPlano(item.clientes!.id!, item.id)}>
                          Remover plano
                        </AdminActionButton>
                      </>
                    ) : null}
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

