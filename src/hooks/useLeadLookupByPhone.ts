import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LeadDealMatch {
  dealId: string;
  dealName: string | null;
  ownerEmail: string | null;
  originId: string | null;
  originName: string | null;
  stageName: string | null;
  createdAt: string;
}

export interface LeadMatch {
  contactId: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  deals: LeadDealMatch[];
}

const phoneSuffix = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : digits;
};

export function useLeadLookupByPhone(rawPhone: string) {
  const digits = rawPhone.replace(/\D/g, '');
  const suffix = phoneSuffix(rawPhone);
  const enabled = digits.length >= 8;

  return useQuery({
    queryKey: ['lead-lookup-by-phone', suffix],
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<LeadMatch[]> => {
      if (!enabled) return [];

      // 1. Buscar contatos com phone terminando no sufixo
      const { data: contacts, error: contactsErr } = await supabase
        .from('crm_contacts')
        .select('id, name, phone, email')
        .ilike('phone', `%${suffix}`)
        .limit(20);

      if (contactsErr) {
        console.error('[useLeadLookupByPhone] contacts error', contactsErr);
        return [];
      }
      if (!contacts || contacts.length === 0) return [];

      const contactIds = contacts.map(c => c.id);

      // 2. Buscar deals associados a esses contatos
      const { data: deals, error: dealsErr } = await supabase
        .from('crm_deals')
        .select(`
          id, name, contact_id, owner_id, origin_id, stage_id, created_at,
          crm_origins!origin_id(name),
          pipeline_stages!stage_id(name),
          profiles!owner_profile_id(email)
        `)
        .in('contact_id', contactIds)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (dealsErr) {
        console.warn('[useLeadLookupByPhone] deals error', dealsErr);
      }

      const dealsByContact = new Map<string, LeadDealMatch[]>();
      (deals || []).forEach((d: any) => {
        if (!d.contact_id) return;
        const arr = dealsByContact.get(d.contact_id) || [];
        arr.push({
          dealId: d.id,
          dealName: d.name,
          ownerEmail: d.profiles?.email || null,
          originId: d.origin_id,
          originName: d.crm_origins?.name || null,
          stageName: d.pipeline_stages?.name || null,
          createdAt: d.created_at,
        });
        dealsByContact.set(d.contact_id, arr);
      });

      return contacts.map(c => ({
        contactId: c.id,
        contactName: c.name,
        email: c.email,
        phone: c.phone,
        deals: dealsByContact.get(c.id) || [],
      }));
    },
  });
}
