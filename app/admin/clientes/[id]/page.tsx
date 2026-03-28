"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
  descricao: string | null;
  preco: number;
  cortes_incluidos: number;
  barbas_incluidas: number;
  sobrancelhas_incluidas: number;
};

type ClienteDetalhe = {
  cliente: {
    id: string;
    nome: string;
    telefone: string;
    email_google: string | null;
    data_nascimento: string | null;
    whatsapp_link: string;
  };
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
    setErro("");

    const [detalheRes, planosRes] = await Promise.all([
      fetch(`/api/admin/clientes/${clienteId}`, { cache: "no-store" }),
      fetch("/api/planos", { cache: "no-store" }),
    ]);
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
    setPlanoId(detalheJson.assinatura?.plano_id ?? planosJson.planos?.[0]?.id ?? "");
    setTipoRenovacao(detalheJson.assinatura?.tipo_renovacao ?? "manual");
    setInicioCiclo(detalheJson.assinatura?.inicio_ciclo ?? getTodayInputValue());
    setFimCiclo(detalheJson.assinatura?.fim_ciclo ?? getTodayInputValue());
    setObservacoes(String(detalheJson.assinatura?.observacoes_internas ?? ""));
    setLoading(false);
  }, [clienteId]);

  useEffect(() => {
    if (!clienteId) return;
    let cancelled = false;

    void (async () => {
      await Promise.resolve();
      if (!cancelled) {
        await carregar();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [carregar, clienteId]);

  async function acaoPlano(acao: "adicionar_plano" | "renovar_plano" | "troca_imediata") {
    const mensagens = {
      adicionar_plano: "Adicionar este plano ao cliente agora?",
      renovar_plano: "Renovar o plano deste cliente agora?",
      troca_imediata: "Aplicar a troca imediata deste plano agora? Os creditos novos entram no ciclo atual.",
    } as const;

    if (!window.confirm(mensagens[acao])) {
      return;
    }

    setErro("");
    setMsg("");

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
    if (!window.confirm("Cancelar o plano ativo deste cliente agora?")) return;

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
    if (!window.confirm("Registrar esse uso manual do plano agora? Essa acao consome creditos do cliente.")) {
      return;
    }

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
    <>
      <AdminPageHeading
        eyebrow="Perfil do cliente"
        title={detalhe?.cliente.nome ?? "Carregando cliente"}
        description="Veja os dados do cliente, o uso do plano, o historico financeiro e as acoes administrativas em uma unica tela."
      />

      {erro ? <div className="mb-6"><AdminNotice tone="danger">{erro}</AdminNotice></div> : null}
      {msg ? <div className="mb-6"><AdminNotice tone="success">{msg}</AdminNotice></div> : null}
      {loading ? <p className="text-[var(--muted)]">Carregando perfil...</p> : null}

      {!loading && detalhe ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-6">
            <AdminMetric label="Plano atual" value={detalhe.plano?.nome ?? "Sem plano"} />
            <AdminMetric label="Cortes" value={String(detalhe.assinatura?.cortes_restantes ?? 0)} />
            <AdminMetric label="Barbas" value={String(detalhe.assinatura?.barbas_restantes ?? 0)} />
            <AdminMetric label="Sobrancelhas" value={String(detalhe.assinatura?.sobrancelhas_restantes ?? 0)} />
            <AdminMetric label="Faltas" value={String(detalhe.faltas_periodo ?? 0)} />
            <AdminMetric label="Cancelamentos" value={String(detalhe.cancelamentos_periodo ?? 0)} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <AdminPanel title="Dados do cliente" description="Estas informacoes valem para qualquer barbeiro da barbearia, porque o cadastro do cliente e unico.">
              <div className="space-y-3 text-sm text-[var(--muted)]">
                <p><span className="text-white">Nome:</span> {detalhe.cliente.nome}</p>
                <p><span className="text-white">Celular:</span> {detalhe.cliente.telefone}</p>
                <p><span className="text-white">Google:</span> {detalhe.cliente.email_google || "Nao encontrado"}</p>
                <p><span className="text-white">Nascimento:</span> {detalhe.cliente.data_nascimento || "-"}</p>
              </div>
              <div className="mt-5">
                <a href={detalhe.cliente.whatsapp_link} target="_blank" rel="noreferrer" className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/10">
                  Abrir WhatsApp
                </a>
              </div>
            </AdminPanel>

            <AdminPanel title="Gestao do plano" description="Adicione, renove, troque imediatamente ou cancele o plano do cliente sem sair desta tela.">
              <div className="grid gap-4">
                <select value={planoId} onChange={(event) => setPlanoId(event.target.value)} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white">
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

                <div className="flex flex-wrap gap-3">
                  {!detalhe.assinatura ? <AdminActionButton onClick={() => acaoPlano("adicionar_plano")}>Adicionar plano</AdminActionButton> : null}
                  {detalhe.assinatura ? <AdminActionButton onClick={() => acaoPlano("renovar_plano")}>Renovar plano</AdminActionButton> : null}
                  {detalhe.assinatura ? <AdminActionButton tone="secondary" onClick={() => acaoPlano("troca_imediata")}>Troca imediata</AdminActionButton> : null}
                  {detalhe.assinatura ? <AdminActionButton tone="danger" onClick={cancelarPlano}>Cancelar plano</AdminActionButton> : null}
                </div>
              </div>
            </AdminPanel>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <AdminPanel title="Registrar uso manual" description="Use quando o cliente foi atendido sem agendamento e o consumo precisa entrar no plano mesmo assim.">
              <div className="grid gap-4">
                <select value={categoriaUso} onChange={(event) => setCategoriaUso(event.target.value as "corte" | "barba" | "sobrancelha")} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white">
                  <option value="corte">Corte</option>
                  <option value="barba">Barba</option>
                  <option value="sobrancelha">Sobrancelha</option>
                </select>
                <input type="number" min={1} value={quantidadeUso} onChange={(event) => setQuantidadeUso(Number(event.target.value) || 1)} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3" />
                <AdminActionButton onClick={registrarUsoManual}>Registrar uso do plano</AdminActionButton>
              </div>
            </AdminPanel>

            <AdminPanel title="Observacoes internas" description="Notas de contexto para o barbeiro lembrar preferencias, comportamento ou combinados.">
              <textarea value={observacoes} onChange={(event) => setObservacoes(event.target.value)} className="min-h-[140px] w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3" placeholder="Escreva observacoes internas sobre o cliente ou a assinatura." />
              {detalhe.assinatura ? (
                <div className="mt-4">
                  <AdminActionButton onClick={salvarObservacoes}>Salvar observacoes</AdminActionButton>
                </div>
              ) : null}
            </AdminPanel>
          </div>

          <div className="grid gap-6 xl:grid-cols-4">
            <AdminPanel title="Reservas do periodo">
              <div className="space-y-3">
                {detalhe.reservas_periodo.slice(0, 8).map((item, index) => (
                  <div key={`${item.id ?? index}`} className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-[var(--muted)]">
                    {String(item.data ?? "-")} - {String(item.servico_nome ?? "-")} - {String(item.status_agendamento ?? "agendado")}
                  </div>
                ))}
                {detalhe.reservas_periodo.length === 0 ? <p className="text-[var(--muted)]">Sem reservas no ciclo.</p> : null}
              </div>
            </AdminPanel>

            <AdminPanel title="Historico de uso">
              <div className="space-y-3">
                {detalhe.historico_uso.slice(0, 8).map((item, index) => (
                  <div key={`${item.id ?? index}`} className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-[var(--muted)]">
                    {String(item.tipo_movimentacao ?? "-")} - {String(item.categoria_servico ?? "-")} - {String(item.quantidade ?? 1)}
                  </div>
                ))}
                {detalhe.historico_uso.length === 0 ? <p className="text-[var(--muted)]">Sem uso registrado.</p> : null}
              </div>
            </AdminPanel>

            <AdminPanel title="Historico financeiro">
              <div className="space-y-3">
                {detalhe.financeiro.slice(0, 8).map((item, index) => (
                  <div key={`${item.id ?? index}`} className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-[var(--muted)]">
                    {String(item.descricao ?? "-")} - {Number(item.valor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </div>
                ))}
                {detalhe.financeiro.length === 0 ? <p className="text-[var(--muted)]">Sem lancamentos.</p> : null}
              </div>
            </AdminPanel>

            <AdminPanel title="Historico de telefone">
              <div className="space-y-3">
                {detalhe.historico_telefone.slice(0, 8).map((item, index) => (
                  <div key={`${item.id ?? index}`} className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-[var(--muted)]">
                    {String(item.telefone ?? "-")} - {String(item.origem ?? "-")}
                  </div>
                ))}
                {detalhe.historico_telefone.length === 0 ? <p className="text-[var(--muted)]">Sem alteracoes registradas.</p> : null}
              </div>
            </AdminPanel>
          </div>
        </div>
      ) : null}
    </>
  );
}

