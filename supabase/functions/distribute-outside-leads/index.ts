import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// PIPELINE INSIDE SALES origin ID
const DEFAULT_ORIGIN_ID = 'e3c04f21-7b9a-4c2d-8f1e-5a3b7c9d2e4f';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json().catch(() => ({}));
    const dry_run: boolean = body.dry_run ?? false;
    const only_no_owner: boolean = body.only_no_owner ?? true;

    console.log(`🚀 [DISTRIBUTE-OUTSIDE] Iniciando. dry_run=${dry_run}, only_no_owner=${only_no_owner}`);

    // 1. Buscar origin_id do PIPELINE INSIDE SALES
    const { data: origins } = await supabase
      .from('crm_origins')
      .select('id, name')
      .ilike('name', '%PIPELINE INSIDE SALES%')
      .limit(1);

    const originId = origins?.[0]?.id || DEFAULT_ORIGIN_ID;
    console.log(`📍 [DISTRIBUTE-OUTSIDE] Origin: ${origins?.[0]?.name} (${originId})`);

    // 2. Buscar deals sem owner na origin (ou todos se only_no_owner=false)
    let dealsQuery = supabase
      .from('crm_deals')
      .select(`
        id,
        name,
        owner_id,
        origin_id,
        tags,
        contact_id,
        crm_contacts!contact_id(id, email, name)
      `)
      .eq('origin_id', originId)
      .not('stage_id', 'is', null);

    if (only_no_owner) {
      dealsQuery = dealsQuery.is('owner_id', null);
    }

    const { data: deals, error: dealsError } = await dealsQuery;
    if (dealsError) {
      console.error('[DISTRIBUTE-OUTSIDE] Erro ao buscar deals:', dealsError);
      throw dealsError;
    }

    console.log(`📋 [DISTRIBUTE-OUTSIDE] ${deals?.length || 0} deals sem owner encontrados`);

    if (!deals || deals.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          dry_run,
          total_checked: 0,
          outside_found: 0,
          distributed: 0,
          results: [],
          message: 'Nenhum deal sem owner encontrado no Pipeline Inside Sales'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Extrair emails e deal_ids únicos
    const emails: string[] = [];
    const dealIds: string[] = [];
    const emailToDealMap = new Map<string, string[]>(); // email -> [dealId]
    const dealToEmailMap = new Map<string, string>(); // dealId -> email

    for (const deal of deals) {
      const contact = deal.crm_contacts as any;
      const email = contact?.email?.toLowerCase().trim();
      dealIds.push(deal.id);

      if (email) {
        emails.push(email);
        const existing = emailToDealMap.get(email) || [];
        existing.push(deal.id);
        emailToDealMap.set(email, existing);
        dealToEmailMap.set(deal.id, email);
      }
    }

    const uniqueEmails = [...new Set(emails)];
    console.log(`📧 [DISTRIBUTE-OUTSIDE] ${uniqueEmails.length} emails únicos para verificar`);

    // 4. Buscar contratos Hubla em paralelo com reuniões R1
    const [contractsResult, r1Result] = await Promise.all([
      // Contratos pagos (product_name ILIKE '%Contrato%')
      supabase
        .from('hubla_transactions')
        .select('customer_email, sale_date, product_name')
        .in('customer_email', uniqueEmails)
        .eq('offer_id', 'pgah16gjTMdAkqUMVKGz')
        .eq('sale_status', 'completed')
        .order('sale_date', { ascending: true }),

      // Reuniões R1 para os deal_ids
      supabase
        .from('meeting_slot_attendees')
        .select(`
          deal_id,
          meeting_slots!inner(scheduled_at, meeting_type)
        `)
        .in('deal_id', dealIds)
        .eq('meeting_slots.meeting_type', 'r1'),
    ]);

    // 5. Construir mapa email -> contrato mais antigo
    const earliestContract = new Map<string, Date>();
    for (const c of (contractsResult.data || [])) {
      const email = c.customer_email?.toLowerCase().trim();
      if (!email) continue;
      const saleDate = new Date(c.sale_date);
      const existing = earliestContract.get(email);
      if (!existing || saleDate < existing) {
        earliestContract.set(email, saleDate);
      }
    }

    // 6. Construir mapa dealId -> R1 mais cedo
    const earliestR1 = new Map<string, Date>();
    for (const a of (r1Result.data || [])) {
      if (!a.deal_id) continue;
      const slot = a.meeting_slots as any;
      const scheduledAt = new Date(slot.scheduled_at);
      const existing = earliestR1.get(a.deal_id);
      if (!existing || scheduledAt < existing) {
        earliestR1.set(a.deal_id, scheduledAt);
      }
    }

    // 7. Identificar deals Outside
    const outsideDeals: typeof deals = [];
    for (const deal of deals) {
      const email = dealToEmailMap.get(deal.id);
      if (!email) continue;

      const contractDate = earliestContract.get(email);
      if (!contractDate) continue; // Sem contrato = não é Outside

      const r1Date = earliestR1.get(deal.id);
      const isOutside = !r1Date || contractDate <= r1Date;

      if (isOutside) {
        outsideDeals.push(deal);
        console.log(`✅ [DISTRIBUTE-OUTSIDE] Outside: ${deal.name} (${deal.id}) - contrato: ${contractDate.toISOString()}, R1: ${r1Date?.toISOString() || 'NENHUMA'}`);
      }
    }

    console.log(`🎯 [DISTRIBUTE-OUTSIDE] ${outsideDeals.length} deals Outside identificados`);

    if (outsideDeals.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          dry_run,
          total_checked: deals.length,
          outside_found: 0,
          distributed: 0,
          results: [],
          message: 'Nenhum lead Outside sem owner encontrado'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 8. Verificar se há distribuição ativa para esta origin
    const { data: distConfig } = await supabase
      .from('lead_distribution_config')
      .select('id')
      .eq('origin_id', originId)
      .eq('is_active', true)
      .limit(1);

    if (!distConfig || distConfig.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          dry_run,
          total_checked: deals.length,
          outside_found: outsideDeals.length,
          distributed: 0,
          results: [],
          message: 'Nenhuma configuração de distribuição ativa encontrada para esta origin. Configure a distribuição em Configurações > Distribuição de Leads.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 422 }
      );
    }

    // 9. Distribuir cada deal Outside
    const results: Array<{
      deal_id: string;
      deal_name: string;
      contact_email: string;
      assigned_to: string | null;
      success: boolean;
      error?: string;
    }> = [];

    let distributedCount = 0;

    for (const deal of outsideDeals) {
      const contact = deal.crm_contacts as any;
      const contactEmail = contact?.email || '';

      try {
        if (dry_run) {
          // Simular: obter próximo owner sem incrementar contador
          const { data: nextOwner } = await supabase
            .from('lead_distribution_config')
            .select('user_email')
            .eq('origin_id', originId)
            .eq('is_active', true)
            .gt('percentage', 0)
            .order('current_count', { ascending: true })
            .limit(1)
            .maybeSingle();

          results.push({
            deal_id: deal.id,
            deal_name: deal.name,
            contact_email: contactEmail,
            assigned_to: nextOwner?.user_email || null,
            success: true,
          });
          distributedCount++;
        } else {
          // Distribuir de verdade
          const { data: nextOwnerEmail } = await supabase.rpc('get_next_lead_owner', {
            p_origin_id: originId
          });

          if (!nextOwnerEmail) {
            results.push({
              deal_id: deal.id,
              deal_name: deal.name,
              contact_email: contactEmail,
              assigned_to: null,
              success: false,
              error: 'Não foi possível obter próximo owner da fila'
            });
            continue;
          }

          // Buscar profile_id do owner
          const { data: ownerProfile } = await supabase
            .from('profiles')
            .select('id')
            .ilike('email', nextOwnerEmail)
            .maybeSingle();

          // Atualizar deal com novo owner
          const currentTags = Array.isArray(deal.tags) ? deal.tags : [];
          const newTags = currentTags.includes('Outside') ? currentTags : [...currentTags, 'Outside'];

          const { error: updateError } = await supabase
            .from('crm_deals')
            .update({
              owner_id: nextOwnerEmail,
              owner_profile_id: ownerProfile?.id || null,
              tags: newTags,
              updated_at: new Date().toISOString()
            })
            .eq('id', deal.id);

          if (updateError) {
            results.push({
              deal_id: deal.id,
              deal_name: deal.name,
              contact_email: contactEmail,
              assigned_to: nextOwnerEmail,
              success: false,
              error: updateError.message
            });
            continue;
          }

          // Registrar atividade
          await supabase
            .from('deal_activities')
            .insert({
              deal_id: deal.id,
              activity_type: 'owner_change',
              description: `Auto-distribuído como lead Outside para ${nextOwnerEmail}`,
              to_stage: null,
              from_stage: null,
              metadata: {
                new_owner: nextOwnerEmail,
                new_owner_profile_id: ownerProfile?.id,
                distributed_at: new Date().toISOString(),
                distribution_type: 'outside_batch',
                contact_email: contactEmail,
              }
            });

          results.push({
            deal_id: deal.id,
            deal_name: deal.name,
            contact_email: contactEmail,
            assigned_to: nextOwnerEmail,
            success: true,
          });
          distributedCount++;

          console.log(`✅ [DISTRIBUTE-OUTSIDE] Deal "${deal.name}" distribuído para ${nextOwnerEmail}`);
        }
      } catch (err: any) {
        console.error(`❌ [DISTRIBUTE-OUTSIDE] Erro no deal ${deal.id}:`, err);
        results.push({
          deal_id: deal.id,
          deal_name: deal.name,
          contact_email: contactEmail,
          assigned_to: null,
          success: false,
          error: err.message || 'Erro desconhecido'
        });
      }
    }

    console.log(`🎉 [DISTRIBUTE-OUTSIDE] Concluído: ${distributedCount}/${outsideDeals.length} distribuídos`);

    return new Response(
      JSON.stringify({
        success: true,
        dry_run,
        total_checked: deals.length,
        outside_found: outsideDeals.length,
        distributed: distributedCount,
        failed: outsideDeals.length - distributedCount,
        results,
        message: dry_run
          ? `Simulação: ${outsideDeals.length} leads Outside encontrados, ${distributedCount} seriam distribuídos`
          : `${distributedCount} leads Outside distribuídos com sucesso`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('[DISTRIBUTE-OUTSIDE] Erro geral:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
