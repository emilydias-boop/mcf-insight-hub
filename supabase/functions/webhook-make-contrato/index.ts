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

// ============= HELPER: Auto-marcar Contrato Pago =============
interface AutoMarkData {
  customerEmail: string | null;
  customerPhone: string | null;
  customerName: string | null;
  saleDate: string;
}

interface AutoMarkResult {
  matched: boolean;
  attendee_id?: string;
  attendee_name?: string;
  match_type?: string;
  deal_transferred?: boolean;
  closer_email?: string;
}

// deno-lint-ignore no-explicit-any
async function autoMarkContractPaid(supabase: any, data: AutoMarkData): Promise<AutoMarkResult> {
  if (!data.customerEmail && !data.customerPhone) {
    console.log('🎯 [AUTO-PAGO] Sem email ou telefone para buscar reunião');
    return { matched: false };
  }

  // Normalizar dados para busca
  const phoneDigits = data.customerPhone?.replace(/\D/g, '') || '';
  const phoneSuffix = phoneDigits.slice(-9);
  const emailLower = data.customerEmail?.toLowerCase()?.trim() || '';

  console.log(`🎯 [AUTO-PAGO] Buscando match para: email="${emailLower}", phone_suffix="${phoneSuffix}", name="${data.customerName}"`);

  try {
    // Limitar busca aos últimos 14 dias
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    // Buscar attendees R1 dos últimos 14 dias - com JOIN para trazer email/phone do contato
    const { data: attendeesRaw, error: queryError } = await supabase
      .from('meeting_slot_attendees')
      .select(`
        id,
        status,
        meeting_slot_id,
        attendee_name,
        attendee_phone,
        deal_id,
        meeting_slots!inner(
          id,
          scheduled_at,
          status,
          meeting_type,
          closer_id
        ),
        crm_deals!deal_id(
          id,
          crm_contacts!contact_id(email, phone)
        )
      `)
      .eq('meeting_slots.meeting_type', 'r1')
      .gte('meeting_slots.scheduled_at', twoWeeksAgo.toISOString())
      .in('meeting_slots.status', ['scheduled', 'completed', 'rescheduled', 'contract_paid'])
      .in('status', ['scheduled', 'invited', 'completed', 'rescheduled'])
      .eq('is_partner', false);

    if (queryError) {
      console.error('🎯 [AUTO-PAGO] Erro na query:', queryError.message);
      return { matched: false };
    }

    if (!attendeesRaw?.length) {
      console.log('🎯 [AUTO-PAGO] Nenhum attendee R1 encontrado nos últimos 14 dias');
      return { matched: false };
    }

    // Ordenar em JavaScript (mais confiável que ordenação nested do Supabase)
    const attendees = [...attendeesRaw].sort((a: any, b: any) => {
      const dateA = new Date(a.meeting_slots?.scheduled_at || 0).getTime();
      const dateB = new Date(b.meeting_slots?.scheduled_at || 0).getTime();
      return dateB - dateA; // Mais recente primeiro
    });

    console.log(`🎯 [AUTO-PAGO] ${attendees.length} attendees encontrados (últimos 14 dias)`);

    // Match em duas fases - email primeiro, telefone como fallback
    let matchingAttendee: any = null;
    let meeting: any = null;
    let matchType: string = '';
    let phoneMatchCandidate: { attendee: any; meeting: any } | null = null;

    for (const attendee of attendees) {
      if (!attendee.deal_id) {
        continue;
      }

      // Dados do contato já vieram no JOIN - sem query adicional!
      const contactEmail = attendee.crm_deals?.crm_contacts?.email?.toLowerCase()?.trim() || '';
      const contactPhone = (attendee.crm_deals?.crm_contacts?.phone || '').replace(/\D/g, '');

      // Log para debug detalhado
      console.log(`🔍 Verificando: ${attendee.attendee_name} | CRM email: "${contactEmail}" | CRM phone: "${contactPhone}" | deal: ${attendee.deal_id}`);

      // Match por EMAIL (prioridade 1) - break imediato
      if (emailLower && contactEmail && contactEmail === emailLower) {
        matchingAttendee = attendee;
        meeting = attendee.meeting_slots;
        matchType = 'email';
        console.log(`✅ [AUTO-PAGO] Match por EMAIL: ${attendee.attendee_name} - deal: ${attendee.deal_id}`);
        break;
      }

      // Match por TELEFONE (prioridade 2) - guardar como candidato, continuar buscando email
      if (phoneSuffix.length >= 8 && !phoneMatchCandidate) {
        const attendeePhoneClean = attendee.attendee_phone?.replace(/\D/g, '') || '';
        if (contactPhone.endsWith(phoneSuffix) || attendeePhoneClean.endsWith(phoneSuffix)) {
          phoneMatchCandidate = { attendee, meeting: attendee.meeting_slots };
          console.log(`📞 [AUTO-PAGO] Candidato por TELEFONE: ${attendee.attendee_name} - deal: ${attendee.deal_id}`);
        }
      }
    }

    // Se não encontrou por email, usar candidato de telefone
    if (!matchingAttendee && phoneMatchCandidate) {
      matchingAttendee = phoneMatchCandidate.attendee;
      meeting = phoneMatchCandidate.meeting;
      matchType = 'telefone';
      console.log(`✅ [AUTO-PAGO] Match final por TELEFONE: ${matchingAttendee.attendee_name} - deal: ${matchingAttendee.deal_id}`);
    }

    if (!matchingAttendee) {
      console.log(`🎯 [AUTO-PAGO] Nenhum match encontrado para email="${emailLower}" ou phone_suffix="${phoneSuffix}"`);
      return { matched: false };
    }

    console.log(`🎉 [AUTO-PAGO] Match por ${matchType.toUpperCase()}: Attendee ${matchingAttendee.id} (${matchingAttendee.attendee_name}) - Reunião: ${meeting.id}`);

    // Atualizar attendee para contract_paid com a data da reunião
    const { error: updateError } = await supabase
      .from('meeting_slot_attendees')
      .update({
        status: 'contract_paid',
        contract_paid_at: meeting.scheduled_at
      })
      .eq('id', matchingAttendee.id);

    if (updateError) {
      console.error('🎯 [AUTO-PAGO] Erro ao atualizar attendee:', updateError.message);
      return { matched: false };
    }

    console.log(`✅ [AUTO-PAGO] Attendee ${matchingAttendee.id} marcado como contract_paid`);

    // Atualizar reunião para completed se ainda não estiver
    if (meeting.status === 'scheduled' || meeting.status === 'rescheduled') {
      await supabase
        .from('meeting_slots')
        .update({ status: 'completed' })
        .eq('id', meeting.id);
      
      console.log(`✅ [AUTO-PAGO] Reunião ${meeting.id} marcada como completed`);
    }

    // Criar notificação para o closer agendar R2
    if (meeting.closer_id) {
      const { error: notifError } = await supabase
        .from('user_notifications')
        .insert({
          user_id: meeting.closer_id,
          type: 'contract_paid',
          title: '💰 Contrato Pago - Agendar R2',
          message: `${data.customerName || matchingAttendee.attendee_name || 'Cliente'} pagou o contrato! Agende a R2.`,
          data: {
            attendee_id: matchingAttendee.id,
            meeting_id: meeting.id,
            customer_name: data.customerName,
            sale_date: data.saleDate,
            attendee_name: matchingAttendee.attendee_name
          },
          read: false
        });

      if (notifError) {
        console.error('🎯 [AUTO-PAGO] Erro ao criar notificação:', notifError.message);
      } else {
        console.log(`🔔 [AUTO-PAGO] Notificação criada para closer: ${meeting.closer_id}`);
      }
    }

    // TRANSFERIR OWNERSHIP E MOVER ESTÁGIO DO DEAL
    let closerEmail: string | undefined;
    let dealTransferred = false;
    
    if (matchingAttendee.deal_id && meeting.closer_id) {
      try {
        // Buscar email do closer
        const { data: closerData } = await supabase
          .from('closers')
          .select('email')
          .eq('id', meeting.closer_id)
          .maybeSingle();
        
        closerEmail = closerData?.email;
        
        if (closerEmail) {
          // Buscar deal atual
          const { data: deal } = await supabase
            .from('crm_deals')
            .select('owner_id, original_sdr_email, r1_closer_email, origin_id')
            .eq('id', matchingAttendee.deal_id)
            .maybeSingle();
          
          if (deal) {
            // Buscar lista de closers para verificar se owner atual é closer
            const { data: closersList } = await supabase
              .from('closers')
              .select('email')
              .eq('is_active', true);
            
            const closerEmails = closersList?.map((c: { email: string }) => c.email.toLowerCase()) || [];
            const isOwnerCloser = closerEmails.includes(deal.owner_id?.toLowerCase() || '');
            
            // Buscar profile_id do closer para owner_profile_id
            const { data: closerProfile } = await supabase
              .from('profiles')
              .select('id')
              .eq('email', closerEmail)
              .maybeSingle();
            
            // Buscar stage "Contrato Pago" no pipeline
            const { data: contractPaidStage } = await supabase
              .from('crm_stages')
              .select('id')
              .eq('origin_id', deal.origin_id)
              .ilike('stage_name', '%Contrato Pago%')
              .maybeSingle();
            
            // Atualizar deal com transferência de ownership
            const updatePayload: Record<string, unknown> = {
              owner_id: closerEmail,
              r1_closer_email: closerEmail,
            };
            
            // Preservar SDR original se owner atual não é closer
            if (!deal.original_sdr_email && deal.owner_id && !isOwnerCloser) {
              updatePayload.original_sdr_email = deal.owner_id;
            }
            
            // Atualizar owner_profile_id se encontrou o profile
            if (closerProfile?.id) {
              updatePayload.owner_profile_id = closerProfile.id;
            }
            
            // Mover para estágio Contrato Pago se encontrou
            if (contractPaidStage?.id) {
              updatePayload.stage_id = contractPaidStage.id;
            }
            
            const { error: dealUpdateError } = await supabase
              .from('crm_deals')
              .update(updatePayload)
              .eq('id', matchingAttendee.deal_id);
            
            if (dealUpdateError) {
              console.error(`❌ [AUTO-PAGO] Erro ao transferir deal:`, dealUpdateError.message);
            } else {
              dealTransferred = true;
              console.log(`✅ [AUTO-PAGO] Deal ${matchingAttendee.deal_id} transferido para ${closerEmail}`);
              console.log(`📋 [AUTO-PAGO] Campos atualizados:`, JSON.stringify(updatePayload));
            }
          }
        } else {
          console.log(`⚠️ [AUTO-PAGO] Closer ${meeting.closer_id} não encontrado na tabela closers`);
        }
      } catch (ownershipErr: any) {
        console.error(`❌ [AUTO-PAGO] Erro na transferência de ownership:`, ownershipErr.message);
      }
    }

    console.log(`🎉 [AUTO-PAGO] Contrato marcado como pago automaticamente!`);
    
    return {
      matched: true,
      attendee_id: matchingAttendee.id,
      attendee_name: matchingAttendee.attendee_name,
      match_type: matchType,
      deal_transferred: dealTransferred,
      closer_email: closerEmail,
    };
  } catch (err: any) {
    console.error('🎯 [AUTO-PAGO] Erro:', err.message);
    return { matched: false };
  }
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

    // ===== AUTO-MARCAR CONTRATO PAGO =====
    console.log('🎯 Iniciando auto-marcação de contrato pago...');
    const autoMarkResult = await autoMarkContractPaid(supabase, {
      customerEmail: body.email,
      customerPhone: body.telefone || null,
      customerName: body.nome,
      saleDate: saleDate,
    });

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
        auto_mark_result: autoMarkResult,
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
