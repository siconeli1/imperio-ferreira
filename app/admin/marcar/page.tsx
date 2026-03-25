"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getTodayInputValue } from "@/lib/format";
import {
  AdminActionButton,
  AdminNotice,
  AdminPageHeading,
  AdminPanel,
} from "@/app/admin/_components/AdminUi";

type Servico = {
  id: string;
  nome: string;
  duracao_minutos: number;
  preco: number;
};

type Cliente = {
  id: string;
  nome: string;
  telefone: string;
  email_google: string | null;
  plano_nome?: string | null;
};

type AgendaResumo = {
  id: string;
  hora_inicio: string;
  hora_fim: string;
  nome_cliente: string;
  servico_nome: string;
};

export default function AdminMarcarPage() {
  const today = getTodayInputValue();
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [agendaData, setAgendaData] = useState<AgendaResumo[]>([]);
  const [data, setData] = useState(today);
  const [horaInicio, setHoraInicio] = useState("09:00");
  const [servicoId, setServicoId] = useState("");
  const [modoCliente, setModoCliente] = useState<"existente" | "manual">("existente");
  const [buscaCliente, setBuscaCliente] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [nomeCliente, setNomeCliente] = useState("");
  const [celularCliente, setCelularCliente] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const carregarBase = useCallback(async () => {
    setLoading(true);
    setErro("");

    try {
      const [servicosRes, clientesRes] = await Promise.all([
        fetch("/api/servicos", { cache: "no-store" }),
        fetch("/api/admin/clientes", { cache: "no-store" }),
      ]);
      const [servicosJson, clientesJson] = await Promise.all([servicosRes.json(), clientesRes.json()]);

      if (!servicosRes.ok) {
        throw new Error(servicosJson.erro || "Erro ao carregar servicos.");
      }
      if (!clientesRes.ok) {
        throw new Error(clientesJson.erro || "Erro ao carregar clientes.");
      }

      const servicosAtivos = servicosJson.servicos ?? [];
      setServicos(servicosAtivos);
      setClientes(clientesJson.clientes ?? []);

      if (servicosAtivos[0] && !servicoId) {
        setServicoId(servicosAtivos[0].id);
      }
      if ((clientesJson.clientes ?? [])[0] && !clienteId) {
        setClienteId(clientesJson.clientes[0].id);
      }
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }, [clienteId, servicoId]);

  const carregarAgendaDia = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin-agenda?data=${encodeURIComponent(data)}`, { cache: "no-store" });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.erro || "Erro ao carregar agenda do dia.");
      }

      setAgendaData((json ?? []).filter((item: AgendaResumo & { origem?: string }) => item.origem !== "horario_customizado"));
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao carregar agenda do dia.");
    }
  }, [data]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void carregarBase();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [carregarBase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void carregarAgendaDia();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [carregarAgendaDia]);

  const clientesFiltrados = useMemo(() => {
    const termo = buscaCliente.trim().toLowerCase();
    if (!termo) {
      return clientes.slice(0, 10);
    }

    return clientes
      .filter((cliente) => {
        const nome = cliente.nome.toLowerCase();
        return nome.includes(termo) || cliente.telefone.includes(termo) || (cliente.email_google ?? "").toLowerCase().includes(termo);
      })
      .slice(0, 10);
  }, [buscaCliente, clientes]);

  const clienteSelecionado = useMemo(
    () => clientes.find((cliente) => cliente.id === clienteId) ?? null,
    [clienteId, clientes]
  );

  async function marcarHorario(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");
    setMsg("");
    setSalvando(true);

    try {
      const res = await fetch("/api/admin-agenda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data,
          hora_inicio: horaInicio,
          servico_id: servicoId,
          cliente_id: modoCliente === "existente" ? clienteId : null,
          nome_cliente: modoCliente === "manual" ? nomeCliente : null,
          celular_cliente: modoCliente === "manual" ? celularCliente : null,
          observacoes,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.erro || "Erro ao marcar horario.");
      }

      setMsg(json.aviso || "Horario marcado com sucesso.");
      setObservacoes("");
      if (modoCliente === "manual") {
        setNomeCliente("");
        setCelularCliente("");
      }
      await carregarAgendaDia();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao marcar horario.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <AdminPageHeading
        eyebrow="Marcar horarios"
        title="Marcacao manual do barbeiro"
        description="Aqui voce pode marcar qualquer data e qualquer horario. O sistema so trava quando ja existe outro compromisso, reserva manual ou bloqueio no mesmo intervalo."
      />

      {erro ? <div className="mb-6"><AdminNotice tone="danger">{erro}</AdminNotice></div> : null}
      {msg ? <div className="mb-6"><AdminNotice tone="success">{msg}</AdminNotice></div> : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <AdminPanel title="Novo horario" description="Escolha servico, data, inicio e o cliente. Se o cliente ainda nao estiver cadastrado, voce pode preencher manualmente.">
          {loading ? <p className="text-[var(--muted)]">Carregando base do formulario...</p> : null}

          {!loading ? (
            <form onSubmit={marcarHorario} className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <input type="date" value={data} onChange={(event) => setData(event.target.value)} className="datetime-input rounded-2xl border px-4 py-3" />
                <input type="time" value={horaInicio} onChange={(event) => setHoraInicio(event.target.value)} className="datetime-input rounded-2xl border px-4 py-3" />
              </div>

              <select value={servicoId} onChange={(event) => setServicoId(event.target.value)} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white">
                {servicos.map((servico) => (
                  <option key={servico.id} value={servico.id}>
                    {servico.nome} • {servico.duracao_minutos} min • {Number(servico.preco).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </option>
                ))}
              </select>

              <div className="flex flex-wrap gap-2">
                <AdminActionButton type="button" tone={modoCliente === "existente" ? "primary" : "secondary"} onClick={() => setModoCliente("existente")}>
                  Cliente cadastrado
                </AdminActionButton>
                <AdminActionButton type="button" tone={modoCliente === "manual" ? "primary" : "secondary"} onClick={() => setModoCliente("manual")}>
                  Preencher manualmente
                </AdminActionButton>
              </div>

              {modoCliente === "existente" ? (
                <div className="grid gap-3">
                  <input
                    type="text"
                    value={buscaCliente}
                    onChange={(event) => setBuscaCliente(event.target.value)}
                    placeholder="Buscar cliente por nome, celular ou e-mail"
                    className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3"
                  />
                  <select value={clienteId} onChange={(event) => setClienteId(event.target.value)} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white">
                    {clientesFiltrados.length === 0 ? <option value="">Nenhum cliente encontrado</option> : null}
                    {clientesFiltrados.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.nome} • {cliente.telefone}
                      </option>
                    ))}
                  </select>

                  {clienteSelecionado ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-[var(--muted)]">
                      <p>{clienteSelecionado.nome}</p>
                      <p className="mt-1">{clienteSelecionado.telefone}</p>
                      <p className="mt-1">{clienteSelecionado.email_google || "Sem e-mail Google encontrado"}</p>
                      <p className="mt-2 text-[var(--accent-strong)]">{clienteSelecionado.plano_nome || "Sem plano ativo"}</p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="grid gap-3">
                  <input
                    type="text"
                    value={nomeCliente}
                    onChange={(event) => setNomeCliente(event.target.value)}
                    placeholder="Nome do cliente"
                    className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3"
                  />
                  <input
                    type="text"
                    value={celularCliente}
                    onChange={(event) => setCelularCliente(event.target.value)}
                    placeholder="Celular do cliente"
                    className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3"
                  />
                </div>
              )}

              <textarea
                value={observacoes}
                onChange={(event) => setObservacoes(event.target.value)}
                placeholder="Observacoes internas (opcional)"
                className="min-h-[110px] rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3"
              />

              <AdminActionButton
                type="submit"
                disabled={salvando || !servicoId || (modoCliente === "existente" ? !clienteId : !nomeCliente || !celularCliente)}
              >
                {salvando ? "Salvando..." : "Marcar horario"}
              </AdminActionButton>
            </form>
          ) : null}
        </AdminPanel>

        <AdminPanel title="Compromissos da data" description="Use esta coluna para bater o olho e evitar choque de horario antes de salvar.">
          <div className="mb-5 max-w-xs">
            <label className="text-sm text-[var(--muted)]">Data consultada</label>
            <input
              type="date"
              value={data}
              onChange={(event) => setData(event.target.value)}
              className="datetime-input mt-3 w-full rounded-2xl border px-4 py-3"
            />
          </div>

          {agendaData.length === 0 ? <p className="text-[var(--muted)]">Nenhum horario ativo nessa data.</p> : null}

          {agendaData.length > 0 ? (
            <div className="space-y-4">
              {agendaData.map((item) => (
                <div key={item.id} className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                  <p className="font-semibold">{item.hora_inicio.slice(0, 5)} - {item.hora_fim.slice(0, 5)}</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">{item.nome_cliente}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{item.servico_nome}</p>
                </div>
              ))}
            </div>
          ) : null}
        </AdminPanel>
      </div>
    </>
  );
}
