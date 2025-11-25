import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';
import * as xlsx from 'https://deno.land/x/sheetjs@v0.18.3/xlsx.mjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para converter data do Excel para Date
function excelDateToJSDate(serial: number | string): Date {
  // Se for string no formato DD/MM/YYYY
  if (typeof serial === 'string') {
    const parts = serial.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1; // JS months are 0-indexed
      const year = parseInt(parts[2]);
      return new Date(year, month, day);
    }
  }
  
  // Se for número (serial do Excel)
  if (typeof serial === 'number') {
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate());
  }
  
  // Fallback: tentar criar Date diretamente
  return new Date(serial);
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
    if (workbook.SheetNames.includes('Resultados Semanais')) {
      const sheet = workbook.Sheets['Resultados Semanais'];
      const data = xlsx.utils.sheet_to_json(sheet);

      console.log(`Found ${data.length} metric rows`);

      for (const row of data) {
        try {
          const rowData = row as any;
          
          // Converter datas do Excel
          const startDate = excelDateToJSDate(rowData['Data Inicio']);
          const endDate = excelDateToJSDate(rowData['Data Fim']);

          // Gerar week_label
          const formatDate = (date: Date) => {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
          };

          const week_label = `${formatDate(startDate)} - ${formatDate(endDate)}`;

          // Preparar dados com mapeamento CORRETO das colunas da planilha
          const metricsData = {
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0],
            week_label,
            // Custos
            ads_cost: parseBRCurrency(rowData['Custo Ads (MAKE)']),
            team_cost: parseBRCurrency(rowData['Custo Equipe (PLANILHA MANUAL)']),
            office_cost: parseBRCurrency(rowData['Custo Escritório (PLANILHA MANUAL)']),
            // A010
            a010_revenue: parseBRCurrency(rowData['Faturado Curso A010']),
            a010_sales: parseInt(rowData['Vendas A010']) || 0,
            sdr_ia_ig: parseInt(rowData['SDR IA+IG']) || 0,
            // Order Bumps
            ob_construir_revenue: parseBRCurrency(rowData['Faturado Order Bump Construir Para Alugar']),
            ob_construir_sales: parseInt(rowData['Vendas OB Construir Para alugar']) || 0,
            ob_vitalicio_revenue: parseBRCurrency(rowData['Faturado Order Bump Acesso Vitalício']),
            ob_vitalicio_sales: parseInt(rowData['Vendas Acesso Vitalício']) || 0,
            ob_evento_revenue: parseBRCurrency(rowData['Valor Vendido OB Evento']),
            ob_evento_sales: parseInt(rowData['Vendas OB Evento']) || 0,
            // Contrato
            contract_revenue: parseBRCurrency(rowData['Faturado Contrato']),
            contract_sales: parseInt(rowData['Vendas Contrato']) || 0,
            // Clint e Incorporador
            clint_revenue: parseBRCurrency(rowData['Faturamento Clint']),
            incorporador_50k: parseBRCurrency(rowData['Faturamento Incorporador 50k']),
            // Ultrametas
            ultrameta_clint: parseBRCurrency(rowData['Ultrameta Clint']),
            ultrameta_liquido: parseBRCurrency(rowData['Ultra Meta Líquido']),
            // Campos calculados da planilha
            total_revenue: parseBRCurrency(rowData['Faturamento Total']),
            operating_cost: parseBRCurrency(rowData['Custo Total']),
            operating_profit: parseBRCurrency(rowData['Lucro Operacional']),
            real_cost: parseBRCurrency(rowData['Custo Real Por Semana (ADS - (A010+BIM))']),
            // Métricas calculadas
            roi: parsePercent(rowData['ROI']),
            roas: parseFloat(rowData['ROAS']) || 0,
            cpl: parseBRCurrency(rowData['CPL']),
            cplr: parseBRCurrency(rowData['CPLR']),
            cir: parsePercent(rowData['CIR']),
            // Funil - Etapas com nomes CORRETOS da planilha
            stage_01_target: parseInt(rowData['Meta Etapa 01']) || 0,
            stage_01_actual: parseInt(rowData['Etapa 01 - Novo Lead']) || 0,
            stage_01_rate: 0, // Não tem % para etapa 01
            stage_02_target: 0,
            stage_02_actual: 0,
            stage_02_rate: 0,
            stage_03_target: parseInt(rowData['Meta Etapa 03']) || 0,
            stage_03_actual: parseInt(rowData['Etapa 03 - Reunião 01 Agendada']) || 0,
            stage_03_rate: parsePercent(rowData['%Etapa 03']),
            stage_04_target: parseInt(rowData['Meta Etapa 04']) || 0,
            stage_04_actual: parseInt(rowData['Etapa 04 - Reunião 01 Realizada']) || 0,
            stage_04_rate: parsePercent(rowData['%Etapa 04']),
            stage_05_target: parseInt(rowData['Meta Etapa 05']) || 0,
            stage_05_actual: parseInt(rowData['Etapa 05 - Contrato Pago']) || 0,
            stage_05_rate: parsePercent(rowData['%Etapa 05']),
            stage_06_target: 0,
            stage_06_actual: parseInt(rowData['Etapa 06 - Reunião 02 Realizada']) || 0,
            stage_06_rate: parsePercent(rowData['%Etapa 06']),
            stage_07_target: 0,
            stage_07_actual: parseInt(rowData['Etapa 07 - Reunião 03 Realizada']) || 0,
            stage_07_rate: parsePercent(rowData['%Etapa 07']),
            stage_08_target: 0,
            stage_08_actual: parseInt(rowData['Etapa 08 - Venda Realizada']) || 0,
            stage_08_rate: parsePercent(rowData['%Etapa 08']),
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
