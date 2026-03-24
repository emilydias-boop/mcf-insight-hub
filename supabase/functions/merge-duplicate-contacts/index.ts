import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Normaliza telefone para formato E.164: +55XXXXXXXXXX
 */
function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  
  let clean = phone.replace(/\D/g, '');
  
  if (clean.startsWith('0')) {
    clean = clean.substring(1);
  }
  
  if (!clean.startsWith('55') && clean.length <= 11) {
    clean = '55' + clean;
  }
  
  return '+' + clean;
}

/**
 * Extrai os últimos 9 dígitos do telefone
 */
function getPhoneSuffix(phone: string | null): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '').slice(-9);
}

/**
 * Calcula o max stage_order dos deals de um contato
 */
function getMaxStageOrder(contact: any): number {
  const deals = (contact.crm_deals as any[]) || [];
  if (deals.length === 0) return -1;
  return Math.max(...deals.map((d: any) => d.crm_stages?.order ?? -1));
}

/**
 * Merge de arrays de tags únicos
 */
function mergeTags(tagsA: string[] | null, tagsB: string[] | null): string[] {
  const set = new Set<string>();
  for (const t of tagsA || []) set.add(t);
  for (const t of tagsB || []) set.add(t);
  return Array.from(set);
}

type MatchType = 'email' | 'phone';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const body = await req.json().catch(() => ({}));
    const { dry_run = true, limit = 100, match_type = 'email', primary_id, duplicate_ids, consolidate_only = false } = body;

    const results = {
      match_type: match_type,
      total_groups: 0,
      merged: 0,
      deals_updated: 0,
      deals_consolidated: 0,
      contacts_deleted: 0,
      phones_normalized: 0,
      errors: [] as string[],
      groups_processed: [] as any[],
    };

    // === Modo consolidate_only: limpar deals duplicados na mesma origin ===
    if (consolidate_only) {
      console.log(`🧹 Modo consolidate_only: buscando deals duplicados na mesma origin (dry_run=${dry_run})`);

      const { data: dupes, error: dupErr } = await supabase.rpc('get_duplicate_deals_same_origin');

      if (dupErr) {
        // Se a RPC não existir, fazer query manual
        console.log('RPC não disponível, usando query manual...');
        const { data: allDeals, error: allErr } = await supabase
          .from('crm_deals')
          .select('contact_id, origin_id')
          .not('contact_id', 'is', null)
          .not('origin_id', 'is', null);

        if (allErr) throw allErr;

        // Agrupar e encontrar duplicados
        const groups: Record<string, number> = {};
        const contactOriginPairs: { contact_id: string; origin_id: string }[] = [];
        
        for (const d of allDeals || []) {
          const key = `${d.contact_id}__${d.origin_id}`;
          groups[key] = (groups[key] || 0) + 1;
        }

        for (const [key, count] of Object.entries(groups)) {
          if (count >= 2) {
            const [contact_id, origin_id] = key.split('__');
            contactOriginPairs.push({ contact_id, origin_id });
          }
        }

        results.total_groups = contactOriginPairs.length;
        console.log(`📊 Encontrados ${contactOriginPairs.length} pares (contact, origin) com deals duplicados`);

        if (!dry_run) {
          for (const pair of contactOriginPairs) {
            try {
              await consolidateDeals(supabase, pair.contact_id, results);
            } catch (err: any) {
              results.errors.push(`Erro consolidando contact=${pair.contact_id}: ${err.message}`);
            }
          }
        } else {
          for (const pair of contactOriginPairs) {
            results.groups_processed.push({
              contact_id: pair.contact_id,
              origin_id: pair.origin_id,
              action: 'would_consolidate',
            });
          }
        }

        return new Response(
          JSON.stringify({ success: true, dry_run, consolidate_only: true, ...results }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Se a RPC existir, usar os resultados
      results.total_groups = dupes?.length || 0;
      console.log(`📊 Encontrados ${results.total_groups} pares com deals duplicados`);

      if (!dry_run) {
        const processedContacts = new Set<string>();
        for (const pair of dupes || []) {
          if (!processedContacts.has(pair.contact_id)) {
            processedContacts.add(pair.contact_id);
            try {
              await consolidateDeals(supabase, pair.contact_id, results);
            } catch (err: any) {
              results.errors.push(`Erro consolidando contact=${pair.contact_id}: ${err.message}`);
            }
          }
        }
      } else {
        for (const pair of dupes || []) {
          results.groups_processed.push({
            contact_id: pair.contact_id,
            origin_id: pair.origin_id,
            deal_count: pair.deal_count,
            action: 'would_consolidate',
          });
        }
      }

      return new Response(
        JSON.stringify({ success: true, dry_run, consolidate_only: true, ...results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === Merge direcionado (um grupo específico) ===
    if (primary_id && duplicate_ids?.length) {
      console.log(`🎯 Merge direcionado: primary=${primary_id}, duplicates=${duplicate_ids.join(',')}, dry_run=${dry_run}`);

      const allIds = [primary_id, ...duplicate_ids];
      const { data: contacts, error: contactsError } = await supabase
        .from('crm_contacts')
        .select(`
          id, email, phone, name, tags, created_at,
          crm_deals(id, owner_id, stage_id, crm_stages(order), meeting_slots(id))
        `)
        .in('id', allIds);

      if (contactsError) throw contactsError;
      if (!contacts || contacts.length < 2) {
        return new Response(
          JSON.stringify({ success: false, error: 'Contatos não encontrados' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      results.total_groups = 1;
      await mergeContacts(supabase, contacts, primary_id, 'targeted', dry_run, results);

      return new Response(
        JSON.stringify({ success: true, dry_run, ...results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === Merge em massa (comportamento original) ===
    const matchType: MatchType = match_type === 'phone' ? 'phone' : 'email';
    console.log(`🔍 Buscando contatos duplicados por ${matchType} (dry_run: ${dry_run}, limit: ${limit})`);

    if (matchType === 'email') {
      const { data: duplicateEmails, error: rpcError } = await supabase
        .rpc('get_duplicate_contact_emails', { limit_count: limit });

      if (rpcError) throw rpcError;

      results.total_groups = duplicateEmails?.length || 0;
      for (const { email } of duplicateEmails || []) {
        await processEmailGroup(supabase, email, dry_run, results);
      }
    } else {
      const { data: duplicatePhones, error: rpcError } = await supabase
        .rpc('get_duplicate_contact_phones', { limit_count: limit });

      if (rpcError) throw rpcError;

      results.total_groups = duplicatePhones?.length || 0;
      for (const { phone_suffix } of duplicatePhones || []) {
        await processPhoneGroup(supabase, phone_suffix, dry_run, results);
      }
    }

    console.log(`✅ Processamento concluído`);

    return new Response(
      JSON.stringify({ success: true, dry_run, ...results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function processEmailGroup(supabase: any, email: string, dryRun: boolean, results: any) {
  try {
    console.log(`📧 Processando email: ${email}`);

    const { data: contacts, error: contactsError } = await supabase
      .from('crm_contacts')
      .select(`
        id, email, phone, name, tags, created_at,
        crm_deals(id, owner_id, stage_id, crm_stages(order), meeting_slots(id))
      `)
      .ilike('email', email)
      .order('created_at', { ascending: true });

    if (contactsError) {
      results.errors.push(`Erro ao buscar ${email}: ${contactsError.message}`);
      return;
    }

    if (!contacts || contacts.length < 2) return;

    await mergeContacts(supabase, contacts, email, 'email', dryRun, results);
  } catch (err: any) {
    results.errors.push(`Erro no grupo ${email}: ${err.message}`);
  }
}

async function processPhoneGroup(supabase: any, phoneSuffix: string, dryRun: boolean, results: any) {
  try {
    console.log(`📱 Processando telefone suffix: ${phoneSuffix}`);

    const { data: contacts, error: contactsError } = await supabase
      .from('crm_contacts')
      .select(`
        id, email, phone, name, tags, created_at,
        crm_deals(id, owner_id, stage_id, crm_stages(order), meeting_slots(id))
      `)
      .ilike('phone', `%${phoneSuffix}`)
      .order('created_at', { ascending: true });

    if (contactsError) {
      results.errors.push(`Erro ao buscar telefone ${phoneSuffix}: ${contactsError.message}`);
      return;
    }

    const filtered = contacts?.filter((c: any) => getPhoneSuffix(c.phone) === phoneSuffix) || [];
    if (filtered.length < 2) return;

    await mergeContacts(supabase, filtered, phoneSuffix, 'phone', dryRun, results);
  } catch (err: any) {
    results.errors.push(`Erro no grupo telefone ${phoneSuffix}: ${err.message}`);
  }
}

async function mergeContacts(
  supabase: any, 
  contacts: any[], 
  key: string, 
  matchType: MatchType, 
  dryRun: boolean, 
  results: any
) {
  // Ordenar: max stage_order > mais deals > mais reuniões > mais antigo
  const sortedContacts = contacts.sort((a: any, b: any) => {
    const aMaxStage = getMaxStageOrder(a);
    const bMaxStage = getMaxStageOrder(b);
    if (bMaxStage !== aMaxStage) return bMaxStage - aMaxStage;

    const aDeals = (a.crm_deals as any[])?.length || 0;
    const bDeals = (b.crm_deals as any[])?.length || 0;
    if (bDeals !== aDeals) return bDeals - aDeals;

    const aMeetings = (a.crm_deals as any[])?.reduce((acc: number, d: any) => acc + ((d.meeting_slots as any[])?.length || 0), 0) || 0;
    const bMeetings = (b.crm_deals as any[])?.reduce((acc: number, d: any) => acc + ((d.meeting_slots as any[])?.length || 0), 0) || 0;
    if (bMeetings !== aMeetings) return bMeetings - aMeetings;

    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const primary = sortedContacts[0];
  const duplicates = sortedContacts.slice(1);

  // Enriquecer: preencher email/phone/tags faltantes
  let bestPhone = primary.phone;
  let bestEmail = primary.email;
  let mergedTagsList = primary.tags || [];
  for (const dup of duplicates) {
    if (!bestPhone && dup.phone) bestPhone = dup.phone;
    if (!bestEmail && dup.email) bestEmail = dup.email;
    mergedTagsList = mergeTags(mergedTagsList, dup.tags);
  }
  const normalizedPhone = normalizePhone(bestPhone);

  const groupResult = {
    key,
    matchType,
    primary_id: primary.id,
    primary_name: primary.name,
    primary_max_stage_order: getMaxStageOrder(primary),
    primary_deals: (primary.crm_deals as any[])?.length || 0,
    duplicates: duplicates.map((d: any) => ({ 
      id: d.id, 
      name: d.name,
      deals: (d.crm_deals as any[])?.length || 0,
      max_stage_order: getMaxStageOrder(d),
    })),
    phone_before: primary.phone,
    phone_after: normalizedPhone,
    tags_merged: mergedTagsList,
  };

  if (!dryRun) {
    // Transferir deals dos duplicados para o primary
    for (const dup of duplicates) {
      const { error: updateDealsError, count } = await supabase
        .from('crm_deals')
        .update({ 
          contact_id: primary.id,
          updated_at: new Date().toISOString()
        })
        .eq('contact_id', dup.id);

      if (updateDealsError) {
        console.error(`Erro ao atualizar deals do contato ${dup.id}:`, updateDealsError);
      } else {
        results.deals_updated += count || 0;
      }
    }

    // Consolidar deals duplicados na mesma origin
    await consolidateDeals(supabase, primary.id, results);

    // Atualizar primary com dados enriquecidos
    const updateData: any = { updated_at: new Date().toISOString() };
    if (normalizedPhone && normalizedPhone !== primary.phone) {
      updateData.phone = normalizedPhone;
    }
    if (bestEmail && !primary.email) {
      updateData.email = bestEmail;
    }
    if (mergedTagsList.length > 0) {
      updateData.tags = mergedTagsList;
    }

    if (Object.keys(updateData).length > 1) {
      const { error: updateError } = await supabase
        .from('crm_contacts')
        .update(updateData)
        .eq('id', primary.id);

      if (!updateError && updateData.phone) {
        results.phones_normalized++;
      }
    }

    // Deletar contatos duplicados
    for (const dup of duplicates) {
      const { error: deleteError } = await supabase
        .from('crm_contacts')
        .delete()
        .eq('id', dup.id);

      if (deleteError) {
        console.error(`Erro ao deletar contato ${dup.id}:`, deleteError);
        results.errors.push(`Não foi possível deletar ${dup.id}: ${deleteError.message}`);
      } else {
        results.contacts_deleted++;
      }
    }

    results.merged++;
  }

  results.groups_processed.push(groupResult);
}

/**
 * Consolida deals duplicados na mesma origin para um contato.
 * Mantém o deal com maior stage_order, transfere meetings/activities dos secundários.
 */
async function consolidateDeals(supabase: any, contactId: string, results: any) {
  // Buscar todos os deals do contato com stage info
  const { data: deals, error } = await supabase
    .from('crm_deals')
    .select('id, origin_id, stage_id, tags, crm_stages(order)')
    .eq('contact_id', contactId);

  if (error || !deals?.length) return;

  // Agrupar por origin_id
  const byOrigin: Record<string, any[]> = {};
  for (const deal of deals) {
    const oid = deal.origin_id || '_none_';
    if (!byOrigin[oid]) byOrigin[oid] = [];
    byOrigin[oid].push(deal);
  }

  for (const [originId, originDeals] of Object.entries(byOrigin)) {
    if (originDeals.length < 2) continue;

    // Ordenar por stage_order DESC — manter o mais avançado
    originDeals.sort((a: any, b: any) => {
      const aOrder = a.crm_stages?.order ?? -1;
      const bOrder = b.crm_stages?.order ?? -1;
      return bOrder - aOrder;
    });

    const primaryDeal = originDeals[0];
    const secondaryDeals = originDeals.slice(1);

    console.log(`🔀 Consolidando ${originDeals.length} deals na origin ${originId}. Primary: ${primaryDeal.id}`);

    for (const secDeal of secondaryDeals) {
      // Transferir meeting_slots
      const { error: msErr } = await supabase
        .from('meeting_slots')
        .update({ deal_id: primaryDeal.id })
        .eq('deal_id', secDeal.id);

      if (msErr) {
        console.error(`Erro ao transferir meeting_slots de ${secDeal.id}:`, msErr);
      }

      // Transferir meeting_slot_attendees (tem deal_id próprio com CASCADE)
      const { error: msaErr } = await supabase
        .from('meeting_slot_attendees')
        .update({ deal_id: primaryDeal.id })
        .eq('deal_id', secDeal.id);

      if (msaErr) {
        console.error(`Erro ao transferir meeting_slot_attendees de ${secDeal.id}:`, msaErr);
      }

      // Transferir deal_activities
      const { error: daErr } = await supabase
        .from('deal_activities')
        .update({ deal_id: primaryDeal.id })
        .eq('deal_id', secDeal.id);

      if (daErr) {
        console.error(`Erro ao transferir deal_activities de ${secDeal.id}:`, daErr);
      }

      // Transferir calls
      const { error: callsErr } = await supabase
        .from('calls')
        .update({ deal_id: primaryDeal.id })
        .eq('deal_id', secDeal.id);

      if (callsErr) {
        console.error(`Erro ao transferir calls de ${secDeal.id}:`, callsErr);
      }

      // Merge tags do deal secundário no primary
      const mergedDealTags = mergeTags(primaryDeal.tags, secDeal.tags);
      if (mergedDealTags.length > 0) {
        await supabase
          .from('crm_deals')
          .update({ tags: mergedDealTags, updated_at: new Date().toISOString() })
          .eq('id', primaryDeal.id);
        primaryDeal.tags = mergedDealTags;
      }

      // Deletar deal secundário
      const { error: delErr } = await supabase
        .from('crm_deals')
        .delete()
        .eq('id', secDeal.id);

      if (delErr) {
        console.error(`Erro ao deletar deal secundário ${secDeal.id}:`, delErr);
        results.errors.push(`Não foi possível deletar deal ${secDeal.id}: ${delErr.message}`);
      } else {
        results.deals_consolidated++;
        console.log(`✅ Deal ${secDeal.id} consolidado em ${primaryDeal.id}`);
      }
    }
  }
}
