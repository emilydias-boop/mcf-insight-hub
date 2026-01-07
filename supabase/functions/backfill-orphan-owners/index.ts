import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const dryRun = body.dry_run === true;

    console.log(`[Backfill] Iniciando ${dryRun ? '(DRY RUN)' : ''}...`);

    // Buscar todos os deals sem owner
    const { data: orphanDeals, error: fetchError } = await supabase
      .from('crm_deals')
      .select('id, contact_id')
      .is('owner_id', null);

    if (fetchError) {
      throw new Error(`Erro ao buscar deals órfãos: ${fetchError.message}`);
    }

    console.log(`[Backfill] ${orphanDeals?.length || 0} deals órfãos encontrados`);

    if (!orphanDeals || orphanDeals.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhum deal órfão encontrado',
          total: 0,
          updated: 0,
          skipped: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Agrupar por contact_id para buscar sugestões
    const contactIds = [...new Set(orphanDeals.filter(d => d.contact_id).map(d => d.contact_id))];

    // Buscar owners de outros deals desses contatos
    const { data: dealsWithOwners, error: ownerError } = await supabase
      .from('crm_deals')
      .select('contact_id, owner_id')
      .in('contact_id', contactIds)
      .not('owner_id', 'is', null);

    if (ownerError) {
      throw new Error(`Erro ao buscar owners: ${ownerError.message}`);
    }

    // Criar mapa de contact_id -> owner_id
    const ownerMap = new Map<string, string>();
    dealsWithOwners?.forEach(deal => {
      if (deal.contact_id && deal.owner_id && !ownerMap.has(deal.contact_id)) {
        ownerMap.set(deal.contact_id, deal.owner_id);
      }
    });

    console.log(`[Backfill] ${ownerMap.size} contatos com owner existente`);

    // Filtrar deals que têm sugestão de owner
    const dealsToUpdate = orphanDeals.filter(deal => 
      deal.contact_id && ownerMap.has(deal.contact_id)
    );

    console.log(`[Backfill] ${dealsToUpdate.length} deals podem ser atualizados`);

    if (dryRun) {
      return new Response(
        JSON.stringify({ 
          success: true,
          dry_run: true,
          total: orphanDeals.length,
          would_update: dealsToUpdate.length,
          skipped: orphanDeals.length - dealsToUpdate.length,
          details: dealsToUpdate.slice(0, 10).map(d => ({
            deal_id: d.id,
            contact_id: d.contact_id,
            suggested_owner: ownerMap.get(d.contact_id!),
          })),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atualizar deals em batches
    let updated = 0;
    const batchSize = 50;

    for (let i = 0; i < dealsToUpdate.length; i += batchSize) {
      const batch = dealsToUpdate.slice(i, i + batchSize);
      
      for (const deal of batch) {
        const ownerId = ownerMap.get(deal.contact_id!);
        if (ownerId) {
          const { error: updateError } = await supabase
            .from('crm_deals')
            .update({ 
              owner_id: ownerId, 
              updated_at: new Date().toISOString() 
            })
            .eq('id', deal.id);

          if (!updateError) {
            updated++;
          } else {
            console.error(`[Backfill] Erro ao atualizar deal ${deal.id}:`, updateError);
          }
        }
      }
    }

    console.log(`[Backfill] Concluído: ${updated} deals atualizados`);

    return new Response(
      JSON.stringify({ 
        success: true,
        total: orphanDeals.length,
        updated,
        skipped: orphanDeals.length - dealsToUpdate.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Backfill] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
