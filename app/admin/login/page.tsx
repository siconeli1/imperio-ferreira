"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setErro("");

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });
      const json = await res.json();

      if (!res.ok) {
        setErro(json.erro || "Erro ao fazer login");
        return;
      }

      router.push("/admin");
    } catch {
      setErro("Erro de conexao");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-white">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
        <section className="border border-white/10 bg-white/[0.03] p-8 lg:p-12">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--accent-strong)]">Imperio Ferreira</p>
          <h1 className="mt-5 text-5xl font-semibold leading-tight">Area administrativa por barbeiro.</h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--muted)]">
            Cada profissional acessa apenas a propria rotina: agenda do dia, marcacoes manuais, bloqueios e horarios personalizados.
          </p>
          <div className="mt-10 space-y-4 text-sm text-[var(--muted)]">
            <p>Logins iniciais da migration: `lucas`, `alexandre`, `ryan` e `peixoto`.</p>
            <p>Senha inicial para todos: `ferreira`.</p>
          </div>
        </section>

        <section className="border border-white/10 bg-black/25 p-8 lg:p-10">
          <h2 className="text-3xl font-semibold">Entrar</h2>
          <p className="mt-3 text-[var(--muted)]">Use sua credencial individual para acessar sua area.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <input
              type="text"
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              placeholder="Login"
              className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Senha"
              className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3"
              required
            />

            {erro && <div className="border border-red-700 bg-red-950/60 px-4 py-3 text-sm text-red-200">{erro}</div>}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center bg-[var(--accent)] px-6 py-3 font-semibold text-black hover:bg-[var(--accent-strong)] disabled:opacity-50"
            >
              {loading ? "Entrando..." : "Entrar na area admin"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

