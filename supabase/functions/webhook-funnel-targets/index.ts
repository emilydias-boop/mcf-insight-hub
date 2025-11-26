import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FunnelTargetsPayload {
  week_start: string;
  week_end: string;
  origin_id: string;
  targets: {
    novo_lead?: number;
    r1_agendada?: number;
    r1_realizada?: number;
    contrato_pago?: number;
    venda_realizada?: number;
  };
}

const STAGE_MAPPING: Record<string, { id: string; name: string }> = {
  novo_lead: {
    id: 'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b',
    name: 'Novo Lead',
  },
  r1_agendada: {
    id: 'a8365215-fd31-4bdc-bbe7-77100fa39e53',
    name: 'Reunião 01 Agendada',
  },
  r1_realizada: {
    id: '34995d75-933e-4d67-b7fc-19fcb8b81680',
    name: 'Reunião 01 Realizada',
  },
  contrato_pago: {
    id: '062927f5-b7a3-496a-9d47-eb03b3d69b10',
    name: 'Contrato Pago',
  },
  venda_realizada: {
    id: '3a2776e2-a536-4a2a-bb7b-a2f53c8941df',
    name: 'Venda realizada',
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[webhook-funnel-targets] Received request');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: FunnelTargetsPayload = await req.json();
    console.log('[webhook-funnel-targets] Payload:', JSON.stringify(payload, null, 2));

    const { week_start, week_end, origin_id, targets } = payload;

    if (!week_start || !week_end || !origin_id || !targets) {
      throw new Error('Missing required fields: week_start, week_end, origin_id, targets');
    }

    const targetRecords = [];

    for (const [key, value] of Object.entries(targets)) {
      if (value === undefined || value === null) continue;

      const stage = STAGE_MAPPING[key];
      if (!stage) {
        console.warn(`[webhook-funnel-targets] Unknown stage key: ${key}`);
        continue;
      }

      targetRecords.push({
        week_start,
        week_end,
        origin_id,
        target_type: 'funnel_stage',
        target_name: stage.name,
        reference_id: stage.id,
        target_value: value,
        current_value: 0,
      });
    }

    console.log(`[webhook-funnel-targets] Upserting ${targetRecords.length} targets`);

    // Upsert targets (atualiza se já existe ou cria se não existe)
    for (const record of targetRecords) {
      const { error } = await supabase
        .from('team_targets')
        .upsert(record, {
          onConflict: 'week_start,origin_id,reference_id',
          ignoreDuplicates: false,
        });

      if (error) {
        console.error('[webhook-funnel-targets] Error upserting target:', error);
        throw error;
      }
    }

    console.log('[webhook-funnel-targets] Successfully upserted targets');

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully upserted ${targetRecords.length} funnel targets`,
        targets: targetRecords,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[webhook-funnel-targets] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
