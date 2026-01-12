import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProjetosPayload {
  // Dados do projeto
  nome: string;
  descricao?: string;
  cliente_nome: string;
  cliente_email?: string;
  cliente_telefone?: string;
  
  // Valores
  valor_total: number;
  valor_entrada?: number;
  
  // Status e datas
  status: 'prospeccao' | 'negociacao' | 'contratado' | 'em_andamento' | 'concluido' | 'cancelado';
  data_inicio?: string;
  data_previsao?: string;
  
  // Origem
  origem?: string;
  responsavel_email?: string;
}

function parseBrazilianDate(dateStr?: string): string | null {
  if (!dateStr) return null;
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  return null;
}

function parseMonetaryValue(value: any): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  
  const str = String(value)
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  
  return parseFloat(str) || 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: ProjetosPayload = await req.json();
    console.log('Webhook Projetos - Payload recebido:', JSON.stringify(payload));

    // Validação de campos obrigatórios
    if (!payload.nome || !payload.cliente_nome || !payload.valor_total || !payload.status) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Campos obrigatórios: nome, cliente_nome, valor_total, status' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Log do webhook
    const { data: logEntry } = await supabase
      .from('bu_webhook_logs')
      .insert({
        bu_type: 'projetos',
        event_type: 'new_project',
        payload: payload,
        status: 'processing'
      })
      .select('id')
      .single();

    // Preparar dados para inserção
    const projectData = {
      name: payload.nome,
      description: payload.descricao,
      client_name: payload.cliente_nome,
      client_email: payload.cliente_email,
      client_phone: payload.cliente_telefone,
      total_value: parseMonetaryValue(payload.valor_total),
      down_payment: parseMonetaryValue(payload.valor_entrada),
      status: payload.status,
      start_date: parseBrazilianDate(payload.data_inicio),
      expected_end_date: parseBrazilianDate(payload.data_previsao),
      source: payload.origem,
      owner_email: payload.responsavel_email
    };

    // Inserir na tabela projects
    const { data: project, error: insertError } = await supabase
      .from('projects')
      .insert(projectData)
      .select('id')
      .single();

    if (insertError) {
      console.error('Erro ao inserir projeto:', insertError);
      
      if (logEntry?.id) {
        await supabase
          .from('bu_webhook_logs')
          .update({ 
            status: 'error', 
            error_message: insertError.message,
            processed_at: new Date().toISOString()
          })
          .eq('id', logEntry.id);
      }

      return new Response(
        JSON.stringify({ success: false, error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atualizar log com sucesso
    if (logEntry?.id) {
      await supabase
        .from('bu_webhook_logs')
        .update({ 
          status: 'processed', 
          record_id: project.id,
          processed_at: new Date().toISOString()
        })
        .eq('id', logEntry.id);
    }

    const processingTime = Date.now() - startTime;
    console.log(`Webhook Projetos processado em ${processingTime}ms - Project ID: ${project.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        id: project.id,
        message: 'Projeto criado com sucesso',
        processing_time_ms: processingTime
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro no webhook projetos:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
