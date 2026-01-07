import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.83.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SpreadsheetData {
  date: string;
  product: string;
  customer: string;
  email: string;
  phone: string;
  installment: number;
  grossValue: number;
  netValue: number;
}

interface Correction {
  type: 'missing' | 'divergent';
  spreadsheet: SpreadsheetData;
  database: {
    hubla_id: string;
    product_name: string;
    product_price: number;
    net_value: number;
    customer_name: string;
    customer_email: string;
    sale_date: string;
  } | null;
}

// Map product names to categories
function mapProductCategory(productName: string): string {
  const name = productName?.toUpperCase() || '';
  
  if (name.includes('A010')) return 'a010';
  if (name.includes('A009') || name.includes('A001') || name.includes('A002') || 
      name.includes('A003') || name.includes('A004') || name.includes('A005') ||
      name.includes('A008') || name.includes('MCF')) return 'incorporador';
  if (name.includes('A000') || name.includes('CONTRATO')) return 'incorporador';
  if (name.includes('A006') || name.includes('RENOVAÇÃO')) return 'renovacao';
  
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
    const { corrections } = await req.json() as { corrections: Correction[] };
    
    console.log(`📊 Recebidas ${corrections.length} correções para aplicar`);
    
    let applied = 0;
    let errors = 0;
    const errorMessages: string[] = [];

    for (const correction of corrections) {
      try {
        if (correction.type === 'missing') {
          // Insert missing transaction
          const hublaId = `manual-audit-${correction.spreadsheet.email}-${correction.spreadsheet.date}-${Date.now()}`;
          
          const transactionData = {
            hubla_id: hublaId,
            event_type: 'manual_audit',
            product_name: correction.spreadsheet.product,
            product_category: mapProductCategory(correction.spreadsheet.product),
            product_price: correction.spreadsheet.grossValue,
            net_value: correction.spreadsheet.netValue,
            customer_name: correction.spreadsheet.customer,
            customer_email: correction.spreadsheet.email,
            customer_phone: correction.spreadsheet.phone,
            sale_date: correction.spreadsheet.date,
            sale_status: 'completed',
            installment_number: correction.spreadsheet.installment,
            total_installments: 1,
            source: 'audit_correction',
            count_in_dashboard: correction.spreadsheet.netValue > 0,
          };
          
          const { error } = await supabase
            .from('hubla_transactions')
            .insert(transactionData);
          
          if (error) {
            console.error(`❌ Erro ao inserir transação: ${error.message}`);
            errors++;
            errorMessages.push(`${correction.spreadsheet.customer}: ${error.message}`);
          } else {
            console.log(`✅ Transação inserida: ${correction.spreadsheet.customer}`);
            applied++;
          }
          
        } else if (correction.type === 'divergent' && correction.database) {
          // Update divergent transaction
          const { error } = await supabase
            .from('hubla_transactions')
            .update({
              product_price: correction.spreadsheet.grossValue,
              net_value: correction.spreadsheet.netValue,
              source: 'audit_correction',
            })
            .eq('hubla_id', correction.database.hubla_id);
          
          if (error) {
            console.error(`❌ Erro ao atualizar transação: ${error.message}`);
            errors++;
            errorMessages.push(`${correction.spreadsheet.customer}: ${error.message}`);
          } else {
            console.log(`✅ Transação atualizada: ${correction.spreadsheet.customer}`);
            applied++;
          }
        }
      } catch (err: any) {
        console.error(`❌ Erro ao processar correção:`, err);
        errors++;
        errorMessages.push(`${correction.spreadsheet.customer}: ${err.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        applied,
        errors,
        errorMessages: errorMessages.slice(0, 10), // Limit to first 10 errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro fatal:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
