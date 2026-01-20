import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun ?? false;
    const limit = body.limit ?? 100;

    console.log(`🔄 Starting sync-deals-from-agenda (dryRun: ${dryRun}, limit: ${limit})`);

    // Estágios que indicam que o deal ainda não foi agendado
    const preScheduleStagePatterns = [
      'Novo Lead', 'Lead Instagram', 'Lead Qualificado', 'Lead Gratuito',
      'Lead Premium', 'Novo Contato', 'Aguardando', 'Lead', 'Em Aberto'
    ];

    // Buscar attendees com reunião agendada que têm deal_id
    const { data: attendeesWithMeetings, error: fetchError } = await supabase
      .from('meeting_slot_attendees')
      .select(`
        id,
        deal_id,
        status,
        meeting_slots!inner(
          id,
          meeting_type,
          status,
          scheduled_at
        )
      `)
      .in('status', ['invited', 'scheduled', 'confirmed'])
      .not('deal_id', 'is', null)
      .limit(limit * 2); // Fetch more since we'll filter

    if (fetchError) {
      console.error('Error fetching attendees:', fetchError);
      throw fetchError;
    }

    console.log(`📋 Found ${attendeesWithMeetings?.length || 0} attendees with meetings`);

    const results = {
      processed: 0,
      synced: 0,
      skipped: 0,
      errors: 0,
      details: [] as { dealId: string; dealName: string; fromStage: string; toStage: string; meetingType: string }[]
    };

    const processedDealIds = new Set<string>();

    for (const attendee of attendeesWithMeetings || []) {
      if (results.processed >= limit) break;
      
      const dealId = attendee.deal_id;
      if (!dealId || processedDealIds.has(dealId)) continue;
      processedDealIds.add(dealId);

      try {
        // Buscar deal com seu estágio atual
        const { data: deal, error: dealError } = await supabase
          .from('crm_deals')
          .select(`
            id,
            name,
            origin_id,
            stage_id,
            crm_stages!inner(id, stage_name)
          `)
          .eq('id', dealId)
          .single();

        if (dealError || !deal) {
          console.log(`⚠️ Deal ${dealId} not found`);
          results.skipped++;
          continue;
        }

        const currentStageName = (deal.crm_stages as any)?.stage_name || '';
        
        // Verificar se o deal está em um estágio pré-agendamento
        const isPreScheduleStage = preScheduleStagePatterns.some(pattern => 
          currentStageName.toLowerCase().includes(pattern.toLowerCase())
        );

        if (!isPreScheduleStage) {
          console.log(`⏭️ Deal "${deal.name}" already in stage "${currentStageName}" - skipping`);
          results.skipped++;
          continue;
        }

        results.processed++;

        // Determinar o estágio alvo baseado no tipo de reunião
        const meetingType = (attendee.meeting_slots as any)?.meeting_type || 'r1';
        const stageNamesR1 = ['Reunião 01 Agendada', 'Reunião 1 Agendada', 'R1 Agendada'];
        const stageNamesR2 = ['Reunião 02 Agendada', 'Reunião 2 Agendada', 'R2 Agendada'];
        const targetStageNames = meetingType === 'r2' ? stageNamesR2 : stageNamesR1;

        // Buscar estágio alvo na mesma pipeline (origin_id)
        let targetStage = null;
        for (const stageName of targetStageNames) {
          const { data: stage } = await supabase
            .from('crm_stages')
            .select('id, stage_name')
            .eq('origin_id', deal.origin_id)
            .ilike('stage_name', stageName)
            .limit(1);

          if (stage && stage.length > 0) {
            targetStage = stage[0];
            break;
          }
        }

        if (!targetStage) {
          console.log(`⚠️ Target stage not found for deal "${deal.name}" in origin ${deal.origin_id}`);
          results.errors++;
          continue;
        }

        if (targetStage.id === deal.stage_id) {
          console.log(`⏭️ Deal "${deal.name}" already in target stage - skipping`);
          results.skipped++;
          continue;
        }

        console.log(`✨ Will sync deal "${deal.name}": "${currentStageName}" → "${targetStage.stage_name}"`);

        if (!dryRun) {
          // Atualizar o deal
          const { error: updateError } = await supabase
            .from('crm_deals')
            .update({ stage_id: targetStage.id })
            .eq('id', dealId);

          if (updateError) {
            console.error(`Error updating deal ${dealId}:`, updateError);
            results.errors++;
            continue;
          }

          // Registrar atividade
          await supabase.from('deal_activities').insert({
            deal_id: dealId,
            activity_type: 'stage_change',
            description: 'Sincronizado automaticamente - reunião já agendada na agenda',
            from_stage: deal.stage_id,
            to_stage: targetStage.id,
            metadata: { via: 'sync_deals_from_agenda', meeting_slot_id: (attendee.meeting_slots as any)?.id }
          });
        }

        results.synced++;
        results.details.push({
          dealId,
          dealName: deal.name,
          fromStage: currentStageName,
          toStage: targetStage.stage_name,
          meetingType
        });

      } catch (err) {
        console.error(`Error processing deal ${dealId}:`, err);
        results.errors++;
      }
    }

    console.log(`✅ Sync complete: ${results.synced} synced, ${results.skipped} skipped, ${results.errors} errors`);

    return new Response(JSON.stringify({
      success: true,
      dryRun,
      ...results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
