import { supabase } from "@/lib/supabase";
import { constantTimeEqual, sha256 } from "@/lib/security";

export interface Barbeiro {
  id: string;
  nome: string;
  slug: string;
  login: string;
  senha_hash: string;
  ativo: boolean;
  ordem: number;
  foto_url: string | null;
}

const BARBEIROS_FALLBACK: Barbeiro[] = [
  {
    id: "enzo-ferreira",
    nome: "Enzo Ferreira",
    slug: "enzo-ferreira",
    login: "enzo",
    senha_hash: "9780504a6409d9e94d06f54161fba4b798fc348b2b595b1361e589aeea7f5a37",
    ativo: true,
    ordem: 1,
    foto_url: null,
  },
  {
    id: "rafa-costa",
    nome: "Rafael Costa",
    slug: "rafael-costa",
    login: "rafa",
    senha_hash: "033c5e1d53fe695ba624aca792a18ade043ed386c3d58e781ea23dd3f5c463a1",
    ativo: true,
    ordem: 2,
    foto_url: null,
  },
  {
    id: "marcos-lima",
    nome: "Marcos Lima",
    slug: "marcos-lima",
    login: "marcos",
    senha_hash: "d9c0002e3a7df51985a36327e5ec93760cc03f782f620a5fe7f2ac550218bfa6",
    ativo: true,
    ordem: 3,
    foto_url: null,
  },
];

async function loadBarbeirosFromDatabase() {
  const { data, error } = await supabase
    .from("barbeiros")
    .select("id, nome, slug, login, senha_hash, ativo, ordem, foto_url")
    .order("ordem", { ascending: true })
    .order("nome", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Barbeiro[];
}

export async function listActiveBarbeiros() {
  try {
    const barbeiros = await loadBarbeirosFromDatabase();
    return barbeiros.filter((barbeiro) => barbeiro.ativo);
  } catch {
    return BARBEIROS_FALLBACK.filter((barbeiro) => barbeiro.ativo);
  }
}

export async function listAllBarbeiros() {
  try {
    return await loadBarbeirosFromDatabase();
  } catch {
    return BARBEIROS_FALLBACK;
  }
}

export async function findBarbeiroByLogin(login?: string | null) {
  const normalized = String(login ?? "").trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  const barbeiros = await listAllBarbeiros();
  return barbeiros.find((barbeiro) => barbeiro.login.toLowerCase() === normalized) ?? null;
}

export async function findBarbeiroById(id?: string | null) {
  const normalized = String(id ?? "").trim();

  if (!normalized) {
    return null;
  }

  const barbeiros = await listAllBarbeiros();
  return barbeiros.find((barbeiro) => barbeiro.id === normalized) ?? null;
}

export async function authenticateBarbeiro(login: string, senha: string) {
  const barbeiro = await findBarbeiroByLogin(login);

  if (!barbeiro || !barbeiro.ativo) {
    return null;
  }

  const providedHash = await sha256(senha);
  const matches = await constantTimeEqual(providedHash, barbeiro.senha_hash);

  if (!matches) {
    return null;
  }

  return barbeiro;
}
