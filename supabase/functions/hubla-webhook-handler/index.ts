import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Produtos que ENTRAM no Incorporador 50k (A006 EXCLUÍDO - é renovação)
const INCORPORADOR_50K_CATEGORIES = ['a000', 'a001', 'a002', 'a003', 'a004', 'a005', 'a008', 'a009', 'contrato-anticrise'];

// Produtos EXCLUÍDOS (consórcio/leilão e renovação)
const EXCLUDED_FROM_INCORPORADOR = [
  'A006', 'RENOVAÇÃO PARCEIRO', 'CONTRATO - EFEITO ALAVANCA', 'CONTRATO - CLUBE DO ARREMATE',
  'IMERSÃO SÓCIOS', 'IMERSÃO SÓCIOS MCF'
];

const PRODUCT_MAPPING: Record<string, string> = {
  // Incorporador 50k (A006 agora é renovacao, não incorporador)
  'A001': 'incorporador',
  'A002': 'incorporador',
  'A003': 'incorporador',
  'A004': 'incorporador',
  'A005': 'incorporador',
  'A008': 'incorporador',
  'A009': 'incorporador',
  'A000': 'incorporador',
  'CONTRATO': 'incorporador',
  'CONTRATO - ANTICRISE': 'contrato-anticrise',
  'ANTICRISE': 'contrato-anticrise',
  
  // A006 é renovação, NÃO incorporador
  'A006': 'renovacao',
  'RENOVAÇÃO PARCEIRO': 'renovacao',
  
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
  'IMERSÃO PRESENCIAL': 'ob_evento',
  'IMERSÃO SÓCIOS': 'imersao_socios',
  'IMERSÃO SÓCIOS MCF': 'imersao_socios',
  'IS': 'imersao_socios',
};

