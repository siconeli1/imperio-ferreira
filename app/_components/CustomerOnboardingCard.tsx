"use client";

import { useState } from "react";
import { formatarCelular } from "@/lib/format";

type ExistingProfile = {
  nome?: string | null;
  telefone?: string | null;
};

type CustomerOnboardingCardProps = {
  accessToken: string;
  existingProfile?: ExistingProfile | null;
  title?: string;
  description?: string;
  submitLabel?: string;
  onSaved?: () => Promise<void> | void;
};

export function CustomerOnboardingCard({
  accessToken,
  existingProfile,
  title = "Complete seu cadastro",
  description = "Informe seu nome e celular uma unica vez para usar sua conta Google em todos os agendamentos.",
  submitLabel = "Salvar cadastro",
  onSaved,
}: CustomerOnboardingCardProps) {
  const [nome, setNome] = useState(existingProfile?.nome ?? "");
  const [telefone, setTelefone] = useState(existingProfile?.telefone ?? "");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  async function salvarPerfil() {
    if (!nome.trim() || !telefone.trim()) {
      setErro("Preencha nome e celular para continuar.");
      return;
    }

    setLoading(true);
    setErro("");

    const method = existingProfile ? "PATCH" : "POST";
    const res = await fetch("/api/client/profile", {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        nome: nome.trim(),
        telefone,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      setErro(json.erro || "Erro ao salvar cadastro.");
      setLoading(false);
      return;
    }

    setLoading(false);
    await onSaved?.();
  }

  return (
    <section className="border border-white/10 bg-white/[0.03] p-8">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="mt-3 max-w-2xl text-[var(--muted)]">{description}</p>

      {erro && <div className="mt-6 border border-red-700 bg-red-950/60 px-4 py-3 text-red-200">{erro}</div>}

      <div className="mt-8 grid gap-4">
        <input
          value={nome}
          onChange={(event) => setNome(event.target.value)}
          placeholder="Seu nome"
          className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3"
        />
        <input
          type="tel"
          value={telefone}
          onChange={(event) => setTelefone(formatarCelular(event.target.value))}
          placeholder="(11) 99999-9999"
          maxLength={15}
          className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3"
        />
        <button
          type="button"
          onClick={salvarPerfil}
          disabled={loading}
          className="inline-flex items-center justify-center bg-[var(--accent)] px-6 py-3 font-semibold text-black hover:bg-[var(--accent-strong)] disabled:opacity-50"
        >
          {loading ? "Salvando..." : submitLabel}
        </button>
      </div>
    </section>
  );
}
