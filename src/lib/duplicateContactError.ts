import { supabase } from "@/integrations/supabase/client";

/**
 * Detecta se o erro vindo do Supabase corresponde à proteção
 * de telefone duplicado (trigger duplicate_contact:phone:<sufixo>:<contact_id>).
 * Retorna o nome amigável do contato dono do telefone, ou null.
 */
export async function describeDuplicatePhoneError(error: unknown): Promise<string | null> {
  const msg = (error as any)?.message || (error as any)?.details || String(error || "");
  const match = /duplicate_contact:phone:([0-9]+):([0-9a-f-]{36})/i.exec(msg);
  if (!match) return null;
  const conflictingContactId = match[2];
  try {
    const { data } = await supabase
      .from("crm_contacts")
      .select("id, name, phone")
      .eq("id", conflictingContactId)
      .maybeSingle();
    if (data) {
      const phone = data.phone ? ` (${data.phone})` : "";
      return `Este telefone já está cadastrado em outro lead: ${data.name || "sem nome"}${phone}.`;
    }
  } catch {
    /* ignore */
  }
  return "Este telefone já está cadastrado em outro lead.";
}
