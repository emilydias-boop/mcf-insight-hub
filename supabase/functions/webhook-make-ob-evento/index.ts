import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MakeOBEventoPayload {
  data: string;
  nome: string;
  email: string;
  telefone?: string;
  valor_liquido: number | string;
  valor_bruto?: number | string;
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

  const startTime = Date.now();

  try {
    const body: MakeOBEventoPayload = await req.json();
    console.log('[WEBHOOK-MAKE-OB-EVENTO] Received payload:', JSON.stringify(body));

    // Validate required fields
    if (!body.data || !body.nome || !body.email || body.valor_liquido === undefined) {
      console.error('[WEBHOOK-MAKE-OB-EVENTO] Missing required fields');
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields', 
          required: ['data', 'nome', 'email', 'valor_liquido'],
          received: Object.keys(body)
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse monetary values
    const parseMonetaryValue = (value: number | string | undefined): number => {
      if (value === undefined || value === null || value === '') return 0;
      if (typeof value === 'number') return value;
      // Remove currency symbols and convert comma to dot
      const cleaned = value.toString().replace(/[R$\s]/g, '').replace(',', '.');
      return parseFloat(cleaned) || 0;
    };

    const valorLiquido = parseMonetaryValue(body.valor_liquido);
    const valorBruto = body.valor_bruto ? parseMonetaryValue(body.valor_bruto) : valorLiquido;

    // Generate unique hubla_id
    const timestamp = Date.now();
    const emailHash = body.email.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
    const hublaId = `make_ob_evento_${timestamp}_${emailHash}`;

    // Parse sale date
    let saleDate: string;
    try {
      const parsedDate = new Date(body.data);
      if (isNaN(parsedDate.getTime())) {
        throw new Error('Invalid date');
      }
      saleDate = parsedDate.toISOString();
    } catch {
      console.error('[WEBHOOK-MAKE-OB-EVENTO] Invalid date format:', body.data);
      return new Response(
        JSON.stringify({ error: 'Invalid date format', received: body.data }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Prepare transaction data
    const transactionData = {
      hubla_id: hublaId,
      customer_name: body.nome,
      customer_email: body.email.toLowerCase(),
      customer_phone: body.telefone || null,
      product_name: 'Imersão Presencial',
      product_category: 'ob_evento',
      net_value: valorLiquido,
      product_price: valorBruto,
      sale_date: saleDate,
      event_type: 'invoice.payment_succeeded',
      sale_status: 'completed',
      source: 'make',
      raw_data: body
    };

    console.log('[WEBHOOK-MAKE-OB-EVENTO] Inserting transaction:', JSON.stringify(transactionData));

    // Insert into hubla_transactions
    const { data, error } = await supabase
      .from('hubla_transactions')
      .insert(transactionData)
      .select()
      .single();

    if (error) {
      console.error('[WEBHOOK-MAKE-OB-EVENTO] Insert error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to insert transaction', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const processingTime = Date.now() - startTime;
    console.log(`[WEBHOOK-MAKE-OB-EVENTO] Success in ${processingTime}ms:`, data.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        id: data.id,
        hubla_id: hublaId,
        product: 'OB Evento (Imersão Presencial)',
        valor_liquido: valorLiquido,
        processing_time_ms: processingTime
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[WEBHOOK-MAKE-OB-EVENTO] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
