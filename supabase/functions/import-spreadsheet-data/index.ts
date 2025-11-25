import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';
import * as xlsx from 'https://deno.land/x/sheetjs@v0.18.3/xlsx.mjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para converter data do Excel para Date
function excelDateToJSDate(serial: number): Date {
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate());
}

// Função para parsear valores brasileiros
function parseBRCurrency(value: string | number): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  
  const cleaned = value
    .toString()
    .replace(/R\$\s?/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  
  return parseFloat(cleaned) || 0;
}

// Função para parsear percentuais
function parsePercent(value: string | number): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  
  const cleaned = value.toString().replace('%', '').replace(',', '.');
  return parseFloat(cleaned) || 0;
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
      throw new Error('No file provided');
    }

    console.log('Processing file:', file.name);

    // Ler arquivo Excel
    const arrayBuffer = await file.arrayBuffer();
    const workbook = xlsx.read(new Uint8Array(arrayBuffer));

    const results = {
      metrics: 0,
      leads: 0,
      goals: 0,
      payments: 0,
      errors: [] as string[],
    };

    // Processar planilha de métricas
    if (workbook.SheetNames.includes('Métricas')) {
      const sheet = workbook.Sheets['Métricas'];
      const data = xlsx.utils.sheet_to_json(sheet);

      console.log(`Found ${data.length} metric rows`);

      for (const row of data) {
        try {
          const rowData = row as any;
          
          // Converter datas do Excel
          const startDate = typeof rowData['Data Início'] === 'number' 
            ? excelDateToJSDate(rowData['Data Início'])
            : new Date(rowData['Data Início']);
          
          const endDate = typeof rowData['Data Fim'] === 'number'
            ? excelDateToJSDate(rowData['Data Fim'])
            : new Date(rowData['Data Fim']);

          // Gerar week_label
          const formatDate = (date: Date) => {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
          };

          const week_label = `${formatDate(startDate)} - ${formatDate(endDate)}`;

          // Preparar dados
          const metricsData = {
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0],
            week_label,
            ads_cost: parseBRCurrency(rowData['Custo Ads']),
            team_cost: parseBRCurrency(rowData['Custo Equipe']),
            office_cost: parseBRCurrency(rowData['Custo Escritório']),
            a010_revenue: parseBRCurrency(rowData['Faturado A010']),
            a010_sales: parseInt(rowData['Vendas A010']) || 0,
            ob_construir_revenue: parseBRCurrency(rowData['OB Construir']),
            ob_construir_sales: parseInt(rowData['Vendas OB Construir']) || 0,
            ob_vitalicio_revenue: parseBRCurrency(rowData['OB Vitalício']),
            ob_vitalicio_sales: parseInt(rowData['Vendas OB Vitalício']) || 0,
            ob_evento_revenue: parseBRCurrency(rowData['OB Evento']),
            ob_evento_sales: parseInt(rowData['Vendas OB Evento']) || 0,
            contract_revenue: parseBRCurrency(rowData['Faturado Contrato']),
            contract_sales: parseInt(rowData['Vendas Contrato']) || 0,
            clint_revenue: parseBRCurrency(rowData['Faturamento Clint']),
            incorporador_50k: parseBRCurrency(rowData['Incorporador 50k']),
            sdr_ia_ig: parseInt(rowData['SDR IA+IG']) || 0,
            // Métricas calculadas
            roi: parsePercent(rowData['ROI %']),
            roas: parseFloat(rowData['ROAS']) || 0,
            cpl: parseBRCurrency(rowData['CPL']),
            cplr: parseBRCurrency(rowData['CPLR']),
            cir: parsePercent(rowData['CIR %']),
            // Funil
            stage_01_target: parseInt(rowData['Etapa 01 Meta']) || 0,
            stage_01_actual: parseInt(rowData['Etapa 01 Real']) || 0,
            stage_01_rate: parsePercent(rowData['Etapa 01 %']),
            stage_02_target: parseInt(rowData['Etapa 02 Meta']) || 0,
            stage_02_actual: parseInt(rowData['Etapa 02 Real']) || 0,
            stage_02_rate: parsePercent(rowData['Etapa 02 %']),
            stage_03_target: parseInt(rowData['Etapa 03 Meta']) || 0,
            stage_03_actual: parseInt(rowData['Etapa 03 Real']) || 0,
            stage_03_rate: parsePercent(rowData['Etapa 03 %']),
            stage_04_target: parseInt(rowData['Etapa 04 Meta']) || 0,
            stage_04_actual: parseInt(rowData['Etapa 04 Real']) || 0,
            stage_04_rate: parsePercent(rowData['Etapa 04 %']),
            stage_05_target: parseInt(rowData['Etapa 05 Meta']) || 0,
            stage_05_actual: parseInt(rowData['Etapa 05 Real']) || 0,
            stage_05_rate: parsePercent(rowData['Etapa 05 %']),
            stage_06_target: parseInt(rowData['Etapa 06 Meta']) || 0,
            stage_06_actual: parseInt(rowData['Etapa 06 Real']) || 0,
            stage_06_rate: parsePercent(rowData['Etapa 06 %']),
            stage_07_target: parseInt(rowData['Etapa 07 Meta']) || 0,
            stage_07_actual: parseInt(rowData['Etapa 07 Real']) || 0,
            stage_07_rate: parsePercent(rowData['Etapa 07 %']),
            stage_08_target: parseInt(rowData['Etapa 08 Meta']) || 0,
            stage_08_actual: parseInt(rowData['Etapa 08 Real']) || 0,
            stage_08_rate: parsePercent(rowData['Etapa 08 %']),
          };

          // Upsert (inserir ou atualizar)
          const { error } = await supabase
            .from('weekly_metrics')
            .upsert(metricsData, {
              onConflict: 'start_date,end_date',
            });

          if (error) throw error;
          results.metrics++;
        } catch (error) {
          console.error('Error processing metric row:', error);
          results.errors.push(`Metric row error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }

    // Processar outras abas conforme necessário
    // (leads, metas incorporador, consórcios, etc.)

    console.log('Import complete:', results);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Data imported successfully',
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in import-spreadsheet-data:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
