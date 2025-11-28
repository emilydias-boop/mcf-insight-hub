import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapeamento completo de 19 categorias
const PRODUCT_MAPPING: Record<string, string> = {
  // A010 - Construa para Vender
  'A010': 'a010',
  'CONSTRUA PARA VENDER': 'a010',
  'CONSULTORIA': 'a010',
  
  // Captação
  'A011': 'captacao',
  'CAPTAÇÃO': 'captacao',
  
  // Contrato
  'A000': 'contrato',
  'CONTRATO - ANTICRISE': 'contrato',
  
  // Parceria (MCF Completo)
  'A003': 'parceria',
  'A004': 'parceria',
  'A009': 'parceria',
  'A001': 'parceria',
  'MCF INCORPORADOR COMPLETO': 'parceria',
  'MCF PLANO ANTICRISE': 'parceria',
  
  // P2 (pagamento parcelado)
  'A005': 'p2',
  'MCF P2': 'p2',
  
  // Renovação
  'A006': 'renovacao',
  'RENOVAÇÃO': 'renovacao',
  
  // Formação
  'A015': 'formacao',
  'FORMAÇÃO INCORPORADOR': 'formacao',
  
  // Projetos
  'MCF PROJETOS': 'projetos',
  
  // Efeito Alavanca
  'EFEITO ALAVANCA': 'efeito_alavanca',
  
  // Mentoria Caixa
  'MENTORIA INDIVIDUAL': 'mentoria_caixa',
  'CREDENCIAMENTO CAIXA': 'mentoria_caixa',
  
  // Mentoria em Grupo
  'MENTORIA EM GRUPO': 'mentoria_grupo_caixa',
  
  // Sócios
  'SÓCIO MCF': 'socios',
  
  // OB Construir para Alugar
  'CONSTRUIR PARA ALUGAR': 'ob_construir_alugar',
  'CONSTRUIR PRA ALUGAR': 'ob_construir_alugar',
  'VIVER DE ALUGUEL': 'ob_construir_alugar',
  
  // OB Vitalício
  'ACESSO VITALÍCIO': 'ob_vitalicio',
  'ACESSO VITALICÍO': 'ob_vitalicio',
  'OB - ACESSO VITALÍCIO': 'ob_vitalicio',
  
  // OB Evento
  'OB - EVENTO': 'ob_evento',
  
  // Clube do Arremate
  'CLUBE DO ARREMATE': 'clube_arremate',
  'CONTRATO - CLUBE DO ARREMATE': 'clube_arremate',
  
  // Imersão
  'IMERSÃO PRESENCIAL': 'imersao',
  
  // Imersão Sócios
  'IMERSÃO SÓCIOS': 'imersao_socios',
};

function mapProductCategory(productName: string, productCode?: string): string {
  const name = productName.toUpperCase();
  
  // Tentar mapear por código exato primeiro
  if (productCode && PRODUCT_MAPPING[productCode.toUpperCase()]) {
    return PRODUCT_MAPPING[productCode.toUpperCase()];
  }
  
  // Tentar mapear por nome completo
  if (PRODUCT_MAPPING[name]) {
    return PRODUCT_MAPPING[name];
  }
  
  // Tentar mapear por nome parcial
  for (const [key, category] of Object.entries(PRODUCT_MAPPING)) {
    if (name.includes(key)) {
      return category;
    }
  }
  
  return 'outros';
}

function parseDate(dateStr: string): string {
  // Formato esperado: DD/MM/YYYY HH:MM:SS ou DD/MM/YYYY
  const parts = dateStr.split(' ')[0].split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00Z`;
  }
  return new Date().toISOString();
}

function parseBRNumber(value: string | number): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  
  // Remove "R$", espaços, e converte vírgula para ponto
  return parseFloat(
    value.toString()
      .replace(/R\$\s?/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
  ) || 0;
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
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const fileType = formData.get('type') as string; // 'sales' ou 'refunds'

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'Arquivo não fornecido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📂 Processando arquivo: ${file.name} (${fileType})`);

    // Ler arquivo Excel/CSV
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet) as any[];

    console.log(`📊 ${rows.length} linhas encontradas`);

    let processed = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Processar em lotes de 100
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      
      const transactions = batch.map(row => {
        try {
          const hublaId = row['ID da fatura']?.toString() || `${Date.now()}-${Math.random()}`;
          const productName = row['Nome do produto'] || 'Produto Desconhecido';
          const productCode = row['Código do produto'];
          const productCategory = mapProductCategory(productName, productCode);
          
          // Data de pagamento ou reembolso
          const dateField = fileType === 'refunds' ? 'Data de reembolso' : 'Data de pagamento';
          const saleDate = parseDate(row[dateField] || row['Data de pagamento']);
          
          // Valor
          const productPrice = parseBRNumber(row['Valor do produto'] || row['Valor'] || 0);
          
          // Dados do cliente
          const customerName = row['Nome do cliente'] || 'Cliente Hubla';
          const customerEmail = row['Email do cliente'];
          const customerPhone = row['Telefone do cliente'];
          
          // UTMs
          const utmSource = row['UTM Origem'];
          const utmMedium = row['UTM Mídia'];
          const utmCampaign = row['UTM Campanha'];
          
          // Método de pagamento
          const paymentMethod = row['Método de pagamento'];
          
          // Status e tipo de evento
          const saleStatus = fileType === 'refunds' ? 'refunded' : 'completed';
          const eventType = fileType === 'refunds' ? 'invoice.refunded' : 'invoice.payment_succeeded';
          
          return {
            hubla_id: hublaId,
            event_type: eventType,
            product_name: productName,
            product_code: productCode,
            product_category: productCategory,
            product_price: productPrice,
            customer_name: customerName,
            customer_email: customerEmail,
            customer_phone: customerPhone,
            sale_status: saleStatus,
            payment_method: paymentMethod,
            sale_date: saleDate,
            utm_source: utmSource,
            utm_medium: utmMedium,
            utm_campaign: utmCampaign,
            raw_data: row,
          };
        } catch (error: any) {
          console.error('❌ Erro ao processar linha:', error);
          errors.push(`Linha ${i}: ${error?.message || 'Unknown error'}`);
          return null;
        }
      }).filter(Boolean);

      // Inserir lote (ignorar duplicatas)
      const { data, error } = await supabase
        .from('hubla_transactions')
        .upsert(transactions, { 
          onConflict: 'hubla_id',
          ignoreDuplicates: true 
        });

      if (error) {
        console.error('❌ Erro ao inserir lote:', error);
        errors.push(`Lote ${i}-${i + 100}: ${error.message}`);
      } else {
        processed += transactions.length;
      }

      console.log(`✅ Processado lote ${i}-${i + 100}: ${transactions.length} transações`);
    }

    console.log(`\n📈 Resumo da importação:`);
    console.log(`   ✅ Processadas: ${processed}`);
    console.log(`   ⏭️  Ignoradas (duplicatas): ${skipped}`);
    console.log(`   ❌ Erros: ${errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        skipped,
        errors: errors.length > 0 ? errors : undefined,
        message: `${processed} transações importadas com sucesso`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro na importação:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});