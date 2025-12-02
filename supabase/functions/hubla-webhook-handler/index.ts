import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Produtos que ENTRAM no Incorporador 50k
const INCORPORADOR_50K_PRODUCTS = [
  'A001', 'A002', 'A003', 'A004', 'A005', 'A006', 'A008', 'A009',
  'A000', 'CONTRATO - ANTICRISE'
];

// Produtos EXCLUÍDOS (consórcio/leilão)
const EXCLUDED_CONTRACTS = [
  'CONTRATO - EFEITO ALAVANCA',
  'CONTRATO - CLUBE DO ARREMATE'
];

const PRODUCT_MAPPING: Record<string, string> = {
  // Incorporador 50k
  'A001': 'incorporador',
  'A002': 'incorporador',
  'A003': 'incorporador',
  'A004': 'incorporador',
  'A005': 'incorporador',
  'A006': 'incorporador',
  'A008': 'incorporador',
  'A009': 'incorporador',
  'A000': 'incorporador',
  'CONTRATO': 'incorporador',
  'CONTRATO - ANTICRISE': 'incorporador',
  'ANTICRISE': 'incorporador',
  'RENOVAÇÃO PARCEIRO': 'incorporador',
  
  // A010
  'A010': 'a010',
  'A010 - INCORPORADOR': 'a010',
  
  // Order Bumps
  'CONSTRUIR PARA ALUGAR': 'ob_construir_alugar',
  'VIVER DE ALUGUEL': 'ob_construir_alugar',
  'COMO VIVER DE ALUGUEL': 'ob_construir_alugar',
  'CONSTRUIR PARA VENDER': 'ob_construir_vender',
  'ACESSO VITALIC': 'ob_vitalicio',
  'ACESSO VITALÍCIO': 'ob_vitalicio',
  'VITALÍCIO': 'ob_vitalicio',
  'OB - VITALÍCIO': 'ob_vitalicio',
  'GESTÃO DE OBRAS': 'ob_construir_gestao_obras',
  'OB - CONSTRUIR (GESTÃO DE OBRAS)': 'ob_construir_gestao_obras',
  'OB - EVENTO': 'ob_evento',
  'EVENTO OB': 'ob_evento',
  
  // Outros produtos
  'CONTRATO INDIVIDUAL': 'contrato',
  'CONTRATO COMBO': 'contrato',
  'MCF PLANO ANTICRISE': 'parceria',
  'MCF INCORPORADOR COMPLETO': 'parceria',
  'MCF INCORPORADOR': 'parceria',
  'RENOVAÇÃO': 'renovacao',
  'RENOVAÇÃO ANUAL': 'renovacao',
  'CAPTAÇÃO': 'captacao',
  'CAPTAÇÃO DE RECURSOS': 'captacao',
  'P2': 'p2',
  'P2 - MERCADO PRIMÁRIO': 'p2',
  'FORMAÇÃO': 'formacao',
  'FORMAÇÃO DE CORRETORES': 'formacao',
  'PROJETOS': 'projetos',
  'DESENVOLVIMENTO DE PROJETOS': 'projetos',
  'EFEITO ALAVANCA': 'efeito_alavanca',
  'EA': 'efeito_alavanca',
  'MENTORIA CAIXA': 'mentoria_caixa',
  'MENTORIA CAIXA INDIVIDUAL': 'mentoria_caixa',
  'MENTORIA GRUPO CAIXA': 'mentoria_grupo_caixa',
  'MGC': 'mentoria_grupo_caixa',
  'SÓCIOS': 'socios',
  'PROGRAMA SÓCIOS': 'socios',
  'A007': 'socios',
  'CLUBE ARREMATE': 'clube_arremate',
  'CA': 'clube_arremate',
  'IMERSÃO': 'imersao',
  'IMERSÃO PRESENCIAL': 'imersao',
  'IMERSÃO SÓCIOS': 'imersao_socios',
  'IS': 'imersao_socios',
};

