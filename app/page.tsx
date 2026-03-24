import Image from "next/image";
import Link from "next/link";

const servicos = [
  { nome: "Corte de cabelo", duracao: "30 min", preco: "R$ 40" },
  { nome: "Barba", duracao: "30 min", preco: "R$ 30" },
  { nome: "Cabelo + barba", duracao: "1h", preco: "R$ 70" },
  { nome: "Combo completo", duracao: "1h", preco: "R$ 75" },
];

const horarios = [
  { dia: "Seg-Qua", hora: "09:00 - 19:00" },
  { dia: "Quinta", hora: "09:00 - 20:00" },
  { dia: "Sexta", hora: "08:00 - 20:00" },
  { dia: "Sabado", hora: "09:00 - 15:00" },
];

const barbeiros = [
  { nome: "Lucas Cantelle", detalhe: "Corte alinhado e atendimento direto" },
  { nome: "Alexandre Albertini", detalhe: "Barba precisa e acabamento fino" },
  { nome: "Ryan Ferreira", detalhe: "Combo rapido com leitura de agenda" },
  { nome: "Peixoto", detalhe: "Cadeira forte e execucao marcante" },
];

export default function Home() {
  return (
    <main className="brand-shell min-h-screen bg-[var(--background)] pb-28 text-[var(--foreground)]">
      <section className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <div className="overflow-hidden border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))]">
          <div className="relative px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
            <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(210,169,95,0.24),transparent_62%)]" />

            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                Agenda online
              </div>

              <div className="mt-6 flex justify-center lg:justify-start">
                <Image
                  src="/imperio-logo.jpg"
                  alt="Logo Imperio Ferreira"
                  width={210}
                  height={210}
                  priority
                  className="h-auto w-[170px] sm:w-[210px]"
                />
              </div>

              <div className="mx-auto mt-4 max-w-2xl text-center lg:mx-0 lg:text-left">
                <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                  Reserve seu horario em poucos toques.
                </h1>
                <p className="mt-4 text-base leading-7 text-[var(--muted)] sm:text-lg">
                  Escolha o servico, selecione o barbeiro ou qualquer um disponivel e confirme pelo Google.
                </p>
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
                <Link
                  href="/agendar"
                  className="inline-flex min-h-13 items-center justify-center bg-[var(--accent)] px-6 py-4 text-base font-semibold text-black hover:bg-[var(--accent-strong)]"
                >
                  Agendar agora
                </Link>
                <Link
                  href="/meus-agendamentos"
                  className="inline-flex min-h-13 items-center justify-center border border-white/20 bg-black/20 px-6 py-4 text-base font-semibold text-white hover:bg-white/10"
                >
                  Ver meus horarios
                </Link>
              </div>

              <div className="mt-7 grid grid-cols-2 gap-3 lg:max-w-xl">
                <QuickStat label="Reserva" value="30 em 30 min" />
                <QuickStat label="Equipe" value="4 barbeiros" />
                <QuickStat label="Sabado" value="09:00 - 15:00" />
                <QuickStat label="Domingo" value="Fechado" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-6 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <div className="border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent-strong)]">Servicos</p>
              <h2 className="mt-2 text-2xl font-semibold">Escolha rapido</h2>
            </div>
            <Link href="/agendar" className="text-sm font-semibold text-[var(--accent-strong)] hover:text-white">
              Abrir agenda
            </Link>
          </div>

          <div className="mt-5 grid gap-3">
            {servicos.map((servico) => (
              <div key={servico.nome} className="grid grid-cols-[1fr_auto] gap-3 border border-white/10 bg-black/20 p-4">
                <div>
                  <p className="font-semibold text-white">{servico.nome}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{servico.duracao}</p>
                </div>
                <div className="self-center text-right font-semibold text-[var(--accent-strong)]">{servico.preco}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          <section className="border border-white/10 bg-white/[0.03] p-5 sm:p-6">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent-strong)]">Funcionamento</p>
            <div className="mt-5 grid gap-3">
              {horarios.map((item) => (
                <div key={item.dia} className="flex items-center justify-between gap-4 border border-white/10 bg-black/20 px-4 py-3">
                  <span className="font-semibold text-white">{item.dia}</span>
                  <span className="text-sm text-[var(--muted)]">{item.hora}</span>
                </div>
              ))}
              <div className="flex items-center justify-between gap-4 border border-white/10 bg-black/20 px-4 py-3">
                <span className="font-semibold text-white">Domingo</span>
                <span className="text-sm text-[var(--muted)]">Fechado</span>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
              Cada barbeiro usa bloqueios individuais para almoco e pausas. A barbearia continua aberta durante o expediente.
            </p>
          </section>

          <section className="border border-white/10 bg-white/[0.03] p-5 sm:p-6">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent-strong)]">Barbeiros</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {barbeiros.map((barbeiro, index) => (
                <div key={barbeiro.nome} className="grid grid-cols-[42px_1fr] gap-3 border border-white/10 bg-black/20 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--accent)]/40 text-sm font-semibold text-[var(--accent-strong)]">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-semibold text-white">{barbeiro.nome}</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{barbeiro.detalhe}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6 lg:px-8">
        <div className="border border-white/10 bg-[linear-gradient(135deg,rgba(210,169,95,0.12),rgba(255,255,255,0.02))] p-5 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent-strong)]">Praticidade</p>
              <h2 className="mt-2 text-2xl font-semibold">Entrou, escolheu, confirmou.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                O foco aqui e rapidez no celular: login pelo Google, poucos passos e reserva salva na sua conta.
              </p>
            </div>
            <Link
              href="/agendar"
              className="inline-flex min-h-12 items-center justify-center border border-white/20 bg-black/20 px-5 py-3 font-semibold hover:bg-white/10"
            >
              Comecar reserva
            </Link>
          </div>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[rgba(4,7,6,0.94)] p-3 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-2 gap-3">
          <Link
            href="/meus-agendamentos"
            className="inline-flex min-h-12 items-center justify-center border border-white/15 bg-black/20 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
          >
            Meus horarios
          </Link>
          <Link
            href="/agendar"
            className="inline-flex min-h-12 items-center justify-center bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-black hover:bg-[var(--accent-strong)]"
          >
            Agendar
          </Link>
        </div>
      </div>
    </main>
  );
}

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/10 bg-black/20 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
