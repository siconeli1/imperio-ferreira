"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CustomerOnboardingCard } from "@/app/_components/CustomerOnboardingCard";
import { useCustomerSession } from "@/lib/use-customer-session";

const BENEFICIOS = [
  "Agendar com menos atrito nas proximas visitas",
  "Consultar reservas e conta no mesmo lugar",
  "Manter nome e celular sempre atualizados",
];

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[var(--background)] text-white">
          Carregando...
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accessToken, profile, sessionReady, signInWithGoogle, signOut, refresh } = useCustomerSession();
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoStartBlocked, setAutoStartBlocked] = useState(false);
  const autoStartAttemptedRef = useRef(false);

  const nextPath = useMemo(() => searchParams.get("next") || "/minha-conta", [searchParams]);
  const autoStart = useMemo(() => searchParams.get("autostart") === "1", [searchParams]);

  async function handleGoogleLogin() {
    setErro("");
    setLoading(true);
    const suffix = autoStart ? "&autostart=1" : "";
    const { error } = await signInWithGoogle(`/login?next=${encodeURIComponent(nextPath)}${suffix}`);
    if (error) {
      setErro(error.message);
      setLoading(false);
    }
  }

  async function handleLogout() {
    setAutoStartBlocked(true);
    setLoading(true);
    await signOut();
    setLoading(false);
  }

  useEffect(() => {
    if (!sessionReady || autoStartBlocked) {
      return;
    }

    if (autoStart && accessToken && profile) {
      router.replace(nextPath);
      return;
    }

    if (autoStart && !accessToken && !loading && !autoStartAttemptedRef.current) {
      autoStartAttemptedRef.current = true;
      queueMicrotask(() => {
        const suffix = autoStart ? "&autostart=1" : "";
        void signInWithGoogle(`/login?next=${encodeURIComponent(nextPath)}${suffix}`).then(({ error }) => {
          if (error) {
            setErro(error.message);
          }
        });
      });
    }
  }, [accessToken, autoStart, autoStartBlocked, loading, nextPath, profile, router, sessionReady, signInWithGoogle]);

  return (
    <main className="min-h-screen bg-[var(--background)] text-white">
      <div className="mx-auto flex min-h-[calc(100vh-88px)] max-w-5xl flex-col justify-center px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <div className="mb-10 text-center">
          <Link href="/" className="text-[var(--muted)] hover:text-white">
            Voltar
          </Link>
          <p className="mt-6 text-xs uppercase tracking-[0.28em] text-[var(--accent-strong)]">Conta do cliente</p>
          <h1 className="mt-4 text-4xl font-semibold sm:text-5xl">Sua rotina com a barbearia em uma conta so.</h1>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-[var(--muted)] sm:text-lg">
            Entre com Google uma vez e use a mesma conta para agendar, acompanhar horarios e acessar sua area sem retrabalho.
          </p>
        </div>

        {erro && <div className="mb-6 rounded-2xl border border-red-700 bg-red-950/60 px-4 py-3 text-red-200">{erro}</div>}
        {!sessionReady && <p className="text-center text-[var(--muted)]">Carregando sessao...</p>}

        {sessionReady && !accessToken && (
          <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(0,0,0,0.16))] p-8 sm:p-10">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent-strong)]">Entrada simples</p>
              <h2 className="mt-4 text-3xl font-semibold">Acesse sua conta</h2>
              <p className="mt-4 max-w-xl text-[var(--muted)]">
                O login acontece uma vez. Depois disso, suas reservas, seu cadastro e sua conta ficam organizados no mesmo fluxo.
              </p>

              <button
                type="button"
                onClick={() => void handleGoogleLogin()}
                disabled={loading}
                className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--accent)] px-7 py-3 font-semibold text-black hover:bg-[var(--accent-strong)] disabled:opacity-50"
              >
                {loading ? "Redirecionando..." : "Continuar com Google"}
              </button>

              <div className="mt-8 grid gap-3">
                {BENEFICIOS.map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm leading-6 text-[var(--muted)]">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[32px] border border-white/10 bg-black/20 p-8 sm:p-10">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent-strong)]">Primeiro acesso</p>
              <h2 className="mt-4 text-3xl font-semibold">Rapido e sem confusao</h2>
              <div className="mt-6 space-y-4 text-sm leading-7 text-[var(--muted)]">
                <p>1. Entre com sua conta Google.</p>
                <p>2. Informe nome e celular uma unica vez.</p>
                <p>3. Volte para agendar, acompanhar reservas e manter sua conta organizada.</p>
              </div>

              <div className="mt-8 rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                <p className="font-semibold text-white">Feito para o cliente comum</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  A ideia aqui nao e criar cadastro complicado. E permitir que voce marque e acompanhe seus horarios sem pensar demais.
                </p>
              </div>
            </div>
          </section>
        )}

        {sessionReady && accessToken && !profile && (
          <div className="space-y-4">
            <CustomerOnboardingCard
              accessToken={accessToken}
              title="Complete seu cadastro"
              description="Esta conta Google ainda nao foi finalizada no sistema. Informe seu nome e celular para continuar sem retrabalho nas proximas visitas."
              submitLabel="Salvar e continuar"
              onSaved={async () => {
                await refresh();
                window.location.href = nextPath;
              }}
            />
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleLogout}
                disabled={loading}
                className="rounded-full border border-white/20 px-6 py-3 font-semibold hover:bg-white/10 disabled:opacity-50"
              >
                Sair e trocar conta
              </button>
            </div>
          </div>
        )}

        {sessionReady && profile && !autoStart && (
          <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-8 sm:p-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent-strong)]">Conta conectada</p>
                <h2 className="mt-3 text-3xl font-semibold">Tudo pronto para continuar.</h2>
                <p className="mt-3 text-[var(--muted)]">
                  Voce esta logado como <span className="font-medium text-white">{profile.nome}</span>.
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loading}
                className="rounded-full border border-white/20 px-5 py-3 font-semibold hover:bg-white/10 disabled:opacity-50"
              >
                Sair
              </button>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Nome e sobrenome</p>
                <p className="mt-2 font-semibold">{profile.nome}</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Telefone</p>
                <p className="mt-2 font-semibold">{profile.telefone}</p>
              </div>
            </div>

            <div className="mt-8">
              <Link
                href={nextPath}
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--accent)] px-7 py-3 font-semibold text-black hover:bg-[var(--accent-strong)]"
              >
                {nextPath === "/minha-conta" ? "Minha conta" : "Continuar"}
              </Link>
            </div>
          </section>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-2 text-xs uppercase tracking-[0.14em] text-[var(--accent-strong)] sm:mt-10">
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2">Agendamento simples</span>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2">Conta unificada</span>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2">Historico organizado</span>
        </div>
      </div>
    </main>
  );
}
