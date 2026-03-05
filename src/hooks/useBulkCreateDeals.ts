import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BulkCreateDealsInput {
  contactIds: string[];
  originId: string;
  stageId: string;
}

export function useBulkCreateDeals() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contactIds, originId, stageId }: BulkCreateDealsInput) => {
      // Fetch contact names
      const { data: contacts, error: contactsErr } = await supabase
        .from('crm_contacts')
        .select('id, name')
        .in('id', contactIds);

      if (contactsErr) throw contactsErr;

      // Check existing deals for these contacts in same origin
      const { data: existingDeals } = await supabase
        .from('crm_deals')
        .select('contact_id')
        .in('contact_id', contactIds)
        .eq('origin_id', originId);

      const existingContactIds = new Set(existingDeals?.map(d => d.contact_id) || []);

      const contactMap = new Map(contacts?.map(c => [c.id, c.name]) || []);
      const newDeals = contactIds
        .filter(id => !existingContactIds.has(id))
        .map(contactId => ({
          name: contactMap.get(contactId) || 'Sem nome',
          contact_id: contactId,
          origin_id: originId,
          stage_id: stageId,
          owner_id: null,
          owner_profile_id: null,
          tags: [] as string[],
          clint_id: `partner_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${contactId.slice(0, 8)}`,
        }));

      if (newDeals.length === 0) {
        return { created: 0, skipped: contactIds.length };
      }

      // Insert in batches of 50
      let created = 0;
      for (let i = 0; i < newDeals.length; i += 50) {
        const batch = newDeals.slice(i, i + 50);
        const { error } = await supabase.from('crm_deals').insert(batch);
        if (error) throw error;
        created += batch.length;
      }

      return { created, skipped: contactIds.length - newDeals.length };
    },
    onSuccess: (result) => {
      const msgs: string[] = [];
      if (result.created > 0) msgs.push(`${result.created} deal(s) criado(s)`);
      if (result.skipped > 0) msgs.push(`${result.skipped} já existente(s)`);
      toast.success(msgs.join(', '));
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
    },
    onError: (error: any) => {
      console.error('Bulk create deals error:', error);
      toast.error('Erro ao criar deals: ' + error.message);
    },
  });
}
