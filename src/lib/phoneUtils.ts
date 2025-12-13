import { supabase } from '@/integrations/supabase/client';

/**
 * Normaliza número de telefone para formato E.164 (+55XXXXXXXXXXX)
 */
export function normalizePhoneNumber(phone: string): string {
  // Remove tudo exceto números
  let clean = phone.replace(/\D/g, '');
  
  // Se começar com 0, remove (ex: 011 -> 11)
  if (clean.startsWith('0')) {
    clean = clean.substring(1);
  }
  
  // Adiciona código do país se não tiver
  if (!clean.startsWith('55') && clean.length <= 11) {
    clean = '55' + clean;
  }
  
  return '+' + clean;
}

/**
 * Busca telefone na hubla_transactions pelo email do cliente
 */
export async function findPhoneByEmail(email: string): Promise<string | null> {
  if (!email) return null;
  
  const { data, error } = await supabase
    .from('hubla_transactions')
    .select('customer_phone')
    .eq('customer_email', email.toLowerCase())
    .not('customer_phone', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (error || !data || data.length === 0) {
    return null;
  }
  
  return data[0].customer_phone || null;
}

/**
 * Extrai telefone de múltiplas fontes do deal
 */
export function extractPhoneFromDeal(deal: any): string | null {
  return (
    deal.contact?.phone ||
    deal.custom_fields?.telefone ||
    deal.custom_fields?.phone ||
    deal.custom_fields?.complete_phone ||
    deal.custom_fields?.celular ||
    deal.custom_fields?.whatsapp ||
    null
  );
}

/**
 * Valida se o número tem formato válido para ligação
 */
export function isValidPhoneNumber(phone: string): boolean {
  const clean = phone.replace(/\D/g, '');
  // Número brasileiro deve ter 10-13 dígitos (com ou sem código do país)
  return clean.length >= 10 && clean.length <= 13;
}
