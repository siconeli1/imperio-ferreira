import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdminSession } from "@/lib/admin-auth";

export async function GET() {
  try {
    const session = await requireAdminSession();
    const { data: bloqueios, error } = await supabase
      .from("bloqueios_agenda")
      .select("*")
      .eq("barbeiro_id", session.barbeiro_id)
      .order("data", { ascending: false })
      .order("hora_inicio", { ascending: true });

    if (error) {
      return NextResponse.json({ erro: error.message }, { status: 500 });
    }

    return NextResponse.json({ bloqueios: bloqueios || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno ao listar bloqueios.";
    const status = message === "Nao autorizado" ? 401 : 500;
    return NextResponse.json({ erro: message }, { status });
  }
}