function mapProductCategory(productName: string, productCode?: string): string {
  const name = productName?.toUpperCase() || '';
  const code = productCode?.toUpperCase() || '';
  
  // Tentar match exato por código
  if (code && PRODUCT_MAPPING[code]) {
    return PRODUCT_MAPPING[code];
  }
  
  // Tentar match exato por nome
  if (PRODUCT_MAPPING[name]) {
    return PRODUCT_MAPPING[name];
  }
  
  // Tentar match parcial
  for (const [key, category] of Object.entries(PRODUCT_MAPPING)) {
    if (name.includes(key) || (code && code.includes(key))) {
      return category;
    }
  }
  
  return 'outros';
}

// Extrair informações de smartInstallment do invoice
function extractSmartInstallment(invoice: any): { installment: number | null; installments: number | null } {
  const smartInstallment = invoice?.smartInstallment;
  if (!smartInstallment) {
    return { installment: null, installments: null };
  }
  return {
    installment: smartInstallment.installment || null,
    installments: smartInstallment.installments || null,
  };
}

// Extrair valor líquido do seller dos receivers
function extractSellerNetValue(invoice: any): number | null {
  const receivers = invoice?.receivers || [];
  const sellerReceiver = receivers.find((r: any) => r.role === 'seller');
  if (sellerReceiver?.totalCents) {
    return sellerReceiver.totalCents / 100; // Converter de centavos para reais
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const body = await req.json();
    const eventType = body.event_type || body.type;

    console.log('📥 Webhook recebido:', eventType);

    // Log do webhook
    const { data: logEntry } = await supabase
      .from('hubla_webhook_logs')
      .insert({
        event_type: eventType,
        event_data: body,
        status: 'processing',
      })
      .select()
      .single();

    let logId = logEntry?.id;

    try {
      // NewSale - extrair do body.event
      if (eventType === 'NewSale') {
        const eventData = body.event || {};
        const invoice = eventData.invoice || {};
        const productName = eventData.groupName || eventData.products?.[0]?.name || 'Produto Desconhecido';
        const productPrice = parseFloat(eventData.totalAmount || eventData.amount || 0);
        const customerId = eventData.customer_id || eventData.customerId;
        
        // Extrair smartInstallment
        const { installment, installments } = extractSmartInstallment(invoice);
        const sellerNetValue = extractSellerNetValue(invoice);
        
        const productCategory = mapProductCategory(productName);
        const saleDate = new Date(eventData.created_at || eventData.createdAt || Date.now()).toISOString();
        
        const transactionData = {
          hubla_id: eventData.id || `newsale-${Date.now()}`,
          event_type: 'NewSale',
          product_name: productName,
          product_code: eventData.productCode || null,
          product_price: productPrice,
          product_category: productCategory,
          customer_name: eventData.customer?.name || eventData.customerName || null,
          customer_email: eventData.customer?.email || eventData.customerEmail || null,
          customer_phone: eventData.customer?.phone || eventData.customerPhone || null,
          utm_source: eventData.utm_source || eventData.utmSource || null,
          utm_medium: eventData.utm_medium || eventData.utmMedium || null,
          utm_campaign: eventData.utm_campaign || eventData.utmCampaign || null,
          payment_method: eventData.paymentMethod || null,
          sale_date: saleDate,
          sale_status: 'completed',
          raw_data: body, // Preservar raw_data completo
        };

        const { error } = await supabase
          .from('hubla_transactions')
          .upsert(transactionData, { onConflict: 'hubla_id' });

        if (error) throw error;

        // Se for A010 e for primeira parcela (ou sem smartInstallment), inserir na tabela a010_sales
        const isFirstInstallment = installment === null || installment === 1;
        if (productCategory === 'a010' && isFirstInstallment) {
          await supabase
            .from('a010_sales')
            .upsert({
              customer_name: transactionData.customer_name || 'Cliente Desconhecido',
              customer_email: transactionData.customer_email,
              customer_phone: transactionData.customer_phone,
              net_value: sellerNetValue || productPrice,
              sale_date: saleDate,
              status: 'completed',
            }, { onConflict: 'customer_email,sale_date', ignoreDuplicates: true });
        }

        console.log(`✅ NewSale processado: ${productName} - R$ ${productPrice} (parcela ${installment || 1}/${installments || 1})`);
      }

      // invoice.payment_succeeded - extrair items individuais
      if (eventType === 'invoice.payment_succeeded') {
        const invoice = body.event?.invoice || body.invoice;
        const items = invoice?.items || [];
        
        // Extrair smartInstallment do invoice
        const { installment, installments } = extractSmartInstallment(invoice);
        const sellerNetValue = extractSellerNetValue(invoice);
        
        console.log(`📦 Processando ${items.length} items da invoice ${invoice?.id} (parcela ${installment || 1}/${installments || 1})`);

        // Se não tem items, criar transação do produto principal
        if (items.length === 0) {
          const product = body.event?.product || {};
          const productName = product.name || 'Produto Desconhecido';
          const productPrice = (invoice?.amount?.subtotalCents || 0) / 100;
          const productCategory = mapProductCategory(productName);
          const saleDate = new Date(invoice?.saleDate || invoice?.createdAt || Date.now()).toISOString();
          
          const user = body.event?.user || invoice?.payer || {};
          
        const transactionData = {
          hubla_id: invoice?.id || `invoice-${Date.now()}`,
          event_type: 'invoice.payment_succeeded',
          product_name: productName,
          product_code: null,
          product_price: productPrice,
          product_category: productCategory,
          product_type: null,
          customer_name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || null,
          customer_email: user.email || null,
          customer_phone: user.phone || null,
          utm_source: null,
          utm_medium: null,
          utm_campaign: null,
          payment_method: invoice?.paymentMethod || null,
          sale_date: saleDate,
          sale_status: 'completed',
          raw_data: body, // Preservar raw_data completo com smartInstallment
        };

        console.log(`📝 [UPSERT] Tentando salvar transação: ${transactionData.hubla_id} - ${productName}`);
        
        const { data: upsertData, error } = await supabase
          .from('hubla_transactions')
          .upsert(transactionData, { onConflict: 'hubla_id' })
          .select();

        if (error) {
          console.error(`❌ [UPSERT ERROR] hubla_id=${transactionData.hubla_id}:`, error);
          throw error;
        }
        
        console.log(`✅ [UPSERT SUCCESS] hubla_id=${transactionData.hubla_id}, rows=${upsertData?.length || 0}`);

          // Se for A010 e for primeira parcela (ou sem smartInstallment), inserir na tabela a010_sales
          const isFirstInstallment = installment === null || installment === 1;
          if (productCategory === 'a010' && isFirstInstallment) {
            await supabase
              .from('a010_sales')
              .upsert({
                customer_name: transactionData.customer_name || 'Cliente Desconhecido',
                customer_email: transactionData.customer_email,
                customer_phone: transactionData.customer_phone,
                net_value: sellerNetValue || productPrice,
                sale_date: saleDate,
                status: 'completed',
              }, { onConflict: 'customer_email,sale_date', ignoreDuplicates: true });
          }

          console.log(`✅ Invoice sem items: ${productName} - ${productCategory} - R$ ${productPrice} (parcela ${installment || 1}/${installments || 1})`);
        }

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const isOffer = i > 0;
          const hublaId = isOffer ? `${invoice.id}-offer-${i}` : invoice.id;
          
          const productName = item.product?.name || item.offer?.name || item.name || 'Produto Desconhecido';
          const productCode = item.product?.code || item.product_code || null;
          const productPrice = parseFloat(item.price || item.amount || 0);
          
          const productCategory = mapProductCategory(productName, productCode);
          const saleDate = new Date(invoice.saleDate || invoice.created_at || invoice.createdAt || Date.now()).toISOString();
          
          const user = body.event?.user || invoice?.payer || {};
          
          const transactionData = {
            hubla_id: hublaId,
            event_type: 'invoice.payment_succeeded',
            product_name: productName,
            product_code: productCode,
            product_price: productPrice,
            product_category: productCategory,
            product_type: item.type || null,
            customer_name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || invoice.customer?.name || invoice.customer_name || null,
            customer_email: user.email || invoice.customer?.email || invoice.customer_email || null,
            customer_phone: user.phone || invoice.customer?.phone || invoice.customer_phone || null,
            utm_source: invoice.utm_source || null,
            utm_medium: invoice.utm_medium || null,
            utm_campaign: invoice.utm_campaign || null,
            payment_method: invoice.paymentMethod || invoice.payment_method || null,
            sale_date: saleDate,
            sale_status: 'completed',
            raw_data: body, // Preservar raw_data completo com smartInstallment
          };

          console.log(`📝 [UPSERT] Tentando salvar item ${i + 1}: ${transactionData.hubla_id} - ${productName}`);
          
          const { data: itemUpsertData, error } = await supabase
            .from('hubla_transactions')
            .upsert(transactionData, { onConflict: 'hubla_id' })
            .select();

          if (error) {
            console.error(`❌ [UPSERT ERROR] hubla_id=${transactionData.hubla_id}:`, error);
            throw error;
          }
          
          console.log(`✅ [UPSERT SUCCESS] hubla_id=${transactionData.hubla_id}, rows=${itemUpsertData?.length || 0}`);

          // Se for A010, não for offer, e for primeira parcela (ou sem smartInstallment), inserir na tabela a010_sales
          const isFirstInstallment = installment === null || installment === 1;
          if (productCategory === 'a010' && !isOffer && isFirstInstallment) {
            await supabase
              .from('a010_sales')
              .upsert({
                customer_name: transactionData.customer_name || 'Cliente Desconhecido',
                customer_email: transactionData.customer_email,
                customer_phone: transactionData.customer_phone,
                net_value: sellerNetValue || productPrice,
                sale_date: saleDate,
                status: 'completed',
              }, { onConflict: 'customer_email,sale_date', ignoreDuplicates: true });
          }

          console.log(`✅ Item ${i + 1}/${items.length}: ${productName} - ${productCategory} - R$ ${productPrice} (parcela ${installment || 1}/${installments || 1})`);
        }
      }

      // invoice.refunded
      if (eventType === 'invoice.refunded') {
        const invoice = body.event?.invoice || body.invoice;
        const hublaId = invoice?.id;

        if (hublaId) {
          await supabase
            .from('hubla_transactions')
            .update({ sale_status: 'refunded' })
            .eq('hubla_id', hublaId);

          await supabase
            .from('a010_sales')
            .update({ status: 'refunded' })
            .eq('customer_email', invoice.customer?.email || invoice.customer_email)
            .eq('sale_date', new Date(invoice.created_at || invoice.createdAt).toISOString().split('T')[0]);

          console.log(`🔄 Reembolso processado: ${hublaId}`);
        }
      }

      // lead.abandoned_checkout
      if (eventType === 'lead.abandoned_checkout') {
        console.log('🚪 Carrinho abandonado registrado');
      }

      // Atualizar log de sucesso
      const processingTime = Date.now() - startTime;
      if (logId) {
        await supabase
          .from('hubla_webhook_logs')
          .update({
            status: 'success',
            processed_at: new Date().toISOString(),
            processing_time_ms: processingTime,
          })
          .eq('id', logId);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Webhook processado', eventType }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error: any) {
      console.error('❌ Erro ao processar webhook:', error);
      
      // Atualizar log de erro
      if (logId) {
        await supabase
          .from('hubla_webhook_logs')
          .update({
            status: 'error',
            error_message: error.message,
            processed_at: new Date().toISOString(),
            processing_time_ms: Date.now() - startTime,
          })
          .eq('id', logId);
      }

      throw error;
    }

  } catch (error: any) {
    console.error('❌ Erro fatal:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
