import { normalizePhone } from "@/lib/phone";

export function getWhatsAppLink(phone?: string | null) {
  const digits = normalizePhone(phone);
  return digits ? `https://wa.me/55${digits}` : null;
}
