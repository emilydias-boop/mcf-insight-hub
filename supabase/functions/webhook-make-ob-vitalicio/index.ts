import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MakeOBVitalicioPayload {
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
    const body: MakeOBVitalicioPayload = await req.json();
    
    console.log('📦 Webhook OB Vitalício recebido:', JSON.stringify(body, null, 2));

    // Validate required fields
    if (!body.data || !body.nome || !body.email || body.valor_liquido === undefined) {
      console.error('❌ Campos obrigatórios faltando:', { 
        data: !!body.data, 
        nome: !!body.nome, 
        email: !!body.email, 
        valor_liquido: body.valor_liquido !== undefined 
      });
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
    const parseMonetaryValue = (value: number | string): number => {
      if (typeof value === 'number') return value;
      // Remove currency symbols and convert comma to dot
      const cleaned = value.toString().replace(/[R$\s]/g, '').replace(',', '.');
      return parseFloat(cleaned) || 0;
    };

    const valorLiquido = parseMonetaryValue(body.valor_liquido);
    const valorBruto = body.valor_bruto ? parseMonetaryValue(body.valor_bruto) : valorLiquido;

    // Generate unique ID
    const timestamp = Date.now();
    const emailHash = body.email.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
    const hublaId = `make_ob_vitalicio_${timestamp}_${emailHash}`;

    // Parse sale date
    let saleDate: string;
    try {
      const parsedDate = new Date(body.data);
      if (isNaN(parsedDate.getTime())) {
        throw new Error('Invalid date');
      }
      saleDate = parsedDate.toISOString();
    } catch {
      console.log('⚠️ Formato de data não reconhecido, usando data atual');
      saleDate = new Date().toISOString();
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Prepare transaction data
    const transactionData = {
      hubla_id: hublaId,
      customer_name: body.nome.trim(),
      customer_email: body.email.toLowerCase().trim(),
      customer_phone: body.telefone?.trim() || null,
      product_name: 'OB Acesso Vitalício',
      product_category: 'ob_vitalicio',
      net_value: valorLiquido,
      product_price: valorBruto,
      sale_date: saleDate,
      event_type: 'invoice.payment_succeeded',
      sale_status: 'completed',
      source: 'make',
      raw_data: body
    };

    console.log('💾 Inserindo transação OB Vitalício:', JSON.stringify(transactionData, null, 2));

    // Insert into hubla_transactions
    const { data: insertedData, error: insertError } = await supabase
      .from('hubla_transactions')
      .insert(transactionData)
      .select()
      .single();

    if (insertError) {
      console.error('❌ Erro ao inserir transação:', insertError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to insert transaction', 
          details: insertError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const processingTime = Date.now() - startTime;
    console.log(`✅ Transação OB Vitalício inserida com sucesso em ${processingTime}ms:`, insertedData.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'OB Vitalício transaction created successfully',
        transaction_id: insertedData.id,
        hubla_id: hublaId,
        processing_time_ms: processingTime
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('❌ Erro no webhook OB Vitalício:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
