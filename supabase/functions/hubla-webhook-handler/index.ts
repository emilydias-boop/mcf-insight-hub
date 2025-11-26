import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapeamento de produtos Hubla para categorias do dashboard
const PRODUCT_MAPPING: Record<string, string> = {
  'A001': 'a010',
  'A000': 'a010',
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
    const eventType = eventData.type || 'unknown';

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

    // Processar eventos de venda (formato real da Hubla)
    if (eventType === 'invoice.payment_succeeded' || eventType === 'NewSale') {
      const sale = eventData.event || eventData.data || eventData;
      
      // Extrair dados do produto
      const productName = sale.product?.name || sale.products?.[0]?.name || 'Produto Desconhecido';
      const productCode = sale.product?.code || sale.products?.[0]?.code;
      const productType = sale.product?.type || sale.products?.[0]?.type;
      const productCategory = mapProductCategory(productName, productCode);
      
      // Extrair dados do cliente
      const firstName = sale.invoice?.buyer?.firstName || sale.subscription?.payer?.firstName || sale.user?.firstName || '';
      const lastName = sale.invoice?.buyer?.lastName || sale.subscription?.payer?.lastName || sale.user?.lastName || '';
      const customerName = `${firstName} ${lastName}`.trim() || 'Cliente Hubla';
      const customerEmail = sale.invoice?.buyer?.email || sale.subscription?.payer?.email || sale.user?.email;
      const customerPhone = sale.invoice?.buyer?.phone || sale.subscription?.payer?.phone || sale.user?.phone;
      
      // Extrair valor (converter de centavos para reais)
      const amountCents = sale.invoice?.amount?.totalCents || sale.subscription?.lastInvoice?.amount?.totalCents || sale.amount || 0;
      const amount = typeof amountCents === 'number' ? amountCents / 100 : 0;
      
      // Extrair data da venda
      const saleDate = sale.invoice?.saleDate || sale.subscription?.lastInvoice?.saleDate || sale.created_at || new Date().toISOString();
      
      // ID da transação
      const hublaId = sale.invoice?.id || sale.subscription?.lastInvoice?.id || sale.id || sale.transaction_id || `${Date.now()}`;
      
      console.log(`📦 Produto: ${productName} → Categoria: ${productCategory} | Valor: R$ ${amount.toFixed(2)}`);

      // Inserir transação na tabela hubla_transactions
      const { error: insertError } = await supabase
        .from('hubla_transactions')
        .insert({
          hubla_id: hublaId,
          event_type: eventType,
          product_name: productName,
          product_type: productType,
          product_code: productCode,
          product_category: productCategory,
          product_price: amount,
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone,
          sale_status: 'completed',
          payment_method: sale.payment_method,
          sale_date: saleDate,
          utm_source: sale.utm_source,
          utm_medium: sale.utm_medium,
          utm_campaign: sale.utm_campaign,
          raw_data: eventData,
        });

      if (insertError) {
        console.error('❌ Erro ao inserir transação:', insertError);
        throw insertError;
      }

      console.log('✅ Transação Hubla registrada com sucesso!');

      // Se for produto A010, também inserir na tabela a010_sales
      if (productCategory === 'a010') {
        console.log('💰 Inserindo venda A010...');
        
        const { error: a010Error } = await supabase
          .from('a010_sales')
          .insert({
            sale_date: new Date(saleDate).toISOString().split('T')[0],
            customer_name: customerName,
            customer_email: customerEmail,
            customer_phone: customerPhone,
            net_value: amount,
            status: 'completed',
          });

        if (a010Error) {
          console.error('❌ Erro ao inserir venda A010:', a010Error);
          // Não faz throw aqui para não bloquear o webhook
        } else {
          console.log('✅ Venda A010 registrada com sucesso!');
        }
      }
    }

    // Processar eventos de reembolso
    if (eventType === 'invoice.refunded') {
      const sale = eventData.event || eventData.data || eventData;
      const hublaId = sale.invoice?.id || sale.subscription?.lastInvoice?.id || sale.id || sale.transaction_id;

      // Atualizar status da transação na hubla_transactions
      const { error: updateError } = await supabase
        .from('hubla_transactions')
        .update({ sale_status: 'refunded' })
        .eq('hubla_id', hublaId);

      if (updateError) {
        console.error('❌ Erro ao atualizar transação:', updateError);
        throw updateError;
      }

      console.log('✅ Transação marcada como reembolsada');
      
      // Também atualizar na a010_sales se existir
      const { error: a010UpdateError } = await supabase
        .from('a010_sales')
        .update({ status: 'refunded' })
        .eq('customer_email', sale.invoice?.buyer?.email || sale.subscription?.payer?.email || sale.user?.email);

      if (a010UpdateError) {
        console.error('⚠️ Erro ao atualizar A010:', a010UpdateError);
      }
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
