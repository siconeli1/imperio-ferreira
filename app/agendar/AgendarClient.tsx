"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CustomerOnboardingCard } from "@/app/_components/CustomerOnboardingCard";
import { getTodayInputValue, isDateBeyondLimit, isDateInPast } from "@/lib/format";
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
  const isSunday = dayNumber === 0;
  const pastDate = data ? isDateInPast(data) : false;
  const outOfRange = data ? isDateBeyondLimit(data, 30) : false;
  const isClosedDay = isSunday;

  const currentStep = useMemo(() => {
    if (!servicoSelecionado) return 1;
    if (!data || pastDate || outOfRange || isClosedDay) return 2;
    if (!horarioSelecionado) return 3;
    return 4;
  }, [data, horarioSelecionado, isClosedDay, outOfRange, pastDate, servicoSelecionado]);
  const resumoSelecionado = Boolean(servicoSelecionado || data || horarioSelecionado);
  const resumoCobertura =
    slotSelecionado && barbeiroId === "qualquer"
      ? `${slotSelecionado.barbeiros_disponiveis.length} barbeiro(s) livre(s)`
      : barbeiroEscolhido?.nome ?? null;

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
  }, [barbeiroId, data, isClosedDay, outOfRange, pastDate, servicoSelecionado]);

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
          setErro("Seu plano nao cobre este servico com saldo disponivel. Voce pode seguir como servico avulso.");
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
        telefone: profile.telefone,
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
                    {confirmacao.servico.duracao_minutos} min - {formatarPreco(confirmacao.servico.preco)}
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
                <Link
                  href="/meus-agendamentos"
                  className="inline-flex items-center justify-center bg-[var(--accent)] px-6 py-3 font-semibold text-black hover:bg-[var(--accent-strong)]"
                >
                  Ver meus agendamentos
                </Link>
                <Link
                  href="/agendar"
                  className="inline-flex items-center justify-center border border-white/20 px-6 py-3 font-semibold hover:bg-white/10"
                >
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
        <div className="mb-10 rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(0,0,0,0.18))] px-5 py-8 text-center sm:px-8 sm:py-10">
          <Link href="/" className="mb-6 inline-flex items-center gap-2 text-[var(--muted)] hover:text-white">
            Voltar
          </Link>
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--accent-strong)]">Agendamento online</p>
          <h1 className="mt-4 text-4xl font-semibold sm:text-5xl">Reserve seu horario sem perder tempo.</h1>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-[var(--muted)] sm:text-lg">
            Escolha servico, data e horario primeiro. O login entra apenas na confirmacao para deixar a jornada do cliente simples e direta.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs uppercase tracking-[0.16em] text-[var(--accent-strong)]">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">Escolha rapida</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">Conta unificada</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">Confirmacao sem retrabalho</span>
          </div>
        </div>

        {erro && <Banner tone="danger">{erro}</Banner>}
        {msg && <Banner tone="success">{msg}</Banner>}

        {!sessionReady && <p className="text-center text-[var(--muted)]">Carregando sua conta...</p>}

        {sessionReady && (
          <>
            <div className="mb-8 flex flex-wrap items-center justify-center gap-3 text-xs sm:gap-4 sm:text-sm">
              {["Servico", "Data", "Hora", "Confirmar"].map((item, index) => (
                <div key={item} className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full font-semibold ${
                      index + 1 <= currentStep ? "bg-[var(--accent)] text-black" : "bg-white/10 text-[var(--muted)]"
                    }`}
                  >
                    {index + 1}
                  </div>
                  <span className={index + 1 <= currentStep ? "text-white" : "text-[var(--muted)]"}>{item}</span>
                </div>
              ))}
            </div>

            <div className="grid gap-8 lg:grid-cols-[1.12fr_0.88fr]">
              <section className="space-y-8">
                <Card title="1. Escolha o servico" description="Selecione o atendimento desejado. A interface destaca o servico ativo para evitar erro de escolha.">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {initialServicos.map((servico) => {
                      const ativo = servico.id === servicoId;
                      return (
                        <button
                          key={servico.id}
                          type="button"
                          onClick={() => setServicoId(servico.id)}
                          className={`rounded-[24px] border p-4 text-left ${
                            ativo
                              ? "border-[var(--accent)] bg-[linear-gradient(180deg,var(--accent),var(--accent-strong))] text-black shadow-[0_16px_30px_rgba(210,169,95,0.18)]"
                              : "border-white/10 bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.05]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="font-semibold">{servico.nome}</p>
                            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${ativo ? "bg-black/10 text-black/75" : "border border-white/10 bg-black/20 text-[var(--accent-strong)]"}`}>
                              {servico.duracao_minutos} min
                            </span>
                          </div>
                          <p className={`mt-3 text-sm ${ativo ? "text-black/70" : "text-[var(--muted)]"}`}>
                            {formatarPreco(Number(servico.preco))}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </Card>

                <Card title="2. Data e profissional" description="Escolha a data e decida se quer um profissional especifico ou o primeiro barbeiro livre no horario.">
                  <div className="grid gap-5">
                    <input
                      type="date"
                      value={data}
                      onChange={(event) => setData(event.target.value)}
                      min={getTodayInputValue()}
                      className="datetime-input rounded-xl border px-4 py-3"
                    />

                    <div className="space-y-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent-strong)]">Profissional</p>
                          <p className="mt-1 text-sm text-[var(--muted)]">Escolha um barbeiro especifico ou deixe a agenda selecionar o primeiro disponivel.</p>
                        </div>
                        <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                          {barbeiroId === "qualquer" ? "Escolha flexivel" : "Escolha personalizada"}
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <ProfissionalOptionCard
                          title="Qualquer um disponivel"
                          subtitle="Mais flexivel para encontrar horario rapido."
                          selected={barbeiroId === "qualquer"}
                          badge="Recomendado"
                          onClick={() => setBarbeiroId("qualquer")}
                        />

                        {initialBarbeiros.map((barbeiro) => (
                          <ProfissionalOptionCard
                            key={barbeiro.id}
                            title={barbeiro.nome}
                            subtitle="Selecionar este profissional na confirmacao."
                            selected={barbeiroId === barbeiro.id}
                            onClick={() => setBarbeiroId(barbeiro.id)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
                    {pastDate && "A data escolhida esta no passado."}
                    {outOfRange && " A data esta fora da janela de 30 dias."}
                    {isClosedDay && " A barbearia nao atende aos domingos."}
                    {!pastDate &&
                      !outOfRange &&
                      !isClosedDay &&
                      " Segunda a quarta: 09:00 as 19:00. Quinta: 09:00 as 20:00. Sexta: 08:00 as 20:00. Sabado: 09:00 as 15:00."}
                  </p>
                </Card>

                <Card title="3. Horarios disponiveis" description="Mostramos apenas horarios que realmente respeitam funcionamento e disponibilidade da agenda.">
                  {loadingHorarios && <p className="text-[var(--muted)]">Carregando horarios...</p>}
                  {!loadingHorarios && todosHorarios.length === 0 && data && servicoSelecionado && !pastDate && !outOfRange && !isClosedDay && (
                    <p className="text-[var(--muted)]">Nenhum horario encontrado para este servico nesta data.</p>
                  )}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {horariosVisiveis.map((slot) => (
                      <button
                        key={slot.hora_inicio}
                        type="button"
                        onClick={() => setHorarioSelecionado(slot.hora_inicio)}
                        className={`rounded-2xl border px-3 py-3 text-sm font-medium ${
                          horarioSelecionado === slot.hora_inicio
                            ? "border-[var(--accent)] bg-[var(--accent)] text-black"
                            : "border-white/15 bg-white/[0.03] hover:border-white/35"
                        }`}
                      >
                        {slot.hora_inicio}
                      </button>
                    ))}
                  </div>
                  {!showAllHorarios && todosHorarios.length > horarios.length && (
                    <button
                      type="button"
                      onClick={() => setShowAllHorarios(true)}
                      className="mt-4 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10"
                    >
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

              <aside className="h-fit rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(0,0,0,0.18))] p-5 sm:p-6 lg:sticky lg:top-6">
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent-strong)]">Resumo do agendamento</p>
                <h2 className="mt-4 text-2xl font-semibold">Revise antes de confirmar</h2>

                {!resumoSelecionado ? (
                  <div className="mt-5 space-y-3">
                    <ResumoHint titulo="Escolha o servico" texto="Comece pelo atendimento que deseja fazer." />
                    <ResumoHint titulo="Defina a data" texto="O sistema libera apenas datas dentro da janela valida." />
                    <ResumoHint titulo="Selecione o horario" texto="Depois disso, a confirmacao fica pronta no mesmo painel." />
                  </div>
                ) : (
                  <div className="mt-5 grid gap-3">
                    {servicoSelecionado ? <ResumoPill label="Servico" value={servicoSelecionado.nome} /> : null}
                    {servicoSelecionado ? <ResumoPill label="Duracao" value={`${servicoSelecionado.duracao_minutos} min`} /> : null}
                    {servicoSelecionado ? <ResumoPill label="Valor" value={formatarPreco(Number(servicoSelecionado.preco))} /> : null}
                    {data ? <ResumoPill label="Data" value={formatarDataResumo(data)} /> : null}
                    {horarioSelecionado ? <ResumoPill label="Inicio" value={horarioSelecionado} /> : null}
                    {slotSelecionado?.hora_fim ? <ResumoPill label="Fim" value={slotSelecionado.hora_fim} /> : null}
                    <ResumoPill label="Barbeiro" value={barbeiroEscolhido?.nome ?? "Qualquer um disponivel"} />
                    {resumoCobertura ? <ResumoPill label="Cobertura" value={resumoCobertura} /> : null}
                    {profile?.nome ? <ResumoPill label="Cliente" value={profile.nome} /> : null}
                  </div>
                )}

                {!accessToken && (
                  <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="font-semibold">Entre para confirmar</p>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      Voce ja pode escolher servico, data e horario. O login entra so na confirmacao para vincular a reserva a sua conta.
                    </p>
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={loadingLogin}
                      className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[var(--accent)] px-6 py-3 font-semibold text-black hover:bg-[var(--accent-strong)] disabled:opacity-50"
                    >
                      {loadingLogin ? "Redirecionando..." : "Entrar com Google"}
                    </button>
                  </div>
                )}

                {accessToken && !profile && (
                  <div className="mt-6 space-y-4">
                    <CustomerOnboardingCard
                      accessToken={accessToken}
                      title="Complete seu cadastro para continuar"
                      description="Falta so seu nome e celular. Assim que salvar, voce volta para esta etapa e confirma sem recomecar."
                      submitLabel="Salvar e continuar"
                      onSaved={refresh}
                    />
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-white/20 px-6 py-3 font-semibold hover:bg-white/10"
                    >
                      Sair e trocar conta
                    </button>
                  </div>
                )}

                {confirmarAvulso && itensSemSaldo.length > 0 && (
                  <div className="mt-6 border border-amber-500/30 bg-amber-950/30 p-4 text-sm text-amber-100">
                    <p className="font-semibold">Servico sem saldo no plano</p>
                    <p className="mt-2 text-amber-100/80">{itensSemSaldo.map((item) => item.nome).join(", ")}.</p>
                  </div>
                )}

                {profile ? (
                  <>
                    <button
                      type="button"
                      onClick={() => reservar(false)}
                      disabled={!servicoSelecionado || !data || !horarioSelecionado || loadingReserva}
                      className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[var(--accent)] px-6 py-3 font-semibold text-black hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {loadingReserva ? "Confirmando..." : "Confirmar agendamento"}
                    </button>

                    {confirmarAvulso && (
                      <button
                        type="button"
                        onClick={() => reservar(true)}
                        disabled={loadingReserva}
                        className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-full border border-white/20 px-6 py-3 font-semibold hover:bg-white/10"
                      >
                        Confirmar como servico avulso
                      </button>
                    )}
                  </>
                ) : null}
              </aside>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(0,0,0,0.16))] p-5 sm:p-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      {description ? <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ProfissionalOptionCard({
  title,
  subtitle,
  selected,
  badge,
  onClick,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[24px] border p-4 text-left transition ${
        selected
          ? "border-[var(--accent)] bg-[linear-gradient(180deg,rgba(210,169,95,0.22),rgba(210,169,95,0.12))] shadow-[0_14px_28px_rgba(210,169,95,0.12)]"
          : "border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.05]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`font-semibold ${selected ? "text-white" : "text-white"}`}>{title}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{subtitle}</p>
        </div>
        {badge ? (
          <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${selected ? "bg-black/15 text-[var(--background)]" : "border border-white/10 bg-black/20 text-[var(--accent-strong)]"}`}>
            {badge}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function ResumoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
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

function ResumoHint({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
      <p className="font-semibold text-white">{titulo}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{texto}</p>
    </div>
  );
}

function Banner({ tone, children }: { tone: "danger" | "success"; children: React.ReactNode }) {
  return (
    <div
      className={`mb-6 rounded-2xl border px-4 py-3 ${
        tone === "danger"
          ? "border-red-700 bg-red-950/60 text-red-200"
          : "border-emerald-700 bg-emerald-950/40 text-emerald-200"
      }`}
    >
      {children}
    </div>
  );
}
