import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MakeOBConstruirPayload {
  data: string;
  nome: string;
  email: string;
  telefone?: string;
  valor_liquido: string | number;
  valor_bruto?: string | number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body: MakeOBConstruirPayload = await req.json();
    console.log('Received OB Construir payload from Make:', JSON.stringify(body));

    // Validate required fields
    if (!body.data || !body.nome || !body.email || body.valor_liquido === undefined) {
      console.error('Missing required fields:', { 
        hasData: !!body.data, 
        hasNome: !!body.nome, 
        hasEmail: !!body.email, 
        hasValorLiquido: body.valor_liquido !== undefined 
      });
      return new Response(
        JSON.stringify({ error: 'Missing required fields: data, nome, email, valor_liquido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse monetary value
    const parseMonetaryValue = (value: string | number): number => {
      if (typeof value === 'number') return value;
      const cleaned = value
        .replace(/[R$\s]/g, '')
        .replace(/\./g, '')
        .replace(',', '.');
      return parseFloat(cleaned) || 0;
    };

    const netValue = parseMonetaryValue(body.valor_liquido);
    const grossValue = body.valor_bruto ? parseMonetaryValue(body.valor_bruto) : netValue;

    // Generate unique hubla_id
    const timestamp = Date.now();
    const emailHash = body.email.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
    const hublaId = `make_ob_construir_${timestamp}_${emailHash}`;

    // Parse sale date
    let saleDate: string;
    try {
      const parts = body.data.split('/');
      if (parts.length === 3) {
        saleDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      } else {
        saleDate = new Date().toISOString().split('T')[0];
      }
    } catch {
      saleDate = new Date().toISOString().split('T')[0];
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Prepare transaction data
    const transactionData = {
      hubla_id: hublaId,
      event_type: 'invoice.payment_succeeded',
      product_name: 'OB Construir Para Alugar',
      product_category: 'ob_construir',
      customer_name: body.nome,
      customer_email: body.email.toLowerCase(),
      customer_phone: body.telefone || null,
      net_value: netValue,
      product_price: grossValue,
      sale_date: saleDate,
      sale_status: 'completed',
      source: 'make',
      raw_data: body,
    };

    console.log('Inserting OB Construir transaction:', JSON.stringify(transactionData));

    // Insert into hubla_transactions
    const { data, error } = await supabase
      .from('hubla_transactions')
      .insert(transactionData)
      .select('id, hubla_id')
      .single();

    if (error) {
      console.error('Error inserting OB Construir transaction:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to insert transaction', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('OB Construir transaction inserted successfully:', data);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'OB Construir transaction processed',
        transaction_id: data.id,
        hubla_id: data.hubla_id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing OB Construir webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