function mapProductCategory(productName: string, productCode?: string): string {
  const name = productName?.toUpperCase() || '';
  const code = productCode?.toUpperCase() || '';
  
  // Verificar se é produto excluído do Incorporador 50k
  for (const excluded of EXCLUDED_FROM_INCORPORADOR) {
    if (name.includes(excluded) || code === excluded) {
      // Mapear para categoria correta
      if (excluded === 'A006' || excluded === 'RENOVAÇÃO PARCEIRO') return 'renovacao';
      if (excluded.includes('IMERSÃO SÓCIOS')) return 'imersao_socios';
      if (excluded.includes('EFEITO ALAVANCA')) return 'efeito_alavanca';
      if (excluded.includes('CLUBE DO ARREMATE')) return 'clube_arremate';
    }
  }
  
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
function extractSmartInstallment(invoice: any): { installment: number; installments: number } {
  const smartInstallment = invoice?.smartInstallment;
  if (!smartInstallment) {
    return { installment: 1, installments: 1 };
  }
  return {
    installment: smartInstallment.installment || 1,
    installments: smartInstallment.installments || 1,
  };
}

// CORREÇÃO: Extrair valores corretos do invoice
// Bruto = subtotalCents (sem juros de parcelamento)
// Líquido = sellerTotalCents - installmentFeeCents
function extractCorrectValues(invoice: any): {
  subtotalCents: number;
  installmentFeeCents: number;
  sellerTotalCents: number;
  grossValue: number;
  netValue: number;
} {
  const amount = invoice?.amount || {};
  const receivers = invoice?.receivers || [];
  
  const subtotalCents = amount.subtotalCents || amount.totalCents || 0;
  const installmentFeeCents = amount.installmentFeeCents || 0;
  
  const sellerReceiver = receivers.find((r: any) => r.role === 'seller');
  const sellerTotalCents = sellerReceiver?.totalCents || 0;
  
  // Bruto = subtotal em centavos convertido para reais
  const grossValue = subtotalCents / 100;
  
  // Líquido = seller total - juros de parcelamento (convertido para reais)
  const netValue = (sellerTotalCents - installmentFeeCents) / 100;
  
  return {
    subtotalCents,
    installmentFeeCents,
    sellerTotalCents,
    grossValue,
    netValue: netValue > 0 ? netValue : grossValue * 0.9417, // Fallback se não tiver seller
  };
}

// ============= HELPER: Criar/Atualizar Contato e Deal no CRM =============
interface CRMContactData {
  email: string | null;
  phone: string | null;
  name: string | null;
  originName: string;
  productName: string;
  value: number;
}

async function createOrUpdateCRMContact(supabase: any, data: CRMContactData): Promise<void> {
  if (!data.email && !data.phone) {
    console.log('[CRM] Sem email ou telefone, pulando criação de contato');
    return;
  }
  
  try {
    // 1. Buscar ou criar origem
    let originId: string | null = null;
    const { data: existingOrigin } = await supabase
      .from('crm_origins')
      .select('id')
      .ilike('name', data.originName)
      .maybeSingle();
    
    if (existingOrigin) {
      originId = existingOrigin.id;
    } else {
      // Criar nova origem
      const { data: newOrigin } = await supabase
        .from('crm_origins')
        .insert({
          clint_id: `hubla-origin-${Date.now()}`,
          name: data.originName,
          description: 'Criada automaticamente via webhook Hubla'
        })
        .select('id')
        .single();
      
      if (newOrigin) {
        originId = newOrigin.id;
        console.log(`[CRM] Origem criada: ${data.originName} (${originId})`);
      }
    }
    
    // 2. Buscar contato existente pelo email
    let contactId: string | null = null;
    if (data.email) {
      const { data: existingContact } = await supabase
        .from('crm_contacts')
        .select('id')
        .eq('email', data.email)
        .maybeSingle();
      
      if (existingContact) {
        contactId = existingContact.id;
        console.log(`[CRM] Contato existente encontrado: ${contactId}`);
      } else {
        // Criar novo contato
        const { data: newContact, error: contactError } = await supabase
          .from('crm_contacts')
          .insert({
            clint_id: `hubla-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            name: data.name || 'Cliente A010',
            email: data.email,
            phone: data.phone,
            origin_id: originId,
            tags: ['A010', 'Hubla'],
            custom_fields: { source: 'hubla', product: data.productName }
          })
          .select('id')
          .single();
        
        if (!contactError && newContact) {
          contactId = newContact.id;
          console.log(`[CRM] Contato criado: ${data.name} (${contactId})`);
        }
      }
    }
    
    // 3. Buscar estágio "Novo Lead" para a origem
    let stageId: string | null = null;
    if (originId) {
      const { data: stage } = await supabase
        .from('crm_stages')
        .select('id')
        .eq('origin_id', originId)
        .order('stage_order', { ascending: true })
        .limit(1)
        .maybeSingle();
      
      stageId = stage?.id;
    }
    
    // Se não encontrou stage da origem, buscar stage genérico "Novo Lead"
    if (!stageId) {
      const { data: genericStage } = await supabase
        .from('crm_stages')
        .select('id')
        .ilike('stage_name', '%novo lead%')
        .limit(1)
        .maybeSingle();
      
      stageId = genericStage?.id;
    }
    
    // 4. Verificar se já existe deal para este contato com A010
    if (contactId) {
      const { data: existingDeal } = await supabase
        .from('crm_deals')
        .select('id')
        .eq('contact_id', contactId)
        .ilike('product_name', '%A010%')
        .maybeSingle();
      
      if (existingDeal) {
        console.log(`[CRM] Deal A010 já existe para este contato: ${existingDeal.id}`);
        return;
      }
      
      // 5. Criar novo deal
      const { data: newDeal, error: dealError } = await supabase
        .from('crm_deals')
        .insert({
          clint_id: `hubla-deal-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          name: `${data.name || 'Cliente'} - A010`,
          value: data.value || 0,
          contact_id: contactId,
          origin_id: originId,
          stage_id: stageId,
          product_name: data.productName,
          tags: ['A010', 'Hubla'],
          custom_fields: { source: 'hubla', product: data.productName },
          data_source: 'webhook'
        })
        .select('id')
        .single();
      
      if (!dealError && newDeal) {
        console.log(`[CRM] Deal criado: ${data.name} - A010 (${newDeal.id})`);
      } else if (dealError) {
        console.error('[CRM] Erro ao criar deal:', dealError);
      }
    }
  } catch (err) {
    console.error('[CRM] Erro ao criar/atualizar contato:', err);
  }
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
        
        // Extrair valores corrigidos
        const { installment, installments } = extractSmartInstallment(invoice);
        const { grossValue, netValue, subtotalCents, installmentFeeCents } = extractCorrectValues(invoice);
        
        const productPrice = grossValue || parseFloat(eventData.totalAmount || eventData.amount || 0);
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
          raw_data: body,
          // Novos campos
          net_value: netValue,
          // CORREÇÃO: Math.round para evitar erro "invalid input syntax for type integer"
          subtotal_cents: Math.round(subtotalCents || 0),
          installment_fee_cents: Math.round(installmentFeeCents || 0),
          installment_number: installment,
          total_installments: installments,
          is_offer: false,
        };

        const { error } = await supabase
          .from('hubla_transactions')
          .upsert(transactionData, { onConflict: 'hubla_id' });

        if (error) throw error;

        // Se for A010 e for primeira parcela, inserir na tabela a010_sales e criar contato/deal no CRM
        if (productCategory === 'a010' && installment === 1) {
          await supabase
            .from('a010_sales')
            .upsert({
              customer_name: transactionData.customer_name || 'Cliente Desconhecido',
              customer_email: transactionData.customer_email,
              customer_phone: transactionData.customer_phone,
              net_value: netValue,
              sale_date: saleDate,
              status: 'completed',
            }, { onConflict: 'customer_email,sale_date', ignoreDuplicates: true });
          
          // Criar contato e deal no CRM para leads A010
          await createOrUpdateCRMContact(supabase, {
            email: transactionData.customer_email,
            phone: transactionData.customer_phone,
            name: transactionData.customer_name,
            originName: 'A010 Hubla',
            productName: productName,
            value: netValue
          });
        }
      }

      // invoice.payment_succeeded - extrair items individuais
      if (eventType === 'invoice.payment_succeeded') {
        const invoice = body.event?.invoice || body.invoice;
        const items = invoice?.items || [];
        
        // Extrair smartInstallment do invoice
        const { installment, installments } = extractSmartInstallment(invoice);
        const { grossValue, netValue, subtotalCents, installmentFeeCents } = extractCorrectValues(invoice);
        
        console.log(`📦 Processando ${items.length} items da invoice ${invoice?.id} (parcela ${installment}/${installments}) - Bruto: R$ ${grossValue} | Líquido: R$ ${netValue}`);

        // Se não tem items, criar transação do produto principal
        if (items.length === 0) {
          const product = body.event?.product || {};
          const productName = product.name || 'Produto Desconhecido';
          const productCategory = mapProductCategory(productName);
          const saleDate = new Date(invoice?.saleDate || invoice?.createdAt || Date.now()).toISOString();
          
          const user = body.event?.user || invoice?.payer || {};
          
          const transactionData = {
            hubla_id: invoice?.id || `invoice-${Date.now()}`,
            event_type: 'invoice.payment_succeeded',
            product_name: productName,
            product_code: null,
            product_price: grossValue,
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
            raw_data: body,
            // Novos campos
            net_value: netValue,
            // CORREÇÃO: Math.round para evitar erro "invalid input syntax for type integer"
            subtotal_cents: Math.round(subtotalCents || 0),
            installment_fee_cents: Math.round(installmentFeeCents || 0),
            installment_number: installment,
            total_installments: installments,
            is_offer: false,
          };

          console.log(`📝 [UPSERT] Salvando transação: ${transactionData.hubla_id} - ${productName}`);
          
          const { error } = await supabase
            .from('hubla_transactions')
            .upsert(transactionData, { onConflict: 'hubla_id' });

          if (error) {
            console.error(`❌ [UPSERT ERROR]:`, error);
            throw error;
          }

          // Se for A010 e for primeira parcela, inserir na tabela a010_sales e criar contato/deal no CRM
          if (productCategory === 'a010' && installment === 1) {
            await supabase
              .from('a010_sales')
              .upsert({
                customer_name: transactionData.customer_name || 'Cliente Desconhecido',
                customer_email: transactionData.customer_email,
                customer_phone: transactionData.customer_phone,
                net_value: netValue,
                sale_date: saleDate,
                status: 'completed',
              }, { onConflict: 'customer_email,sale_date', ignoreDuplicates: true });
            
            // Criar contato e deal no CRM para leads A010
            await createOrUpdateCRMContact(supabase, {
              email: transactionData.customer_email,
              phone: transactionData.customer_phone,
              name: transactionData.customer_name,
              originName: 'A010 Hubla',
              productName: productName,
              value: netValue
            });
          }
        }

        // Processar items individuais
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const isOffer = i > 0;
          const hublaId = isOffer ? `${invoice.id}-offer-${i}` : invoice.id;
          
          // Para offers, usar o nome do offer para categorização correta
          const productName = isOffer 
            ? (item.offer?.name || item.product?.name || item.name || 'Offer Desconhecido')
            : (item.product?.name || item.name || 'Produto Desconhecido');
          const productCode = item.product?.code || item.product_code || null;
          
          // Para items individuais, usar o price do item
          const itemPrice = parseFloat(item.price || item.amount || 0);
          
          const productCategory = mapProductCategory(productName, productCode);
          const saleDate = new Date(invoice.saleDate || invoice.created_at || invoice.createdAt || Date.now()).toISOString();
          
          const user = body.event?.user || invoice?.payer || {};
          
          // Para offers, calcular net_value proporcional
          // Para item principal, usar o net_value calculado
          const itemNetValue = isOffer 
            ? itemPrice * 0.9417 // Offers usam taxa aproximada
            : netValue;
          
          const transactionData = {
            hubla_id: hublaId,
            event_type: 'invoice.payment_succeeded',
            product_name: productName,
            product_code: productCode,
            product_price: isOffer ? itemPrice : grossValue,
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
            raw_data: body,
            // Novos campos
            net_value: itemNetValue,
            // CORREÇÃO: Math.round para evitar erro "invalid input syntax for type integer"
            subtotal_cents: Math.round(isOffer ? itemPrice * 100 : (subtotalCents || 0)),
            installment_fee_cents: Math.round(isOffer ? 0 : (installmentFeeCents || 0)),
            installment_number: installment,
            total_installments: installments,
            is_offer: isOffer,
          };

          console.log(`📝 [UPSERT] Item ${i + 1}: ${hublaId} - ${productName} (offer: ${isOffer})`);
          
          const { error } = await supabase
            .from('hubla_transactions')
            .upsert(transactionData, { onConflict: 'hubla_id' });

          if (error) {
            console.error(`❌ [UPSERT ERROR]:`, error);
            throw error;
          }

          // Se for A010, não for offer, e for primeira parcela, inserir na tabela a010_sales e criar contato/deal
          if (productCategory === 'a010' && !isOffer && installment === 1) {
            await supabase
              .from('a010_sales')
              .upsert({
                customer_name: transactionData.customer_name || 'Cliente Desconhecido',
                customer_email: transactionData.customer_email,
                customer_phone: transactionData.customer_phone,
                net_value: itemNetValue,
                sale_date: saleDate,
                status: 'completed',
              }, { onConflict: 'customer_email,sale_date', ignoreDuplicates: true });
            
            // Criar contato e deal no CRM para leads A010
            await createOrUpdateCRMContact(supabase, {
              email: transactionData.customer_email,
              phone: transactionData.customer_phone,
              name: transactionData.customer_name,
              originName: 'A010 Hubla',
              productName: productName,
              value: itemNetValue
            });
          }
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
