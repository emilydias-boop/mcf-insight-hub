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

      // 1. Contatos com phone terminando no sufixo
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

      // 2. Deals desses contatos
      const { data: deals } = await supabase
        .from('crm_deals')
        .select('id, name, contact_id, owner_profile_id, origin_id, stage_id, created_at')
        .in('contact_id', contactIds)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
        .limit(50);

      const dealList = (deals || []) as any[];
      const originIds = Array.from(new Set(dealList.map(d => d.origin_id).filter(Boolean)));
      const stageIds  = Array.from(new Set(dealList.map(d => d.stage_id).filter(Boolean)));
      const ownerIds  = Array.from(new Set(dealList.map(d => d.owner_profile_id).filter(Boolean)));

      // 3. Lookups em paralelo
      const [originsRes, stagesRes, profilesRes] = await Promise.all([
        originIds.length
          ? supabase.from('crm_origins').select('id, name').in('id', originIds)
          : Promise.resolve({ data: [] as any[] }),
        stageIds.length
          ? supabase.from('pipeline_stages').select('id, name').in('id', stageIds)
          : Promise.resolve({ data: [] as any[] }),
        ownerIds.length
          ? supabase.from('profiles').select('id, email').in('id', ownerIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const originName = new Map<string, string>(
        (originsRes.data || []).map((o: any) => [o.id, o.name])
      );
      const stageName = new Map<string, string>(
        (stagesRes.data || []).map((s: any) => [s.id, s.name])
      );
      const ownerEmail = new Map<string, string>(
        (profilesRes.data || []).map((p: any) => [p.id, p.email])
      );

      const dealsByContact = new Map<string, LeadDealMatch[]>();
      dealList.forEach(d => {
        if (!d.contact_id) return;
        const arr = dealsByContact.get(d.contact_id) || [];
        arr.push({
          dealId: d.id,
          dealName: d.name,
          ownerEmail: d.owner_profile_id ? ownerEmail.get(d.owner_profile_id) || null : null,
          originId: d.origin_id,
          originName: d.origin_id ? originName.get(d.origin_id) || null : null,
          stageName: d.stage_id ? stageName.get(d.stage_id) || null : null,
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
