import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConsorcioPayload {
  // Dados da cota
  grupo: string;
  cota: string;
  valor_credito: number;
  prazo_meses?: number;
  tipo_produto?: 'select' | 'parcelinha';
  tipo_contrato?: 'normal' | 'intercalado';
  parcelas_pagas_empresa?: number;
  data_contratacao: string;
  dia_vencimento?: number;
  origem?: 'socio' | 'gr' | 'indicacao' | 'outros';
  origem_detalhe?: string;
  
  // Dados do cliente
  tipo_pessoa: 'pf' | 'pj';
  nome_completo?: string;
  cpf?: string;
  email?: string;
  telefone?: string;
  razao_social?: string;
  cnpj?: string;
  
  // Vendedor
  vendedor_email?: string;
  vendedor_name?: string;
}

function parseBrazilianDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  
  // Check if already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // Parse DD/MM/YYYY format
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

    const payload: ConsorcioPayload = await req.json();
    console.log('Webhook Consórcio - Payload recebido:', JSON.stringify(payload));

    // Validação de campos obrigatórios
    if (!payload.grupo || !payload.cota || !payload.valor_credito || !payload.tipo_pessoa) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Campos obrigatórios: grupo, cota, valor_credito, tipo_pessoa' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validação específica por tipo de pessoa
    if (payload.tipo_pessoa === 'pf' && !payload.nome_completo) {
      return new Response(
        JSON.stringify({ success: false, error: 'Campo nome_completo é obrigatório para PF' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (payload.tipo_pessoa === 'pj' && !payload.razao_social) {
      return new Response(
        JSON.stringify({ success: false, error: 'Campo razao_social é obrigatório para PJ' }),
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
        bu_type: 'consorcio',
        event_type: 'new_card',
        payload: payload,
        status: 'processing'
      })
      .select('id')
      .single();

    // Preparar dados para inserção
    const cardData = {
      grupo: payload.grupo,
      cota: payload.cota,
      valor_credito: parseMonetaryValue(payload.valor_credito),
      prazo_meses: payload.prazo_meses || 180,
      tipo_produto: payload.tipo_produto || 'select',
      tipo_contrato: payload.tipo_contrato || 'normal',
      parcelas_pagas_empresa: payload.parcelas_pagas_empresa || 0,
      data_contratacao: parseBrazilianDate(payload.data_contratacao),
      dia_vencimento: payload.dia_vencimento || 10,
      origem: payload.origem || 'outros',
      origem_detalhe: payload.origem_detalhe,
      tipo_pessoa: payload.tipo_pessoa,
      nome_completo: payload.nome_completo,
      cpf: payload.cpf,
      email: payload.email,
      telefone: payload.telefone,
      razao_social: payload.razao_social,
      cnpj: payload.cnpj,
      vendedor_name: payload.vendedor_name,
      status: 'ativo'
    };

    // Inserir na tabela consortium_cards
    const { data: card, error: insertError } = await supabase
      .from('consortium_cards')
      .insert(cardData)
      .select('id')
      .single();

    if (insertError) {
      console.error('Erro ao inserir carta:', insertError);
      
      // Atualizar log com erro
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
          record_id: card.id,
          processed_at: new Date().toISOString()
        })
        .eq('id', logEntry.id);
    }

    const processingTime = Date.now() - startTime;
    console.log(`Webhook Consórcio processado em ${processingTime}ms - Card ID: ${card.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        id: card.id,
        message: 'Carta de consórcio criada com sucesso',
        processing_time_ms: processingTime
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro no webhook consórcio:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
