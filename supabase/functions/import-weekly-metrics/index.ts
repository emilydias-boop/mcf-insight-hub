import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para converter data do formato DD/MM/YYYY
function parseDate(dateStr: string): string {
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const year = parseInt(parts[2]);
    const date = new Date(year, month, day);
    return date.toISOString().split('T')[0];
  }
  throw new Error(`Invalid date format: ${dateStr}`);
}

// Função para parsear valores brasileiros
function parseBRCurrency(value: string): number {
  if (!value) return 0;
  const cleaned = value
    .replace(/R\$\s?/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  return parseFloat(cleaned) || 0;
}

// Função para parsear percentuais
function parsePercent(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace('%', '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

// Função para processar CSV linha por linha
async function processCSVStream(fileText: string, supabase: any) {
  const lines = fileText.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    throw new Error('CSV vazio ou sem dados');
  }

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  console.log('Headers:', headers);

  let processed = 0;
  let errors = 0;
  const BATCH_SIZE = 10;
  let batch: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    try {
      const values = parseCSVLine(lines[i]);
      const row: any = {};
      
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });

      const metric = {
        start_date: parseDate(row['Data Inicio']),
        end_date: parseDate(row['Data Fim']),
        week_label: `${row['Data Inicio']} - ${row['Data Fim']}`,
        ads_cost: parseBRCurrency(row['Custo Ads (MAKE)']),
        team_cost: parseBRCurrency(row['Custo Equipe (PLANILHA MANUAL)']),
        office_cost: parseBRCurrency(row['Custo Escritório (PLANILHA MANUAL)']),
        a010_revenue: parseBRCurrency(row['Faturado Curso A010']),
        a010_sales: parseInt(row['Vendas A010']) || 0,
        sdr_ia_ig: parseInt(row['SDR IA+IG']) || 0,
        ob_construir_revenue: parseBRCurrency(row['Faturado Order Bump Construir Para Alugar']),
        ob_construir_sales: parseInt(row['Vendas OB Construir Para alugar']) || 0,
        ob_vitalicio_revenue: parseBRCurrency(row['Faturado Order Bump Acesso Vitalício']),
        ob_vitalicio_sales: parseInt(row['Vendas Acesso Vitalício']) || 0,
        ob_evento_revenue: parseBRCurrency(row['Valor Vendido OB Evento']),
        ob_evento_sales: parseInt(row['Vendas OB Evento']) || 0,
        contract_revenue: parseBRCurrency(row['Faturado Contrato']),
        contract_sales: parseInt(row['Vendas Contrato']) || 0,
        clint_revenue: parseBRCurrency(row['Faturamento Clint']),
        incorporador_50k: parseBRCurrency(row['Faturamento Incorporador 50k']),
        ultrameta_clint: parseBRCurrency(row['Ultrameta Clint']),
        ultrameta_liquido: parseBRCurrency(row['Ultra Meta Líquido']),
        total_revenue: parseBRCurrency(row['Faturamento Total']),
        operating_cost: parseBRCurrency(row['Custo Total']),
        operating_profit: parseBRCurrency(row['Lucro Operacional']),
        real_cost: parseBRCurrency(row['Custo Real Por Semana (ADS - (A010+BIM))']),
        roi: parsePercent(row['ROI']),
        roas: parseFloat(row['ROAS']) || 0,
        cpl: parseBRCurrency(row['CPL']),
        cplr: parseBRCurrency(row['CPLR']),
        cir: parsePercent(row['CIR']),
        stage_01_target: parseInt(row['Meta Etapa 01']) || 0,
        stage_01_actual: parseInt(row['Etapa 01 - Novo Lead']) || 0,
        stage_01_rate: 0,
        stage_02_target: 0,
        stage_02_actual: 0,
        stage_02_rate: 0,
        stage_03_target: parseInt(row['Meta Etapa 03']) || 0,
        stage_03_actual: parseInt(row['Etapa 03 - Reunião 01 Agendada']) || 0,
        stage_03_rate: parsePercent(row['%Etapa 03']),
        stage_04_target: parseInt(row['Meta Etapa 04']) || 0,
        stage_04_actual: parseInt(row['Etapa 04 - Reunião 01 Realizada']) || 0,
        stage_04_rate: parsePercent(row['%Etapa 04']),
        stage_05_target: parseInt(row['Meta Etapa 05']) || 0,
        stage_05_actual: parseInt(row['Etapa 05 - Contrato Pago']) || 0,
        stage_05_rate: parsePercent(row['%Etapa 05']),
        stage_06_target: 0,
        stage_06_actual: parseInt(row['Etapa 06 - Reunião 02 Realizada']) || 0,
        stage_06_rate: parsePercent(row['%Etapa 06']),
        stage_07_target: 0,
        stage_07_actual: parseInt(row['Etapa 07 - Reunião 03 Realizada']) || 0,
        stage_07_rate: parsePercent(row['%Etapa 07']),
        stage_08_target: 0,
        stage_08_actual: parseInt(row['Etapa 08 - Venda Realizada']) || 0,
        stage_08_rate: parsePercent(row['%Etapa 08']),
      };

      batch.push(metric);

      if (batch.length >= BATCH_SIZE) {
        const { error } = await supabase
          .from('weekly_metrics')
          .upsert(batch, { onConflict: 'start_date,end_date' });

        if (error) {
          console.error('Batch insert error:', error);
          errors += batch.length;
        } else {
          processed += batch.length;
          console.log(`Processed ${processed} rows`);
        }
        
        batch = [];
      }
    } catch (error) {
      console.error(`Error processing line ${i}:`, error);
      errors++;
    }
  }

  // Insert remaining batch
  if (batch.length > 0) {
    const { error } = await supabase
      .from('weekly_metrics')
      .upsert(batch, { onConflict: 'start_date,end_date' });

    if (error) {
      console.error('Final batch error:', error);
      errors += batch.length;
    } else {
      processed += batch.length;
    }
  }

  return { processed, errors };
}

// Função para parsear linha CSV respeitando aspas
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      throw new Error('Nenhum arquivo fornecido');
    }

    if (!file.name.endsWith('.csv')) {
      throw new Error('Apenas arquivos CSV são aceitos');
    }

    console.log('Processing CSV file:', file.name, 'Size:', file.size, 'bytes');

    const text = await file.text();
    const result = await processCSVStream(text, supabase);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Importação concluída: ${result.processed} registros processados`,
        processed: result.processed,
        errors: result.errors,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        success: false,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
