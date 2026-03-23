import { supabase } from "@/lib/supabase";

export interface Servico {
  id: string;
  codigo: string;
  nome: string;
  categoria: "corte" | "barba" | "sobrancelha" | "combo" | "outro";
  duracao_minutos: number;
  preco: number;
  ordem: number;
  ativo: boolean;
}

const SERVICOS_FALLBACK: Servico[] = [
  {
    id: "corte-classico",
    codigo: "corte-classico",
    nome: "Corte classico",
    categoria: "corte",
    duracao_minutos: 45,
    preco: 45,
    ordem: 1,
    ativo: true,
  },
  {
    id: "barba-modelada",
    codigo: "barba-modelada",
    nome: "Barba modelada",
    categoria: "barba",
    duracao_minutos: 35,
    preco: 35,
    ordem: 2,
    ativo: true,
  },
  {
    id: "sobrancelha",
    codigo: "sobrancelha",
    nome: "Sobrancelha",
    categoria: "sobrancelha",
    duracao_minutos: 20,
    preco: 20,
    ordem: 3,
    ativo: true,
  },
  {
    id: "corte-barba",
    codigo: "corte-barba",
    nome: "Corte e barba",
    categoria: "combo",
    duracao_minutos: 70,
    preco: 75,
    ordem: 4,
    ativo: true,
  },
];

async function loadServicosFromDatabase() {
  const { data, error } = await supabase
    .from("servicos")
    .select("id, codigo, nome, categoria, duracao_minutos, preco, ordem, ativo")
    .order("ordem", { ascending: true })
    .order("nome", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Servico[];
}

export async function listarServicosAtivos() {
  try {
    const servicos = await loadServicosFromDatabase();
    const ativos = servicos.filter((servico) => servico.ativo !== false);
    return ativos.length > 0 ? ativos : SERVICOS_FALLBACK;
  } catch {
    return SERVICOS_FALLBACK;
  }
}

export async function encontrarServicoAtivo(params: { id?: string | null; codigo?: string | null }) {
  const match = String(params.id ?? params.codigo ?? "").trim().toLowerCase();

  if (!match) {
    return null;
  }

  const servicos = await listarServicosAtivos();
  return servicos.find((servico) => servico.id.toLowerCase() === match || servico.codigo.toLowerCase() === match) ?? null;
}

export async function encontrarServicosAtivosPorIds(serviceIds: string[]) {
  const ids = Array.from(new Set(serviceIds.map((item) => item.trim()).filter(Boolean)));
  if (ids.length === 0) return [];

  const servicos = await listarServicosAtivos();
  return servicos.filter((servico) => ids.includes(servico.id) || ids.includes(servico.codigo));
}
