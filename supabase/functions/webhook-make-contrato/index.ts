import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MakeContratoPayload {
  data: string;
  nome: string;
  email: string;
  telefone?: string;
  valor_liquido: number | string;
  valor_bruto?: number | string;
  tipo_contrato?: string;
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  
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
    const body: MakeContratoPayload = await req.json();
    console.log('📄 Webhook Make Contrato - Payload recebido:', JSON.stringify(body, null, 2));

    // Validate required fields
    if (!body.data || !body.nome || !body.email || body.valor_liquido === undefined) {
      console.error('❌ Campos obrigatórios ausentes:', { 
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

    // Parse monetary values - handles both Brazilian (1.234,56) and international (1234.56) formats
    const parseMonetaryValue = (value: number | string | undefined): number => {
      if (value === undefined || value === null) return 0;
      if (typeof value === 'number') return value;
      const str = value.toString().replace(/[R$\s]/g, '');
      // Brazilian format: has comma as decimal separator
      if (str.includes(',')) {
        const cleaned = str.replace(/\./g, '').replace(',', '.');
        return parseFloat(cleaned) || 0;
      }
      // International format
      return parseFloat(str) || 0;
    };

    let valorLiquido = parseMonetaryValue(body.valor_liquido);
    const valorBruto = body.valor_bruto ? parseMonetaryValue(body.valor_bruto) : valorLiquido;

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ===== VALIDAÇÃO CONTRA HUBLA =====
    // Detectar se valor parece ser taxa da Hubla (< 15% do bruto)
    const pareceSerTaxa = valorBruto > 0 && valorLiquido < valorBruto * 0.15;
    let valorCorrigido = false;
    let valorOriginalMake = valorLiquido;

    if (pareceSerTaxa) {
      console.log('⚠️ Valor parece ser taxa da Hubla:', { valorLiquido, valorBruto, ratio: valorLiquido / valorBruto });
      
      // Buscar registro Hubla correspondente (mesmo email, data ±1 dia, mesmo valor bruto)
      const parsedDate = new Date(body.data);
      const dataInicio = new Date(parsedDate);
      dataInicio.setDate(dataInicio.getDate() - 1);
      const dataFim = new Date(parsedDate);
      dataFim.setDate(dataFim.getDate() + 1);

      const { data: hublaMatch, error: hublaError } = await supabase
        .from('hubla_transactions')
        .select('net_value, product_price, customer_email')
        .eq('source', 'hubla')
        .ilike('customer_email', body.email.toLowerCase())
        .gte('sale_date', dataInicio.toISOString())
        .lte('sale_date', dataFim.toISOString())
        .gte('product_price', valorBruto * 0.95)
        .lte('product_price', valorBruto * 1.05)
        .limit(1)
        .maybeSingle();

      if (!hublaError && hublaMatch && hublaMatch.net_value) {
        console.log('✅ Match encontrado na Hubla! Corrigindo valor:', {
          makeOriginal: valorLiquido,
          hublaCorreto: hublaMatch.net_value
        });
        
        valorLiquido = hublaMatch.net_value;
        valorCorrigido = true;

        // Criar alerta sobre a correção
        const { error: alertError } = await supabase.from('alertas').insert({
          tipo: 'correcao_valor',
          titulo: `Valor corrigido: ${body.nome}`,
          descricao: `Make enviou R$ ${valorOriginalMake.toFixed(2)} (taxa Hubla), corrigido para R$ ${valorLiquido.toFixed(2)} (valor líquido Hubla)`,
          user_id: '00000000-0000-0000-0000-000000000000', // System user
          metadata: { 
            email: body.email, 
            valorOriginal: valorOriginalMake, 
            valorCorrigido: valorLiquido,
            produto: body.tipo_contrato || 'Contrato',
            dataVenda: body.data
          }
        });
        
        if (alertError) {
          console.warn('⚠️ Não foi possível criar alerta:', alertError);
        }
      } else {
        console.log('⚠️ Nenhum match encontrado na Hubla, mantendo valor do Make');
      }
    }

    // Generate unique ID
    const timestamp = Date.now();
    const emailHash = body.email.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
    const hublaId = `make_contrato_${timestamp}_${emailHash}`;

    // Parse sale date
    let saleDate: string;
    try {
      const parsedDate = new Date(body.data);
      if (isNaN(parsedDate.getTime())) {
        throw new Error('Invalid date');
      }
      saleDate = parsedDate.toISOString();
    } catch {
      saleDate = new Date().toISOString();
      console.warn('⚠️ Data inválida, usando data atual:', body.data);
    }

    // Determine product name
    const productName = body.tipo_contrato || 'Contrato';

    // Prepare transaction data
    const transactionData = {
      hubla_id: hublaId,
      customer_name: body.nome,
      customer_email: body.email.toLowerCase(),
      customer_phone: body.telefone || null,
      product_name: productName,
      product_category: 'contrato',
      net_value: valorLiquido,
      product_price: valorBruto,
      sale_date: saleDate,
      event_type: 'invoice.payment_succeeded',
      sale_status: 'completed',
      source: 'make',
      count_in_dashboard: true,
      raw_data: { ...body, valor_corrigido: valorCorrigido, valor_original_make: valorOriginalMake },
    };

    console.log('💾 Inserindo transação Contrato:', JSON.stringify(transactionData, null, 2));

    // Insert into hubla_transactions
    const { data: insertedData, error: insertError } = await supabase
      .from('hubla_transactions')
      .insert(transactionData)
      .select('id, hubla_id')
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
    console.log(`✅ Contrato inserido com sucesso em ${processingTime}ms:`, insertedData);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Contrato sale processed successfully',
        transaction_id: insertedData.id,
        hubla_id: insertedData.hubla_id,
        product_name: productName,
        valor_liquido: valorLiquido,
        valor_bruto: valorBruto,
        valor_corrigido: valorCorrigido,
        valor_original_make: valorCorrigido ? valorOriginalMake : undefined,
        processing_time_ms: processingTime,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('❌ Erro no webhook Make Contrato:', error);
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
