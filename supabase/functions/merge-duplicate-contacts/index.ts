import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { dry_run = true, limit = 100 } = await req.json().catch(() => ({}));

    console.log(`🔍 Buscando contatos duplicados via RPC (dry_run: ${dry_run}, limit: ${limit})`);

    // 1. Usar RPC para encontrar emails duplicados de forma eficiente
    const { data: duplicateEmails, error: rpcError } = await supabase
      .rpc('get_duplicate_contact_emails', { limit_count: limit });

    if (rpcError) {
      console.error('Erro ao buscar duplicados via RPC:', rpcError);
      throw rpcError;
    }

    console.log(`📊 Encontrados ${duplicateEmails?.length || 0} emails duplicados`);

    const results = {
      total_groups: duplicateEmails?.length || 0,
      merged: 0,
      deals_updated: 0,
      contacts_deleted: 0,
      phones_normalized: 0,
      errors: [] as string[],
      groups_processed: [] as any[],
    };

    // 2. Para cada email duplicado, buscar os contatos e processar
    for (const { email, contact_count } of duplicateEmails || []) {
      try {
        console.log(`📧 Processando email: ${email} (${contact_count} contatos)`);

        // Buscar todos os contatos com este email (case insensitive)
        const { data: contacts, error: contactsError } = await supabase
          .from('crm_contacts')
          .select(`
            id,
            email,
            phone,
            name,
            created_at,
            crm_deals(id, owner_id)
          `)
          .ilike('email', email)
          .order('created_at', { ascending: true });

        if (contactsError) {
          console.error(`Erro ao buscar contatos do email ${email}:`, contactsError);
          results.errors.push(`Erro ao buscar ${email}: ${contactsError.message}`);
          continue;
        }

        if (!contacts || contacts.length < 2) {
          console.log(`⏭️ Email ${email} não tem duplicados reais, pulando...`);
          continue;
        }

        // Escolher primary: quem tem mais deals, ou o mais antigo
        const sortedContacts = contacts.sort((a, b) => {
          const aDeals = (a.crm_deals as any[])?.length || 0;
          const bDeals = (b.crm_deals as any[])?.length || 0;
          if (bDeals !== aDeals) return bDeals - aDeals;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });

        const primary = sortedContacts[0];
        const duplicates = sortedContacts.slice(1);

        // Normalizar telefone do primary
        let bestPhone = primary.phone;
        for (const dup of duplicates) {
          if (!bestPhone && dup.phone) {
            bestPhone = dup.phone;
          }
        }
        const normalizedPhone = normalizePhone(bestPhone);

        const groupResult = {
          email,
          primary_id: primary.id,
          primary_name: primary.name,
          primary_deals: (primary.crm_deals as any[])?.length || 0,
          duplicates: duplicates.map(d => ({ 
            id: d.id, 
            name: d.name,
            deals: (d.crm_deals as any[])?.length || 0
          })),
          phone_before: primary.phone,
          phone_after: normalizedPhone,
        };

        if (!dry_run) {
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

          // Atualizar telefone normalizado no primary
          if (normalizedPhone) {
            const { error: phoneError } = await supabase
              .from('crm_contacts')
              .update({ 
                phone: normalizedPhone,
                updated_at: new Date().toISOString()
              })
              .eq('id', primary.id);

            if (!phoneError) {
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
      } catch (groupError: any) {
        console.error(`Erro ao processar grupo ${email}:`, groupError);
        results.errors.push(`Erro no grupo ${email}: ${groupError.message}`);
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
