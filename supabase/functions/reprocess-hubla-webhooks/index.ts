import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapear categoria do produto
const PRODUCT_MAPPING: Record<string, string> = {
  'A010': 'a010',
  'A010 - INCORPORADOR': 'a010',
  'CONSTRUIR PARA ALUGAR': 'ob_construir_alugar',
  'VIVER DE ALUGUEL': 'ob_construir_alugar',
  'COMO VIVER DE ALUGUEL': 'ob_construir_alugar',
  'ACESSO VITALIC': 'ob_vitalicio',
  'ACESSO VITALÍCIO': 'ob_vitalicio',
  'VITALÍCIO': 'ob_vitalicio',
};

function mapProductCategory(productName: string): string {
  const name = productName?.toUpperCase() || '';
  for (const [key, category] of Object.entries(PRODUCT_MAPPING)) {
    if (name.includes(key)) return category;
  }
  return 'outros';
}

function extractSellerNetValue(invoice: any): number | null {
  const receivers = invoice?.receivers || [];
  const sellerReceiver = receivers.find((r: any) => r.role === 'seller');
  if (sellerReceiver?.totalCents) {
    return sellerReceiver.totalCents / 100;
  }
  return null;
}

function extractSmartInstallment(invoice: any): { installment: number | null; installments: number | null } {
  const smartInstallment = invoice?.smartInstallment;
  if (!smartInstallment) return { installment: null, installments: null };
  return {
    installment: smartInstallment.installment || null,
    installments: smartInstallment.installments || null,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const payload = await req.json();
    const { date_filter, status_filter = 'processing', event_type_filter, limit = 100 } = payload;

    console.log(`🔄 Reprocessando webhooks: date=${date_filter}, status=${status_filter}, limit=${limit}`);

    // 1. Buscar webhooks com filtros
    let query = supabase
      .from('hubla_webhook_logs')
      .select('*')
      .eq('status', status_filter)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (date_filter) {
      query = query.gte('created_at', `${date_filter}T00:00:00Z`);
    }
    if (event_type_filter) {
      query = query.eq('event_type', event_type_filter);
    }

    const { data: webhooks, error: fetchError } = await query;

    if (fetchError) {
      console.error('❌ Erro ao buscar webhooks:', fetchError);
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Encontrados ${webhooks?.length || 0} webhooks para reprocessar`);

    const results = {
      total: webhooks?.length || 0,
      processed: 0,
      created: 0,
      already_exists: 0,
      errors: 0,
      details: [] as any[],
    };

    for (const webhook of webhooks || []) {
      try {
        const eventData = webhook.event_data;
        const eventType = webhook.event_type;

        // Apenas processar invoice.payment_succeeded
        if (eventType !== 'invoice.payment_succeeded') {
          console.log(`⏭️ Ignorando event_type: ${eventType}`);
          results.processed++;
          continue;
        }

        const invoice = eventData?.event?.invoice || eventData?.invoice;
        const items = invoice?.items || [];

        const { installment, installments } = extractSmartInstallment(invoice);
        const sellerNetValue = extractSellerNetValue(invoice);

        // Se não tem items, processar como produto único
        if (items.length === 0) {
          const product = eventData?.event?.product || {};
          const productName = product.name || 'Produto Desconhecido';
          const productPrice = (invoice?.amount?.subtotalCents || 0) / 100;
          const productCategory = mapProductCategory(productName);
          const saleDate = new Date(invoice?.saleDate || invoice?.createdAt || Date.now()).toISOString();
          const user = eventData?.event?.user || invoice?.payer || {};
          const hublaId = invoice?.id || `reprocess-${webhook.id}`;

          // Verificar se já existe
          const { data: existing } = await supabase
            .from('hubla_transactions')
            .select('id')
            .eq('hubla_id', hublaId)
            .single();

          if (existing) {
            console.log(`✅ Já existe: ${hublaId}`);
            results.already_exists++;
          } else {
            // Criar transação
            const transactionData = {
              hubla_id: hublaId,
              event_type: 'invoice.payment_succeeded',
              product_name: productName,
              product_price: productPrice,
              product_category: productCategory,
              customer_name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || null,
              customer_email: user.email || null,
              customer_phone: user.phone || null,
              payment_method: invoice?.paymentMethod || null,
              sale_date: saleDate,
              sale_status: 'completed',
              raw_data: eventData,
            };

            const { error: insertError } = await supabase
              .from('hubla_transactions')
              .insert(transactionData);

            if (insertError) {
              console.error(`❌ Erro ao inserir ${hublaId}:`, insertError);
              results.errors++;
              results.details.push({ hublaId, error: insertError.message });
            } else {
              console.log(`✅ Criado: ${hublaId} - ${productName}`);
              results.created++;
              results.details.push({ hublaId, action: 'created', product: productName });

              // Se for A010 e primeira parcela, adicionar em a010_sales
              const isFirstInstallment = installment === null || installment === 1;
              if (productCategory === 'a010' && isFirstInstallment) {
                await supabase.from('a010_sales').upsert({
                  customer_name: transactionData.customer_name || 'Cliente Desconhecido',
                  customer_email: transactionData.customer_email,
                  customer_phone: transactionData.customer_phone,
                  net_value: sellerNetValue || productPrice,
                  sale_date: saleDate,
                  status: 'completed',
                }, { onConflict: 'customer_email,sale_date', ignoreDuplicates: true });
              }
            }
          }
        } else {
          // Processar items individuais
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const isOffer = i > 0;
            const hublaId = isOffer ? `${invoice.id}-offer-${i}` : invoice.id;

            const productName = item.product?.name || item.offer?.name || item.name || 'Produto Desconhecido';
            const productPrice = parseFloat(item.price || item.amount || 0);
            const productCategory = mapProductCategory(productName);
            const saleDate = new Date(invoice.saleDate || invoice.createdAt || Date.now()).toISOString();
            const user = eventData?.event?.user || invoice?.payer || {};

            // Verificar se já existe
            const { data: existing } = await supabase
              .from('hubla_transactions')
              .select('id')
              .eq('hubla_id', hublaId)
              .single();

            if (existing) {
              console.log(`✅ Já existe: ${hublaId}`);
              results.already_exists++;
            } else {
              const transactionData = {
                hubla_id: hublaId,
                event_type: 'invoice.payment_succeeded',
                product_name: productName,
                product_code: item.product?.code || null,
                product_price: productPrice,
                product_category: productCategory,
                product_type: item.type || null,
                customer_name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || null,
                customer_email: user.email || null,
                customer_phone: user.phone || null,
                payment_method: invoice.paymentMethod || null,
                sale_date: saleDate,
                sale_status: 'completed',
                raw_data: eventData,
              };

              const { error: insertError } = await supabase
                .from('hubla_transactions')
                .insert(transactionData);

              if (insertError) {
                console.error(`❌ Erro ao inserir ${hublaId}:`, insertError);
                results.errors++;
                results.details.push({ hublaId, error: insertError.message });
              } else {
                console.log(`✅ Criado: ${hublaId} - ${productName}`);
                results.created++;
                results.details.push({ hublaId, action: 'created', product: productName });

                // Se for A010, não for offer, e primeira parcela
                const isFirstInstallment = installment === null || installment === 1;
                if (productCategory === 'a010' && !isOffer && isFirstInstallment) {
                  await supabase.from('a010_sales').upsert({
                    customer_name: transactionData.customer_name || 'Cliente Desconhecido',
                    customer_email: transactionData.customer_email,
                    customer_phone: transactionData.customer_phone,
                    net_value: sellerNetValue || productPrice,
                    sale_date: saleDate,
                    status: 'completed',
                  }, { onConflict: 'customer_email,sale_date', ignoreDuplicates: true });
                }
              }
            }
          }
        }

        // Atualizar status do webhook para success
        await supabase
          .from('hubla_webhook_logs')
          .update({ status: 'success', processed_at: new Date().toISOString() })
          .eq('id', webhook.id);

        results.processed++;
      } catch (error: any) {
        console.error(`❌ Erro ao processar webhook ${webhook.id}:`, error);
        results.errors++;
        results.details.push({ webhookId: webhook.id, error: error.message });
      }
    }

    console.log(`📊 Resultado: ${results.created} criados, ${results.already_exists} já existiam, ${results.errors} erros`);

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro fatal:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
