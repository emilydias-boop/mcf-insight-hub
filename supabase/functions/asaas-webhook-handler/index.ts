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
    return 'incorporador';
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

// Buscar categoria do produto na tabela product_configurations (fallback para getProductCategory)
async function getProductCategoryFromDB(supabase: any, productName: string): Promise<string> {
  if (!productName) return 'outros';
  try {
    const { data } = await supabase
      .from('product_configurations')
      .select('product_category')
      .eq('product_name', productName)
      .limit(1)
      .single();
    if (data?.product_category) return data.product_category;
  } catch (_) { /* fallback */ }
  return getProductCategory(productName);
}

// Helper to normalize phone numbers for matching
function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '').slice(-11); // Keep last 11 digits
}

// ============ REGRA DE OUTSIDE (espelho do hubla-webhook-handler) ============
// Fallback estático — a fonte de verdade é a tabela public.outside_offers
const OUTSIDE_OFFER_NAMES = [
  'Contrato - Curso R$ 97,00',
  'Contrato Perfil A - Vitrine A010',
  'A000 - Contrato MCF - Construir pra Alugar',
];

function isOutsideOffer(offerName: string | null | undefined): boolean {
  if (!offerName) return false;
  const normalized = offerName.toLowerCase().trim();
  return OUTSIDE_OFFER_NAMES.some(n => n.toLowerCase() === normalized);
}

// Consulta a tabela configurável de ofertas Outside (nome OU offer_id).
// Em caso de erro, cai no fallback estático por nome (nunca derruba o webhook).
async function isOutsideOfferDb(
  supabase: any,
  offerName: string | null | undefined,
  offerId?: string | null,
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('outside_offers')
      .select('offer_name, offer_id')
      .eq('is_active', true);

    if (error) throw error;

    if (data && data.length > 0) {
      const normalizedName = (offerName || '').toLowerCase().trim();
      const normalizedId = (offerId || '').trim();
      return data.some((row: any) => {
        const rowName = (row.offer_name || '').toLowerCase().trim();
        const rowId = (row.offer_id || '').trim();
        if (rowName && normalizedName && rowName === normalizedName) return true;
        if (rowId && normalizedId && rowId === normalizedId) return true;
        return false;
      });
    }
  } catch (e) {
    console.error('⚠️ [Asaas][OUTSIDE] Falha ao ler outside_offers, usando fallback estático:', (e as Error).message);
  }
  return isOutsideOffer(offerName);
}

