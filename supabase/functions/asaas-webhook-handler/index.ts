import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaas-access-token',
};

// Determinar categoria do produto baseada na descrição
function getProductCategory(productName: string): string {
  if (!productName) return 'outros';
  const upper = productName.toUpperCase();
  
  if (upper.includes('A009') || upper.includes('A001')) {
    return 'parceria';
  }
  if (upper.includes('A000') && upper.includes('CONTRATO')) {
    return 'contrato';
  }
  if (upper.includes('A010') || upper.includes('INCORPORADOR')) {
    return 'incorporador';
  }
  // Categoria padrão para produtos não mapeados
  return 'outros';
}

// Helper to normalize phone numbers for matching
function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '').slice(-11); // Keep last 11 digits
}

// Auto-mark sale as complete: move deal to "Venda Realizada" and update attendee
// FIXED: Direct email/phone lookup instead of .limit(50) iteration
async function autoMarkSaleComplete(supabase: any, data: {
  customerEmail: string;
  customerPhone?: string;
  productName: string;
  saleDate: string;
  netValue: number;
}): Promise<{ success: boolean; dealId?: string; message: string }> {
  const logPrefix = '🛒 [ASAAS PARCERIA]';
  console.log(`${logPrefix} Buscando lead R2 aprovado para: ${data.customerEmail}`);
  
  try {
    // 1. Fetch R2 status "Aprovado"
    const { data: statusOptions, error: statusError } = await supabase
      .from('r2_status_options')
      .select('id, name')
      .eq('is_active', true);
    
    if (statusError) {
      console.error(`❌ ${logPrefix} Erro ao buscar status options:`, statusError);
      return { success: false, message: 'Failed to fetch R2 status options' };
    }
    
    const aprovadoStatus = statusOptions?.find((s: any) => 
      s.name.toLowerCase().includes('aprovado') || 
      s.name.toLowerCase().includes('approved')
    );
    
    if (!aprovadoStatus) {
      console.log(`⚠️ ${logPrefix} Status "Aprovado" não encontrado`);
      return { success: false, message: 'Aprovado status not found' };
    }

    // 2. BUSCA DIRETA: Encontrar contact por email na crm_contacts
    let matchedAttendee: any = null;
    let deal: any = null;

    // Fase 1: Busca por email
    const { data: contactByEmail } = await supabase
      .from('crm_contacts')
      .select('id')
      .ilike('email', data.customerEmail)
      .limit(5);

    if (contactByEmail && contactByEmail.length > 0) {
      const contactIds = contactByEmail.map((c: any) => c.id);
      console.log(`${logPrefix} Contacts encontrados por email: ${contactIds.length}`);

      for (const contactId of contactIds) {
        const { data: deals } = await supabase
          .from('crm_deals')
          .select('id, origin_id')
          .eq('contact_id', contactId);

        if (!deals || deals.length === 0) continue;

        for (const d of deals) {
          const { data: att } = await supabase
            .from('meeting_slot_attendees')
            .select(`
              id, deal_id, attendee_name, attendee_phone, carrinho_status,
              meeting_slot:meeting_slots!inner(
                id, meeting_type, closer_id,
                closer:closers(id, name, email)
              )
            `)
            .eq('deal_id', d.id)
            .eq('meeting_slots.meeting_type', 'r2')
            .eq('r2_status_id', aprovadoStatus.id)
            .limit(1)
            .maybeSingle();

          if (att) {
            matchedAttendee = att;
            deal = d;
            break;
          }
        }
        if (matchedAttendee) break;
      }
    }

    // Fase 2: Fallback por telefone
    if (!matchedAttendee && data.customerPhone) {
      const normalizedPhone = data.customerPhone.replace(/\D/g, '');
      const phoneSuffix = normalizedPhone.slice(-9);
      
      if (phoneSuffix.length >= 8) {
        console.log(`${logPrefix} Email não encontrou, tentando por telefone: ...${phoneSuffix}`);
        
        const { data: attByPhone } = await supabase
          .from('meeting_slot_attendees')
          .select(`
            id, deal_id, attendee_name, attendee_phone, carrinho_status,
            meeting_slot:meeting_slots!inner(
              id, meeting_type, closer_id,
              closer:closers(id, name, email)
            )
          `)
          .eq('meeting_slots.meeting_type', 'r2')
          .eq('r2_status_id', aprovadoStatus.id)
          .ilike('attendee_phone', `%${phoneSuffix}`)
          .limit(1)
          .maybeSingle();

        if (attByPhone && attByPhone.deal_id) {
          const { data: dealData } = await supabase
            .from('crm_deals')
            .select('id, origin_id')
            .eq('id', attByPhone.deal_id)
            .single();
          
          if (dealData) {
            matchedAttendee = attByPhone;
            deal = dealData;
          }
        }

        if (!matchedAttendee) {
          const { data: contactByPhone } = await supabase
            .from('crm_contacts')
            .select('id')
            .ilike('phone', `%${phoneSuffix}`)
            .limit(5);

          if (contactByPhone && contactByPhone.length > 0) {
            for (const contact of contactByPhone) {
              const { data: deals } = await supabase
                .from('crm_deals')
                .select('id, origin_id')
                .eq('contact_id', contact.id);

              if (!deals) continue;

              for (const d of deals) {
                const { data: att } = await supabase
                  .from('meeting_slot_attendees')
                  .select(`
                    id, deal_id, attendee_name, attendee_phone, carrinho_status,
                    meeting_slot:meeting_slots!inner(
                      id, meeting_type, closer_id,
                      closer:closers(id, name, email)
                    )
                  `)
                  .eq('deal_id', d.id)
                  .eq('meeting_slots.meeting_type', 'r2')
                  .eq('r2_status_id', aprovadoStatus.id)
                  .limit(1)
                  .maybeSingle();

                if (att) {
                  matchedAttendee = att;
                  deal = d;
                  break;
                }
              }
              if (matchedAttendee) break;
            }
          }
        }
      }
    }

    if (!matchedAttendee || !deal) {
      console.log(`⚠️ ${logPrefix} Nenhum lead R2 aprovado encontrado para: ${data.customerEmail} / ${data.customerPhone || 'sem telefone'}`);
      return { success: false, message: 'No matching approved R2 lead found' };
    }

    console.log(`✅ ${logPrefix} Lead R2 encontrado: Deal ${deal.id}, Attendee ${matchedAttendee.id}`);

    // 3. Find "Venda Realizada" stage in the same origin
    const { data: vendaStage, error: stageError } = await supabase
      .from('crm_stages')
      .select('id, stage_name')
      .eq('origin_id', deal.origin_id)
      .or('stage_name.ilike.%venda realizada%,stage_name.ilike.%sale completed%')
      .limit(1)
      .maybeSingle();
    
    if (stageError || !vendaStage) {
      console.log(`⚠️ ${logPrefix} Stage "Venda Realizada" não encontrada para origin ${deal.origin_id}`);
      return { success: false, message: 'Venda Realizada stage not found' };
    }
    
    // 4. Update deal to "Venda Realizada"
    const { error: dealUpdateError } = await supabase
      .from('crm_deals')
      .update({ stage_id: vendaStage.id })
      .eq('id', deal.id);
    
    if (dealUpdateError) {
      console.error(`❌ ${logPrefix} Erro ao atualizar deal:`, dealUpdateError);
      return { success: false, message: 'Failed to update deal stage' };
    }
    
    // 5. Mark attendee as "comprou"
    const { error: attendeeUpdateError } = await supabase
      .from('meeting_slot_attendees')
      .update({ 
        carrinho_status: 'comprou',
        carrinho_updated_at: new Date().toISOString()
      })
      .eq('id', matchedAttendee.id);
    
    if (attendeeUpdateError) {
      console.error(`⚠️ ${logPrefix} Erro ao atualizar attendee:`, attendeeUpdateError);
    }
    
    // 6. Log activity in deal_activities
    await supabase
      .from('deal_activities')
      .insert({
        deal_id: deal.id,
        activity_type: 'stage_change',
        description: `Venda de parceria realizada via Asaas: ${data.productName}`,
        to_stage: vendaStage.stage_name,
        metadata: {
          via: 'webhook_asaas',
          product_name: data.productName,
          net_value: data.netValue,
          sale_date: data.saleDate,
          customer_email: data.customerEmail,
          attendee_id: matchedAttendee.id,
          closer_name: matchedAttendee.meeting_slot?.closer?.name
        }
      });
    
    // 7. Create notification for the closer
    const closerId = matchedAttendee.meeting_slot?.closer?.id;
    const closerName = matchedAttendee.meeting_slot?.closer?.name;
    
    if (closerId) {
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
              title: '🎉 Venda de Parceria Asaas!',
              message: `${data.productName} - ${matchedAttendee.attendee_name || data.customerEmail}`,
              data: {
                deal_id: deal.id,
                product_name: data.productName,
                net_value: data.netValue,
                customer_email: data.customerEmail,
                source: 'asaas'
              },
              read: false
            });
        }
      }
    }
    
    console.log(`🎉 ${logPrefix} Deal ${deal.id} movido para "${vendaStage.stage_name}"! Closer: ${closerName || 'N/A'}`);
    
    return { 
      success: true, 
      dealId: deal.id, 
      message: `Deal moved to ${vendaStage.stage_name}` 
    };
  } catch (error) {
    console.error(`❌ ${logPrefix} Erro inesperado:`, error);
    return { success: false, message: `Unexpected error: ${(error as Error).message}` };
  }
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  let logId: string | null = null;

  try {
    const body = await req.json();
    
    console.log('📦 [Asaas Webhook] Recebido:', JSON.stringify(body, null, 2));

    // Detect format: Hubla/mcfpay sends type as string + event as object
    // Asaas sends event as string + payment/data as object
    const isHublaFormat = typeof body.event === 'object' && body.event !== null && typeof body.type === 'string';
    const event = isHublaFormat ? body.type : body.event;
    const payment = body.payment;

    // Log do webhook
    const { data: logData } = await supabase
      .from('bu_webhook_logs')
      .insert({
        bu_type: 'asaas',
        event_type: event,
        payload: body,
        status: 'processing'
      })
      .select('id')
      .single();
    
    logId = logData?.id;

    // Processar eventos de pagamento confirmado (padrão Asaas) e purchase.completed (formato customizado)
    const validEvents = ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED', 'purchase.completed', 'invoice.payment_succeeded'];
    if (!validEvents.includes(event)) {
      console.log(`[Asaas] Evento ignorado: ${event}`);
      
      if (logId) {
        await supabase
          .from('bu_webhook_logs')
          .update({ status: 'skipped', processed_at: new Date().toISOString() })
          .eq('id', logId);
      }
      
      return new Response(
        JSON.stringify({ received: true, skipped: true, reason: 'Event type not processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Detectar formato do payload e extrair dados
    let productName = '';
    let customerName = '';
    let customerEmail = '';
    let customerPhone = '';
    let netValue = 0;
    let grossValue = 0;
    let saleDate = '';
    let paymentId = '';

    if (body.payment) {
      // Formato padrão Asaas: { event, payment: { ... } }
      const payment = body.payment;
      paymentId = payment.id;
      productName = payment.description || '';
      grossValue = payment.value || 0;
      netValue = payment.netValue || grossValue;
      saleDate = payment.confirmedDate || payment.paymentDate || payment.clientPaymentDate || new Date().toISOString().split('T')[0];
      
      if (typeof payment.customer === 'object' && payment.customer !== null) {
        customerName = payment.customer.name || '';
        customerEmail = payment.customer.email || '';
        customerPhone = payment.customer.phone || payment.customer.mobilePhone || '';
      } else {
        customerName = payment.customerName || payment.customer_name || '';
        customerEmail = payment.customerEmail || payment.customer_email || '';
        customerPhone = payment.customerPhone || payment.customer_phone || '';
      }
      
      console.log(`[Asaas] Formato padrão detectado: payment.id = ${paymentId}`);
      
    } else if (body.data) {
      // Formato customizado: { event, data: { ... } }
      const data = body.data;
      paymentId = data.purchase_id || data.id || `custom_${Date.now()}`;
      productName = data.product_name || data.productName || '';
      grossValue = data.amount || data.value || 0;
      netValue = data.net_amount || data.netAmount || grossValue;
      saleDate = data.created_at || data.createdAt || data.sale_date || new Date().toISOString();
      customerName = data.customer_name || data.customerName || '';
      customerEmail = data.customer_email || data.customerEmail || '';
      customerPhone = data.customer_phone || data.customerPhone || '';
      
      console.log(`[Asaas] Formato customizado detectado: data.purchase_id = ${paymentId}`);
      
    } else if (isHublaFormat) {
      // Formato Hubla/mcfpay: { type: "invoice.payment_succeeded", event: { user, invoice, product }, version }
      const hublaEvent = body.event;
      const invoice = hublaEvent?.invoice;
      const user = hublaEvent?.user || invoice?.payer || {};
      const product = hublaEvent?.product || {};
      
      paymentId = invoice?.id || `mcfpay_${Date.now()}`;
      productName = product.name || invoice?.items?.[0]?.product?.name || 'Produto MCFPay';
      
      const subtotalCents = invoice?.amount?.subtotalCents || invoice?.amount?.totalCents || 0;
      grossValue = subtotalCents / 100;
      
      // Extract seller net value from receivers
      const sellerReceiver = (invoice?.receivers || []).find((r: any) => r.role === 'seller');
      netValue = sellerReceiver ? (sellerReceiver.totalCents || 0) / 100 : grossValue;
      
      saleDate = invoice?.saleDate || invoice?.createdAt || new Date().toISOString();
      customerName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || '';
      customerEmail = user.email || '';
      customerPhone = user.phone || '';
      
      console.log(`[Asaas] Formato Hubla/mcfpay detectado: invoice.id = ${paymentId}, product = ${productName}`);
      
    } else {
      // Payload não reconhecido
      console.log('[Asaas] Payload sem payment ou data - formato desconhecido');
      
      if (logId) {
        await supabase
          .from('bu_webhook_logs')
          .update({ status: 'skipped', processed_at: new Date().toISOString() })
          .eq('id', logId);
      }
      
      return new Response(
        JSON.stringify({ received: true, skipped: true, reason: 'Unknown payload format' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determinar categoria do produto
    const productCategory = getProductCategory(productName);
    console.log(`[Asaas] Produto: "${productName}" | Categoria: ${productCategory}`);

    // Gerar hubla_id único para evitar duplicatas
    const sourceLabel = isHublaFormat ? 'mcfpay' : 'asaas';
    const hublaId = `${sourceLabel}_${paymentId}`;

    // Verificar se já existe
    const { data: existing } = await supabase
      .from('hubla_transactions')
      .select('id')
      .eq('hubla_id', hublaId)
      .maybeSingle();

    if (existing) {
      console.log(`[Asaas] Transação duplicada: ${hublaId}`);
      
      if (logId) {
        await supabase
          .from('bu_webhook_logs')
          .update({ status: 'duplicate', processed_at: new Date().toISOString(), record_id: existing.id })
          .eq('id', logId);
      }
      
      return new Response(
        JSON.stringify({ received: true, duplicate: true, transaction_id: existing.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Inserir na hubla_transactions
    const transactionData = {
      hubla_id: hublaId,
      event_type: event,
      product_name: productName,
      product_category: productCategory,
      net_value: netValue,
      product_price: grossValue,
      customer_name: customerName,
      customer_email: customerEmail.toLowerCase(),
      customer_phone: customerPhone,
      sale_date: new Date(saleDate).toISOString(),
      sale_status: 'completed',
      source: sourceLabel,
      count_in_dashboard: true,
      raw_data: body
    };

    console.log('💾 [Asaas] Inserindo transação:', JSON.stringify(transactionData, null, 2));

    const { data: inserted, error: insertError } = await supabase
      .from('hubla_transactions')
      .insert(transactionData)
      .select()
      .single();

    if (insertError) {
      console.error('❌ [Asaas] Erro ao inserir:', insertError);
      throw insertError;
    }

    console.log(`✅ [Asaas] Transação inserida: ${inserted.id}`);

    // Automação: mover deal para "Venda Realizada" APENAS para produtos de parceria
    let autoResult = { success: false, message: 'Skipped - not a parceria product' };
    
    if (productCategory === 'parceria') {
      autoResult = await autoMarkSaleComplete(supabase, {
        customerEmail: customerEmail.toLowerCase(),
        customerPhone: customerPhone,
        productName: productName,
        saleDate: transactionData.sale_date,
        netValue: netValue
      });
    } else {
      console.log(`[Asaas] Automação CRM ignorada para categoria: ${productCategory}`);
    }

    const processingTime = Date.now() - startTime;

    // Atualizar log de sucesso
    if (logId) {
      await supabase
        .from('bu_webhook_logs')
        .update({ 
          status: 'success', 
          processed_at: new Date().toISOString(),
          record_id: inserted.id
        })
        .eq('id', logId);
    }

    console.log(`🎉 [Asaas] Webhook processado em ${processingTime}ms`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        transaction_id: inserted.id,
        product: productName,
        net_value: netValue,
        auto_mark_result: autoResult,
        processing_time_ms: processingTime
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ [Asaas Webhook] Erro:', error);

    // Atualizar log de erro
    if (logId) {
      await supabase
        .from('bu_webhook_logs')
        .update({ 
          status: 'error', 
          error_message: (error as Error).message,
          processed_at: new Date().toISOString()
        })
        .eq('id', logId);
    }

    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
