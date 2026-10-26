import { supabase } from '@/integrations/supabase/client';

/**
 * Consulta única de "negócios do contato" (não arquivados), compartilhada por
 * useContactDealIds (linha do tempo) e useContactDeals (CrossPipelineHistory).
 */
export const dealsDoContatoKey = (contactId: string) => ['deals-do-contato', contactId] as const;

export async function fetchDealsDoContato(contactId: string) {
  const { data, error } = await supabase
    .from('crm_deals')
    .select(`
      id, clint_id, name, created_at, owner_id, value, custom_fields,
      crm_origins(name),
      crm_stages(stage_name, color)
    `)
    .eq('contact_id', contactId)
    .eq('is_archived', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
