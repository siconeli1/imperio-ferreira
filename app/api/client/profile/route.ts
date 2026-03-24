import { NextResponse } from "next/server";
import { requireCustomerAuth, getCustomerProfileByAuthUserId } from "@/lib/customer-auth";
import { normalizePhone } from "@/lib/phone";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  try {
    const auth = await requireCustomerAuth(request);
    const profile = await getCustomerProfileByAuthUserId(auth.authUserId);
    return NextResponse.json({ profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar perfil.";
    return NextResponse.json({ erro: message }, { status: message === "Cliente nao autenticado" ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireCustomerAuth(request);
    const body = await request.json();
    const nome = String(body?.nome ?? "").trim();
    const telefone = normalizePhone(body?.telefone);
    const dataNascimento = String(body?.data_nascimento ?? "").trim();

    if (!nome || !telefone) {
      return NextResponse.json({ erro: "Nome e telefone sao obrigatorios." }, { status: 400 });
    }

    const existing = await getCustomerProfileByAuthUserId(auth.authUserId);
    if (existing) {
      return NextResponse.json({ erro: "Perfil ja cadastrado." }, { status: 409 });
    }

    const { data, error } = await supabase
      .from("clientes")
      .insert({
        auth_user_id: auth.authUserId,
        nome,
        telefone,
        data_nascimento: dataNascimento || null,
      })
      .select("*")
      .single();

    if (error) {
      if (error.message?.includes("data_nascimento")) {
        return NextResponse.json(
          { erro: "O banco ainda exige data de nascimento. Aplique a migration que torna esse campo opcional no cadastro do cliente." },
          { status: 500 }
        );
      }
      return NextResponse.json({ erro: error.message }, { status: 500 });
    }

    return NextResponse.json({ profile: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar perfil.";
    return NextResponse.json({ erro: message }, { status: message === "Cliente nao autenticado" ? 401 : 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireCustomerAuth(request);
    const existing = await getCustomerProfileByAuthUserId(auth.authUserId);
    if (!existing) {
      return NextResponse.json({ erro: "Perfil nao encontrado." }, { status: 404 });
    }

    const body = await request.json();
    const patch: Record<string, string> = {};

    if (body?.nome) patch.nome = String(body.nome).trim();
    if (body?.telefone) patch.telefone = normalizePhone(body.telefone);
    if (body?.data_nascimento) patch.data_nascimento = String(body.data_nascimento).trim();

    const { data, error } = await supabase
      .from("clientes")
      .update(patch)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ erro: error.message }, { status: 500 });
    }

    return NextResponse.json({ profile: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao atualizar perfil.";
    return NextResponse.json({ erro: message }, { status: message === "Cliente nao autenticado" ? 401 : 500 });
  }
}
