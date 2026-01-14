import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-kiwify-token',
};

// Mapeamento de produtos Kiwify para categorias (mesmo padrão do Hubla)
const PRODUCT_MAPPING: Record<string, string> = {
  // A010 - Curso
  'A010': 'a010',
  'A011': 'a010',
  'A012': 'a010',
  // Incorporador 50k products
  'A000': 'incorporador',
  'A001': 'incorporador',
  'A002': 'incorporador',
  'A003': 'incorporador',
  'A004': 'incorporador',
  'A005': 'incorporador',
  'A008': 'incorporador',
  'A009': 'incorporador',
  'R001': 'incorporador',
  'R004': 'incorporador',
  'R005': 'incorporador',
  'R006': 'incorporador',
  'R009': 'incorporador',
  'R21': 'incorporador',
  // Contratos
  'Contrato': 'contrato',
  'CONTRATO': 'contrato',
  // Order Bumps
  'OB': 'orderbump',
  'Imersão Presencial': 'ob_evento',
  'Acesso Vitalício': 'ob_acesso',
  'Construir Para Alugar': 'ob_construir',
};

/**
 * Converte data da Kiwify (Brasília sem timezone) para UTC ISO string
 * Kiwify envia: "2026-01-14 15:40" (horário de Brasília)
 * Devemos salvar: "2026-01-14T18:40:00.000Z" (UTC)
 */
function convertKiwifyDateToUTC(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  
  // Se já tem timezone (termina em Z ou +/-), retornar como está
  if (dateStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateStr)) {
    return new Date(dateStr).toISOString();
  }
  
  // Kiwify envia horário de Brasília (UTC-3)
  // Adicionar o offset -03:00 antes de converter para UTC
  const dateWithTz = `${dateStr.replace(' ', 'T')}-03:00`;
  return new Date(dateWithTz).toISOString();
}

function mapProductCategory(productName: string, productCode?: string): string {
  if (!productName) return 'outros';
  const upperName = productName.toUpperCase();
  
  // Check product code first
  if (productCode) {
    for (const [key, value] of Object.entries(PRODUCT_MAPPING)) {
      if (productCode.toUpperCase().includes(key.toUpperCase())) {
        return value;
      }
    }
  }
  
  // Check product name patterns
  if (upperName.includes('A010') || upperName.includes('A011') || upperName.includes('A012')) {
    return 'a010';
  }
  if (upperName.includes('CONTRATO') || upperName.includes('A000')) {
    return 'contrato';
  }
  if (upperName.includes('MCF') || upperName.includes('INCORPORADOR') || upperName.includes('ANTICRISE')) {
    return 'incorporador';
  }
  if (upperName.includes('ORDER BUMP') || upperName.includes('OB ')) {
    return 'orderbump';
  }
  if (upperName.includes('IMERSÃO PRESENCIAL')) {
    return 'ob_evento';
  }
  if (upperName.includes('ACESSO VITALÍCIO')) {
    return 'ob_acesso';
  }
  if (upperName.includes('CONSTRUIR PARA ALUGAR')) {
    return 'ob_construir';
  }
  if (upperName.includes('EFEITO ALAVANCA') || upperName.includes('CLUBE DO ARREMATE')) {
    return 'outros';
  }
  
  return 'outros';
}

