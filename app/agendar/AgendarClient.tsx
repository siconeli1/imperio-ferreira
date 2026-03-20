"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatarCelular, getTodayInputValue, isDateBeyondLimit, isDateInPast } from "@/lib/format";
import type { Servico } from "@/lib/servicos";

type BarbeiroOption = {
  id: string;
  nome: string;
  slug: string;
};

type Slot = {
  hora_inicio: string;
  hora_fim: string;
  barbeiros_disponiveis: string[];
};

type AgendarClientProps = {
  initialServicos: Servico[];
  initialBarbeiros: BarbeiroOption[];
  initialErro?: string;
};

type Confirmacao = {
  nome: string;
  celular: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  servico_nome: string;
  servico_preco: number;
  servico_duracao: number;
  barbeiro_nome: string;
};

export default function AgendarClient({
  initialServicos,
  initialBarbeiros,
  initialErro,
}: AgendarClientProps) {
  const [servicoId, setServicoId] = useState(initialServicos[0]?.id ?? "");
  const [barbeiroId, setBarbeiroId] = useState("qualquer");
  const [data, setData] = useState("");
  const [horarios, setHorarios] = useState<Slot[]>([]);
  const [todosHorarios, setTodosHorarios] = useState<Slot[]>([]);
  const [horarioSelecionado, setHorarioSelecionado] = useState("");
  const [nome, setNome] = useState("");
  const [celular, setCelular] = useState("");
  const [erro, setErro] = useState(initialErro ?? "");
  const [msg, setMsg] = useState("");
  const [loadingHorarios, setLoadingHorarios] = useState(false);
  const [loadingReserva, setLoadingReserva] = useState(false);
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);

  const servicoSelecionado = initialServicos.find((servico) => servico.id === servicoId) ?? null;
  const slotSelecionado = todosHorarios.find((slot) => slot.hora_inicio === horarioSelecionado) ?? null;
  const barbeiroEscolhido =
    barbeiroId === "qualquer"
      ? null
      : initialBarbeiros.find((barbeiro) => barbeiro.id === barbeiroId) ?? null;

  const dayNumber = data ? new Date(`${data}T00:00:00`).getDay() : -1;
  const isSaturday = dayNumber === 6;
  const isSunday = dayNumber === 0;
  const pastDate = data ? isDateInPast(data) : false;
  const outOfRange = data ? isDateBeyondLimit(data, 30) : false;
  const isClosedDay = isSaturday || isSunday;

  const currentStep = useMemo(() => {
    if (!servicoId) return 1;
    if (!data || pastDate || outOfRange || isClosedDay) return 2;
    if (!horarioSelecionado) return 3;
    if (!nome || !celular) return 4;
    return 5;
  }, [celular, data, horarioSelecionado, isClosedDay, nome, outOfRange, pastDate, servicoId]);

  useEffect(() => {
    async function buscarHorarios() {
      if (!data || !servicoSelecionado || pastDate || outOfRange || isClosedDay) {
        setHorarios([]);
        setTodosHorarios([]);
        setHorarioSelecionado("");
        return;
      }

      setLoadingHorarios(true);
      setErro("");

      try {
        const res = await fetch(
          `/api/horarios?data=${encodeURIComponent(data)}&servico_id=${encodeURIComponent(
            servicoSelecionado.id
          )}&barbeiro_id=${encodeURIComponent(barbeiroId)}`
        );
        const json = await res.json();

        if (!res.ok) {
          setErro(json.erro || "Erro ao buscar horarios");
          setHorarios([]);
          setTodosHorarios([]);
          return;
        }

        setHorarios(json.horarios ?? []);
        setTodosHorarios(json.horarios_completos ?? json.horarios ?? []);
      } catch {
        setErro("Erro ao carregar horarios");
        setHorarios([]);
        setTodosHorarios([]);
      } finally {
        setLoadingHorarios(false);
      }
    }

    void buscarHorarios();
  }, [barbeiroId, data, isClosedDay, outOfRange, pastDate, servicoSelecionado]);

  useEffect(() => {
    setHorarioSelecionado("");
  }, [barbeiroId, servicoId]);

  async function reservar() {
    if (!servicoSelecionado || !data || !horarioSelecionado || !nome || !celular) {
      setErro("Preencha os campos obrigatorios.");
      return;
    }

    setLoadingReserva(true);
    setErro("");
    setMsg("");

    try {
      const res = await fetch("/api/reservar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data,
          hora_inicio: horarioSelecionado,
          servico_id: servicoSelecionado.id,
          barbeiro_id: barbeiroId,
          nome,
          celular,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        setErro(json.erro || "Erro ao confirmar agendamento");
        return;
      }

      setConfirmacao({
        nome,
        celular,
        data,
        hora_inicio: horarioSelecionado,
        hora_fim: slotSelecionado?.hora_fim ?? "-",
        servico_nome: servicoSelecionado.nome,
        servico_preco: Number(servicoSelecionado.preco),
        servico_duracao: Number(servicoSelecionado.duracao_minutos),
        barbeiro_nome: json.barbeiro?.nome ?? barbeiroEscolhido?.nome ?? "Barbeiro selecionado automaticamente",
      });

      setNome("");
      setCelular("");
      setData("");
      setBarbeiroId("qualquer");
      setHorarioSelecionado("");
      setHorarios([]);
      setTodosHorarios([]);
      setMsg("Agendamento confirmado com sucesso.");
    } catch {
      setErro("Erro ao conectar com o servidor");
    } finally {
      setLoadingReserva(false);
    }
  }

  function formatarPreco(valor: number) {
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function formatarDataResumo(valor: string) {
    const [ano, mes, dia] = valor.split("-");
    return `${dia}/${mes}/${ano}`;
  }

  if (confirmacao) {
    return (
      <main className="min-h-screen bg-[var(--background)] text-white">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
          <Link href="/" className="mb-8 inline-flex items-center gap-2 text-[var(--muted)] hover:text-white">
            Voltar
          </Link>

          <section className="grid overflow-hidden border border-white/10 bg-white/[0.03] lg:grid-cols-[1.1fr_0.9fr]">
            <div className="border-b border-white/10 p-8 lg:border-b-0 lg:border-r lg:p-12">
              <p className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-300">
                Horario confirmado
              </p>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight">Seu atendimento esta reservado.</h1>
              <p className="mt-4 max-w-xl text-lg leading-8 text-[var(--muted)]">
                Conferimos a disponibilidade e registramos seu horario na agenda do barbeiro correto.
              </p>

              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                <div className="border border-white/10 bg-black/25 p-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Servico</p>
                  <p className="mt-2 text-xl font-semibold">{confirmacao.servico_nome}</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {confirmacao.servico_duracao} min • {formatarPreco(confirmacao.servico_preco)}
                  </p>
                </div>
                <div className="border border-white/10 bg-black/25 p-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Barbeiro</p>
                  <p className="mt-2 text-xl font-semibold">{confirmacao.barbeiro_nome}</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {formatarDataResumo(confirmacao.data)} • {confirmacao.hora_inicio} ate {confirmacao.hora_fim}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-8 lg:p-10">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Resumo</p>
              <div className="mt-6 space-y-4 text-sm">
                <ResumoItem label="Cliente" value={confirmacao.nome} />
                <ResumoItem label="Celular" value={confirmacao.celular} />
                <ResumoItem label="Data" value={formatarDataResumo(confirmacao.data)} />
                <ResumoItem label="Inicio" value={confirmacao.hora_inicio} />
                <ResumoItem label="Fim" value={confirmacao.hora_fim} />
                <ResumoItem label="Barbeiro" value={confirmacao.barbeiro_nome} />
                <ResumoItem label="Valor" value={formatarPreco(confirmacao.servico_preco)} />
              </div>

              <div className="mt-10 grid gap-3">
                <Link href="/" className="inline-flex items-center justify-center bg-[var(--accent)] px-6 py-3 font-semibold text-black hover:bg-[var(--accent-strong)]">
                  Voltar para a home
                </Link>
                <Link
                  href={`/meus-agendamentos?celular=${encodeURIComponent(confirmacao.celular)}`}
                  className="inline-flex items-center justify-center border border-white/20 px-6 py-3 font-semibold hover:bg-white/10"
                >
                  Ver meus agendamentos
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-white">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="mb-12 border-b border-white/10 pb-10 text-center">
          <Link href="/" className="mb-6 inline-flex items-center gap-2 text-[var(--muted)] hover:text-white">
            Voltar
          </Link>
          <h1 className="text-4xl font-semibold">Agendar horario</h1>
          <p className="mt-3 text-lg text-[var(--muted)]">
            Escolha servico, data e o barbeiro desejado ou deixe que a barbearia defina automaticamente.
          </p>
        </div>

        <div className="mb-8 flex flex-wrap items-center justify-center gap-4 text-sm">
          {["Servico", "Data", "Barbeiro", "Horario", "Dados"].map((item, index) => (
            <div key={item} className="flex items-center gap-3">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full font-semibold ${index + 1 <= currentStep ? "bg-[var(--accent)] text-black" : "bg-white/10 text-[var(--muted)]"}`}>
                {index + 1}
              </div>
              <span className={index + 1 <= currentStep ? "text-white" : "text-[var(--muted)]"}>{item}</span>
            </div>
          ))}
        </div>

        {erro && <Banner tone="danger">{erro}</Banner>}
        {msg && <Banner tone="success">{msg}</Banner>}

        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-8">
            <Card title="1. Servico">
              <div className="grid gap-3 sm:grid-cols-2">
                {initialServicos.map((servico) => {
                  const ativo = servico.id === servicoId;
                  return (
                    <button
                      key={servico.id}
                      type="button"
                      onClick={() => setServicoId(servico.id)}
                      className={`border p-4 text-left ${ativo ? "border-[var(--accent)] bg-[var(--accent)] text-black" : "border-white/10 bg-white/[0.03] hover:border-white/30"}`}
                    >
                      <p className="font-semibold">{servico.nome}</p>
                      <p className={`mt-2 text-sm ${ativo ? "text-black/70" : "text-[var(--muted)]"}`}>
                        {servico.duracao_minutos} min • {formatarPreco(Number(servico.preco))}
                      </p>
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card title="2. Data e barbeiro">
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  type="date"
                  value={data}
                  onChange={(event) => setData(event.target.value)}
                  min={getTodayInputValue()}
                  className="datetime-input rounded-xl border px-4 py-3"
                />
                <select
                  value={barbeiroId}
                  onChange={(event) => setBarbeiroId(event.target.value)}
                  className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white"
                >
                  <option value="qualquer">Qualquer um disponivel</option>
                  {initialBarbeiros.map((barbeiro) => (
                    <option key={barbeiro.id} value={barbeiro.id}>
                      {barbeiro.nome}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-4 text-sm text-[var(--muted)]">
                {pastDate && "A data escolhida esta no passado."}
                {outOfRange && " A data esta fora da janela de 30 dias."}
                {isClosedDay && " A barbearia nao atende aos sabados e domingos."}
                {!pastDate && !outOfRange && !isClosedDay && " Atendimento de segunda a sexta, das 08:30 as 12:00 e das 14:00 as 20:00."}
              </p>
            </Card>

            <Card title="3. Horarios disponiveis">
              {loadingHorarios && <p className="text-[var(--muted)]">Carregando horarios...</p>}
              {!loadingHorarios && todosHorarios.length === 0 && data && !pastDate && !outOfRange && !isClosedDay && (
                <p className="text-[var(--muted)]">Nenhum horario encontrado para esta combinacao.</p>
              )}
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                {horarios.map((slot) => (
                  <button
                    key={slot.hora_inicio}
                    type="button"
                    onClick={() => setHorarioSelecionado(slot.hora_inicio)}
                    className={`border px-3 py-3 text-sm font-medium ${horarioSelecionado === slot.hora_inicio ? "border-[var(--accent)] bg-[var(--accent)] text-black" : "border-white/15 bg-white/[0.03] hover:border-white/35"}`}
                  >
                    {slot.hora_inicio}
                  </button>
                ))}
              </div>
              {barbeiroId === "qualquer" && (
                <p className="mt-4 text-sm text-[var(--muted)]">
                  Nos horarios exibidos, pelo menos um barbeiro ativo esta livre. A definicao final acontece no backend ao confirmar.
                </p>
              )}
            </Card>

            <Card title="4. Seus dados">
              <div className="grid gap-4">
                <input
                  type="text"
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  placeholder="Nome completo"
                  className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3"
                />
                <input
                  type="tel"
                  value={celular}
                  onChange={(event) => setCelular(formatarCelular(event.target.value))}
                  placeholder="(11) 99999-9999"
                  maxLength={15}
                  className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3"
                />
              </div>
            </Card>
          </section>

          <aside className="h-fit border border-white/10 bg-white/[0.03] p-6 lg:sticky lg:top-8">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent-strong)]">Resumo</p>
            <div className="mt-6 space-y-4 text-sm">
              <ResumoItem label="Servico" value={servicoSelecionado?.nome ?? "-"} />
              <ResumoItem label="Duracao" value={servicoSelecionado ? `${servicoSelecionado.duracao_minutos} min` : "-"} />
              <ResumoItem label="Valor" value={servicoSelecionado ? formatarPreco(Number(servicoSelecionado.preco)) : "-"} />
              <ResumoItem label="Barbeiro" value={barbeiroEscolhido?.nome ?? "Qualquer um disponivel"} />
              <ResumoItem label="Data" value={data ? formatarDataResumo(data) : "-"} />
              <ResumoItem label="Inicio" value={horarioSelecionado || "-"} />
              <ResumoItem label="Fim" value={slotSelecionado?.hora_fim ?? "-"} />
              <ResumoItem
                label="Cobertura"
                value={
                  slotSelecionado && barbeiroId === "qualquer"
                    ? `${slotSelecionado.barbeiros_disponiveis.length} barbeiro(s) livre(s)`
                    : barbeiroEscolhido?.nome ?? "-"
                }
              />
            </div>

            <button
              type="button"
              onClick={reservar}
              disabled={!servicoSelecionado || !data || !horarioSelecionado || !nome || !celular || loadingReserva}
              className="mt-8 inline-flex w-full items-center justify-center bg-[var(--accent)] px-6 py-3 font-semibold text-black hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingReserva ? "Confirmando..." : "Confirmar agendamento"}
            </button>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-white/10 bg-white/[0.03] p-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ResumoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/8 pb-3">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="text-right font-medium text-white">{value}</span>
    </div>
  );
}

function Banner({ tone, children }: { tone: "danger" | "success"; children: React.ReactNode }) {
  return (
    <div
      className={`mb-6 border px-4 py-3 ${
        tone === "danger"
          ? "border-red-700 bg-red-950/60 text-red-200"
          : "border-emerald-700 bg-emerald-950/40 text-emerald-200"
      }`}
    >
      {children}
    </div>
  );
}
