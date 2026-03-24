"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CustomerOnboardingCard } from "@/app/_components/CustomerOnboardingCard";
import { formatarCelular, getTodayInputValue, isDateBeyondLimit, isDateInPast } from "@/lib/format";
import { useCustomerSession } from "@/lib/use-customer-session";
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
  data: string;
  hora_inicio: string;
  hora_fim: string;
  barbeiro_nome: string;
  servico: { id: string; nome: string; preco: number; duracao_minutos: number; tipo_cobranca?: string };
  nome_cliente: string;
  telefone: string;
};

export default function AgendarClient({ initialServicos, initialBarbeiros, initialErro }: AgendarClientProps) {
  const { accessToken, profile, sessionReady, refresh, signInWithGoogle, signOut } = useCustomerSession();
  const [servicoId, setServicoId] = useState(initialServicos[0]?.id ?? "");
  const [barbeiroId, setBarbeiroId] = useState("qualquer");
  const [data, setData] = useState("");
  const [horarios, setHorarios] = useState<Slot[]>([]);
  const [todosHorarios, setTodosHorarios] = useState<Slot[]>([]);
  const [horarioSelecionado, setHorarioSelecionado] = useState("");
  const [erro, setErro] = useState(initialErro ?? "");
  const [msg, setMsg] = useState("");
  const [loadingHorarios, setLoadingHorarios] = useState(false);
  const [loadingReserva, setLoadingReserva] = useState(false);
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [showAllHorarios, setShowAllHorarios] = useState(false);
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);
  const [confirmarAvulso, setConfirmarAvulso] = useState(false);
  const [itensSemSaldo, setItensSemSaldo] = useState<Array<{ id: string; nome: string; categoria: string }>>([]);

  const servicoSelecionado = useMemo(
    () => initialServicos.find((servico) => servico.id === servicoId) ?? null,
    [initialServicos, servicoId]
  );
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
    if (!servicoSelecionado) return 1;
    if (!data || pastDate || outOfRange || isClosedDay) return 2;
    if (!horarioSelecionado) return 3;
    return 4;
  }, [data, horarioSelecionado, isClosedDay, outOfRange, pastDate, servicoSelecionado]);

  useEffect(() => {
    async function buscarHorarios() {
      if (!accessToken || !profile || !data || !servicoSelecionado || pastDate || outOfRange || isClosedDay) {
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

        const completos = (json.horarios_completos ?? json.horarios ?? []) as Slot[];
        setHorarios(completos.slice(0, 12));
        setTodosHorarios(completos);
        setShowAllHorarios(false);
      } catch {
        setErro("Erro ao carregar horarios");
        setHorarios([]);
        setTodosHorarios([]);
      } finally {
        setLoadingHorarios(false);
      }
    }

    void buscarHorarios();
  }, [accessToken, barbeiroId, data, isClosedDay, outOfRange, pastDate, profile, servicoSelecionado]);

  useEffect(() => {
    setHorarioSelecionado("");
    setConfirmarAvulso(false);
    setItensSemSaldo([]);
  }, [barbeiroId, servicoId, data]);

  async function handleGoogleLogin() {
    setErro("");
    setLoadingLogin(true);
    const { error } = await signInWithGoogle("/agendar");
    if (error) {
      setErro(error.message);
      setLoadingLogin(false);
    }
  }

  async function handleLogout() {
    await signOut();
  }

  async function reservar(forceAvulso = false) {
    if (!servicoSelecionado || !data || !horarioSelecionado) {
      setErro("Selecione o servico, a data e o horario antes de confirmar.");
      return;
    }

    if (!accessToken || !profile) {
      setErro("Entre com Google e finalize seu cadastro antes de confirmar.");
      return;
    }

    setLoadingReserva(true);
    setErro("");
    setMsg("");

    try {
      const res = await fetch("/api/reservar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          data,
          hora_inicio: horarioSelecionado,
          servico_id: servicoSelecionado.id,
          barbeiro_id: barbeiroId,
          confirmar_avulso: forceAvulso,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        if (json.requires_avulso_confirmation) {
          setItensSemSaldo(json.itens_sem_saldo ?? []);
          setConfirmarAvulso(true);
          setErro("Seu plano nao cobre este serviço com saldo disponivel. Voce pode seguir como serviço avulso.");
          return;
        }

        setErro(json.erro || "Erro ao confirmar agendamento");
        return;
      }

      const itemApi = (json.itens ?? []).find((item: { servico_id: string }) => item.servico_id === servicoSelecionado.id);

      setConfirmacao({
        data,
        hora_inicio: horarioSelecionado,
        hora_fim: slotSelecionado?.hora_fim ?? json.agendamento?.hora_fim ?? "-",
        barbeiro_nome: json.barbeiro?.nome ?? barbeiroEscolhido?.nome ?? "Barbeiro selecionado automaticamente",
        servico: {
          id: servicoSelecionado.id,
          nome: servicoSelecionado.nome,
          preco: Number(servicoSelecionado.preco),
          duracao_minutos: Number(servicoSelecionado.duracao_minutos),
          tipo_cobranca: itemApi?.tipo_cobranca,
        },
        nome_cliente: profile.nome,
        telefone: formatarCelular(profile.telefone),
      });

      setData("");
      setBarbeiroId("qualquer");
      setHorarioSelecionado("");
      setHorarios([]);
      setTodosHorarios([]);
      setConfirmarAvulso(false);
      setItensSemSaldo([]);
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

  const horariosVisiveis = showAllHorarios ? todosHorarios : horarios;

  if (confirmacao) {
    return (
      <main className="min-h-screen bg-[var(--background)] text-white">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
          <Link href="/" className="mb-8 inline-flex items-center gap-2 text-[var(--muted)] hover:text-white">
            Voltar
          </Link>

          <section className="grid overflow-hidden border border-white/10 bg-white/[0.03] lg:grid-cols-[1.05fr_0.95fr]">
            <div className="border-b border-white/10 p-8 lg:border-b-0 lg:border-r lg:p-12">
              <p className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-300">
                Reserva confirmada
              </p>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight">Seu atendimento esta reservado.</h1>
              <p className="mt-4 max-w-xl text-lg leading-8 text-[var(--muted)]">
                Sua conta Google agora guarda esse agendamento automaticamente. Nas proximas visitas, voce entra direto e segue de onde precisa.
              </p>

              <div className="mt-10">
                <div className="border border-white/10 bg-black/25 p-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Servico</p>
                  <p className="mt-2 text-xl font-semibold">{confirmacao.servico.nome}</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {confirmacao.servico.duracao_minutos} min • {formatarPreco(confirmacao.servico.preco)}
                  </p>
                  <p className="mt-2 text-sm text-[var(--accent-strong)]">
                    {confirmacao.servico.tipo_cobranca === "plano" ? "Coberto pelo plano" : "Servico avulso"}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-8 lg:p-10">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Resumo</p>
              <div className="mt-6 space-y-4 text-sm">
                <ResumoItem label="Cliente" value={confirmacao.nome_cliente} />
                <ResumoItem label="Celular" value={confirmacao.telefone} />
                <ResumoItem label="Servico" value={confirmacao.servico.nome} />
                <ResumoItem label="Data" value={formatarDataResumo(confirmacao.data)} />
                <ResumoItem label="Inicio" value={confirmacao.hora_inicio} />
                <ResumoItem label="Fim" value={confirmacao.hora_fim} />
                <ResumoItem label="Barbeiro" value={confirmacao.barbeiro_nome} />
                <ResumoItem label="Valor" value={formatarPreco(confirmacao.servico.preco)} />
              </div>

              <div className="mt-10 grid gap-3">
                <Link href="/meus-agendamentos" className="inline-flex items-center justify-center bg-[var(--accent)] px-6 py-3 font-semibold text-black hover:bg-[var(--accent-strong)]">
                  Ver meus agendamentos
                </Link>
                <Link href="/agendar" className="inline-flex items-center justify-center border border-white/20 px-6 py-3 font-semibold hover:bg-white/10">
                  Fazer novo agendamento
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
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="mb-12 border-b border-white/10 pb-10 text-center">
          <Link href="/" className="mb-6 inline-flex items-center gap-2 text-[var(--muted)] hover:text-white">
            Voltar
          </Link>
          <h1 className="text-4xl font-semibold">Agendamento online</h1>
          <p className="mt-3 text-lg text-[var(--muted)]">
            Entre com Google, finalize seu cadastro uma unica vez e siga para a reserva sem perder contexto.
          </p>
        </div>

        {erro && <Banner tone="danger">{erro}</Banner>}
        {msg && <Banner tone="success">{msg}</Banner>}

        {!sessionReady && <p className="text-center text-[var(--muted)]">Carregando sua conta...</p>}

        {sessionReady && !accessToken && (
          <section className="mx-auto max-w-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent-strong)]">Antes de agendar</p>
            <h2 className="mt-4 text-3xl font-semibold">Entre com sua conta Google</h2>
            <p className="mt-4 text-[var(--muted)]">
              O login acontece primeiro para que sua reserva fique salva na sua conta desde o inicio, sem pedir autenticação no meio do processo.
            </p>
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loadingLogin}
              className="mt-8 bg-[var(--accent)] px-6 py-3 font-semibold text-black hover:bg-[var(--accent-strong)] disabled:opacity-50"
            >
              {loadingLogin ? "Redirecionando..." : "Entrar com Google"}
            </button>
          </section>
        )}

        {sessionReady && accessToken && !profile && (
          <div className="mx-auto max-w-3xl">
            <div className="space-y-4">
              <CustomerOnboardingCard
                accessToken={accessToken}
                title="Complete seu cadastro para continuar"
                description="Falta so seu nome e celular. Assim que salvar, voce segue direto para o agendamento e essa etapa nao aparece mais nas proximas visitas."
                submitLabel="Salvar e continuar para a reserva"
                onSaved={refresh}
              />
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="border border-white/20 px-6 py-3 font-semibold hover:bg-white/10"
                >
                  Sair e trocar conta
                </button>
              </div>
            </div>
          </div>
        )}

        {sessionReady && profile && (
          <>
            <div className="mb-8 flex flex-wrap items-center justify-center gap-4 text-sm">
              {["Servico", "Data", "Horario", "Confirmacao"].map((item, index) => (
                <div key={item} className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full font-semibold ${index + 1 <= currentStep ? "bg-[var(--accent)] text-black" : "bg-white/10 text-[var(--muted)]"}`}>
                    {index + 1}
                  </div>
                  <span className={index + 1 <= currentStep ? "text-white" : "text-[var(--muted)]"}>{item}</span>
                </div>
              ))}
            </div>

            <div className="mb-8 border border-white/10 bg-white/[0.03] p-5">
              <p className="text-sm text-[var(--muted)]">
                Agendando como <span className="font-semibold text-white">{profile.nome}</span> • {formatarCelular(profile.telefone)}
              </p>
            </div>

            <div className="grid gap-8 lg:grid-cols-[1.12fr_0.88fr]">
              <section className="space-y-8">
                <Card title="1. Escolha o servico">
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

                <Card title="2. Data e profissional">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <input
                      type="date"
                      value={data}
                      onChange={(event) => setData(event.target.value)}
                      min={getTodayInputValue()}
                      className="datetime-input rounded-xl border px-4 py-3"
                    />
                    <select value={barbeiroId} onChange={(event) => setBarbeiroId(event.target.value)} className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white">
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
                    {!pastDate &&
                      !outOfRange &&
                      !isClosedDay &&
                      " Segunda a quarta: 09:00 as 19:00. Quinta: 09:00 as 20:00. Sexta: 08:00 as 20:00. Sabado: 09:00 as 15:00."}
                  </p>
                </Card>

                <Card title="3. Horarios disponiveis">
                  {loadingHorarios && <p className="text-[var(--muted)]">Carregando horarios...</p>}
                  {!loadingHorarios && todosHorarios.length === 0 && data && servicoSelecionado && !pastDate && !outOfRange && !isClosedDay && (
                    <p className="text-[var(--muted)]">Nenhum horario encontrado para este servico nesta data.</p>
                  )}
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                    {horariosVisiveis.map((slot) => (
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
                  {!showAllHorarios && todosHorarios.length > horarios.length && (
                    <button type="button" onClick={() => setShowAllHorarios(true)} className="mt-4 border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10">
                      Ver mais horarios
                    </button>
                  )}
                  {barbeiroId === "qualquer" && (
                    <p className="mt-4 text-sm text-[var(--muted)]">
                      Quando voce escolhe qualquer um disponivel, a definicao final do profissional acontece no backend no momento da confirmacao.
                    </p>
                  )}
                </Card>
              </section>

              <aside className="h-fit border border-white/10 bg-white/[0.03] p-6 lg:sticky lg:top-8">
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent-strong)]">Resumo do agendamento</p>
                <div className="mt-6 space-y-4 text-sm">
                  <ResumoItem label="Cliente" value={profile.nome} />
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

                {confirmarAvulso && itensSemSaldo.length > 0 && (
                  <div className="mt-6 border border-amber-500/30 bg-amber-950/30 p-4 text-sm text-amber-100">
                    <p className="font-semibold">Servico sem saldo no plano</p>
                    <p className="mt-2 text-amber-100/80">{itensSemSaldo.map((item) => item.nome).join(", ")}.</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => reservar(false)}
                  disabled={!servicoSelecionado || !data || !horarioSelecionado || loadingReserva}
                  className="mt-8 inline-flex w-full items-center justify-center bg-[var(--accent)] px-6 py-3 font-semibold text-black hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loadingReserva ? "Confirmando..." : "Confirmar agendamento"}
                </button>

                {confirmarAvulso && (
                  <button
                    type="button"
                    onClick={() => reservar(true)}
                    disabled={loadingReserva}
                    className="mt-3 inline-flex w-full items-center justify-center border border-white/20 px-6 py-3 font-semibold hover:bg-white/10"
                  >
                    Confirmar como servico avulso
                  </button>
                )}
              </aside>
            </div>
          </>
        )}
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
