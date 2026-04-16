import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { INSIDE_SALES_ORIGIN_ID } from '@/constants/team';
import { toast } from 'sonner';

// Busca todos os deals da Pipeline Inside Sales com contatos (em lotes de 1000)
export function useInsideSalesDeals() {
  return useQuery({
    queryKey: ['inside-sales-deals-limbo'],
    queryFn: async () => {
      const allDeals: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('crm_deals')
          .select(`
            id,
            name,
            value,
            owner_id,
            owner_profile_id,
            stage_id,
            origin_id,
            clint_id,
            created_at,
            updated_at,
            crm_contacts!crm_deals_contact_id_fkey (
              id,
              name,
              email,
              phone
            )
          `)
          .eq('origin_id', INSIDE_SALES_ORIGIN_ID)
          .eq('is_duplicate', false)
          .is('archived_at', null)
          .range(from, from + batchSize - 1);

        if (error) throw error;
        if (data) {
          allDeals.push(...data);
          hasMore = data.length === batchSize;
          from += batchSize;
        } else {
          hasMore = false;
        }
      }

      return allDeals;
    },
    staleTime: 5 * 60 * 1000, // 5 min cache
  });
}

// Busca SDRs ativos para select de atribuição
export function useActiveSdrs() {
  return useQuery({
    queryKey: ['active-sdrs-limbo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sdr')
        .select('id, name, email')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });
}

