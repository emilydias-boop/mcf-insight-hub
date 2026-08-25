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

/**
 * Cobre os DOIS casos do trigger prevent_duplicate_crm_contact:
 * duplicate_contact:phone:<sufixo>:<id> e duplicate_contact:email:<email>:<id>.
 * Devolve frase pronta com o nome do contato dono, ou null se o erro for outro.
 */
export async function describeDuplicateContactError(error: unknown): Promise<string | null> {
  const msg = (error as any)?.message || (error as any)?.details || String(error || "");
  const match = /duplicate_contact:(phone|email):(.+?):([0-9a-f-]{36})/i.exec(msg);
  if (!match) return null;
  const tipo = match[1].toLowerCase() as "phone" | "email";
  const conflictingContactId = match[3];
  const rotulo = tipo === "phone" ? "Este telefone" : "Este e-mail";

  try {
    const { data } = await supabase
      .from("crm_contacts")
      .select("id, name, phone, email")
      .eq("id", conflictingContactId)
      .maybeSingle();
    if (data) {
      const detalhe = tipo === "phone" ? data.phone : data.email;
      const sufixo = detalhe ? ` (${detalhe})` : "";
      return `${rotulo} já está cadastrado em outro lead: ${data.name || "sem nome"}${sufixo}.`;
    }
  } catch {
    /* ignore */
  }
  return `${rotulo} já está cadastrado em outro lead.`;
}

/** Mensagem humana imediata (sem consulta ao banco), para toasts. */
export function mensagemDuplicateContact(rawMessage: string): string | null {
  if (/^duplicate_contact:phone/i.test(rawMessage)) {
    return "Este telefone já está cadastrado em outro lead. Busque o lead existente em vez de criar um novo.";
  }
  if (/^duplicate_contact:email/i.test(rawMessage)) {
    return "Este e-mail já está cadastrado em outro lead. Busque o lead existente em vez de criar um novo.";
  }
  return null;
}
