"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatarCelular, getTodayInputValue, isDateBeyondLimit, isDateInPast } from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
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

type CustomerProfile = {
  id: string;
  nome: string;
  telefone: string;
  data_nascimento: string;
};

type Confirmacao = {
  data: string;
  hora_inicio: string;
  hora_fim: string;
  barbeiro_nome: string;
  servicos: Array<{ id: string; nome: string; preco: number; duracao_minutos: number; tipo_cobranca?: string }>;
  valor_total: number;
  nome_cliente: string;
  telefone: string;
};

export default function AgendarClient({ initialServicos, initialBarbeiros, initialErro }: AgendarClientProps) {
  const supabase = getSupabaseBrowserClient();
  const auth = supabase.auth;
  const [selecionadoId, setSelecionadoId] = useState(initialServicos[0]?.id ?? "");
  const [carrinhoIds, setCarrinhoIds] = useState<string[]>(initialServicos[0] ? [initialServicos[0].id] : []);
  const [barbeiroId, setBarbeiroId] = useState("qualquer");
  const [data, setData] = useState("");
  const [horarios, setHorarios] = useState<Slot[]>([]);
  const [todosHorarios, setTodosHorarios] = useState<Slot[]>([]);
  const [horarioSelecionado, setHorarioSelecionado] = useState("");
  const [erro, setErro] = useState(initialErro ?? "");
  const [msg, setMsg] = useState("");
  const [loadingHorarios, setLoadingHorarios] = useState(false);
  const [loadingReserva, setLoadingReserva] = useState(false);
  const [showAllHorarios, setShowAllHorarios] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);
  const [confirmarAvulso, setConfirmarAvulso] = useState(false);
  const [itensSemSaldo, setItensSemSaldo] = useState<Array<{ id: string; nome: string; categoria: string }>>([]);

  const carrinho = useMemo(() => {
    const ids = new Set(carrinhoIds);
    return initialServicos.filter((servico) => ids.has(servico.id));
  }, [carrinhoIds, initialServicos]);

  const valorTotal = carrinho.reduce((acc, item) => acc + Number(item.preco), 0);
  const duracaoTotal = carrinho.reduce((acc, item) => acc + Number(item.duracao_minutos), 0);
  const slotSelecionado = todosHorarios.find((slot) => slot.hora_inicio === horarioSelecionado) ?? null;
  const barbeiroEscolhido = barbeiroId === "qualquer" ? null : initialBarbeiros.find((barbeiro) => barbeiro.id === barbeiroId) ?? null;

  const dayNumber = data ? new Date(`${data}T00:00:00`).getDay() : -1;
  const isSaturday = dayNumber === 6;
  const isSunday = dayNumber === 0;
  const pastDate = data ? isDateInPast(data) : false;
  const outOfRange = data ? isDateBeyondLimit(data, 30) : false;
  const isClosedDay = isSaturday || isSunday;

  const currentStep = useMemo(() => {
    if (carrinho.length === 0) return 1;
    if (!data || pastDate || outOfRange || isClosedDay) return 2;
    if (!horarioSelecionado) return 3;
    if (!accessToken) return 4;
    if (!profile) return 5;
    return 6;
  }, [accessToken, carrinho.length, data, horarioSelecionado, isClosedDay, outOfRange, pastDate, profile]);

  const loadCustomerContext = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? null;
    setAccessToken(token);

    if (!token) {
      setProfile(null);
      setSessionReady(true);
      return;
    }

    const res = await fetch("/api/client/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (res.ok) {
      setProfile(json.profile ?? null);
    } else {
      setProfile(null);
    }
    setSessionReady(true);
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCustomerContext();
    }, 0);
    const { data: listener } = auth.onAuthStateChange(() => {
      void loadCustomerContext();
    });
    return () => {
      window.clearTimeout(timer);
      listener.subscription.unsubscribe();
    };
  }, [auth, loadCustomerContext]);

  useEffect(() => {
    async function buscarHorarios() {
      if (!data || carrinho.length === 0 || pastDate || outOfRange || isClosedDay) {
        setHorarios([]);
        setTodosHorarios([]);
        setHorarioSelecionado("");
        return;
      }

      setLoadingHorarios(true);
      setErro("");

      try {
        const res = await fetch(
          `/api/horarios?data=${encodeURIComponent(data)}&servico_ids=${encodeURIComponent(
            carrinho.map((item) => item.id).join(",")
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
  }, [barbeiroId, carrinho, data, isClosedDay, outOfRange, pastDate]);

  useEffect(() => {
    setHorarioSelecionado("");
    setConfirmarAvulso(false);
    setItensSemSaldo([]);
  }, [barbeiroId, carrinhoIds, data]);

  function addServico() {
    if (!selecionadoId || carrinhoIds.includes(selecionadoId)) {
      return;
    }
    setCarrinhoIds((current) => [...current, selecionadoId]);
  }

  function removerServico(id: string) {
    setCarrinhoIds((current) => current.filter((item) => item !== id));
  }

  async function signInWithGoogle() {
    setErro("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/agendar` },
    });

    if (error) {
      setErro(error.message);
    }
  }

  async function reservar(forceAvulso = false) {
    if (carrinho.length === 0 || !data || !horarioSelecionado) {
      setErro("Selecione os servicos, a data e o horario antes de confirmar.");
      return;
    }

    if (!accessToken) {
      setErro("Entre com Google antes de confirmar o agendamento.");
      return;
    }

    if (!profile) {
      setErro("Complete seu cadastro antes de confirmar o agendamento.");
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
          service_ids: carrinho.map((item) => item.id),
          barbeiro_id: barbeiroId,
          confirmar_avulso: forceAvulso,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        if (json.requires_avulso_confirmation) {
          setItensSemSaldo(json.itens_sem_saldo ?? []);
          setConfirmarAvulso(true);
          setErro("Seu plano nao cobre todos os servicos do carrinho. Voce pode seguir com os itens sem saldo como servico avulso.");
          return;
        }

        setErro(json.erro || "Erro ao confirmar agendamento");
        return;
      }

      setConfirmacao({
        data,
        hora_inicio: horarioSelecionado,
        hora_fim: slotSelecionado?.hora_fim ?? json.agendamento?.hora_fim ?? "-",
        barbeiro_nome: json.barbeiro?.nome ?? barbeiroEscolhido?.nome ?? "Barbeiro selecionado automaticamente",
        servicos: carrinho.map((servico) => {
          const itemApi = (json.itens ?? []).find((item: { servico_id: string }) => item.servico_id === servico.id);
          return {
            id: servico.id,
            nome: servico.nome,
            preco: Number(servico.preco),
            duracao_minutos: Number(servico.duracao_minutos),
            tipo_cobranca: itemApi?.tipo_cobranca,
          };
        }),
        valor_total: valorTotal,
        nome_cliente: profile.nome,
        telefone: formatarCelular(profile.telefone),
      });

      setCarrinhoIds(initialServicos[0] ? [initialServicos[0].id] : []);
      setSelecionadoId(initialServicos[0]?.id ?? "");
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
                O horario foi travado na agenda do profissional correto e o sistema ja registrou a cobranca do carrinho.
              </p>

              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                {confirmacao.servicos.map((servico) => (
                  <div key={servico.id} className="border border-white/10 bg-black/25 p-5">
                    <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Servico</p>
                    <p className="mt-2 text-xl font-semibold">{servico.nome}</p>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      {servico.duracao_minutos} min • {formatarPreco(servico.preco)}
                    </p>
                    <p className="mt-2 text-sm text-[var(--accent-strong)]">
                      {servico.tipo_cobranca === "plano" ? "Coberto pelo plano" : "Servico avulso"}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-8 lg:p-10">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Resumo</p>
              <div className="mt-6 space-y-4 text-sm">
                <ResumoItem label="Cliente" value={confirmacao.nome_cliente} />
                <ResumoItem label="Celular" value={confirmacao.telefone} />
                <ResumoItem label="Data" value={formatarDataResumo(confirmacao.data)} />
                <ResumoItem label="Inicio" value={confirmacao.hora_inicio} />
                <ResumoItem label="Fim" value={confirmacao.hora_fim} />
                <ResumoItem label="Barbeiro" value={confirmacao.barbeiro_nome} />
                <ResumoItem label="Valor total" value={formatarPreco(confirmacao.valor_total)} />
              </div>

              <div className="mt-10 grid gap-3">
                <Link href="/minha-conta" className="inline-flex items-center justify-center bg-[var(--accent)] px-6 py-3 font-semibold text-black hover:bg-[var(--accent-strong)]">
                  Ir para minha conta
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
            Monte seu carrinho, escolha o profissional ou qualquer um disponivel e confirme tudo com login Google.
          </p>
        </div>

        <div className="mb-8 flex flex-wrap items-center justify-center gap-4 text-sm">
          {["Carrinho", "Data", "Horario", "Login", "Cadastro", "Confirmacao"].map((item, index) => (
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

        <div className="grid gap-8 lg:grid-cols-[1.12fr_0.88fr]">
          <section className="space-y-8">
            <Card title="1. Monte seu carrinho">
              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                <div>
                  <label className="mb-2 block text-sm text-[var(--muted)]">Adicionar servico</label>
                  <select value={selecionadoId} onChange={(event) => setSelecionadoId(event.target.value)} className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white">
                    {initialServicos.map((servico) => (
                      <option key={servico.id} value={servico.id}>
                        {servico.nome} • {servico.duracao_minutos} min • {formatarPreco(Number(servico.preco))}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="button" onClick={addServico} className="bg-[var(--accent)] px-6 py-3 font-semibold text-black hover:bg-[var(--accent-strong)]">
                  Adicionar ao carrinho
                </button>
              </div>

              <div className="mt-6 grid gap-3">
                {carrinho.length === 0 && <p className="text-[var(--muted)]">Selecione pelo menos um servico para continuar.</p>}
                {carrinho.map((servico) => (
                  <div key={servico.id} className="flex flex-col gap-3 border border-white/10 bg-black/25 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold">{servico.nome}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {servico.duracao_minutos} min • {formatarPreco(Number(servico.preco))}
                      </p>
                    </div>
                    <button type="button" onClick={() => removerServico(servico.id)} className="border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10">
                      Remover
                    </button>
                  </div>
                ))}
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
                {!pastDate && !outOfRange && !isClosedDay && " Atendimento de segunda a sexta, das 08:30 as 12:00 e das 14:00 as 20:00."}
              </p>
            </Card>

            <Card title="3. Horarios disponiveis">
              {loadingHorarios && <p className="text-[var(--muted)]">Carregando horarios...</p>}
              {!loadingHorarios && todosHorarios.length === 0 && data && carrinho.length > 0 && !pastDate && !outOfRange && !isClosedDay && (
                <p className="text-[var(--muted)]">Nenhum horario encontrado para este carrinho nesta data.</p>
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

            <Card title="4. Conta do cliente">
              {!sessionReady && <p className="text-[var(--muted)]">Carregando sessao...</p>}
              {sessionReady && !accessToken && (
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="font-semibold">Entre com Google para continuar</p>
                    <p className="mt-2 text-sm text-[var(--muted)]">O login e obrigatorio para confirmar reservas, acompanhar o plano e consultar o historico.</p>
                  </div>
                  <button type="button" onClick={signInWithGoogle} className="bg-[var(--accent)] px-6 py-3 font-semibold text-black hover:bg-[var(--accent-strong)]">
                    Entrar com Google
                  </button>
                </div>
              )}
              {sessionReady && accessToken && !profile && (
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="font-semibold">Cadastro pendente</p>
                    <p className="mt-2 text-sm text-[var(--muted)]">Complete nome, telefone e data de nascimento para liberar o agendamento.</p>
                  </div>
                  <Link href="/login" className="inline-flex items-center justify-center border border-white/20 px-6 py-3 font-semibold hover:bg-white/10">
                    Completar cadastro
                  </Link>
                </div>
              )}
              {sessionReady && profile && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <AccountCard label="Cliente" value={profile.nome} />
                  <AccountCard label="Telefone" value={formatarCelular(profile.telefone)} />
                  <AccountCard label="Nascimento" value={formatarDataResumo(profile.data_nascimento)} />
                </div>
              )}
            </Card>
          </section>

          <aside className="h-fit border border-white/10 bg-white/[0.03] p-6 lg:sticky lg:top-8">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent-strong)]">Resumo do carrinho</p>
            <div className="mt-6 space-y-4 text-sm">
              <ResumoItem label="Servicos" value={carrinho.length ? String(carrinho.length) : "-"} />
              <ResumoItem label="Duracao" value={duracaoTotal ? `${duracaoTotal} min` : "-"} />
              <ResumoItem label="Valor" value={carrinho.length ? formatarPreco(valorTotal) : "-"} />
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
                <p className="font-semibold">Itens sem saldo no plano</p>
                <p className="mt-2 text-amber-100/80">
                  {itensSemSaldo.map((item) => item.nome).join(", ")}.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => reservar(false)}
              disabled={carrinho.length === 0 || !data || !horarioSelecionado || loadingReserva}
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
                Confirmar itens sem saldo como avulso
              </button>
            )}
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

function AccountCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/10 bg-black/20 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 font-semibold">{value}</p>
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