// Busca profiles para resolver owner_profile_id a partir do email
export function useProfilesByEmail() {
  return useQuery({
    queryKey: ['profiles-by-email-limbo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
  });
}

export interface LimboRow {
  // Dados da planilha
  excelName: string;
  excelEmail: string;
  excelPhone: string;
  excelStage: string;
  excelValue: number | null;
  excelOwner: string;
  excelCreatedAt?: string;
  excelLostAt?: string;
  // Resultado do match
  status: 'com_dono' | 'sem_dono' | 'nao_encontrado';
  // Deal local (se encontrado)
  localDealId?: string;
  localDealName?: string;
  localOwner?: string;
  localStage?: string;
  localContactName?: string;
  localContactEmail?: string;
  localContactPhone?: string;
  // Para atribuição
  assignedSdrEmail?: string;
  assignedCloserName?: string;
}

// Normaliza para comparação
function normalize(val: string | null | undefined): string {
  return (val || '').toLowerCase().trim();
}

// Compara planilha com deals locais
export function compareExcelWithLocal(
  excelRows: Array<{ name: string; email: string; phone: string; stage: string; value: number | null; owner: string; created_at?: string; lost_at?: string }>,
  localDeals: any[]
): LimboRow[] {
  // Indexar deals locais por email do contato e por nome do contato
  const byEmail = new Map<string, any>();
  const byName = new Map<string, any>();

  for (const deal of localDeals) {
    const contact = deal.crm_contacts;
    if (contact?.email) {
      const key = normalize(contact.email);
      if (key && !byEmail.has(key)) byEmail.set(key, deal);
    }
    if (contact?.name) {
      const key = normalize(contact.name);
      if (key && !byName.has(key)) byName.set(key, deal);
    }
  }

  return excelRows.map((row) => {
    const emailKey = normalize(row.email);
    const nameKey = normalize(row.name);

    // Tentar match por email primeiro, depois por nome
    const match = (emailKey ? byEmail.get(emailKey) : null) || (nameKey ? byName.get(nameKey) : null);

    if (!match) {
      return {
        excelName: row.name,
        excelEmail: row.email,
        excelPhone: row.phone,
        excelStage: row.stage,
        excelValue: row.value,
        excelOwner: row.owner,
        excelCreatedAt: row.created_at || '',
        excelLostAt: row.lost_at || '',
        status: 'nao_encontrado' as const,
      };
    }

    const contact = match.crm_contacts;
    const stageName = '';

    return {
      excelName: row.name,
      excelEmail: row.email,
      excelPhone: row.phone,
      excelStage: row.stage,
      excelValue: row.value,
      excelOwner: row.owner,
      excelCreatedAt: row.created_at || '',
      excelLostAt: row.lost_at || '',
      status: match.owner_id ? ('com_dono' as const) : ('sem_dono' as const),
      localDealId: match.id,
      localDealName: match.name,
      localOwner: match.owner_id || '',
      localStage: stageName,
      localContactName: contact?.name || '',
      localContactEmail: contact?.email || '',
      localContactPhone: contact?.phone || '',
    };
  });
}

// Revalidate persisted limbo results against current CRM data (batched)
export async function revalidateLimboResults(
  results: LimboRow[],
  localDeals: any[]
): Promise<{ updated: LimboRow[]; changed: boolean }> {
  // Build indexes from current local deals
  const byEmail = new Map<string, any>();
  const byName = new Map<string, any>();

  for (const deal of localDeals) {
    const contact = deal.crm_contacts;
    if (contact?.email) {
      const key = normalize(contact.email);
      if (key && !byEmail.has(key)) byEmail.set(key, deal);
    }
    if (contact?.name) {
      const key = normalize(contact.name);
      if (key && !byName.has(key)) byName.set(key, deal);
    }
  }

  // First pass: resolve using local Inside Sales deals
  let changed = false;
  const firstPass = results.map((r) => {
    if (r.status === 'com_dono') return r;
    const emailKey = normalize(r.excelEmail);
    const nameKey = normalize(r.excelName);
    const localMatch = (emailKey ? byEmail.get(emailKey) : null) || (nameKey ? byName.get(nameKey) : null);

    if (localMatch) {
      if (localMatch.owner_id) {
        changed = true;
        return { ...r, status: 'com_dono' as const, localDealId: localMatch.id, localOwner: localMatch.owner_id };
      }
      if (r.status === 'nao_encontrado') {
        changed = true;
        return { ...r, status: 'sem_dono' as const, localDealId: localMatch.id };
      }
    }
    return r;
  });

  // Collect unique emails of still-unresolved leads for global batched search
  const unresolvedEmailSet = new Set<string>();
  for (const r of firstPass) {
    if (r.status === 'nao_encontrado' || r.status === 'sem_dono') {
      const emailKey = normalize(r.excelEmail);
      if (emailKey) unresolvedEmailSet.add(emailKey);
    }
  }
  const unresolvedEmails = Array.from(unresolvedEmailSet);

  // Batched global search: find contacts by email using .in()
  const BATCH = 200;
  const globalContactMap = new Map<string, { hasOwner: boolean; ownerEmail: string }>();

  // Step 1: Batch fetch contact IDs by email
  const emailToContactId = new Map<string, string>();
  for (let i = 0; i < unresolvedEmails.length; i += BATCH) {
    const batch = unresolvedEmails.slice(i, i + BATCH);
    const { data: contacts } = await supabase
      .from('crm_contacts')
      .select('id, email')
      .in('email', batch);

    if (contacts) {
      for (const c of contacts) {
        if (c.email) emailToContactId.set(normalize(c.email), c.id);
      }
    }
  }

  // Step 2: Batch fetch deals for those contact IDs
  const contactIds = Array.from(new Set(emailToContactId.values()));
  const contactIdToDeals = new Map<string, { owner_id: string | null }[]>();

  for (let i = 0; i < contactIds.length; i += BATCH) {
    const batch = contactIds.slice(i, i + BATCH);
    const { data: deals } = await supabase
      .from('crm_deals')
      .select('id, owner_id, contact_id')
      .in('contact_id', batch);

    if (deals) {
      for (const d of deals) {
        const cid = (d as any).contact_id as string;
        if (!contactIdToDeals.has(cid)) contactIdToDeals.set(cid, []);
        contactIdToDeals.get(cid)!.push({ owner_id: d.owner_id });
      }
    }
  }

  // Build global map: email -> has owner?
  for (const [email, contactId] of emailToContactId) {
    const deals = contactIdToDeals.get(contactId);
    if (deals?.length) {
      // Prioritize deals with owner
      const withOwner = deals.find(d => !!d.owner_id);
      globalContactMap.set(email, {
        hasOwner: !!withOwner,
        ownerEmail: withOwner?.owner_id || '',
      });
    }
  }

  // Second pass: resolve using global search results
  const updated = firstPass.map((r) => {
    if (r.status === 'com_dono') return r;

    const emailKey = normalize(r.excelEmail);
    if (emailKey && globalContactMap.has(emailKey)) {
      const info = globalContactMap.get(emailKey)!;
      if (info.hasOwner) {
        changed = true;
        return { ...r, status: 'com_dono' as const, localOwner: info.ownerEmail };
      }
    }

    return r;
  });

  return { updated, changed };
}

// Mutation para atribuir owner a deals sem dono
export function useAssignLimboOwner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dealIds, ownerEmail, ownerProfileId, stageId }: { dealIds: string[]; ownerEmail: string; ownerProfileId: string; stageId?: string }) => {
      const NOVO_LEAD_STAGE = 'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b';
      const targetStage = stageId || NOVO_LEAD_STAGE;
      const batchSize = 50;
      for (let i = 0; i < dealIds.length; i += batchSize) {
        const batch = dealIds.slice(i, i + batchSize);
        const { error } = await supabase
          .from('crm_deals')
          .update({ owner_id: ownerEmail, owner_profile_id: ownerProfileId, stage_id: targetStage })
          .in('id', batch);
        if (error) throw error;
      }
      return { count: dealIds.length };
    },
    onSuccess: (data) => {
      toast.success(`${data.count} leads atribuídos com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['inside-sales-deals-limbo'] });
    },
    onError: (error: any) => {
      toast.error(`Erro ao atribuir leads: ${error.message}`);
    },
  });
}

// Mutation para vincular contrato pago (atualizar closer no deal)
export function useLinkPaidContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dealId, closerName }: { dealId: string; closerName: string }) => {
      const { error } = await supabase
        .from('crm_deals')
        .update({ 
          custom_fields: { closer_responsavel: closerName },
        })
        .eq('id', dealId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Closer vinculado ao contrato!');
      queryClient.invalidateQueries({ queryKey: ['inside-sales-deals-limbo'] });
    },
    onError: (error: any) => {
      toast.error(`Erro: ${error.message}`);
    },
  });
}

// Mutation para duplicar lead de outra pipeline para Inside Sales
export function useDuplicateToInsideSales() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      leads: Array<{
        name: string;
        email: string;
        phone: string;
        value?: number | null;
        sourceContactId?: string;
        sourceDealId?: string;
      }>;
      ownerEmail: string;
      ownerProfileId: string;
      stageId?: string;
    }) => {
      const NOVO_LEAD_STAGE = 'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b';
      const targetStage = params.stageId || NOVO_LEAD_STAGE;

      let created = 0;

      for (const lead of params.leads) {
        // Step 1: Find or create contact
        let contactId = lead.sourceContactId;

        if (!contactId && lead.email) {
          const { data: existing } = await supabase
            .from('crm_contacts')
            .select('id')
            .eq('email', lead.email)
            .limit(1)
            .maybeSingle();
          contactId = existing?.id;
        }

        if (!contactId && lead.phone) {
          const { data: existing } = await supabase
            .from('crm_contacts')
            .select('id')
            .eq('phone', lead.phone)
            .limit(1)
            .maybeSingle();
          contactId = existing?.id;
        }

        if (!contactId) {
          const { data: newContact, error: cErr } = await supabase
            .from('crm_contacts')
            .insert([{
              name: lead.name,
              email: lead.email || null,
              phone: lead.phone || null,
              clint_id: `limbo_contact_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            }])
            .select('id')
            .single();
          if (cErr) throw cErr;
          contactId = newContact.id;
        }

        // Step 2: Check if active deal already exists in Inside Sales for this contact
        if (contactId) {
          const { data: existingDeal } = await supabase
            .from('crm_deals')
            .select('id')
            .eq('contact_id', contactId)
            .eq('origin_id', INSIDE_SALES_ORIGIN_ID)
            .eq('is_duplicate', false)
            .is('archived_at', null)
            .limit(1);

          if (existingDeal?.length) {
            // Skip — deal already exists for this person
            continue;
          }
        }

        // Step 3: Create deal in Inside Sales
        const { data: newDeal, error: dErr } = await supabase
          .from('crm_deals')
          .insert({
            name: lead.name,
            contact_id: contactId,
            origin_id: INSIDE_SALES_ORIGIN_ID,
            stage_id: targetStage,
            owner_id: params.ownerEmail,
            owner_profile_id: params.ownerProfileId,
            value: lead.value || 0,
            replicated_from_deal_id: lead.sourceDealId || null,
            tags: ['Duplicado-Limbo'],
            clint_id: `limbo_dup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          })
          .select('id')
          .single();
        if (dErr) throw dErr;

        // Step 3: Log activity on the new deal (with user_id)
        const { data: { user: limboUser } } = await supabase.auth.getUser();
        await supabase.from('deal_activities').insert({
          deal_id: newDeal.id,
          activity_type: 'creation',
          description: lead.sourceDealId
            ? `Duplicado de outra pipeline (deal original: ${lead.sourceDealId}) via Limbo`
            : 'Criado via Limbo — lead de outra pipeline',
          user_id: limboUser?.id,
        });

        // Step 4: Log activity on the source deal (if exists)
        if (lead.sourceDealId) {
          await supabase.from('deal_activities').insert({
            deal_id: lead.sourceDealId,
            activity_type: 'replication',
            description: `Lead duplicado para Inside Sales (novo deal: ${newDeal.id})`,
            user_id: limboUser?.id,
          });
        }

        created++;
      }

      return { created };
    },
    onSuccess: (data) => {
      toast.success(`${data.created} lead(s) duplicado(s) para Inside Sales!`);
      queryClient.invalidateQueries({ queryKey: ['inside-sales-deals-limbo'] });
    },
    onError: (error: any) => {
      toast.error(`Erro ao duplicar: ${error.message}`);
    },
  });
}
