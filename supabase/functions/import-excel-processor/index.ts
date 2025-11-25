import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WeeklyMetricRow {
  periodo?: string;
  inicio?: string;
  fim?: string;
  custo_ads?: number | string;
  custo_equipe?: number | string;
  custo_escritorio?: number | string;
  faturamento_a010?: number | string;
  vendas_a010?: number | string;
  faturamento_ob_evento?: number | string;
  vendas_ob_evento?: number | string;
  faturamento_contratos?: number | string;
  vendas_contratos?: number | string;
  faturamento_ob_construir?: number | string;
  vendas_ob_construir?: number | string;
  faturamento_ob_vitalicio?: number | string;
  vendas_ob_vitalicio?: number | string;
  roi?: number | string;
  roas?: number | string;
  cpl?: number | string;
  etapa_01?: number | string;
  etapa_02?: number | string;
  etapa_03?: number | string;
  etapa_04?: number | string;
  etapa_05?: number | string;
  etapa_06?: number | string;
  etapa_07?: number | string;
  etapa_08?: number | string;
}

// Parse número brasileiro (1.234,56 ou 1234.56)
function parseNumber(value: any): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  
  const str = String(value).trim();
  
  // Se contém vírgula como decimal (formato BR)
  if (str.includes(',')) {
    return parseFloat(str.replace(/\./g, '').replace(',', '.'));
  }
  
  // Formato US ou já é número
  return parseFloat(str.replace(/,/g, ''));
}

// Parse data do período (ex: "13/01/2025 a 19/01/2025")
function parsePeriod(periodo: string): { start: string; end: string; label: string } | null {
  if (!periodo) return null;
  
  const parts = periodo.split(' a ');
  if (parts.length !== 2) return null;
  
  const [startStr, endStr] = parts;
  
  try {
    // Formato DD/MM/YYYY para YYYY-MM-DD
    const [startDay, startMonth, startYear] = startStr.trim().split('/');
    const [endDay, endMonth, endYear] = endStr.trim().split('/');
    
    const start = `${startYear}-${startMonth.padStart(2, '0')}-${startDay.padStart(2, '0')}`;
    const end = `${endYear}-${endMonth.padStart(2, '0')}-${endDay.padStart(2, '0')}`;
    
    return {
      start,
      end,
      label: `Semana ${startDay}/${startMonth}`,
    };
  } catch (err) {
    console.error('Erro ao parsear período:', periodo, err);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { file, filename } = await req.json();

    if (!file) {
      throw new Error('Arquivo não fornecido');
    }

    console.log('Processando arquivo:', filename);

    // Decodificar base64
    const buffer = Uint8Array.from(atob(file), c => c.charCodeAt(0));
    
    // Ler Excel
    const workbook = XLSX.read(buffer, { type: 'array' });
    
    console.log('Abas encontradas:', workbook.SheetNames);

    let imported = 0;
    const errors: string[] = [];

    // Processar cada aba
    for (const sheetName of workbook.SheetNames) {
      console.log('Processando aba:', sheetName);
      
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { defval: null });
      
      console.log(`Aba ${sheetName}: ${data.length} linhas`);

      // Detectar tipo de dados pela aba ou colunas
      if (sheetName.toLowerCase().includes('métrica') || sheetName.toLowerCase().includes('metrica') || 
          sheetName.toLowerCase().includes('semana') || sheetName.toLowerCase().includes('roi')) {
        
        // Importar métricas semanais
        for (const row of data as WeeklyMetricRow[]) {
          try {
            // Buscar campo de período (pode ter nomes diferentes)
            const periodoValue = row.periodo || row.inicio || row['Período'] || row['PERÍODO'];
            
            if (!periodoValue) {
              console.log('Linha sem período, pulando:', row);
              continue;
            }

            const period = parsePeriod(String(periodoValue));
            if (!period) {
              errors.push(`Período inválido: ${periodoValue}`);
              continue;
            }

            const adsCost = parseNumber(row.custo_ads || row['Custo Ads'] || row['CUSTO ADS'] || 0);
            const teamCost = parseNumber(row.custo_equipe || row['Custo Equipe'] || row['CUSTO EQUIPE'] || 0);
            const officeCost = parseNumber(row.custo_escritorio || row['Custo Escritório'] || row['CUSTO ESCRITÓRIO'] || 0);
            const totalCost = adsCost + teamCost + officeCost;

            const metricsData = {
              start_date: period.start,
              end_date: period.end,
              week_label: period.label,
              
              // Custos
              ads_cost: adsCost,
              team_cost: teamCost,
              office_cost: officeCost,
              total_cost: totalCost,
              
              // Receitas A010
              a010_revenue: parseNumber(row.faturamento_a010 || row['Faturamento A010'] || 0),
              a010_sales: parseNumber(row.vendas_a010 || row['Vendas A010'] || 0),
              
              // OB Evento
              ob_evento_revenue: parseNumber(row.faturamento_ob_evento || row['Faturamento OB Evento'] || 0),
              ob_evento_sales: parseNumber(row.vendas_ob_evento || row['Vendas OB Evento'] || 0),
              
              // Contratos
              contract_revenue: parseNumber(row.faturamento_contratos || row['Faturamento Contratos'] || 0),
              contract_sales: parseNumber(row.vendas_contratos || row['Vendas Contratos'] || 0),
              
              // OB Construir
              ob_construir_revenue: parseNumber(row.faturamento_ob_construir || row['Faturamento OB Construir'] || 0),
              ob_construir_sales: parseNumber(row.vendas_ob_construir || row['Vendas OB Construir'] || 0),
              
              // OB Vitalício
              ob_vitalicio_revenue: parseNumber(row.faturamento_ob_vitalicio || row['Faturamento OB Vitalício'] || 0),
              ob_vitalicio_sales: parseNumber(row.vendas_ob_vitalicio || row['Vendas OB Vitalício'] || 0),
              
              // Métricas
              roi: parseNumber(row.roi || row['ROI'] || 0),
              roas: parseNumber(row.roas || row['ROAS'] || 0),
              cpl: parseNumber(row.cpl || row['CPL'] || 0),
              
              // Funil
              stage_01_actual: parseNumber(row.etapa_01 || row['Etapa 01'] || 0),
              stage_02_actual: parseNumber(row.etapa_02 || row['Etapa 02'] || 0),
              stage_03_actual: parseNumber(row.etapa_03 || row['Etapa 03'] || 0),
              stage_04_actual: parseNumber(row.etapa_04 || row['Etapa 04'] || 0),
              stage_05_actual: parseNumber(row.etapa_05 || row['Etapa 05'] || 0),
              stage_06_actual: parseNumber(row.etapa_06 || row['Etapa 06'] || 0),
              stage_07_actual: parseNumber(row.etapa_07 || row['Etapa 07'] || 0),
              stage_08_actual: parseNumber(row.etapa_08 || row['Etapa 08'] || 0),
            };

            const { error } = await supabase
              .from('weekly_metrics')
              .upsert(metricsData, { 
                onConflict: 'start_date',
                ignoreDuplicates: false 
              });

            if (error) {
              console.error('Erro ao inserir métrica:', error);
              errors.push(`Erro na linha ${period.label}: ${error.message}`);
            } else {
              imported++;
            }
          } catch (err: any) {
            console.error('Erro ao processar linha:', err);
            errors.push(`Erro: ${err.message}`);
          }
        }
      }
    }

    console.log(`Importação concluída: ${imported} registros, ${errors.length} erros`);

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
