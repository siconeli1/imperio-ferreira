import { supabase } from "@/lib/supabase";

export async function getCustomerEmailByAuthUserId(authUserId?: string | null) {
  if (!authUserId) {
    return null;
  }

  const { data, error } = await supabase.auth.admin.getUserById(authUserId);
  if (error) {
    return null;
  }

  return data.user?.email ?? null;
}

export async function buildCustomerEmailMap(authUserIds: Array<string | null | undefined>) {
  const ids = Array.from(new Set(authUserIds.filter(Boolean))) as string[];
  const pairs = await Promise.all(
    ids.map(async (authUserId) => [authUserId, await getCustomerEmailByAuthUserId(authUserId)] as const)
  );

  return new Map<string, string | null>(pairs);
}
