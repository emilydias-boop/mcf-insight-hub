import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapeamento de produtos Hubla para categorias do dashboard
const PRODUCT_MAPPING: Record<string, string> = {
  'A001': 'a010',
  'MCF Incorporador Completo': 'a010',
  'A005': 'ob_construir',
  'Anticrise Completo': 'ob_construir',
  'A006': 'ob_vitalicio',
  'Anticrise Básico': 'ob_vitalicio',
  'OB Evento': 'ob_evento',
  'R001': 'incorporador_50k',
  'Incorporador 50K': 'incorporador_50k',
  '000': 'contract',
  'Contrato': 'contract',
};

function mapProductCategory(productName: string, productCode?: string): string {
  // Tentar mapear por código primeiro
  if (productCode && PRODUCT_MAPPING[productCode]) {
    return PRODUCT_MAPPING[productCode];
  }
  
  // Tentar mapear por nome parcial
  for (const [key, category] of Object.entries(PRODUCT_MAPPING)) {
    if (productName.toLowerCase().includes(key.toLowerCase())) {
      return category;
    }
  }
  
  return 'outros';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const eventData = await req.json();
    const eventType = eventData.event || eventData.type || 'unknown';

    console.log('📥 Webhook recebido:', eventType);
    console.log('Dados:', JSON.stringify(eventData, null, 2));

    // Logar evento no banco
    const { data: logEntry, error: logError } = await supabase
      .from('hubla_webhook_logs')
      .insert({
        event_type: eventType,
        event_data: eventData,
        status: 'processing',
      })
      .select()
      .single();

    if (logError) {
      console.error('❌ Erro ao logar webhook:', logError);
    }

    // Processar eventos de venda
    if (eventType === 'sale.completed' || eventType === 'sale.approved') {
      const sale = eventData.data || eventData;
      
      const productName = sale.product?.name || sale.product_name || 'Produto Desconhecido';
      const productCode = sale.product?.code || sale.product_code;
      const productCategory = mapProductCategory(productName, productCode);
      
      console.log(`📦 Produto: ${productName} → Categoria: ${productCategory}`);

      // Inserir transação
      const { error: insertError } = await supabase
        .from('hubla_transactions')
        .insert({
          hubla_id: sale.id || sale.transaction_id || `${Date.now()}`,
          event_type: eventType,
          product_name: productName,
          product_type: sale.product?.type || sale.product_type,
          product_code: productCode,
          product_category: productCategory,
          product_price: sale.amount || sale.value || 0,
          customer_name: sale.customer?.name || sale.customer_name,
          customer_email: sale.customer?.email || sale.customer_email,
          customer_phone: sale.customer?.phone || sale.customer_phone,
          sale_status: 'completed',
          payment_method: sale.payment_method,
          sale_date: sale.created_at || sale.sale_date || new Date().toISOString(),
          utm_source: sale.utm_source,
          utm_medium: sale.utm_medium,
          utm_campaign: sale.utm_campaign,
          raw_data: eventData,
        });

      if (insertError) {
        console.error('❌ Erro ao inserir transação:', insertError);
        throw insertError;
      }

      console.log('✅ Transação registrada com sucesso!');
    }

    // Processar eventos de reembolso
    if (eventType === 'sale.refunded') {
      const sale = eventData.data || eventData;
      const hublaId = sale.id || sale.transaction_id;

      // Atualizar status da transação
      const { error: updateError } = await supabase
        .from('hubla_transactions')
        .update({ sale_status: 'refunded' })
        .eq('hubla_id', hublaId);

      if (updateError) {
        console.error('❌ Erro ao atualizar transação:', updateError);
        throw updateError;
      }

      console.log('✅ Transação marcada como reembolsada');
    }

    // Processar checkout abandonado
    if (eventType === 'lead.abandoned_checkout') {
      console.log('🛒 Checkout abandonado registrado');
    }

    // Atualizar log como sucesso
    const processingTime = Date.now() - startTime;
    if (logEntry) {
      await supabase
        .from('hubla_webhook_logs')
        .update({
          status: 'success',
          processing_time_ms: processingTime,
          processed_at: new Date().toISOString(),
        })
        .eq('id', logEntry.id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        event_type: eventType,
        processing_time_ms: processingTime 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('❌ Erro no webhook handler:', error);

    const processingTime = Date.now() - startTime;

    // Atualizar log como erro
    await supabase
      .from('hubla_webhook_logs')
      .update({
        status: 'error',
        error_message: error.message,
        processing_time_ms: processingTime,
        processed_at: new Date().toISOString(),
      });

    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
