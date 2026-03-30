import { supabase } from "@/lib/supabase";
import { constantTimeEqual, sha256 } from "@/lib/security";

export interface Barbeiro {
  id: string;
  nome: string;
  slug: string;
  login: string;
  senha_hash: string;
  cargo: "socio" | "barbeiro";
  ativo: boolean;
  ordem: number;
  foto_url: string | null;
}

const BARBEIROS_AUTORIZADOS = [
  {
    id: "lucas-cantelle",
    nome: "Lucas",
    slug: "lucas-cantelle",
    login: "lucas",
    cargo: "socio" as const,
    ordem: 1,
  },
  {
    id: "alexandre-albertini",
    nome: "Alexandre Albertini",
    slug: "alexandre-albertini",
    login: "alexandre",
    cargo: "barbeiro" as const,
    ordem: 2,
  },
  {
    id: "ryan-ferreira",
    nome: "Ryan",
    slug: "ryan-ferreira",
    login: "ryan",
    cargo: "socio" as const,
    ordem: 3,
  },
  {
    id: "peixoto",
    nome: "Peixoto",
    slug: "peixoto",
    login: "peixoto",
    cargo: "barbeiro" as const,
    ordem: 4,
  },
] as const;

type BarbeiroAutorizadoId = (typeof BARBEIROS_AUTORIZADOS)[number]["id"];

const BARBEIROS_AUTORIZADOS_MAP = new Map<BarbeiroAutorizadoId, (typeof BARBEIROS_AUTORIZADOS)[number]>(
  BARBEIROS_AUTORIZADOS.map((barbeiro) => [barbeiro.id, barbeiro])
);

const BARBEIROS_FALLBACK: Barbeiro[] = [
  {
    id: "lucas-cantelle",
    nome: "Lucas",
    slug: "lucas-cantelle",
    login: "lucas",
    senha_hash: "c4ed9a5c3798260ebc2c43c02428cae33fe3dd59129ec82f50374b82a4e4907d",
    cargo: "socio",
    ativo: true,
    ordem: 1,
    foto_url: null,
  },
  {
    id: "alexandre-albertini",
    nome: "Alexandre Albertini",
    slug: "alexandre-albertini",
    login: "alexandre",
    senha_hash: "c4ed9a5c3798260ebc2c43c02428cae33fe3dd59129ec82f50374b82a4e4907d",
    cargo: "barbeiro",
    ativo: true,
    ordem: 2,
    foto_url: null,
  },
  {
    id: "ryan-ferreira",
    nome: "Ryan",
    slug: "ryan-ferreira",
    login: "ryan",
    senha_hash: "c4ed9a5c3798260ebc2c43c02428cae33fe3dd59129ec82f50374b82a4e4907d",
    cargo: "socio",
    ativo: true,
    ordem: 3,
    foto_url: null,
  },
  {
    id: "peixoto",
    nome: "Peixoto",
    slug: "peixoto",
    login: "peixoto",
    senha_hash: "c4ed9a5c3798260ebc2c43c02428cae33fe3dd59129ec82f50374b82a4e4907d",
    cargo: "barbeiro",
    ativo: true,
    ordem: 4,
    foto_url: null,
  },
];

function filtrarBarbeirosAutorizados(barbeiros: Barbeiro[]) {
  return barbeiros
    .filter((barbeiro) => BARBEIROS_AUTORIZADOS_MAP.has(barbeiro.id as BarbeiroAutorizadoId))
    .map((barbeiro) => {
      const autorizado = BARBEIROS_AUTORIZADOS_MAP.get(barbeiro.id as BarbeiroAutorizadoId)!;
      return {
        ...barbeiro,
        nome: autorizado.nome,
        slug: autorizado.slug,
        login: autorizado.login,
        cargo: autorizado.cargo,
        ordem: autorizado.ordem,
      };
    })
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"));
}

async function loadBarbeirosFromDatabase() {
  const { data, error } = await supabase
    .from("barbeiros")
    .select("id, nome, slug, login, senha_hash, cargo, ativo, ordem, foto_url")
    .order("ordem", { ascending: true })
    .order("nome", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return filtrarBarbeirosAutorizados((data ?? []) as Barbeiro[]);
}

async function loadBarbeirosStrict() {
  return loadBarbeirosFromDatabase();
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

  const barbeiros = await loadBarbeirosStrict();
  return barbeiros.find((barbeiro) => barbeiro.login.toLowerCase() === normalized) ?? null;
}

export async function findBarbeiroById(id?: string | null) {
  const normalized = String(id ?? "").trim();

  if (!normalized) {
    return null;
  }

  const barbeiros = await loadBarbeirosStrict();
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
