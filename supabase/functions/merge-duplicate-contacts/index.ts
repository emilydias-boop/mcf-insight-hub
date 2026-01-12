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
    const { dry_run = true, limit = 100, match_type = 'email' } = await req.json().catch(() => ({}));
    const matchType: MatchType = match_type === 'phone' ? 'phone' : 'email';

    console.log(`🔍 Buscando contatos duplicados por ${matchType} (dry_run: ${dry_run}, limit: ${limit})`);

    const results = {
      match_type: matchType,
      total_groups: 0,
      merged: 0,
      deals_updated: 0,
      contacts_deleted: 0,
      phones_normalized: 0,
      errors: [] as string[],
      groups_processed: [] as any[],
    };

    if (matchType === 'email') {
      // Processar duplicados por EMAIL
      const { data: duplicateEmails, error: rpcError } = await supabase
        .rpc('get_duplicate_contact_emails', { limit_count: limit });

      if (rpcError) {
        console.error('Erro ao buscar duplicados por email:', rpcError);
        throw rpcError;
      }

      results.total_groups = duplicateEmails?.length || 0;
      console.log(`📊 Encontrados ${results.total_groups} emails duplicados`);

      for (const { email } of duplicateEmails || []) {
        await processEmailGroup(supabase, email, dry_run, results);
      }
    } else {
      // Processar duplicados por TELEFONE
      const { data: duplicatePhones, error: rpcError } = await supabase
        .rpc('get_duplicate_contact_phones', { limit_count: limit });

      if (rpcError) {
        console.error('Erro ao buscar duplicados por telefone:', rpcError);
        throw rpcError;
      }

      results.total_groups = duplicatePhones?.length || 0;
      console.log(`📊 Encontrados ${results.total_groups} telefones duplicados`);

      for (const { phone_suffix } of duplicatePhones || []) {
        await processPhoneGroup(supabase, phone_suffix, dry_run, results);
      }
    }

    console.log(`✅ Processamento concluído:`, JSON.stringify(results, null, 2));

    return new Response(
      JSON.stringify({
        success: true,
        dry_run,
        ...results
      }),
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
        id, email, phone, name, created_at,
        crm_deals(id, owner_id, meeting_slots(id))
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
        id, email, phone, name, created_at,
        crm_deals(id, owner_id, meeting_slots(id))
      `)
      .ilike('phone', `%${phoneSuffix}`)
      .order('created_at', { ascending: true });

    if (contactsError) {
      results.errors.push(`Erro ao buscar telefone ${phoneSuffix}: ${contactsError.message}`);
      return;
    }

    // Filtrar para garantir match exato do sufixo
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
  // Ordenar: mais deals > mais reuniões > mais antigo
  const sortedContacts = contacts.sort((a: any, b: any) => {
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

  // Normalizar telefone do primary
  let bestPhone = primary.phone;
  let bestEmail = primary.email;
  for (const dup of duplicates) {
    if (!bestPhone && dup.phone) bestPhone = dup.phone;
    if (!bestEmail && dup.email) bestEmail = dup.email;
  }
  const normalizedPhone = normalizePhone(bestPhone);

  const groupResult = {
    key,
    matchType,
    primary_id: primary.id,
    primary_name: primary.name,
    primary_deals: (primary.crm_deals as any[])?.length || 0,
    duplicates: duplicates.map((d: any) => ({ 
      id: d.id, 
      name: d.name,
      deals: (d.crm_deals as any[])?.length || 0
    })),
    phone_before: primary.phone,
    phone_after: normalizedPhone,
  };

  if (!dryRun) {
    // Atualizar deals dos duplicados para apontar para o primary
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

    // Atualizar telefone e email normalizado no primary
    const updateData: any = { updated_at: new Date().toISOString() };
    if (normalizedPhone && normalizedPhone !== primary.phone) {
      updateData.phone = normalizedPhone;
    }
    if (bestEmail && !primary.email) {
      updateData.email = bestEmail;
    }

    if (Object.keys(updateData).length > 1) {
      const { error: phoneError } = await supabase
        .from('crm_contacts')
        .update(updateData)
        .eq('id', primary.id);

      if (!phoneError && updateData.phone) {
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
