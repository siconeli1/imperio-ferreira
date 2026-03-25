"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useCustomerSession } from "@/lib/use-customer-session";

export function CustomerAccountBar() {
  const pathname = usePathname();
  const { sessionReady, accessToken, profile, signInWithGoogle, signOut } = useCustomerSession();
  const [loading, setLoading] = useState(false);

  if (pathname?.startsWith("/admin")) {
    return null;
  }

  async function handleLogin() {
    setLoading(true);
    const { error } = await signInWithGoogle(pathname || "/");
    if (error) {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoading(true);
    await signOut();
    setLoading(false);
  }

  return (
    <header className="border-b border-white/10 bg-black/30 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-lg font-semibold tracking-[0.16em] text-white uppercase">
            Imperio Ferreira
          </Link>
          <span className="hidden text-sm text-[var(--muted)] sm:inline">
            Agenda online, minha conta e historico vinculados ao seu Google.
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link href="/agendar" className="text-sm font-medium text-[var(--muted)] hover:text-white">
            Agendar
          </Link>
          <Link href="/meus-agendamentos" className="text-sm font-medium text-[var(--muted)] hover:text-white">
            Meus agendamentos
          </Link>
          <Link href="/minha-conta" className="text-sm font-medium text-[var(--muted)] hover:text-white">
            Minha conta
          </Link>

          {!sessionReady && <span className="text-sm text-[var(--muted)]">Carregando conta...</span>}

          {sessionReady && !accessToken && (
            <button
              type="button"
              onClick={handleLogin}
              disabled={loading}
              className="bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-black hover:bg-[var(--accent-strong)] disabled:opacity-50"
            >
              {loading ? "Entrando..." : "Entrar com Google"}
            </button>
          )}

          {sessionReady && accessToken && !profile && (
            <>
              <Link
                href={`/login?next=${encodeURIComponent(pathname || "/")}`}
                className="border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10"
              >
                Completar cadastro
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loading}
                className="border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"
              >
                Sair
              </button>
            </>
          )}

          {sessionReady && accessToken && profile && (
            <>
              <span className="text-sm text-white">Ola, {profile.nome.split(" ")[0]}</span>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loading}
                className="border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"
              >
                Sair
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
