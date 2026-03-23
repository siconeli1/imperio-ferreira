"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { formatarCelular } from "@/lib/format";

export default function LoginPage() {
  const supabase = getSupabaseBrowserClient();
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");

  const loadProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      setSessionReady(true);
      setProfile(null);
      return;
    }

    const res = await fetch("/api/client/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();

    if (res.ok) {
      setProfile(json.profile ?? null);
      if (json.profile) {
        setNome(String(json.profile.nome ?? ""));
        setTelefone(String(json.profile.telefone ?? ""));
        setDataNascimento(String(json.profile.data_nascimento ?? ""));
      }
    }

    setSessionReady(true);
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProfile();
    }, 0);
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      void loadProfile();
    });
    return () => {
      window.clearTimeout(timer);
      listener.subscription.unsubscribe();
    };
  }, [loadProfile, supabase]);

  async function signInWithGoogle() {
    setErro("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/login` },
    });
    if (error) {
      setErro(error.message);
      setLoading(false);
    }
  }

  async function salvarPerfil() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setErro("Sessao nao encontrada.");
      return;
    }

    setLoading(true);
    setErro("");

    const method = profile ? "PATCH" : "POST";
    const res = await fetch("/api/client/profile", {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ nome, telefone, data_nascimento: dataNascimento }),
    });
    const json = await res.json();

    if (!res.ok) {
      setErro(json.erro || "Erro ao salvar perfil.");
      setLoading(false);
      return;
    }

    setProfile(json.profile);
    setLoading(false);
  }

  async function sair() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-white">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <Link href="/" className="text-[var(--muted)] hover:text-white">Voltar</Link>
          <h1 className="mt-6 text-4xl font-semibold">Entrar com Google</h1>
          <p className="mt-3 text-[var(--muted)]">Login obrigatorio para confirmar reservas, acompanhar o plano e ver seu historico.</p>
        </div>

        {erro && <div className="mb-6 border border-red-700 bg-red-950/60 px-4 py-3 text-red-200">{erro}</div>}
        {!sessionReady && <p className="text-center text-[var(--muted)]">Carregando sessao...</p>}

        {sessionReady && !profile && (
          <section className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="border border-white/10 bg-white/[0.03] p-8">
              <h2 className="text-2xl font-semibold">Acesse sua conta</h2>
              <p className="mt-4 text-[var(--muted)]">Use Google OAuth. Nao existe login por SMS ou WhatsApp neste sistema.</p>
              <button onClick={signInWithGoogle} disabled={loading} className="mt-8 bg-[var(--accent)] px-6 py-3 font-semibold text-black hover:bg-[var(--accent-strong)] disabled:opacity-50">
                {loading ? "Redirecionando..." : "Continuar com Google"}
              </button>
            </div>

            <div className="border border-white/10 bg-black/20 p-8">
              <h2 className="text-2xl font-semibold">Primeiro acesso</h2>
              <p className="mt-4 text-[var(--muted)]">Depois do login, complete nome, telefone e data de nascimento para liberar o agendamento.</p>
            </div>
          </section>
        )}

        {sessionReady && profile && (
          <section className="border border-white/10 bg-white/[0.03] p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Seu cadastro</h2>
                <p className="mt-2 text-[var(--muted)]">Mantenha seus dados atualizados. O telefone fica com historico de alteracoes.</p>
              </div>
              <button onClick={sair} className="border border-white/20 px-4 py-2 font-semibold hover:bg-white/10">Sair</button>
            </div>

            <div className="mt-8 grid gap-4">
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3" />
              <input value={telefone} onChange={(e) => setTelefone(formatarCelular(e.target.value))} placeholder="Telefone" className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3" />
              <input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} className="datetime-input rounded-xl border px-4 py-3" />
              <div className="flex gap-3">
                <button onClick={salvarPerfil} disabled={loading} className="bg-[var(--accent)] px-6 py-3 font-semibold text-black hover:bg-[var(--accent-strong)] disabled:opacity-50">
                  {loading ? "Salvando..." : "Salvar perfil"}
                </button>
                <Link href="/minha-conta" className="border border-white/20 px-6 py-3 font-semibold hover:bg-white/10">Ir para minha conta</Link>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}



