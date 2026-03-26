"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CustomerOnboardingCard } from "@/app/_components/CustomerOnboardingCard";
import { useCustomerSession } from "@/lib/use-customer-session";

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
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <Link href="/" className="text-[var(--muted)] hover:text-white">
            Voltar
          </Link>
          <h1 className="mt-6 text-4xl font-semibold">Conta do cliente</h1>
          <p className="mt-3 text-[var(--muted)]">
            Entre com Google uma vez e use a mesma conta para agendar, acompanhar seus horarios e acessar sua area.
          </p>
        </div>

        {erro && <div className="mb-6 border border-red-700 bg-red-950/60 px-4 py-3 text-red-200">{erro}</div>}
        {!sessionReady && <p className="text-center text-[var(--muted)]">Carregando sessao...</p>}

        {sessionReady && !accessToken && (
          <section className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="border border-white/10 bg-white/[0.03] p-8">
              <h2 className="text-2xl font-semibold">Acesse sua conta</h2>
              <button
                type="button"
                onClick={() => void handleGoogleLogin()}
                disabled={loading}
                className="mt-8 bg-[var(--accent)] px-6 py-3 font-semibold text-black hover:bg-[var(--accent-strong)] disabled:opacity-50"
              >
                {loading ? "Redirecionando..." : "Continuar com Google"}
              </button>
            </div>

            <div className="border border-white/10 bg-black/20 p-8">
              <h2 className="text-2xl font-semibold">Primeiro acesso</h2>
              <p className="mt-4 text-[var(--muted)]">
                Depois do login, voce informa apenas nome e celular. O sistema guarda isso na sua conta para as proximas visitas.
              </p>
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
                className="border border-white/20 px-6 py-3 font-semibold hover:bg-white/10 disabled:opacity-50"
              >
                Sair e trocar conta
              </button>
            </div>
          </div>
        )}

        {sessionReady && profile && !autoStart && (
          <section className="border border-white/10 bg-white/[0.03] p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Conta conectada</h2>
                <p className="mt-2 text-[var(--muted)]">
                  Voce esta logado como <span className="font-medium text-white">{profile.nome}</span>.
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loading}
                className="border border-white/20 px-4 py-2 font-semibold hover:bg-white/10 disabled:opacity-50"
              >
                Sair
              </button>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="border border-white/10 bg-black/20 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Nome e sobrenome</p>
                <p className="mt-2 font-semibold">{profile.nome}</p>
              </div>
              <div className="border border-white/10 bg-black/20 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Telefone</p>
                <p className="mt-2 font-semibold">{profile.telefone}</p>
              </div>
            </div>

            <div className="mt-8">
              <Link
                href={nextPath}
                className="inline-flex bg-[var(--accent)] px-6 py-3 font-semibold text-black hover:bg-[var(--accent-strong)]"
              >
                {nextPath === "/minha-conta" ? "Minha conta" : "Continuar"}
              </Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
