import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";
import { parse } from "https://deno.land/std@0.224.0/csv/parse.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PRODUCT_MAPPING: Record<string, string> = {
  'A010': 'a010',
  'A010 - Incorporador': 'a010',
  'Contrato': 'contrato',
  'Contrato Individual': 'contrato',
  'Contrato Combo': 'contrato',
  'MCF Plano Anticrise': 'parceria',
  'MCF INCORPORADOR COMPLETO': 'parceria',
  'MCF Incorporador': 'parceria',
  'A001': 'parceria',
  'Renovação': 'renovacao',
  'Renovação Anual': 'renovacao',
  'Captação': 'captacao',
  'Captação de Recursos': 'captacao',
  'P2': 'p2',
  'P2 - Mercado Primário': 'p2',
  'Formação': 'formacao',
  'Formação de Corretores': 'formacao',
  'Projetos': 'projetos',
  'Desenvolvimento de Projetos': 'projetos',
  'Efeito Alavanca': 'efeito_alavanca',
  'EA': 'efeito_alavanca',
  'Mentoria Caixa': 'mentoria_caixa',
  'Mentoria Caixa Individual': 'mentoria_caixa',
  'Mentoria Grupo Caixa': 'mentoria_grupo_caixa',
  'MGC': 'mentoria_grupo_caixa',
  'Sócios': 'socios',
  'Programa Sócios': 'socios',
  'Clube Arremate': 'clube_arremate',
  'CA': 'clube_arremate',
  'Imersão': 'imersao',
  'Imersão Presencial': 'imersao',
  'Imersão Sócios': 'imersao_socios',
  'IS': 'imersao_socios',
  'Viver de Aluguel': 'ob_construir_alugar',
  'Como Viver de Aluguel': 'ob_construir_alugar',
  'OB - CONSTRUIR (Viver de Aluguel)': 'ob_construir_alugar',
  'Gestão de Obras': 'ob_construir_gestao_obras',
  'OB - CONSTRUIR (Gestão de Obras)': 'ob_construir_gestao_obras',
  'OB - EVENTO': 'ob_evento',
  'Evento OB': 'ob_evento',
  'OB - VITALÍCIO': 'ob_vitalicio',
  'Vitalício': 'ob_vitalicio',
  'outros': 'outros',
};

function mapProductCategory(productName: string, productCode?: string): string {
  const name = productName.toUpperCase();
  if (productCode && PRODUCT_MAPPING[productCode.toUpperCase()]) {
    return PRODUCT_MAPPING[productCode.toUpperCase()];
  }
  if (PRODUCT_MAPPING[name]) {
    return PRODUCT_MAPPING[name];
  }
  for (const [key, category] of Object.entries(PRODUCT_MAPPING)) {
    if (name.includes(key)) {
      return category;
    }
  }
  return 'outros';
}

function parseDate(dateStr: string): string {
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
  
  const str = value.toString().replace(/R\$\s?/g, '').trim();
  
  // Detectar formato: BR (vírgula decimal) vs US (ponto decimal)
  const hasComma = str.includes(',');
  const hasDot = str.includes('.');
  
  if (hasComma && hasDot) {
    // Formato brasileiro: 1.234,56 → remove pontos, troca vírgula por ponto
    return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
  } else if (hasComma && !hasDot) {
    // Formato brasileiro sem milhar: 1234,56 → troca vírgula por ponto
    return parseFloat(str.replace(',', '.')) || 0;
  } else {
    // Formato americano ou inteiro: 1234.56 ou 1234 → usa direto
    return parseFloat(str) || 0;
  }
}

