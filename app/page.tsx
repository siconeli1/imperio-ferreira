import Link from "next/link";

const diferenciais = [
  {
    titulo: "Agenda inteligente",
    texto: "Escolha um barbeiro especifico ou deixe o sistema encontrar o primeiro horario livre entre os profissionais ativos.",
  },
  {
    titulo: "Experiencia refinada",
    texto: "Fluxo rapido, visual premium e confirmacao clara para o cliente do inicio ao fim.",
  },
  {
    titulo: "Operacao segmentada",
    texto: "Cada barbeiro acessa apenas a propria agenda, bloqueios e horarios personalizados.",
  },
];

const barbeiros = [
  { nome: "Enzo Ferreira", destaque: "Fade, tesoura e acabamento classico" },
  { nome: "Rafael Costa", destaque: "Barba desenhada e cortes executivos" },
  { nome: "Marcos Lima", destaque: "Combos completos e ritmo de atendimento rapido" },
];

export default function Home() {
  return (
    <main className="brand-shell min-h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <section className="border-b border-white/10">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-24">
          <div className="relative">
            <p className="mb-5 inline-flex rounded-full border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent-strong)]">
              Imperio Ferreira
            </p>
            <h1 className="max-w-3xl text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
              Barbearia premium com agenda online para varios barbeiros.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">
              A mesma fluidez da referencia Conceito, agora adaptada para uma operacao escalavel,
              com atendimento individual por profissional e reserva automatica para qualquer um disponivel.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/agendar"
                className="inline-flex items-center justify-center bg-[var(--accent)] px-6 py-3 font-semibold text-black hover:bg-[var(--accent-strong)]"
              >
                Agendar horario
              </Link>
              <Link
                href="/meus-agendamentos"
                className="inline-flex items-center justify-center border border-white/20 px-6 py-3 font-semibold text-white hover:bg-white/10"
              >
                Meus agendamentos
              </Link>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              {diferenciais.map((item) => (
                <div key={item.titulo} className="border border-white/10 bg-white/[0.03] p-5">
                  <p className="text-sm uppercase tracking-[0.24em] text-[var(--accent-strong)]">Destaque</p>
                  <h2 className="mt-3 text-xl font-semibold">{item.titulo}</h2>
                  <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{item.texto}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-5">
            <div className="border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-8">
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--accent-strong)]">Rotina da casa</p>
              <div className="mt-8 space-y-5">
                <div className="border-l border-[var(--accent)] pl-4">
                  <p className="text-sm text-[var(--muted)]">Segunda a sexta</p>
                  <p className="text-2xl font-semibold">08:30 - 12:00</p>
                </div>
                <div className="border-l border-[var(--accent)] pl-4">
                  <p className="text-sm text-[var(--muted)]">Retorno do expediente</p>
                  <p className="text-2xl font-semibold">14:00 - 20:00</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">Ultimo inicio de atendimento: 19:00</p>
                </div>
              </div>
            </div>
            <div className="border border-white/10 bg-black/30 p-8">
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--accent-strong)]">Time de barbeiros</p>
              <div className="mt-6 space-y-4">
                {barbeiros.map((barbeiro, index) => (
                  <div key={barbeiro.nome} className="grid grid-cols-[48px_1fr] items-center gap-4 border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--accent)]/40 text-sm font-semibold text-[var(--accent-strong)]">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-lg font-semibold">{barbeiro.nome}</p>
                      <p className="text-sm text-[var(--muted)]">{barbeiro.destaque}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="border border-white/10 bg-white/[0.03] p-8">
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--accent-strong)]">Como funciona</p>
            <h2 className="mt-4 text-3xl font-semibold">Agendamento desenhado para varias cadeiras.</h2>
            <div className="mt-8 space-y-6 text-[var(--muted)]">
              <div>
                <p className="text-white">1. Escolha o servico</p>
                <p className="mt-2 leading-7">A duracao e o valor sao carregados automaticamente a partir do catalogo global da barbearia.</p>
              </div>
              <div>
                <p className="text-white">2. Selecione um barbeiro ou qualquer um disponivel</p>
                <p className="mt-2 leading-7">Quando o cliente escolhe qualquer um disponivel, o backend consolida as agendas individuais e decide a reserva no momento da confirmacao.</p>
              </div>
              <div>
                <p className="text-white">3. Admin separado por profissional</p>
                <p className="mt-2 leading-7">Cada barbeiro faz login com a propria credencial e gerencia apenas os proprios compromissos e bloqueios.</p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="border border-white/10 bg-black/25 p-7">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent-strong)]">Cliente</p>
              <h3 className="mt-4 text-2xl font-semibold">Fluxo publico completo</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                Home institucional, agendamento online, resumo da reserva, meus agendamentos por celular e cancelamento.
              </p>
            </div>
            <div className="border border-white/10 bg-black/25 p-7">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent-strong)]">Operacao</p>
              <h3 className="mt-4 text-2xl font-semibold">Area administrativa por barbeiro</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                Agenda do dia, visao semanal, marcacoes manuais, bloqueios e atualizacao de status sem cruzar dados entre perfis.
              </p>
            </div>
            <div className="border border-white/10 bg-black/25 p-7 sm:col-span-2">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent-strong)]">Acesso rapido</p>
              <div className="mt-5 flex flex-col gap-4 sm:flex-row">
                <Link href="/admin/login" className="inline-flex items-center justify-center border border-white/20 px-6 py-3 font-semibold hover:bg-white/10">
                  Entrar na area admin
                </Link>
                <Link href="/agendar" className="inline-flex items-center justify-center bg-[var(--accent)] px-6 py-3 font-semibold text-black hover:bg-[var(--accent-strong)]">
                  Iniciar novo agendamento
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
