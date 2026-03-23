import { supabase } from "@/lib/supabase";

export type CustomerAuthContext = {
  authUserId: string;
  email: string | null;
};

export async function getCustomerAuthFromRequest(request: Request): Promise<CustomerAuthContext | null> {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return null;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }

  return {
    authUserId: data.user.id,
    email: data.user.email ?? null,
  };
}

export async function requireCustomerAuth(request: Request) {
  const auth = await getCustomerAuthFromRequest(request);

  if (!auth) {
    throw new Error("Cliente nao autenticado");
  }

  return auth;
}

export async function getCustomerProfileByAuthUserId(authUserId: string) {
  const { data, error } = await supabase
    .from("clientes")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
