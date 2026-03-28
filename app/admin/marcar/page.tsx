"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getTodayInputValue } from "@/lib/format";
import {
  AdminActionButton,
  AdminNotice,
  AdminPageHeading,
  AdminPanel,
  AdminScopeNotice,
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

type AdminMeResponse = {
  barbeiro: {
    id: string;
    nome: string;
    cargo: "socio" | "barbeiro";
  };
};

type BarbeiroOption = {
  id: string;
  nome: string;
};

export default function AdminMarcarPage() {
  const today = getTodayInputValue();
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [agendaData, setAgendaData] = useState<AgendaResumo[]>([]);
  const [adminCargo, setAdminCargo] = useState<"socio" | "barbeiro" | "">("");
  const [barbeiros, setBarbeiros] = useState<BarbeiroOption[]>([]);
  const [barbeiroId, setBarbeiroId] = useState("");
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
  const [contextLoading, setContextLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const carregarBase = useCallback(async () => {
    setLoading(true);
    setErro("");

    try {
      const [adminRes, servicosRes, clientesRes] = await Promise.all([
        fetch("/api/admin/me", { cache: "no-store" }),
        fetch("/api/servicos", { cache: "no-store" }),
        fetch("/api/admin/clientes", { cache: "no-store" }),
      ]);
      const [adminJson, servicosJson, clientesJson] = await Promise.all([
        adminRes.json(),
        servicosRes.json(),
        clientesRes.json(),
      ]);

      if (!adminRes.ok) {
        throw new Error(adminJson.erro || "Erro ao carregar sessao administrativa.");
      }

      if (!servicosRes.ok) {
        throw new Error(servicosJson.erro || "Erro ao carregar servicos.");
      }
      if (!clientesRes.ok) {
        throw new Error(clientesJson.erro || "Erro ao carregar clientes.");
      }

      const admin = (adminJson as AdminMeResponse).barbeiro;
      setAdminCargo(admin.cargo);

      if (admin.cargo === "socio") {
        const barbeirosRes = await fetch("/api/barbeiros", { cache: "no-store" });
        const barbeirosJson = await barbeirosRes.json();

        if (!barbeirosRes.ok) {
          throw new Error(barbeirosJson.erro || "Erro ao carregar barbeiros.");
        }

        const options = (barbeirosJson.barbeiros ?? []) as BarbeiroOption[];
        setBarbeiros(options);
        setBarbeiroId((current) => current || admin.id);
      } else {
        setBarbeiros([{ id: admin.id, nome: admin.nome }]);
        setBarbeiroId(admin.id);
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
      setContextLoading(false);
      setLoading(false);
    }
  }, [clienteId, servicoId]);

  const carregarAgendaDia = useCallback(async () => {
    if (contextLoading) {
      return;
    }

    if (!barbeiroId) {
      setAgendaData([]);
      return;
    }

    try {
      const search = new URLSearchParams({ data, barbeiro_id: barbeiroId });
      const res = await fetch(`/api/admin-agenda?${search.toString()}`, { cache: "no-store" });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.erro || "Erro ao carregar agenda do dia.");
      }

      setAgendaData((json ?? []).filter((item: AgendaResumo & { origem?: string }) => item.origem !== "horario_customizado"));
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao carregar agenda do dia.");
    }
  }, [barbeiroId, contextLoading, data]);

  useEffect(() => {
    void carregarBase();
  }, [carregarBase]);

  useEffect(() => {
    void carregarAgendaDia();
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
  const barbeiroSelecionado = useMemo(
    () => barbeiros.find((barbeiro) => barbeiro.id === barbeiroId) ?? null,
    [barbeiroId, barbeiros]
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
          barbeiro_id: barbeiroId,
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
        title="Marcar horario manualmente"
        description="Escolha a data, o horario, o servico e o cliente. O sistema so impede a marcacao quando ja existe conflito real na sua agenda."
      />

      {erro ? <div className="mb-6"><AdminNotice tone="danger">{erro}</AdminNotice></div> : null}
      {msg ? <div className="mb-6"><AdminNotice tone="success">{msg}</AdminNotice></div> : null}
      {adminCargo === "socio" && barbeiroSelecionado ? (
        <div className="mb-6">
          <AdminScopeNotice
            title={`Novo horario para ${barbeiroSelecionado.nome}.`}
            description="A marcacao manual e a consulta da agenda desta tela vao usar o barbeiro selecionado."
          />
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <AdminPanel title="Novo horario" description="Escolha o servico, defina a data e selecione um cliente cadastrado. Se precisar, voce tambem pode preencher o cliente manualmente.">
          {loading ? <p className="text-[var(--muted)]">Carregando base do formulario...</p> : null}

          {!loading ? (
            <form onSubmit={marcarHorario} className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <input type="date" value={data} onChange={(event) => setData(event.target.value)} className="datetime-input rounded-2xl border px-4 py-3" />
                <input type="time" value={horaInicio} onChange={(event) => setHoraInicio(event.target.value)} className="datetime-input rounded-2xl border px-4 py-3" />
              </div>

              {adminCargo === "socio" ? (
                <select value={barbeiroId} onChange={(event) => setBarbeiroId(event.target.value)} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white">
                  {barbeiros.map((barbeiro) => (
                    <option key={barbeiro.id} value={barbeiro.id}>
                      {barbeiro.nome}
                    </option>
                  ))}
                </select>
              ) : null}

              <select value={servicoId} onChange={(event) => setServicoId(event.target.value)} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white">
                {servicos.map((servico) => (
                  <option key={servico.id} value={servico.id}>
                    {servico.nome} - {servico.duracao_minutos} min - {Number(servico.preco).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
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
                        {cliente.nome} - {cliente.telefone}
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
                disabled={salvando || !barbeiroId || !servicoId || (modoCliente === "existente" ? !clienteId : !nomeCliente || !celularCliente)}
              >
                {salvando ? "Salvando..." : "Marcar horario"}
              </AdminActionButton>
            </form>
          ) : null}
        </AdminPanel>

        <AdminPanel title="Agenda da data" description="Confira os horarios ja ocupados antes de salvar para evitar encaixes conflitantes.">
          <div className="mb-5 max-w-xs">
            <label className="text-sm text-[var(--muted)]">Data consultada</label>
            <input
              type="date"
              value={data}
              onChange={(event) => setData(event.target.value)}
              className="datetime-input mt-3 w-full rounded-2xl border px-4 py-3"
            />
          </div>

          {contextLoading ? <p className="text-[var(--muted)]">Carregando agenda...</p> : null}

          {!contextLoading && agendaData.length === 0 ? <p className="text-[var(--muted)]">Nenhum horario ativo nessa data.</p> : null}

          {!contextLoading && agendaData.length > 0 ? (
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

