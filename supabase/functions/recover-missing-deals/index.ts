import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const originId = '4e2b810a-6782-4ce9-9c0d-10d04c018636'; // Viver de Aluguel
  const stageId = '2c69bf1d-94d5-4b6d-928d-dcf12da2d78c'; // NOVO LEAD

  const leads = [
    { contact_id: '2915687b-c241-4c55-9b40-3509ac4fe40d', name: 'Aquiles Menezes Alencar' },
    { contact_id: 'd4dd02bf-19f7-4e1c-9944-edb27fef2c0c', name: 'Clesio Ferreira da Silva' },
    { contact_id: '56185e27-884e-4fc7-bb14-25a0b5cc1742', name: 'Diego Floriano Maciel' },
    { contact_id: '06d0480b-7380-4985-bc4d-40c8a03bae21', name: 'Eduardo Henrique' },
    { contact_id: '4e3f4907-0abc-4304-a908-090f69491ae3', name: 'Francisco Harley Soares de Sousa' },
    { contact_id: 'e34d5c5a-b87a-46ef-95cb-faa304c8af2b', name: 'HENRIQUE FERREIRA DOS SANTOS' },
    { contact_id: '7b009877-fa13-45d6-915d-bb55b7f194aa', name: 'Jean Landi' },
    { contact_id: '1cc84d9d-72a9-43f4-a470-f999223bb610', name: 'Jair Fernando Sanches Remijo' },
    { contact_id: '2514f9f8-e9ae-485b-8e73-c0b424863328', name: 'Vanderson faria' },
    { contact_id: 'c8c4735e-2c56-4381-b4a6-3c0f79453bb7', name: 'Rosana Brasco' },
    { contact_id: 'b0e476d4-efaa-4d26-b905-e984e5715b46', name: 'Thiago da Silva Lopes' },
    { contact_id: '705e26fd-8399-4f58-8612-151943ee4c75', name: 'Valéria Rosas' },
  ];

  const results: any[] = [];

  for (const lead of leads) {
    // Check if deal already exists
    const { data: existing } = await supabase
      .from('crm_deals')
      .select('id')
      .eq('contact_id', lead.contact_id)
      .eq('origin_id', originId)
      .maybeSingle();

    if (existing) {
      results.push({ name: lead.name, status: 'already_exists', deal_id: existing.id });
      continue;
    }

    const { data: newDeal, error } = await supabase
      .from('crm_deals')
      .insert({
        contact_id: lead.contact_id,
        origin_id: originId,
        stage_id: stageId,
        title: `${lead.name} - A010`,
        product_name: 'A010 - Consultoria Construa para Vender sem Dinheiro + Treinamento',
        tags: ['A010', 'Hubla', 'recuperado'],
        custom_fields: { source: 'hubla', a010_compra: true, recovered: '2026-04-07' },
        data_source: 'webhook',
        stage_moved_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      results.push({ name: lead.name, status: 'error', error: error.message });
    } else {
      results.push({ name: lead.name, status: 'created', deal_id: newDeal.id });
    }
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
