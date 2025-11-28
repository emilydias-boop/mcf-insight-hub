import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';

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
  return parseFloat(
    value.toString()
      .replace(/R\$\s?/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
  ) || 0;
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

    const fileBuffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(fileBuffer, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(worksheet);

    console.log(`📊 ${rows.length} linhas, iniciando da linha ${startRow}`);

    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const BATCH_SIZE = 50;
    const MAX_ROWS_PER_RUN = 200;
    const endRow = Math.min(startRow + MAX_ROWS_PER_RUN, rows.length);

    for (let i = startRow; i < endRow; i += BATCH_SIZE) {
      const batch = rows.slice(i, Math.min(i + BATCH_SIZE, endRow));
      const transactions = [];

      for (const row of batch) {
        try {
          const r = row as any;
          const hublaId = String(r['ID da fatura'] || r['id'] || '').trim();
          if (!hublaId) {
            skippedCount++;
            continue;
          }

          const productName = String(r['Nome do produto'] || r['product_name'] || 'Produto Desconhecido').trim();
          const productCode = r['Código do produto'] || r['product_code'];
          const productCategory = mapProductCategory(productName, productCode);
          const saleDate = parseDate(String(r['Data de pagamento'] || r['Data de reembolso'] || r['sale_date'] || ''));

          transactions.push({
            hubla_id: hublaId,
            product_name: productName,
            product_code: productCode || null,
            product_category: productCategory,
            product_price: parseBRNumber(r['Valor do produto'] || r['product_price'] || 0),
            product_type: r['Tipo do produto'] || r['product_type'] || null,
            customer_name: String(r['Nome do cliente'] || r['customer_name'] || '').trim() || null,
            customer_email: String(r['Email do cliente'] || r['customer_email'] || '').trim() || null,
            customer_phone: String(r['Telefone do cliente'] || r['customer_phone'] || '').trim() || null,
            utm_source: r['UTM Origem'] || r['utm_source'] || null,
            utm_medium: r['UTM Mídia'] || r['utm_medium'] || null,
            utm_campaign: r['UTM Campanha'] || r['utm_campaign'] || null,
            payment_method: r['Método de pagamento'] || r['payment_method'] || null,
            sale_date: saleDate,
            sale_status: fileType === 'sales' ? 'completed' : 'refunded',
            event_type: fileType === 'sales' ? 'invoice.payment_succeeded' : 'refund',
            raw_data: r,
          });
        } catch (error) {
          console.error(`❌ Erro ao processar linha:`, error);
          errorCount++;
        }
      }

      if (transactions.length > 0) {
        const { error } = await supabase
          .from('hubla_transactions')
          .upsert(transactions, { onConflict: 'hubla_id', ignoreDuplicates: true });

        if (error) {
          console.error('❌ Erro ao inserir lote:', error);
          errorCount += transactions.length;
        } else {
          processedCount += transactions.length;
        }
      }

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
            total_rows: rows.length,
            current_row: endRow,
            error_count: errorCount,
          }
        })
        .eq('id', jobId);

      console.log(`✅ ${endRow}/${rows.length} (${Math.round(endRow / rows.length * 100)}%)`);
    }

    const isComplete = endRow >= rows.length;

    if (isComplete) {
      await supabase
        .from('sync_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);
      console.log(`✅ Completo: ${processedCount} processados, ${skippedCount} ignorados, ${errorCount} erros`);
    } else {
      await supabase
        .from('sync_jobs')
        .update({ status: 'running' })
        .eq('id', jobId);
      console.log(`⏸️ Pausado em ${endRow}/${rows.length}`);
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
