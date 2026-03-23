import { supabase } from "@/lib/supabase";

export type Plano = {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  cortes_incluidos: number;
  barbas_incluidas: number;
  sobrancelhas_incluidas: number;
  ativo: boolean;
  ordem: number;
};

export async function listarPlanosAtivos() {
  const { data, error } = await supabase
    .from("planos")
    .select("*")
    .eq("ativo", true)
    .order("ordem", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Plano[];
}

export async function buscarPlanoPorId(planoId: string) {
  const { data, error } = await supabase
    .from("planos")
    .select("*")
    .eq("id", planoId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as Plano | null;
}
