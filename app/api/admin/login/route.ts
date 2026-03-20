import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionCookie,
} from "@/lib/admin-session";
import { authenticateBarbeiro } from "@/lib/barbeiros";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const login = String(body?.login ?? "").trim();
  const senha = String(body?.password ?? "");

  if (!login || !senha) {
    return NextResponse.json({ erro: "Informe login e senha." }, { status: 400 });
  }

  const barbeiro = await authenticateBarbeiro(login, senha);

  if (!barbeiro) {
    return NextResponse.json({ erro: "Login ou senha invalidos." }, { status: 401 });
  }

  const token = await createAdminSessionCookie({
    barbeiro_id: barbeiro.id,
    barbeiro_login: barbeiro.login,
    barbeiro_nome: barbeiro.nome,
  });

  const response = NextResponse.json({
    ok: true,
    barbeiro: {
      id: barbeiro.id,
      nome: barbeiro.nome,
      login: barbeiro.login,
      slug: barbeiro.slug,
    },
  });

  response.cookies.set(ADMIN_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    path: "/",
  });

  return response;
}
