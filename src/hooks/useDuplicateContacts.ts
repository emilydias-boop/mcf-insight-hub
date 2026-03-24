import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type DuplicateMatchType = 'email' | 'phone' | 'email_prefix_phone';

interface DuplicateContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  deals_count: number;
  meetings_count: number;
  has_owner: boolean;
  max_stage_order: number;
}

export interface DuplicateGroup {
  matchKey: string;
  matchType: DuplicateMatchType;
  contacts: DuplicateContact[];
}

// Extrai os últimos 9 dígitos do telefone
function getPhoneSuffix(phone: string | null): string {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  return clean.slice(-9);
}

// Busca duplicados por EMAIL
async function fetchEmailDuplicates(): Promise<DuplicateGroup[]> {
  const { data: emails, error } = await supabase
    .rpc('get_duplicate_contact_emails', { limit_count: 200 });

  if (error) throw error;
  if (!emails?.length) return [];

  const groups: DuplicateGroup[] = [];

  for (const { email } of emails) {
    const { data: contacts } = await supabase
      .from('crm_contacts')
      .select(`
        id, name, email, phone, created_at,
        crm_deals(id, owner_id, stage_id, crm_stages(stage_order), meeting_slots(id))
      `)
      .ilike('email', email)
      .order('created_at', { ascending: true });

    if (!contacts || contacts.length < 2) continue;

    const mappedContacts: DuplicateContact[] = contacts.map(c => {
      const deals = (c.crm_deals as any[]) || [];
      const meetingsCount = deals.reduce((acc, d) => acc + ((d.meeting_slots as any[])?.length || 0), 0);
      const maxStageOrder = deals.length > 0 ? Math.max(...deals.map((d: any) => d.crm_stages?.stage_order ?? -1)) : -1;
      return {
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        created_at: c.created_at,
        deals_count: deals.length,
        meetings_count: meetingsCount,
        has_owner: deals.some((d: any) => d.owner_id),
        max_stage_order: maxStageOrder,
      };
    });

    // Ordenar: maior stage_order > mais deals > mais reuniões > mais antigo
    mappedContacts.sort((a, b) => {
      if (b.max_stage_order !== a.max_stage_order) return b.max_stage_order - a.max_stage_order;
      if (b.deals_count !== a.deals_count) return b.deals_count - a.deals_count;
      if (b.meetings_count !== a.meetings_count) return b.meetings_count - a.meetings_count;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    groups.push({
      matchKey: email,
      matchType: 'email',
      contacts: mappedContacts,
    });
  }

  return groups;
}

// Busca duplicados por TELEFONE
async function fetchPhoneDuplicates(): Promise<DuplicateGroup[]> {
  const { data: phones, error } = await supabase
    .rpc('get_duplicate_contact_phones', { limit_count: 200 });

  if (error) throw error;
  if (!phones?.length) return [];

  const groups: DuplicateGroup[] = [];

  for (const { phone_suffix } of phones) {
    if (!phone_suffix || phone_suffix.length < 8) continue;

    const { data: contacts } = await supabase
      .from('crm_contacts')
      .select(`
        id, name, email, phone, created_at,
        crm_deals(id, owner_id, stage_id, crm_stages(order), meeting_slots(id))
      `)
      .ilike('phone', `%${phone_suffix}`)
      .order('created_at', { ascending: true });

    if (!contacts || contacts.length < 2) continue;

    const filtered = contacts.filter(c => getPhoneSuffix(c.phone) === phone_suffix);
    if (filtered.length < 2) continue;

    const mappedContacts: DuplicateContact[] = filtered.map(c => {
      const deals = (c.crm_deals as any[]) || [];
      const meetingsCount = deals.reduce((acc, d) => acc + ((d.meeting_slots as any[])?.length || 0), 0);
      const maxStageOrder = deals.length > 0 ? Math.max(...deals.map((d: any) => d.crm_stages?.order ?? -1)) : -1;
      return {
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        created_at: c.created_at,
        deals_count: deals.length,
        meetings_count: meetingsCount,
        has_owner: deals.some((d: any) => d.owner_id),
        max_stage_order: maxStageOrder,
      };
    });

    mappedContacts.sort((a, b) => {
      if (b.max_stage_order !== a.max_stage_order) return b.max_stage_order - a.max_stage_order;
      if (b.deals_count !== a.deals_count) return b.deals_count - a.deals_count;
      if (b.meetings_count !== a.meetings_count) return b.meetings_count - a.meetings_count;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    groups.push({
      matchKey: phone_suffix,
      matchType: 'phone',
      contacts: mappedContacts,
    });
  }

  return groups;
}

// Hook para buscar todos os tipos de duplicados
export function useDuplicateContacts(matchType: DuplicateMatchType = 'email') {
  return useQuery({
    queryKey: ['duplicate-contacts', matchType],
    queryFn: async () => {
      if (matchType === 'email') {
        return fetchEmailDuplicates();
      } else if (matchType === 'phone') {
        return fetchPhoneDuplicates();
      }
      // email_prefix_phone seria uma combinação mais complexa, podemos adicionar depois
      return fetchEmailDuplicates();
    },
  });
}

// Hook legado para compatibilidade
export function useDuplicateContactsLegacy() {
  return useQuery({
    queryKey: ['duplicate-contacts'],
    queryFn: async () => {
      const { data: contacts, error } = await supabase
        .from('crm_contacts')
        .select(`
          id,
          name,
          email,
          phone,
          created_at,
          crm_deals(id, owner_id)
        `)
        .not('email', 'is', null)
        .order('email')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const groups: Record<string, DuplicateContact[]> = {};
      
      for (const contact of contacts || []) {
        const email = contact.email?.toLowerCase();
        if (!email) continue;

        const deals = (contact.crm_deals as any[]) || [];
        
        if (!groups[email]) {
          groups[email] = [];
        }
        
        groups[email].push({
          id: contact.id,
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          created_at: contact.created_at,
          deals_count: deals.length,
          meetings_count: 0,
          has_owner: deals.some((d: any) => d.owner_id),
          max_stage_order: -1,
        });
      }

      const duplicates: DuplicateGroup[] = Object.entries(groups)
        .filter(([_, contacts]) => contacts.length >= 2)
        .map(([email, contacts]) => ({
          matchKey: email,
          matchType: 'email' as DuplicateMatchType,
          contacts: contacts.sort((a, b) => {
            if (a.has_owner !== b.has_owner) return a.has_owner ? -1 : 1;
            if (a.deals_count !== b.deals_count) return b.deals_count - a.deals_count;
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          }),
        }));

      return duplicates;
    },
  });
}

export function useMergeDuplicates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ primaryId, duplicateIds }: { primaryId: string; duplicateIds: string[] }) => {
      const { data, error } = await supabase.functions.invoke('merge-duplicate-contacts', {
        body: { primary_id: primaryId, duplicate_ids: duplicateIds, dry_run: false },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const consolidated = data.deals_consolidated || 0;
      const deleted = data.contacts_deleted || 0;
      toast.success(`Unificado! ${deleted} contato(s) removido(s), ${consolidated} deal(s) consolidado(s)`);
      queryClient.invalidateQueries({ queryKey: ['duplicate-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
    },
    onError: (error: any) => {
      toast.error(`Erro ao unificar: ${error.message}`);
    },
  });
}

export function useMergeAllDuplicates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dryRun = false, matchType = 'email' }: { dryRun?: boolean; matchType?: DuplicateMatchType }) => {
      const { data, error } = await supabase.functions.invoke('merge-duplicate-contacts', {
        body: { dry_run: dryRun, limit: 500, match_type: matchType },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.dry_run) {
        toast.info(`Simulação: ${data.total_groups} grupos encontrados`);
      } else {
        toast.success(`${data.merged} grupos unificados, ${data.contacts_deleted} contatos removidos`);
      }
      queryClient.invalidateQueries({ queryKey: ['duplicate-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
    },
    onError: (error: any) => {
      toast.error(`Erro: ${error.message}`);
    },
  });
}

export function useConsolidateDeals() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dryRun = true }: { dryRun?: boolean }) => {
      const { data, error } = await supabase.functions.invoke('merge-duplicate-contacts', {
        body: { consolidate_only: true, dry_run: dryRun },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.dry_run) {
        toast.info(`Simulação: ${data.total_groups} pares de deals duplicados encontrados na mesma pipeline`);
      } else {
        toast.success(`${data.deals_consolidated} deal(s) consolidado(s) com sucesso!`);
      }
      queryClient.invalidateQueries({ queryKey: ['duplicate-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
    },
    onError: (error: any) => {
      toast.error(`Erro ao consolidar deals: ${error.message}`);
    },
  });
}

export function useFullCleanup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dryRun = true }: { dryRun?: boolean }) => {
      const { data, error } = await supabase.functions.invoke('merge-duplicate-contacts', {
        body: { full_cleanup: true, dry_run: dryRun, limit: 500 },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.dry_run) {
        const parts = [];
        if (data.email_groups > 0) parts.push(`${data.email_groups} grupos por email`);
        if (data.phone_groups > 0) parts.push(`${data.phone_groups} grupos por telefone`);
        if (data.deal_consolidation_pairs > 0) parts.push(`${data.deal_consolidation_pairs} pares de deals`);
        toast.info(`Simulação: ${parts.join(', ')}`);
      } else {
        const parts = [];
        if (data.email_groups_merged > 0) parts.push(`${data.email_groups_merged} por email`);
        if (data.phone_groups_merged > 0) parts.push(`${data.phone_groups_merged} por telefone`);
        if (data.deals_consolidated > 0) parts.push(`${data.deals_consolidated} deals consolidados`);
        toast.success(`Limpeza completa! ${parts.join(', ')}`);
      }
      queryClient.invalidateQueries({ queryKey: ['duplicate-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
    },
    onError: (error: any) => {
      toast.error(`Erro na limpeza completa: ${error.message}`);
    },
  });
}
