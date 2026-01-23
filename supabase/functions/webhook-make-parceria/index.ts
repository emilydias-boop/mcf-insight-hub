import { createClient } from "npm:@supabase/supabase-js@2";

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

// Helper to normalize phone numbers for matching
function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '').slice(-11); // Keep last 11 digits
}

// Auto-mark sale as complete: move deal to "Venda Realizada" and update attendee
async function autoMarkSaleComplete(supabase: any, data: {
  customerEmail: string;
  customerPhone?: string;
  productName: string;
  saleDate: string;
  netValue: number;
}): Promise<{ success: boolean; dealId?: string; message: string }> {
  console.log(`🛒 [PARCERIA] Buscando lead R2 aprovado para: ${data.customerEmail}`);
  
  try {
    // 1. Fetch R2 status options to find "Aprovado"
    const { data: statusOptions, error: statusError } = await supabase
      .from('r2_status_options')
      .select('id, name')
      .eq('is_active', true);
    
    if (statusError) {
      console.error('❌ [PARCERIA] Erro ao buscar status options:', statusError);
      return { success: false, message: 'Failed to fetch R2 status options' };
    }
    
    const aprovadoStatus = statusOptions?.find((s: any) => 
      s.name.toLowerCase().includes('aprovado') || 
      s.name.toLowerCase().includes('approved')
    );
    
    if (!aprovadoStatus) {
      console.log('⚠️ [PARCERIA] Status "Aprovado" não encontrado');
      return { success: false, message: 'Aprovado status not found' };
    }
    
    // 2. Search for R2 attendee by email or phone
    const normalizedPhone = normalizePhone(data.customerPhone);
    
    const { data: attendees, error: attendeesError } = await supabase
      .from('meeting_slot_attendees')
      .select(`
        id,
        deal_id,
        attendee_name,
        attendee_phone,
        r2_status_id,
        carrinho_status,
        meeting_slot:meeting_slots!inner(
          id,
          meeting_type,
          closer_id,
          closer:closers(id, name, email)
        )
      `)
      .eq('meeting_slots.meeting_type', 'r2')
      .eq('r2_status_id', aprovadoStatus.id)
      .limit(50);
    
    if (attendeesError) {
      console.error('❌ [PARCERIA] Erro ao buscar attendees:', attendeesError);
      return { success: false, message: 'Failed to fetch R2 attendees' };
    }
    
    if (!attendees || attendees.length === 0) {
      console.log('⚠️ [PARCERIA] Nenhum attendee R2 aprovado encontrado');
      return { success: false, message: 'No approved R2 attendees found' };
    }
    
    // 3. Find matching attendee by email or phone
    let matchedAttendee: any = null;
    
    for (const att of attendees) {
      if (!att.deal_id) continue;
      
      // Fetch contact from deal
      const { data: deal } = await supabase
        .from('crm_deals')
        .select('id, origin_id, contact:crm_contacts(email, phone)')
        .eq('id', att.deal_id)
        .single();
      
      if (!deal) continue;
      
      const contact = deal.contact as any;
      const contactEmail = contact?.email?.toLowerCase();
      const contactPhone = normalizePhone(contact?.phone || att.attendee_phone);
      
      // Match by email
      if (contactEmail && contactEmail === data.customerEmail.toLowerCase()) {
        matchedAttendee = { ...att, deal };
        break;
      }
      
      // Match by phone
      if (normalizedPhone && contactPhone && 
          (normalizedPhone.includes(contactPhone) || contactPhone.includes(normalizedPhone))) {
        matchedAttendee = { ...att, deal };
        break;
      }
    }
    
    if (!matchedAttendee) {
      console.log(`⚠️ [PARCERIA] Nenhum lead aprovado encontrado para email/telefone: ${data.customerEmail}/${data.customerPhone}`);
      return { success: false, message: 'No matching approved lead found' };
    }
    
    const deal = matchedAttendee.deal;
    console.log(`✅ [PARCERIA] Lead R2 encontrado: Deal ${deal.id}, Attendee ${matchedAttendee.id}`);
    
    // 4. Find "Venda Realizada" stage in the same origin
    const { data: vendaStage, error: stageError } = await supabase
      .from('crm_stages')
      .select('id, stage_name')
      .eq('origin_id', deal.origin_id)
      .or('stage_name.ilike.%venda realizada%,stage_name.ilike.%sale completed%')
      .limit(1)
      .maybeSingle();
    
    if (stageError || !vendaStage) {
      console.log(`⚠️ [PARCERIA] Stage "Venda Realizada" não encontrada para origin ${deal.origin_id}`);
      return { success: false, message: 'Venda Realizada stage not found' };
    }
    
    // 5. Update deal to "Venda Realizada"
    const { error: dealUpdateError } = await supabase
      .from('crm_deals')
      .update({ stage_id: vendaStage.id })
      .eq('id', deal.id);
    
    if (dealUpdateError) {
      console.error('❌ [PARCERIA] Erro ao atualizar deal:', dealUpdateError);
      return { success: false, message: 'Failed to update deal stage' };
    }
    
    // 6. Mark attendee as "comprou"
    const { error: attendeeUpdateError } = await supabase
      .from('meeting_slot_attendees')
      .update({ 
        carrinho_status: 'comprou',
        carrinho_updated_at: new Date().toISOString()
      })
      .eq('id', matchedAttendee.id);
    
    if (attendeeUpdateError) {
      console.error('⚠️ [PARCERIA] Erro ao atualizar attendee:', attendeeUpdateError);
      // Continue anyway - deal was already updated
    }
    
    // 7. Log activity in deal_activities
    await supabase
      .from('deal_activities')
      .insert({
        deal_id: deal.id,
        activity_type: 'stage_change',
        description: `Venda de parceria realizada: ${data.productName}`,
        to_stage: vendaStage.stage_name,
        metadata: {
          via: 'webhook_parceria',
          product_name: data.productName,
          net_value: data.netValue,
          sale_date: data.saleDate,
          customer_email: data.customerEmail,
          attendee_id: matchedAttendee.id,
          closer_name: matchedAttendee.meeting_slot?.closer?.name
        }
      });
    
    // 8. Create notification for the closer
    const closerId = matchedAttendee.meeting_slot?.closer?.id;
    const closerName = matchedAttendee.meeting_slot?.closer?.name;
    
    if (closerId) {
      // Find closer's user profile by email
      const closerEmail = matchedAttendee.meeting_slot?.closer?.email;
      if (closerEmail) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', closerEmail)
          .maybeSingle();
        
        if (profile) {
          await supabase
            .from('user_notifications')
            .insert({
              user_id: profile.id,
              type: 'sale_completed',
              title: '🎉 Venda de Parceria Realizada!',
              message: `${data.productName} - ${matchedAttendee.attendee_name || data.customerEmail}`,
              data: {
                deal_id: deal.id,
                product_name: data.productName,
                net_value: data.netValue,
                customer_email: data.customerEmail
              },
              read: false
            });
        }
      }
    }
    
    console.log(`🎉 [PARCERIA] Deal ${deal.id} movido para "${vendaStage.stage_name}"! Closer: ${closerName || 'N/A'}`);
    
    return { 
      success: true, 
      dealId: deal.id, 
      message: `Deal moved to ${vendaStage.stage_name}` 
    };
  } catch (error) {
    console.error('❌ [PARCERIA] Erro inesperado:', error);
    return { success: false, message: `Unexpected error: ${(error as Error).message}` };
  }
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

    let valorLiquido = parseMonetaryValue(body.valor_liquido)
    const valorBruto = body.valor_bruto ? parseMonetaryValue(body.valor_bruto) : valorLiquido

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // ===== VALIDAÇÃO CONTRA HUBLA =====
    // Detectar se valor parece ser taxa da Hubla (< 15% do bruto)
    const pareceSerTaxa = valorBruto > 0 && valorLiquido < valorBruto * 0.15
    let valorCorrigido = false
    let valorOriginalMake = valorLiquido

    if (pareceSerTaxa) {
      console.log('⚠️ Valor parece ser taxa da Hubla:', { valorLiquido, valorBruto, ratio: valorLiquido / valorBruto })
      
      // Buscar registro Hubla correspondente (mesmo email, data ±1 dia, mesmo valor bruto)
      const parsedDate = new Date(body.data)
      const dataInicio = new Date(parsedDate)
      dataInicio.setDate(dataInicio.getDate() - 1)
      const dataFim = new Date(parsedDate)
      dataFim.setDate(dataFim.getDate() + 1)

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
        .maybeSingle()

      if (!hublaError && hublaMatch && hublaMatch.net_value) {
        console.log('✅ Match encontrado na Hubla! Corrigindo valor:', {
          makeOriginal: valorLiquido,
          hublaCorreto: hublaMatch.net_value
        })
        
        valorLiquido = hublaMatch.net_value
        valorCorrigido = true

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
            produto: body.tipo_parceria || 'Parceria',
            dataVenda: body.data
          }
        })
        
        if (alertError) {
          console.warn('⚠️ Não foi possível criar alerta:', alertError)
        }
      } else {
        console.log('⚠️ Nenhum match encontrado na Hubla, mantendo valor do Make')
      }
    }

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
      count_in_dashboard: true,
      raw_data: { ...body, valor_corrigido: valorCorrigido, valor_original_make: valorOriginalMake }
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

    // ===== AUTO-MARK SALE COMPLETE =====
    // Move deal to "Venda Realizada" and mark attendee as "comprou"
    const autoMarkResult = await autoMarkSaleComplete(supabase, {
      customerEmail: body.email.toLowerCase(),
      customerPhone: body.telefone,
      productName: body.tipo_parceria || 'Parceria',
      saleDate,
      netValue: valorLiquido
    })

    const processingTime = Date.now() - startTime
    console.log(`✅ Transaction inserted successfully in ${processingTime}ms:`, data.id)

    return new Response(
      JSON.stringify({ 
        success: true,
        transaction_id: data.id,
        hubla_id: hublaId,
        tipo_parceria: body.tipo_parceria || 'Parceria',
        valor_liquido: valorLiquido,
        valor_corrigido: valorCorrigido,
        valor_original_make: valorCorrigido ? valorOriginalMake : undefined,
        auto_mark_result: autoMarkResult,
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