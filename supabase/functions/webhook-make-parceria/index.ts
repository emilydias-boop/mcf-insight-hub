import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MakeParceriaPayload {
  data: string
  nome: string
  email: string
  telefone?: string
  valor_liquido: number | string
  valor_bruto?: number | string
  tipo_parceria?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const startTime = Date.now()

  try {
    const body: MakeParceriaPayload = await req.json()
    console.log('📦 Webhook Make Parceria received:', JSON.stringify(body, null, 2))

    // Validate required fields
    if (!body.data || !body.nome || !body.email || body.valor_liquido === undefined) {
      console.error('❌ Missing required fields')
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields',
          required: ['data', 'nome', 'email', 'valor_liquido'],
          received: Object.keys(body)
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse monetary values - handles both Brazilian (1.234,56) and international (1234.56) formats
    const parseMonetaryValue = (value: number | string | undefined): number => {
      if (value === undefined || value === null) return 0
      if (typeof value === 'number') return value
      const str = value.toString().replace(/[R$\s]/g, '')
      // Brazilian format: has comma as decimal separator
      if (str.includes(',')) {
        const cleaned = str.replace(/\./g, '').replace(',', '.')
        return parseFloat(cleaned) || 0
      }
      // International format
      return parseFloat(str) || 0
    }

    const valorLiquido = parseMonetaryValue(body.valor_liquido)
    const valorBruto = body.valor_bruto ? parseMonetaryValue(body.valor_bruto) : valorLiquido

    // Generate unique hubla_id
    const timestamp = Date.now()
    const emailHash = body.email.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10)
    const hublaId = `make_parceria_${timestamp}_${emailHash}`

    // Parse sale date
    let saleDate: string
    try {
      const date = new Date(body.data)
      saleDate = date.toISOString()
    } catch {
      saleDate = new Date().toISOString()
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Prepare transaction data
    const transactionData = {
      hubla_id: hublaId,
      customer_name: body.nome,
      customer_email: body.email.toLowerCase(),
      customer_phone: body.telefone || null,
      product_name: body.tipo_parceria || 'Parceria',
      product_category: 'parceria',
      net_value: valorLiquido,
      product_price: valorBruto,
      sale_date: saleDate,
      event_type: 'invoice.payment_succeeded',
      sale_status: 'completed',
      source: 'make',
      raw_data: body
    }

    console.log('💾 Inserting transaction:', JSON.stringify(transactionData, null, 2))

    // Insert into hubla_transactions
    const { data, error } = await supabase
      .from('hubla_transactions')
      .insert(transactionData)
      .select()
      .single()

    if (error) {
      console.error('❌ Database error:', error)
      return new Response(
        JSON.stringify({ error: 'Database error', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const processingTime = Date.now() - startTime
    console.log(`✅ Transaction inserted successfully in ${processingTime}ms:`, data.id)

    return new Response(
      JSON.stringify({ 
        success: true,
        transaction_id: data.id,
        hubla_id: hublaId,
        tipo_parceria: body.tipo_parceria || 'Parceria',
        valor_liquido: valorLiquido,
        processing_time_ms: processingTime
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error processing webhook:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