async function processHublaFile(
  supabase: any,
  jobId: string,
  filePath: string,
  fileType: string,
  startRow: number = 0
) {
  try {
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('csv-imports')
      .download(filePath);

    if (downloadError) throw downloadError;

    console.log(`📂 Lendo arquivo CSV...`);

    const text = await fileData.text();
    const allData = parse(text, {
      skipFirstRow: false,
    }) as string[][];
    
    const headers = allData[0];
    const dataRows = allData.slice(1);
    const totalRows = dataRows.length;
    
    console.log(`📊 ${totalRows} linhas de dados, iniciando da linha ${startRow}`);

    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const BATCH_SIZE = 25;
    const MAX_ROWS_PER_RUN = 100;
    const endRow = Math.min(startRow + MAX_ROWS_PER_RUN, totalRows);
    
    const transactions: any[] = [];

    // Processar linhas do range especificado
    for (let i = startRow; i < endRow && i < dataRows.length; i++) {
      try {
        const row = dataRows[i];
        
        // Converter array em objeto usando headers
        const rowData: any = {};
        headers.forEach((header, idx) => {
          rowData[header] = row[idx];
        });

        const hublaId = String(rowData['ID da fatura'] || rowData['id'] || '').trim();
        if (!hublaId) {
          skippedCount++;
          continue;
        }

        const productName = String(rowData['Nome do produto'] || rowData['product_name'] || 'Produto Desconhecido').trim();
        const productCode = rowData['Código do produto'] || rowData['product_code'];
        const productCategory = mapProductCategory(productName, productCode);
        const saleDate = parseDate(String(rowData['Data de pagamento'] || rowData['Data de reembolso'] || rowData['sale_date'] || ''));

        transactions.push({
          hubla_id: hublaId,
          product_name: productName,
          product_code: productCode || null,
          product_category: productCategory,
          product_price: parseBRNumber(rowData['Valor do produto'] || rowData['product_price'] || 0),
          product_type: rowData['Tipo do produto'] || rowData['product_type'] || null,
          customer_name: String(rowData['Nome do cliente'] || rowData['customer_name'] || '').trim() || null,
          customer_email: String(rowData['Email do cliente'] || rowData['customer_email'] || '').trim() || null,
          customer_phone: String(rowData['Telefone do cliente'] || rowData['customer_phone'] || '').trim() || null,
          utm_source: rowData['UTM Origem'] || rowData['utm_source'] || null,
          utm_medium: rowData['UTM Mídia'] || rowData['utm_medium'] || null,
          utm_campaign: rowData['UTM Campanha'] || rowData['utm_campaign'] || null,
          payment_method: rowData['Método de pagamento'] || rowData['payment_method'] || null,
          sale_date: saleDate,
          sale_status: fileType === 'sales' ? 'completed' : 'refunded',
          event_type: fileType === 'sales' ? 'invoice.payment_succeeded' : 'refund',
          raw_data: rowData,
        });
      } catch (error) {
        console.error(`❌ Erro ao processar linha ${i + 2}:`, error);
        errorCount++;
      }
    }

    processedCount = transactions.length;

    // Inserir transações no banco
    if (transactions.length > 0) {
      const { error } = await supabase
        .from('hubla_transactions')
        .upsert(transactions, { onConflict: 'hubla_id', ignoreDuplicates: true });

      if (error) {
        console.error('❌ Erro ao inserir lote:', error);
        errorCount += transactions.length;
      }
    }

    // Atualizar progresso
    await supabase
      .from('sync_jobs')
      .update({
        total_processed: processedCount,
        total_skipped: skippedCount,
        last_page: endRow,
        updated_at: new Date().toISOString(),
        metadata: {
          file_path: filePath,
          file_type: fileType,
          total_rows: totalRows,
          current_row: endRow,
          error_count: errorCount,
        }
      })
      .eq('id', jobId);

    console.log(`✅ ${endRow}/${totalRows} (${Math.round(endRow / totalRows * 100)}%)`);

    const isComplete = endRow >= totalRows;

    if (isComplete) {
      await supabase
        .from('sync_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);
      console.log(`✅ Completo: ${processedCount} processados, ${skippedCount} ignorados, ${errorCount} erros`);
      
      // Recalcular métricas para todas as semanas do período importado
      console.log('📊 Iniciando recálculo automático de métricas...');
      const { data: importedDates } = await supabase
        .from('hubla_transactions')
        .select('sale_date')
        .order('sale_date', { ascending: true });
      
      if (importedDates && importedDates.length > 0) {
        const minDate = new Date(importedDates[0].sale_date);
        const maxDate = new Date(importedDates[importedDates.length - 1].sale_date);
        
        supabase.functions.invoke('recalculate-metrics', {
          body: {
            start_date: minDate.toISOString().split('T')[0],
            end_date: maxDate.toISOString().split('T')[0],
          },
        }).then(({ error }: any) => {
          if (error) console.error('⚠️ Erro ao recalcular métricas:', error);
          else console.log('✅ Recálculo de métricas concluído');
        });
      }
    } else {
      await supabase
        .from('sync_jobs')
        .update({ status: 'running' })
        .eq('id', jobId);
      console.log(`⏸️ Pausado em ${endRow}/${totalRows}`);
    }

  } catch (error: any) {
    console.error('❌ Erro:', error);
    await supabase
      .from('sync_jobs')
      .update({
        status: 'error',
        error_message: error.message,
      })
      .eq('id', jobId);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const url = new URL(req.url);
    const jobId = url.searchParams.get('jobId');

    // Continue existing job
    if (jobId) {
      const { data: job } = await supabase
        .from('sync_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (!job) throw new Error('Job não encontrado');

      if (job.status === 'completed') {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Importação já concluída',
            jobId,
            isComplete: true,
            processedCount: job.total_processed,
            skippedCount: job.total_skipped,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const metadata = job.metadata as any;
      const startRow = job.last_page || 0;
      
      await processHublaFile(supabase, jobId, metadata.file_path, metadata.file_type, startRow);

      // Re-fetch job to get updated status
      const { data: updatedJob } = await supabase
        .from('sync_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Chunk processado',
          jobId,
          progress: updatedJob?.last_page || 0,
          totalRows: metadata.total_rows,
          isComplete: updatedJob?.status === 'completed',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // New import
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const fileType = formData.get('fileType') as string;

    if (!file) throw new Error('Nenhum arquivo fornecido');
    if (!['sales', 'refunds'].includes(fileType)) throw new Error('Tipo de arquivo inválido');

    console.log(`📂 Iniciando: ${file.name} (${fileType})`);

    const fileName = `hubla-import-${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('csv-imports')
      .upload(fileName, file, { contentType: file.type, upsert: false });

    if (uploadError) throw uploadError;

    const { data: job, error: jobError } = await supabase
      .from('sync_jobs')
      .insert({
        job_type: 'hubla_import',
        status: 'running',
        started_at: new Date().toISOString(),
        metadata: { file_path: fileName, file_type: fileType, file_name: file.name },
      })
      .select()
      .single();

    if (jobError) throw jobError;

    await processHublaFile(supabase, job.id, fileName, fileType, 0);

    // Re-fetch job to get updated status
    const { data: updatedJob } = await supabase
      .from('sync_jobs')
      .select('*')
      .eq('id', job.id)
      .single();

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Primeiro chunk processado', 
        jobId: job.id,
        isComplete: updatedJob?.status === 'completed',
        progress: updatedJob?.last_page || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
