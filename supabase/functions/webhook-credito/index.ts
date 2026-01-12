import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreditoPayload {
  // Dados do cliente
  cliente_nome: string;
  cliente_cpf_cnpj: string;
  cliente_email?: string;
  cliente_telefone?: string;
  
  // Dados do crédito
  tipo_credito?: string;
  valor_solicitado: number;
  valor_aprovado?: number;
  taxa_juros?: number;
  prazo_meses?: number;
  status: 'em_analise' | 'aprovado' | 'reprovado' | 'liberado' | 'quitado';
  data_solicitacao: string;
  data_aprovacao?: string;
  
  // Origem
  origem?: string;
  vendedor_email?: string;
}

function parseBrazilianDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  return new Date().toISOString().split('T')[0];
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

    const payload: CreditoPayload = await req.json();
    console.log('Webhook Crédito - Payload recebido:', JSON.stringify(payload));

    // Validação de campos obrigatórios
    if (!payload.cliente_nome || !payload.cliente_cpf_cnpj || !payload.valor_solicitado || !payload.status) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Campos obrigatórios: cliente_nome, cliente_cpf_cnpj, valor_solicitado, status' 
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
        bu_type: 'credito',
        event_type: 'new_credit',
        payload: payload,
        status: 'processing'
      })
      .select('id')
      .single();

    // Verificar se cliente já existe
    const { data: existingClient } = await supabase
      .from('credit_clients')
      .select('id')
      .eq('cpf', payload.cliente_cpf_cnpj)
      .single();

    let clientId: string;

    if (existingClient) {
      clientId = existingClient.id;
      
      // Atualizar dados do cliente
      await supabase
        .from('credit_clients')
        .update({
          full_name: payload.cliente_nome,
          email: payload.cliente_email,
          phone: payload.cliente_telefone,
          status: payload.status,
          total_credit: parseMonetaryValue(payload.valor_aprovado || payload.valor_solicitado),
          updated_at: new Date().toISOString()
        })
        .eq('id', clientId);
    } else {
      // Criar novo cliente
      const { data: newClient, error: clientError } = await supabase
        .from('credit_clients')
        .insert({
          full_name: payload.cliente_nome,
          cpf: payload.cliente_cpf_cnpj,
          email: payload.cliente_email,
          phone: payload.cliente_telefone,
          status: payload.status,
          total_credit: parseMonetaryValue(payload.valor_aprovado || payload.valor_solicitado)
        })
        .select('id')
        .single();

      if (clientError) {
        console.error('Erro ao criar cliente:', clientError);
        
        if (logEntry?.id) {
          await supabase
            .from('bu_webhook_logs')
            .update({ 
              status: 'error', 
              error_message: clientError.message,
              processed_at: new Date().toISOString()
            })
            .eq('id', logEntry.id);
        }

        return new Response(
          JSON.stringify({ success: false, error: clientError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      clientId = newClient.id;
    }

    // Criar histórico de crédito
    const { data: history, error: historyError } = await supabase
      .from('credit_history')
      .insert({
        client_id: clientId,
        amount: parseMonetaryValue(payload.valor_solicitado),
        type: payload.tipo_credito || 'solicitacao',
        description: `Status: ${payload.status}${payload.valor_aprovado ? ` | Aprovado: R$ ${payload.valor_aprovado}` : ''}`
      })
      .select('id')
      .single();

    if (historyError) {
      console.error('Erro ao criar histórico:', historyError);
    }

    // Atualizar log com sucesso
    if (logEntry?.id) {
      await supabase
        .from('bu_webhook_logs')
        .update({ 
          status: 'processed', 
          record_id: clientId,
          processed_at: new Date().toISOString()
        })
        .eq('id', logEntry.id);
    }

    const processingTime = Date.now() - startTime;
    console.log(`Webhook Crédito processado em ${processingTime}ms - Client ID: ${clientId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        client_id: clientId,
        history_id: history?.id,
        message: 'Crédito registrado com sucesso',
        processing_time_ms: processingTime
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro no webhook crédito:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