// Aplica a regra de Outside: mesma etapa (Contrato Pago), mesmo dono fixo (Nicola),
// mesmas tags (Outside/Hubla), mesma atividade (outside_detected).
async function processOutsideOffer(supabase: any, data: {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  offerName: string | null;
  offerId: string | null;
  saleDate: string;
  transactionHublaId: string | null;
}): Promise<void> {
  const emailLower = (data.customerEmail || '').toLowerCase().trim();
  if (!emailLower) {
    console.log('ℓ [Asaas][OUTSIDE] Sem e-mail do cliente — regra de outside não aplicada');
    return;
  }

  console.log(`🔄 [Asaas][OUTSIDE] Oferta Outside detectada ("${data.offerName}"). Buscando deal para email: ${emailLower}`);

  // Buscar contact pelo email
  let { data: outsideContact } = await supabase
    .from('crm_contacts')
    .select('id, name, phone')
    .ilike('email', emailLower)
    .limit(1)
    .maybeSingle();

  // Origin Inside Sales (EXACT match para não pegar "... - LEAD GRATUITO")
  const { data: outsideOrigin } = await supabase
    .from('crm_origins')
    .select('id')
    .ilike('name', 'PIPELINE INSIDE SALES')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!outsideOrigin?.id) {
    console.log('⚠️ [Asaas][OUTSIDE] Origin PIPELINE INSIDE SALES não encontrada — abortando');
    return;
  }

  // Dedupe por telefone quando o e-mail não achou contato
  if (!outsideContact?.id) {
    const phoneDigitsLocal = (data.customerPhone || '').replace(/\D/g, '');
    if (phoneDigitsLocal.length >= 10) {
      const phoneSuffixLocal = phoneDigitsLocal.slice(-9);
      const { data: byPhoneContact } = await supabase
        .from('crm_contacts')
        .select('id, name, phone, email, custom_fields')
        .ilike('phone', `%${phoneSuffixLocal}`)
        .eq('is_archived', false)
        .limit(1)
        .maybeSingle();
      if (byPhoneContact?.id) {
        outsideContact = byPhoneContact;
        console.log(`📞 [Asaas][OUTSIDE] Contato encontrado por TELEFONE (${phoneSuffixLocal}): ${byPhoneContact.id}`);

        const existingEmail = (byPhoneContact.email || '').toLowerCase().trim();
        if (existingEmail !== emailLower) {
          const cf = (byPhoneContact.custom_fields && typeof byPhoneContact.custom_fields === 'object')
            ? { ...byPhoneContact.custom_fields }
            : {};
          const alt: string[] = Array.isArray((cf as any).emails_alternativos)
            ? (cf as any).emails_alternativos
            : [];
          if (!alt.includes(emailLower)) alt.push(emailLower);
          (cf as any).emails_alternativos = alt;

          const updatePayload: Record<string, unknown> = { custom_fields: cf };
          if (!existingEmail) updatePayload.email = emailLower;

          await supabase.from('crm_contacts').update(updatePayload).eq('id', byPhoneContact.id);
          console.log(`✉️ [Asaas][OUTSIDE] E-mail da compra "${emailLower}" anexado ao contato ${byPhoneContact.id}`);
        }
      }
    }
  }

  if (!outsideContact?.id) {
    const { data: createdContact } = await supabase
      .from('crm_contacts')
      .insert({
        clint_id: `hubla-outside-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        name: data.customerName || 'Cliente Outside',
        email: emailLower,
        phone: data.customerPhone || null,
        origin_id: outsideOrigin.id,
        tags: ['Outside', 'Hubla'],
        custom_fields: { source: 'hubla_outside', offer_name: data.offerName },
      })
      .select('id, name, phone')
      .maybeSingle();
    if (createdContact?.id) {
      outsideContact = createdContact;
      console.log(`🆕 [Asaas][OUTSIDE] Contato criado: ${outsideContact.id}`);
    }
  }

  if (!outsideContact?.id) {
    console.log(`❌ [Asaas][OUTSIDE] Não foi possível obter/criar contato para ${emailLower}`);
    return;
  }

  const { data: outsideDeal } = await supabase
    .from('crm_deals')
    .select('id, owner_id, owner_profile_id, origin_id, tags, stage_id')
    .eq('contact_id', outsideContact.id)
    .eq('origin_id', outsideOrigin.id)
    .limit(1)
    .maybeSingle();

  // Stage "Contrato Pago" (fallback Novo Lead)
  const { data: contractPaidStage } = await supabase
    .from('crm_stages')
    .select('id')
    .eq('origin_id', outsideOrigin.id)
    .ilike('stage_name', '%Contrato Pago%')
    .maybeSingle();
  let fallbackStageId: string | null = contractPaidStage?.id || null;
  if (!fallbackStageId) {
    const { data: novoLeadStage } = await supabase
      .from('crm_stages')
      .select('id')
      .eq('origin_id', outsideOrigin.id)
      .ilike('stage_name', '%Novo Lead%')
      .maybeSingle();
    fallbackStageId = novoLeadStage?.id || null;
  }

  // Regra fixa: leads Outside são propriedade do Nicola Ricci
  const OUTSIDE_OWNER_EMAIL = 'nicola.ricci@minhacasafinanciada.com';
  const getNextOwner = async (): Promise<{ email: string | null; profileId: string | null }> => {
    const ownerProfileId = await resolveActiveOwnerProfileId(
      supabase, OUTSIDE_OWNER_EMAIL, 'Asaas][OUTSIDE');
    console.log(`🎯 [Asaas][OUTSIDE] Owner fixo Outside: ${OUTSIDE_OWNER_EMAIL}`);
    return { email: OUTSIDE_OWNER_EMAIL, profileId: ownerProfileId };
  };

  if (!outsideDeal) {
    // ===== Deal não existe → criar + atribuir =====
    console.log('🆕 [Asaas][OUTSIDE] Nenhum deal em Inside Sales — criando deal Outside');
    const { email: newOwnerEmail, profileId: newOwnerProfileId } = await getNextOwner();

    const { data: newDeal, error: newDealErr } = await supabase
      .from('crm_deals')
      .insert({
        clint_id: `hubla-outside-deal-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        name: `${outsideContact.name || data.customerName || 'Cliente'} - Outside`,
        contact_id: outsideContact.id,
        origin_id: outsideOrigin.id,
        stage_id: fallbackStageId,
        owner_id: newOwnerEmail,
        owner_profile_id: newOwnerProfileId,
        value: 0,
        tags: ['Outside', 'Hubla'],
        custom_fields: {
          source: 'hubla_outside',
          offer_name: data.offerName,
          created_via: 'outside_no_deal_flow',
          a010_compra: true,
        },
        data_source: 'webhook',
        stage_moved_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle();

    if (newDealErr) {
      console.error('❌ [Asaas][OUTSIDE] Erro ao criar deal Outside:', newDealErr.message);
      return;
    }
    if (!newDeal?.id) return;

    console.log(`✅ [Asaas][OUTSIDE] Deal Outside criado ${newDeal.id} owner=${newOwnerEmail}`);

    await supabase.from('deal_activities').insert({
      deal_id: newDeal.id,
      activity_type: 'owner_change',
      description: newOwnerEmail
        ? `Deal Outside criado e distribuído para ${newOwnerEmail} via webhook MCF Pay/Asaas (sem R1 prévia)`
        : `Deal Outside criado sem owner via webhook MCF Pay/Asaas`,
      metadata: {
        new_owner: newOwnerEmail,
        new_owner_profile_id: newOwnerProfileId,
        distributed_at: new Date().toISOString(),
        distribution_type: 'outside_webhook_create',
        contact_email: emailLower,
        offer_name: data.offerName,
        trigger: 'contract_paid_outside_no_deal',
      },
    });

    if (data.transactionHublaId) {
      await supabase
        .from('hubla_transactions')
        .update({ linked_deal_id: newDeal.id })
        .eq('hubla_id', data.transactionHublaId);
    }

    if (newOwnerEmail) {
      const { data: sdrProfile } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', newOwnerEmail)
        .maybeSingle();
      if (sdrProfile?.id) {
        await supabase.from('user_notifications').insert({
          user_id: sdrProfile.id,
          type: 'contract_paid',
          title: '💰 Contrato Outside (novo lead) - Verifique',
          message: `${data.customerName || 'Cliente'} pagou contrato Outside (${data.offerName}). Lead foi criado e atribuído a você.`,
          metadata: {
            deal_id: newDeal.id,
            customer_name: data.customerName,
            customer_email: emailLower,
            sale_date: data.saleDate,
            offer_name: data.offerName,
            trigger: 'outside_no_deal_created',
          },
          read: false,
        });
      }
    }
    return;
  }

  // ===== Deal existe → mover para Contrato Pago + tags + owner fixo =====
  const currentTags = Array.isArray(outsideDeal.tags) ? outsideDeal.tags : [];
  const newTags = currentTags.includes('Outside') ? currentTags : [...currentTags, 'Outside'];

  const previousOwnerEmail: string | null = outsideDeal.owner_id || null;
  const previousOwnerProfileId: string | null = outsideDeal.owner_profile_id || null;

  const fixedOwner = await getNextOwner();
  const assignedOwnerEmail: string | null = fixedOwner.email;
  const assignedOwnerProfileId: string | null = fixedOwner.profileId;
  const ownerChanged =
    !!assignedOwnerEmail &&
    (previousOwnerEmail || '').toLowerCase() !== assignedOwnerEmail.toLowerCase();
  console.log(`🎯 [Asaas][OUTSIDE] Deal ${outsideDeal.id} owner anterior=${previousOwnerEmail || 'NENHUM'} → owner Outside=${assignedOwnerEmail}`);

  const updatePayload: Record<string, unknown> = {
    tags: newTags,
    updated_at: new Date().toISOString(),
  };
  if (ownerChanged) {
    updatePayload.owner_id = assignedOwnerEmail;
    updatePayload.owner_profile_id = assignedOwnerProfileId;
  }
  if (contractPaidStage?.id) {
    updatePayload.stage_id = contractPaidStage.id;
  }

  await supabase
    .from('crm_deals')
    .update(updatePayload)
    .eq('id', outsideDeal.id);

  await supabase
    .from('deal_activities')
    .insert({
      deal_id: outsideDeal.id,
      activity_type: 'outside_detected',
      description: ownerChanged
        ? `Lead Outside reatribuído de ${previousOwnerEmail || 'sem dono'} para ${assignedOwnerEmail} via webhook MCF Pay/Asaas (regra fixa Outside)`
        : `Movido para Contrato Pago como Outside (pagamento sem R1) via webhook MCF Pay/Asaas`,
      metadata: {
        from: previousOwnerEmail,
        to: assignedOwnerEmail,
        previous_owner: previousOwnerEmail,
        previous_owner_profile_id: previousOwnerProfileId,
        new_owner: assignedOwnerEmail,
        new_owner_profile_id: assignedOwnerProfileId,
        distributed_at: new Date().toISOString(),
        distribution_type: ownerChanged ? 'outside_fixed_owner_reassign' : 'outside_owner_kept',
        contact_email: emailLower,
        offer_name: data.offerName,
        trigger: 'contract_paid_no_r1',
        moved_to_stage: contractPaidStage?.id || null,
      },
    });

  if (data.transactionHublaId) {
    await supabase
      .from('hubla_transactions')
      .update({ linked_deal_id: outsideDeal.id })
      .eq('hubla_id', data.transactionHublaId);
  }

  if (assignedOwnerEmail) {
    const { data: sdrProfile } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', assignedOwnerEmail)
      .maybeSingle();

    if (sdrProfile?.id) {
      await supabase
        .from('user_notifications')
        .insert({
          user_id: sdrProfile.id,
          type: 'contract_paid',
          title: '💰 Contrato Pago Outside - Verifique seus leads',
          message: `${data.customerName || 'Cliente'} pagou contrato Outside (${data.offerName}). Verifique e dê o tratamento devido.`,
          metadata: {
            deal_id: outsideDeal.id,
            customer_name: data.customerName,
            customer_email: emailLower,
            sale_date: data.saleDate,
            offer_name: data.offerName,
            trigger: 'contract_paid_outside_no_r1',
          },
          read: false,
        });
      console.log(`🔔 [Asaas][OUTSIDE] Notificação criada para SDR ${assignedOwnerEmail}`);
    }
  }
}
// ============ FIM REGRA DE OUTSIDE ============




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
        // stage_change vem do trigger trg_log_deal_stage_change.
        activity_type: 'partner_detected',
        description: `Venda de parceria realizada via Asaas: ${data.productName}`,
        metadata: {
          to_stage_name: vendaStage.stage_name,
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
    // Oferta da compra — hoje o MCF Pay manda `offers` VAZIO, então fica null
    let offerName: string | null = null;
    let offerId: string | null = null;

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

      // Asaas padrão não traz oferta; usa campos equivalentes se existirem, senão null
      offerName = payment.offer_name ?? payment.offerName ?? null;
      offerId = payment.offer_id ?? payment.offerId ?? null;

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
      // Campos equivalentes de oferta, se existirem; senão null
      offerName = data.offer_name ?? data.offerName ?? null;
      offerId = data.offer_id ?? data.offerId ?? null;

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

      // Oferta: primeira offer encontrada em event.products[].offers[].
      // ATENÇÃO: hoje o MCF Pay envia `offers` como array VAZIO — nesse caso fica null
      // (nunca inventamos valor). Quando o MCF Pay passar a enviar, offerName/offerId
      // passam a ser gravados em hubla_transactions automaticamente.
      const mcfProducts = Array.isArray(hublaEvent?.products) ? hublaEvent.products : [];
      for (const p of mcfProducts) {
        const offers = Array.isArray(p?.offers) ? p.offers : [];
        const firstOffer = offers.find((o: any) => o && (o.name || o.id));
        if (firstOffer) {
          offerName = firstOffer.name ?? null;
          offerId = firstOffer.id ?? null;
          break;
        }
      }

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

    // Determinar categoria do produto (busca no DB primeiro, fallback para lógica local)
    const productCategory = await getProductCategoryFromDB(supabase, productName);
    console.log(`[Asaas] Produto: "${productName}" | Categoria: ${productCategory} | Oferta: "${offerName ?? 'null'}" (id: ${offerId ?? 'null'})`);

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
      offer_name: offerName,
      offer_id: offerId,
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