serve(async (req) => {
  const startTime = Date.now();
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const kiwifyToken = Deno.env.get('KIWIFY_WEBHOOK_TOKEN');
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const eventType = body.webhook_event_type || body.event || 'unknown';
    
    console.log(`[Kiwify Webhook] Received event: ${eventType}`);
    console.log(`[Kiwify Webhook] Body:`, JSON.stringify(body, null, 2));

    // Validar token (header ou body)
    const headerToken = req.headers.get('x-kiwify-token') || req.headers.get('X-Kiwify-Token');
    const bodyToken = body.signature || body.token;
    const receivedToken = headerToken || bodyToken;
    
    if (kiwifyToken && receivedToken && receivedToken !== kiwifyToken) {
      console.error('[Kiwify Webhook] Invalid token');
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log do webhook recebido
    const { data: logEntry, error: logError } = await supabase
      .from('hubla_webhook_logs')
      .insert({
        event_type: `kiwify:${eventType}`,
        event_data: body,
        status: 'processing'
      })
      .select('id')
      .single();

    if (logError) {
      console.error('[Kiwify Webhook] Error logging webhook:', logError);
    }

    const logId = logEntry?.id;

    // Processar eventos
    let processed = false;
    let transactionId = null;

    if (eventType === 'order_paid' || eventType === 'compra_aprovada' || eventType === 'purchase_approved' || eventType === 'order_approved') {
      // Venda aprovada - estrutura Kiwify usa Commissions, Customer, Product no root
      const commissions = body.Commissions || body.commissions || {};
      const customer = body.Customer || body.customer || {};
      const product = body.Product || body.product || {};
      const subscription = body.Subscription || body.subscription || {};
      
      const orderId = body.order_id || body.Order?.order_id || `kiwify_${Date.now()}`;
      const kiwifyId = `kiwify_${orderId}`;
      
      // Extrair valores da estrutura Commissions (Kiwify envia em centavos)
      const grossValueCents = commissions.charge_amount || commissions.product_base_price || 0;
      const netValueCents = commissions.my_commission || grossValueCents;
      const grossValue = grossValueCents / 100;
      const netValue = netValueCents / 100;
      
      const productName = product.product_name || product.name || 'Produto Kiwify';
      const productCode = product.product_id || product.id || '';
      const productCategory = mapProductCategory(productName, productCode);
      
      // Verificar parcela (para assinaturas e parcelamentos)
      // Kiwify pode enviar em diferentes formatos: Subscription.charges, installment_number, etc.
      const subscriptionCharges = subscription.charges?.length || 0;
      const bodyInstallment = body.installment_number || body.installment || 0;
      const orderInstallment = body.Order?.installment_number || body.order?.installment_number || 0;
      // Priorizar: subscription > body > order > default
      const installmentNumber = subscriptionCharges > 0 ? subscriptionCharges : (bodyInstallment || orderInstallment || 1);
      const totalInstallments = subscription.plan?.charges_limit || body.total_installments || body.Order?.total_installments || 1;
      
      console.log(`[Kiwify Webhook] Installment detection: subscriptionCharges=${subscriptionCharges}, bodyInstallment=${bodyInstallment}, orderInstallment=${orderInstallment}, final=${installmentNumber}/${totalInstallments}`);
      
      const customerName = customer.full_name || customer.name || '';
      const customerEmail = customer.email || '';
      const customerPhone = customer.mobile || customer.phone || '';
      
      const rawSaleDate = body.approved_date || body.created_at;
      const saleDate = convertKiwifyDateToUTC(rawSaleDate);

      console.log(`[Kiwify Webhook] Processing sale: ${kiwifyId}, product: ${productName}, category: ${productCategory}, gross: ${grossValue}, net: ${netValue}`);

      // Verificar duplicata
      const { data: existing } = await supabase
        .from('hubla_transactions')
        .select('id')
        .eq('hubla_id', kiwifyId)
        .single();

      if (existing) {
        console.log(`[Kiwify Webhook] Transaction ${kiwifyId} already exists, skipping`);
      } else {
        // Inserir transação
        const { data: transaction, error: txError } = await supabase
          .from('hubla_transactions')
          .insert({
            hubla_id: kiwifyId,
            event_type: 'kiwify.purchase_approved',
            product_name: productName,
            product_code: productCode,
            product_category: productCategory,
            product_price: grossValue,
            net_value: netValue,
            customer_name: customerName,
            customer_email: customerEmail,
            customer_phone: customerPhone,
            sale_date: saleDate,
            sale_status: 'completed',
            installment_number: installmentNumber,
            total_installments: totalInstallments,
            source: 'kiwify',
            raw_data: body
          })
          .select('id')
          .single();

        if (txError) {
          console.error('[Kiwify Webhook] Error inserting transaction:', txError);
          throw txError;
        }

        transactionId = transaction?.id;
        processed = true;

        // Se for A010 e primeira parcela, inserir em a010_sales
        if (productCategory === 'a010' && installmentNumber === 1 && customerName) {
          const { error: a010Error } = await supabase
            .from('a010_sales')
            .insert({
              customer_name: customerName,
              customer_email: customerEmail || null,
              customer_phone: customerPhone || null,
              net_value: netValue,
              sale_date: saleDate.split('T')[0],
              status: 'completed'
            });

          if (a010Error) {
            console.error('[Kiwify Webhook] Error inserting a010_sales:', a010Error);
          }
        }
      }
    } else if (eventType === 'refund' || eventType === 'compra_reembolsada' || eventType === 'order_refunded') {
      // Reembolso
      const order = body.order || body.Order || body;
      const orderId = order.order_id || order.id || body.order_id;
      const kiwifyId = `kiwify_${orderId}`;

      console.log(`[Kiwify Webhook] Processing refund for: ${kiwifyId}`);

      // Atualizar status da transação
      const { error: updateError } = await supabase
        .from('hubla_transactions')
        .update({ sale_status: 'refunded' })
        .eq('hubla_id', kiwifyId);

      if (updateError) {
        console.error('[Kiwify Webhook] Error updating refund status:', updateError);
      }

      // Atualizar a010_sales se existir
      const customer = body.Customer || body.customer || order.customer || {};
      const customerEmail = customer.email || '';
      
      if (customerEmail) {
        await supabase
          .from('a010_sales')
          .update({ status: 'refunded' })
          .eq('customer_email', customerEmail);
      }

      processed = true;
    } else if (eventType === 'chargeback' || eventType === 'chargeback_created') {
      // Chargeback
      const order = body.order || body.Order || body;
      const orderId = order.order_id || order.id || body.order_id;
      const kiwifyId = `kiwify_${orderId}`;

      console.log(`[Kiwify Webhook] Processing chargeback for: ${kiwifyId}`);

      const { error: updateError } = await supabase
        .from('hubla_transactions')
        .update({ sale_status: 'chargeback' })
        .eq('hubla_id', kiwifyId);

      if (updateError) {
        console.error('[Kiwify Webhook] Error updating chargeback status:', updateError);
      }

      processed = true;
    } else if (eventType === 'subscription_canceled' || eventType === 'assinatura_cancelada') {
      // Assinatura cancelada
      const subscription = body.Subscription || body.subscription || body;
      const orderId = subscription.id || body.order_id;
      
      console.log(`[Kiwify Webhook] Processing subscription cancellation: ${orderId}`);
      processed = true;
    }

    // Atualizar log
    const processingTime = Date.now() - startTime;
    if (logId) {
      await supabase
        .from('hubla_webhook_logs')
        .update({
          status: 'success',
          processed_at: new Date().toISOString(),
          processing_time_ms: processingTime
        })
        .eq('id', logId);
    }

    console.log(`[Kiwify Webhook] Processed in ${processingTime}ms, transaction: ${transactionId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed,
        transactionId,
        processingTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Kiwify Webhook] Error:', error);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
