import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface A010SaleData {
  sale_date: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  net_value: number | string;
  status?: string;
}

function parseBrazilianCurrency(value: number | string): number {
  if (typeof value === 'number') return value;
  
  // Remove R$, espaços e converte vírgula para ponto
  const cleaned = value
    .replace(/R\$\s?/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  
  return parseFloat(cleaned) || 0;
}

function parseBrazilianDate(dateStr: string): string {
  // Se já está no formato YYYY-MM-DD, retorna
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return dateStr.split('T')[0];
  }
  
  // Parse DD/MM/YYYY
  const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }
  
  // Fallback para hoje
  return new Date().toISOString().split('T')[0];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const data: A010SaleData = await req.json();

    console.log('📥 Received A010 sale data:', data);

    // Validação básica
    if (!data.sale_date || !data.customer_name) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: sale_date and customer_name' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse e prepare os dados
    const saleData = {
      sale_date: parseBrazilianDate(data.sale_date),
      customer_name: data.customer_name,
      customer_email: data.customer_email || null,
      customer_phone: data.customer_phone || null,
      net_value: parseBrazilianCurrency(data.net_value),
      status: data.status || 'completed',
    };

    console.log('💾 Inserting sale:', saleData);

    // Inserir na tabela a010_sales
    const { data: insertedSale, error: insertError } = await supabase
      .from('a010_sales')
      .insert(saleData)
      .select()
      .single();

    if (insertError) {
      console.error('❌ Error inserting sale:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Sale created successfully:', insertedSale.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sale_id: insertedSale.id,
        data: insertedSale
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
