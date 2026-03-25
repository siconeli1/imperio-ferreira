"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AdminNotice,
  AdminPageHeading,
  AdminPanel,
} from "@/app/admin/_components/AdminUi";

type ClienteResumo = {
  id: string;
  nome: string;
  telefone: string;
  email_google: string | null;
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
      const res = await fetch("/api/admin/clientes", { cache: "no-store" });
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
    const termo = busca.trim().toLowerCase();
    if (!termo) return clientes;
    return clientes.filter((cliente) => {
      const nome = cliente.nome.toLowerCase();
      const email = (cliente.email_google ?? "").toLowerCase();
      return nome.includes(termo) || cliente.telefone.includes(termo) || email.includes(termo);
    });
  }, [busca, clientes]);

  return (
    <>
      <AdminPageHeading
        eyebrow="Clientes"
        title="Base geral de clientes"
        description="Aqui ficam todos os clientes cadastrados pela barbearia, independentemente de qual barbeiro atendeu. Voce consulta nome, celular, e-mail Google, ultima visita e plano ativo."
        actions={
          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar por nome, celular ou e-mail"
            className="w-full min-w-[260px] rounded-full border border-white/10 bg-white/[0.06] px-4 py-3 text-sm"
          />
        }
      />

      {erro ? <div className="mb-6"><AdminNotice tone="danger">{erro}</AdminNotice></div> : null}

      <AdminPanel title="Lista de clientes" description="Abrindo um cliente, voce enxerga historico de reservas, financeiro, plano e observacoes internas.">
        {loading ? <p className="text-[var(--muted)]">Carregando clientes...</p> : null}
        {!loading && filtrados.length === 0 ? <p className="text-[var(--muted)]">Nenhum cliente encontrado.</p> : null}

        {!loading && filtrados.length > 0 ? (
          <div className="space-y-4">
            {filtrados.map((cliente) => (
              <div key={cliente.id} className="grid gap-4 rounded-[24px] border border-white/10 bg-black/20 p-5 xl:grid-cols-[1.1fr_0.9fr_auto] xl:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-semibold">{cliente.nome}</h2>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs uppercase tracking-[0.16em] text-[var(--accent-strong)]">
                      {cliente.plano_nome ?? "Sem plano"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--muted)]">Celular: {cliente.telefone}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">Google: {cliente.email_google || "Nao encontrado"}</p>
                </div>

                <div className="text-sm text-[var(--muted)]">
                  <p>Ultima visita: {cliente.ultima_visita ?? "-"}</p>
                  <p className="mt-1">Vencimento do plano: {cliente.vencimento ?? "-"}</p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <a href={cliente.whatsapp_link} target="_blank" rel="noreferrer" className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/10">
                    WhatsApp
                  </a>
                  <Link href={`/admin/clientes/${cliente.id}`} className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-black hover:bg-[var(--accent-strong)]">
                    Ver perfil
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </AdminPanel>
    </>
  );
}
