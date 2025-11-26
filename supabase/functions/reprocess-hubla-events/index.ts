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
  const name = productName.toUpperCase();
  
  // Cursos: A010 ou qualquer produto "Construir para..."
  if (name.includes('A010') || name.includes('CONSTRUIR PARA')) {
    return 'curso';
  }
  
  // Contratos
  if (name.includes('CONTRATO') || productCode === 'A000' || productCode === '000') {
    return 'contrato';
  }
  
  // Tentar mapear por código primeiro (outros produtos)
  if (productCode && PRODUCT_MAPPING[productCode]) {
    return PRODUCT_MAPPING[productCode];
  }
  
  // Tentar mapear por nome parcial (outros produtos)
  for (const [key, category] of Object.entries(PRODUCT_MAPPING)) {
    if (productName.toLowerCase().includes(key.toLowerCase())) {
      return category;
    }
  }
  
  return 'outros';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log('🔄 Iniciando reprocessamento de eventos Hubla...');

    // Buscar todos os logs com status success (vamos filtrar por tipo em JS)
    const { data: logs, error: logsError } = await supabase
      .from('hubla_webhook_logs')
      .select('*')
      .eq('status', 'success')
      .order('created_at', { ascending: true });

    if (logsError) {
      console.error('❌ Erro ao buscar logs:', logsError);
      throw logsError;
    }

    console.log(`📦 Encontrados ${logs?.length || 0} eventos para reprocessar`);

    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const log of logs || []) {
      try {
        const eventData = log.event_data as any;
        const eventType = eventData.type || log.event_type;
        
        // Filtrar apenas eventos de venda
        if (eventType !== 'invoice.payment_succeeded' && eventType !== 'NewSale') {
          continue;
        }
        
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

        // Extrair valor
        const amountCents = sale.invoice?.amount?.totalCents || sale.subscription?.lastInvoice?.amount?.totalCents || sale.amount || 0;
        const amount = typeof amountCents === 'number' ? amountCents / 100 : 0;

        // Extrair data da venda
        const saleDate = sale.invoice?.saleDate || sale.subscription?.lastInvoice?.saleDate || sale.created_at || new Date().toISOString();

        // ID da transação
        const hublaId = sale.invoice?.id || sale.subscription?.lastInvoice?.id || sale.id || sale.transaction_id || `reprocess-${log.id}`;

        console.log(`💰 Processando: ${productName} - ${customerName} - R$ ${amount.toFixed(2)}`);

        // Verificar se já existe
        const { data: existing } = await supabase
          .from('hubla_transactions')
          .select('id')
          .eq('hubla_id', hublaId)
          .single();

        if (existing) {
          console.log(`⏭️  Já processado: ${hublaId}`);
          skippedCount++;
          continue;
        }

        // Inserir em hubla_transactions
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
          console.error(`❌ Erro ao inserir transação ${hublaId}:`, insertError);
          errorCount++;
          continue;
        }

        // Se for curso, inserir também em a010_sales
        if (productCategory === 'curso') {
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
            console.error(`⚠️  Erro ao inserir A010 ${hublaId}:`, a010Error);
          } else {
            console.log(`✅ Venda A010 registrada!`);
          }
        }

        processedCount++;
        console.log(`✅ Processado: ${hublaId}`);

      } catch (error: any) {
        console.error(`❌ Erro ao processar log ${log.id}:`, error);
        errorCount++;
      }
    }

    const summary = {
      total: logs?.length || 0,
      processed: processedCount,
      skipped: skippedCount,
      errors: errorCount,
    };

    console.log('📊 Resumo do reprocessamento:', summary);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Reprocessamento concluído',
        summary,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('❌ Erro no reprocessamento:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
