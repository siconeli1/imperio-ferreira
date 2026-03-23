"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type ClienteResumo = {
  id: string;
  nome: string;
  telefone: string;
  ultima_visita: string | null;
  plano_ativo: string | null;
  plano_nome?: string | null;
  vencimento: string | null;
  whatsapp_link: string;
};

export default function AdminClientesPage() {
  const [clientes, setClientes] = useState<ClienteResumo[]>([]);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregar() {
      setLoading(true);
      const res = await fetch("/api/admin/clientes");
      const json = await res.json();
      if (!res.ok) {
        setErro(json.erro || "Erro ao carregar clientes.");
        setLoading(false);
        return;
      }
      setClientes(json.clientes ?? []);
      setLoading(false);
    }

    void carregar();
  }, []);

  const filtrados = useMemo(() => {
    const term = busca.trim().toLowerCase();
    if (!term) return clientes;
    return clientes.filter((cliente) => cliente.nome.toLowerCase().includes(term) || cliente.telefone.includes(term));
  }, [busca, clientes]);

  return (
    <main className="min-h-screen bg-[var(--background)] text-white">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/admin" className="text-[var(--muted)] hover:text-white">Voltar ao admin</Link>
            <h1 className="mt-4 text-4xl font-semibold">Clientes</h1>
            <p className="mt-2 text-[var(--muted)]">Lista geral com ultima visita, plano ativo e atalho direto para WhatsApp.</p>
          </div>
          <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar por nome ou telefone" className="w-full max-w-sm rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 sm:w-80" />
        </div>

        {erro && <div className="mb-6 border border-red-700 bg-red-950/60 px-4 py-3 text-red-200">{erro}</div>}
        {loading && <p className="text-[var(--muted)]">Carregando clientes...</p>}

        {!loading && (
          <div className="grid gap-4">
            {filtrados.map((cliente) => (
              <div key={cliente.id} className="grid gap-4 border border-white/10 bg-white/[0.03] p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-semibold">{cliente.nome}</h2>
                    <span className="text-xs uppercase tracking-[0.2em] text-[var(--accent-strong)]">{cliente.plano_nome ?? "sem plano"}</span>
                  </div>
                  <p className="mt-2 text-[var(--muted)]">Telefone: {cliente.telefone}</p>
                  <p className="mt-1 text-[var(--muted)]">Ultima visita: {cliente.ultima_visita ?? "-"}</p>
                  <p className="mt-1 text-[var(--muted)]">Vencimento: {cliente.vencimento ?? "-"}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <a href={cliente.whatsapp_link} target="_blank" rel="noreferrer" className="border border-white/20 px-4 py-2 font-semibold hover:bg-white/10">
                    WhatsApp
                  </a>
                  <Link href={`/admin/clientes/${cliente.id}`} className="bg-[var(--accent)] px-4 py-2 font-semibold text-black hover:bg-[var(--accent-strong)]">
                    Ver perfil
                  </Link>
                </div>
              </div>
            ))}
            {filtrados.length === 0 && <p className="text-[var(--muted)]">Nenhum cliente encontrado.</p>}
          </div>
        )}
      </div>
    </main>
  );
}

