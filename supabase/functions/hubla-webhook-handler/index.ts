import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Produtos que ENTRAM no Incorporador 50k (A006 EXCLUÍDO - é renovação)
const INCORPORADOR_50K_CATEGORIES = ['a000', 'a001', 'a002', 'a003', 'a004', 'a005', 'a008', 'a009', 'contrato-anticrise'];

// Produtos EXCLUÍDOS (consórcio/leilão e renovação)
const EXCLUDED_FROM_INCORPORADOR = [
  'A006', 'RENOVAÇÃO PARCEIRO', 'CONTRATO - EFEITO ALAVANCA', 'CONTRATO - CLUBE DO ARREMATE',
  'IMERSÃO SÓCIOS', 'IMERSÃO SÓCIOS MCF'
];

const PRODUCT_MAPPING: Record<string, string> = {
  // Incorporador 50k (A006 agora é renovacao, não incorporador)
  'A001': 'incorporador',
  'A002': 'incorporador',
  'A003': 'incorporador',
  'A004': 'incorporador',
  'A005': 'incorporador',
  'A008': 'incorporador',
  'A009': 'incorporador',
  'A000': 'incorporador',
  'CONTRATO': 'incorporador',
  'CONTRATO - ANTICRISE': 'contrato-anticrise',
  'ANTICRISE': 'contrato-anticrise',
  
  // A006 é renovação, NÃO incorporador
  'A006': 'renovacao',
  'RENOVAÇÃO PARCEIRO': 'renovacao',
  
  // A010
  'A010': 'a010',
  'A010 - INCORPORADOR': 'a010',
  
  // Order Bumps
  'CONSTRUIR PARA ALUGAR': 'ob_construir_alugar',
  'VIVER DE ALUGUEL': 'ob_construir_alugar',
  'COMO VIVER DE ALUGUEL': 'ob_construir_alugar',
  'CONSTRUIR PARA VENDER': 'ob_construir_vender',
  'ACESSO VITALIC': 'ob_vitalicio',
  'ACESSO VITALÍCIO': 'ob_vitalicio',
  'VITALÍCIO': 'ob_vitalicio',
  'OB - VITALÍCIO': 'ob_vitalicio',
  'GESTÃO DE OBRAS': 'ob_construir_gestao_obras',
  'OB - CONSTRUIR (GESTÃO DE OBRAS)': 'ob_construir_gestao_obras',
  'OB - EVENTO': 'ob_evento',
  'EVENTO OB': 'ob_evento',
  
  // Outros produtos
  'CONTRATO INDIVIDUAL': 'contrato',
  'CONTRATO COMBO': 'contrato',
  'MCF PLANO ANTICRISE': 'parceria',
  'MCF INCORPORADOR COMPLETO': 'parceria',
  'MCF INCORPORADOR': 'parceria',
  'RENOVAÇÃO': 'renovacao',
  'RENOVAÇÃO ANUAL': 'renovacao',
  'CAPTAÇÃO': 'captacao',
  'CAPTAÇÃO DE RECURSOS': 'captacao',
  'P2': 'p2',
  'P2 - MERCADO PRIMÁRIO': 'p2',
  'FORMAÇÃO': 'formacao',
  'FORMAÇÃO DE CORRETORES': 'formacao',
  'PROJETOS': 'projetos',
  'DESENVOLVIMENTO DE PROJETOS': 'projetos',
  'EFEITO ALAVANCA': 'efeito_alavanca',
  'EA': 'efeito_alavanca',
  'MENTORIA CAIXA': 'mentoria_caixa',
  'MENTORIA CAIXA INDIVIDUAL': 'mentoria_caixa',
  'MENTORIA GRUPO CAIXA': 'mentoria_grupo_caixa',
  'MGC': 'mentoria_grupo_caixa',
  'SÓCIOS': 'socios',
  'PROGRAMA SÓCIOS': 'socios',
  'A007': 'socios',
  'CLUBE ARREMATE': 'clube_arremate',
  'CA': 'clube_arremate',
  'IMERSÃO': 'imersao',
  'IMERSÃO PRESENCIAL': 'ob_evento',
  'IMERSÃO SÓCIOS': 'imersao_socios',
  'IMERSÃO SÓCIOS MCF': 'imersao_socios',
  'IS': 'imersao_socios',
};

function mapProductCategory(productName: string, productCode?: string): string {
  const name = productName?.toUpperCase() || '';
  const code = productCode?.toUpperCase() || '';
  
  // Verificar se é produto excluído do Incorporador 50k
  for (const excluded of EXCLUDED_FROM_INCORPORADOR) {
    if (name.includes(excluded) || code === excluded) {
      // Mapear para categoria correta
      if (excluded === 'A006' || excluded === 'RENOVAÇÃO PARCEIRO') return 'renovacao';
      if (excluded.includes('IMERSÃO SÓCIOS')) return 'imersao_socios';
      if (excluded.includes('EFEITO ALAVANCA')) return 'efeito_alavanca';
      if (excluded.includes('CLUBE DO ARREMATE')) return 'clube_arremate';
    }
  }
  
  // Tentar match exato por código
  if (code && PRODUCT_MAPPING[code]) {
    return PRODUCT_MAPPING[code];
  }
  
  // Tentar match exato por nome
  if (PRODUCT_MAPPING[name]) {
    return PRODUCT_MAPPING[name];
  }
  
  // Tentar match parcial
  for (const [key, category] of Object.entries(PRODUCT_MAPPING)) {
    if (name.includes(key) || (code && code.includes(key))) {
      return category;
    }
  }
  
  return 'outros';
}

// Extrair informações de smartInstallment do invoice
function extractSmartInstallment(invoice: any): { installment: number; installments: number } {
  const smartInstallment = invoice?.smartInstallment;
  
  // CORREÇÃO: Priorizar smartInstallment, fallback para installments do invoice
  if (smartInstallment) {
    return {
      installment: smartInstallment.installment || 1,
      installments: smartInstallment.installments || invoice?.installments || 1,
    };
  }
  
  // Fallback: Se não tem smartInstallment mas tem installments
  const installments = invoice?.installments || 1;
  return { installment: 1, installments };
}

// NOVA FUNÇÃO: Extrair preço TOTAL do produto (não apenas da parcela)
// Para produtos parcelados, precisamos calcular o valor total
function extractProductTotalPrice(event: any): number {
  // Prioridade 1: subscription.totalAmount (valor total do parcelamento)
  const subscription = event.subscriptions?.[0];
  if (subscription?.totalAmount) {
    console.log(`💰 [PREÇO] Usando subscription.totalAmount: R$ ${subscription.totalAmount / 100}`);
    return subscription.totalAmount / 100;
  }
  
  // Prioridade 2: offers[].price (geralmente contém o valor cheio)
  const offer = event.products?.[0]?.offers?.[0];
  if (offer?.price) {
    console.log(`💰 [PREÇO] Usando offer.price: R$ ${offer.price / 100}`);
    return offer.price / 100;
  }
  
  // Prioridade 3: Calcular com installments
  const invoice = event.invoice;
  const installments = invoice?.installments || invoice?.smartInstallment?.installments || 1;
  const subtotalCents = invoice?.amount?.subtotalCents || 0;
  
  // Se tem mais de 1 parcela, multiplicar para obter valor total
  if (installments > 1) {
    const totalPrice = (subtotalCents / 100) * installments;
    console.log(`💰 [PREÇO] Calculado (${subtotalCents/100} x ${installments}): R$ ${totalPrice}`);
    return totalPrice;
  }
  
  // Fallback: usar subtotalCents como está
  console.log(`💰 [PREÇO] Fallback subtotalCents: R$ ${subtotalCents / 100}`);
  return subtotalCents / 100;
}

// CORREÇÃO: Extrair valores corretos do invoice
// Bruto = subtotalCents (sem juros de parcelamento)
// Líquido = sellerTotalCents - installmentFeeCents
function extractCorrectValues(invoice: any): {
  subtotalCents: number;
  installmentFeeCents: number;
  sellerTotalCents: number;
  grossValue: number;
  netValue: number;
} {
  const amount = invoice?.amount || {};
  const receivers = invoice?.receivers || [];
  
  const subtotalCents = amount.subtotalCents || amount.totalCents || 0;
  const installmentFeeCents = amount.installmentFeeCents || 0;
  
  const sellerReceiver = receivers.find((r: any) => r.role === 'seller');
  const sellerTotalCents = sellerReceiver?.totalCents || 0;
  
  // Bruto = subtotal em centavos convertido para reais
  const grossValue = subtotalCents / 100;
  
  // Líquido = seller total - juros de parcelamento (convertido para reais)
  const netValue = (sellerTotalCents - installmentFeeCents) / 100;
  
  return {
    subtotalCents,
    installmentFeeCents,
    sellerTotalCents,
    grossValue,
    netValue: netValue > 0 ? netValue : grossValue * 0.9417, // Fallback se não tiver seller
  };
}

// ============= HELPER: Normalizar telefone =============
function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  
  let clean = phone.replace(/\D/g, '');
  
  if (clean.startsWith('0')) {
    clean = clean.substring(1);
  }
  
  if (!clean.startsWith('55') && clean.length <= 11) {
    clean = '55' + clean;
  }
  
  return '+' + clean;
}

// ============= HELPER: Criar/Atualizar Contato e Deal no CRM =============
interface CRMContactData {
  email: string | null;
  phone: string | null;
  name: string | null;
  originName: string;
  productName: string;
  value: number;
}

async function createOrUpdateCRMContact(supabase: any, data: CRMContactData): Promise<void> {
  if (!data.email && !data.phone) {
    console.log('[CRM] Sem email ou telefone, pulando criação de contato');
    return;
  }
  
  // Normalizar telefone
  const normalizedPhone = normalizePhone(data.phone);
  console.log(`[CRM] Telefone normalizado: ${data.phone} -> ${normalizedPhone}`);
  
  try {
    // 1. Buscar ou criar origem
    let originId: string | null = null;
    const { data: existingOrigin } = await supabase
      .from('crm_origins')
      .select('id')
      .ilike('name', data.originName)
      .maybeSingle();
    
    if (existingOrigin) {
      originId = existingOrigin.id;
    } else {
      // Criar nova origem
      const { data: newOrigin } = await supabase
        .from('crm_origins')
        .insert({
          clint_id: `hubla-origin-${Date.now()}`,
          name: data.originName,
          description: 'Criada automaticamente via webhook Hubla'
        })
        .select('id')
        .single();
      
      if (newOrigin) {
        originId = newOrigin.id;
        console.log(`[CRM] Origem criada: ${data.originName} (${originId})`);
      }
    }
    
    // 2. Buscar contato existente pelo EMAIL primeiro (prioridade)
    let contactId: string | null = null;
    let existingContact: any = null;
    
    if (data.email) {
      const { data: byEmail } = await supabase
        .from('crm_contacts')
        .select('id, phone')
        .ilike('email', data.email)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      
      if (byEmail) {
        existingContact = byEmail;
        contactId = byEmail.id;
        console.log(`[CRM] Contato existente por email: ${contactId}`);
      }
    }
    
    // 3. Se não encontrou por email, buscar por telefone normalizado
    if (!contactId && normalizedPhone) {
      const phoneDigits = normalizedPhone.replace(/\D/g, '');
      const { data: byPhone } = await supabase
        .from('crm_contacts')
        .select('id, email, phone')
        .or(`phone.eq.${normalizedPhone},phone.eq.+${phoneDigits},phone.eq.${phoneDigits}`)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      
      if (byPhone) {
        existingContact = byPhone;
        contactId = byPhone.id;
        console.log(`[CRM] Contato existente por telefone: ${contactId}`);
      }
    }
    
    // 4. Se encontrou contato, atualizar telefone para formato normalizado
    if (existingContact && normalizedPhone && existingContact.phone !== normalizedPhone) {
      await supabase
        .from('crm_contacts')
        .update({ phone: normalizedPhone, updated_at: new Date().toISOString() })
        .eq('id', existingContact.id);
      console.log(`[CRM] Telefone atualizado para formato normalizado`);
    }
    
    // 5. Se não encontrou, criar novo contato com telefone normalizado
    if (!contactId) {
      const { data: newContact, error: contactError } = await supabase
        .from('crm_contacts')
        .insert({
          clint_id: `hubla-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          name: data.name || 'Cliente A010',
          email: data.email,
          phone: normalizedPhone, // TELEFONE NORMALIZADO
          origin_id: originId,
          tags: ['A010', 'Hubla'],
          custom_fields: { source: 'hubla', product: data.productName }
        })
        .select('id')
        .single();
      
      if (!contactError && newContact) {
        contactId = newContact.id;
        console.log(`[CRM] Contato criado: ${data.name} (${contactId})`);
      }
    }
    
    // 3. Buscar estágio "Novo Lead" para a origem
    let stageId: string | null = null;
    if (originId) {
      const { data: stage } = await supabase
        .from('crm_stages')
        .select('id')
        .eq('origin_id', originId)
        .order('stage_order', { ascending: true })
        .limit(1)
        .maybeSingle();
      
      stageId = stage?.id;
    }
    
    // Se não encontrou stage da origem, buscar stage genérico "Novo Lead"
    if (!stageId) {
      const { data: genericStage } = await supabase
        .from('crm_stages')
        .select('id')
        .ilike('stage_name', '%novo lead%')
        .limit(1)
        .maybeSingle();
      
      stageId = genericStage?.id;
    }
    
    // 4. Verificar se já existe deal para este contato com A010
    if (contactId) {
      const { data: existingDeal } = await supabase
        .from('crm_deals')
        .select('id')
        .eq('contact_id', contactId)
        .ilike('product_name', '%A010%')
        .maybeSingle();
      
      if (existingDeal) {
        console.log(`[CRM] Deal A010 já existe para este contato: ${existingDeal.id}`);
        return;
      }
      
      // 4.1 NOVO: Herdar owner de outro deal do mesmo contato
      let inheritedOwnerId: string | null = null;
      const { data: dealWithOwner } = await supabase
        .from('crm_deals')
        .select('owner_id')
        .eq('contact_id', contactId)
        .not('owner_id', 'is', null)
        .limit(1)
        .maybeSingle();
      
      if (dealWithOwner?.owner_id) {
        inheritedOwnerId = dealWithOwner.owner_id;
        console.log(`[CRM] Owner herdado de outro deal: ${inheritedOwnerId}`);
      }
      
      // 5. Criar novo deal (com owner herdado se disponível)
      const { data: newDeal, error: dealError } = await supabase
        .from('crm_deals')
        .insert({
          clint_id: `hubla-deal-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          name: `${data.name || 'Cliente'} - A010`,
          value: data.value || 0,
          contact_id: contactId,
          origin_id: originId,
          stage_id: stageId,
          owner_id: inheritedOwnerId, // NOVO: owner herdado
          product_name: data.productName,
          tags: ['A010', 'Hubla'],
          custom_fields: { source: 'hubla', product: data.productName },
          data_source: 'webhook'
        })
        .select('id')
        .single();
      
      if (!dealError && newDeal) {
        console.log(`[CRM] Deal criado: ${data.name} - A010 (${newDeal.id}) com owner: ${inheritedOwnerId || 'nenhum'}`);
        
        // 6. Gerar tarefas automáticas baseadas nos templates do estágio
        if (stageId) {
          await generateTasksForDeal(supabase, {
            dealId: newDeal.id,
            contactId: contactId,
            ownerId: inheritedOwnerId, // NOVO: passar owner herdado para as tarefas
            originId,
            stageId,
          });
        }
      } else if (dealError) {
        console.error('[CRM] Erro ao criar deal:', dealError);
      }
    }
  } catch (err) {
    console.error('[CRM] Erro ao criar/atualizar contato:', err);
  }
}

// ============= HELPER: Gerar tarefas automáticas para deal =============
async function generateTasksForDeal(supabase: any, params: {
  dealId: string;
  contactId: string | null;
  ownerId: string | null;
  originId: string | null;
  stageId: string;
}): Promise<void> {
  try {
    // Buscar templates ativos para este estágio
    let query = supabase
      .from('activity_templates')
      .select('*')
      .eq('is_active', true)
      .eq('stage_id', params.stageId)
      .order('order_index', { ascending: true });

    if (params.originId) {
      query = query.or(`origin_id.eq.${params.originId},origin_id.is.null`);
    }

    const { data: templates, error: fetchError } = await query;
    if (fetchError) {
      console.error('[Tasks] Erro ao buscar templates:', fetchError);
      return;
    }

    if (!templates || templates.length === 0) {
      console.log('[Tasks] Nenhum template encontrado para o estágio');
      return;
    }

    // Criar tarefas baseadas nos templates
    const now = new Date();
    const tasks = templates.map((template: any) => ({
      deal_id: params.dealId,
      contact_id: params.contactId,
      template_id: template.id,
      owner_id: params.ownerId,
      title: template.name,
      description: template.description,
      type: template.type,
      status: 'pending',
      due_date: template.sla_offset_minutes 
        ? new Date(now.getTime() + template.sla_offset_minutes * 60000).toISOString()
        : template.default_due_days
          ? new Date(now.getTime() + template.default_due_days * 24 * 60 * 60000).toISOString()
          : new Date(now.getTime() + 24 * 60 * 60000).toISOString(), // fallback: 1 day
      created_by: null,
    }));

    const { error: insertError } = await supabase
      .from('deal_tasks')
      .insert(tasks);

    if (insertError) {
      console.error('[Tasks] Erro ao criar tarefas:', insertError);
    } else {
      console.log(`[Tasks] ${tasks.length} tarefa(s) criada(s) para deal ${params.dealId}`);
    }
  } catch (err) {
    console.error('[Tasks] Erro ao gerar tarefas:', err);
  }
}

// ============= HELPER: Auto-marcar Contrato Pago para Incorporador =============
interface AutoMarkData {
  customerEmail: string | null;
  customerPhone: string | null;
  customerName: string | null;
  saleDate: string;
}

async function autoMarkContractPaid(supabase: any, data: AutoMarkData): Promise<void> {
  if (!data.customerEmail && !data.customerPhone) {
    console.log('🎯 [AUTO-PAGO] Sem email ou telefone para buscar reunião');
    return;
  }

  console.log(`🎯 [AUTO-PAGO] Buscando reunião R1 para: ${data.customerEmail || data.customerPhone}`);

  try {
    // Normalizar telefone para busca
    const phoneDigits = data.customerPhone?.replace(/\D/g, '') || '';
    const phoneSuffix = phoneDigits.slice(-9);

    // 1. Buscar contatos pelo email ou telefone
    let contactIds: string[] = [];

    if (data.customerEmail) {
      const { data: contactsByEmail } = await supabase
        .from('crm_contacts')
        .select('id')
        .ilike('email', data.customerEmail)
        .limit(5);
      
      if (contactsByEmail?.length) {
        contactIds = contactsByEmail.map((c: any) => c.id);
      }
    }

    if (contactIds.length === 0 && phoneSuffix.length >= 8) {
      const { data: contactsByPhone } = await supabase
        .from('crm_contacts')
        .select('id')
        .ilike('phone', `%${phoneSuffix}%`)
        .limit(5);
      
      if (contactsByPhone?.length) {
        contactIds = contactsByPhone.map((c: any) => c.id);
      }
    }

    if (contactIds.length === 0) {
      console.log('🎯 [AUTO-PAGO] Nenhum contato encontrado');
      return;
    }

    console.log(`🎯 [AUTO-PAGO] ${contactIds.length} contatos encontrados`);

    // 2. Buscar attendees com reunião R1 ativa para esses contatos
    const { data: attendees, error } = await supabase
      .from('meeting_slot_attendees')
      .select(`
        id,
        status,
        meeting_slot_id,
        contact_id,
        attendee_name,
        meeting_slots!inner(
          id,
          scheduled_at,
          status,
          meeting_type,
          closer_id
        )
      `)
      .in('contact_id', contactIds)
      .eq('meeting_slots.meeting_type', 'r1')
      .in('meeting_slots.status', ['scheduled', 'completed', 'rescheduled'])
      .in('status', ['scheduled', 'invited', 'completed'])
      .order('meeting_slots(scheduled_at)', { ascending: false })
      .limit(5);

    if (error) {
      console.error('🎯 [AUTO-PAGO] Erro ao buscar attendees:', error.message);
      return;
    }

    if (!attendees || attendees.length === 0) {
      console.log('🎯 [AUTO-PAGO] Nenhuma reunião R1 ativa encontrada');
      return;
    }

    // Pegar a reunião mais recente
    const matchingAttendee = attendees[0];
    const meeting = matchingAttendee.meeting_slots;
    
    console.log(`✅ [AUTO-PAGO] Match encontrado! Reunião: ${meeting.id}, Attendee: ${matchingAttendee.id}`);

    // 3. Atualizar attendee para contract_paid com a data da reunião (não de hoje)
    const { error: updateError } = await supabase
      .from('meeting_slot_attendees')
      .update({
        status: 'contract_paid',
        contract_paid_at: meeting.scheduled_at // Usar data da reunião!
      })
      .eq('id', matchingAttendee.id);

    if (updateError) {
      console.error('🎯 [AUTO-PAGO] Erro ao atualizar attendee:', updateError.message);
      return;
    }

    // 4. Atualizar reunião para completed se ainda não estiver
    if (meeting.status === 'scheduled' || meeting.status === 'rescheduled') {
      await supabase
        .from('meeting_slots')
        .update({ status: 'completed' })
        .eq('id', meeting.id);
      
      console.log(`✅ [AUTO-PAGO] Reunião marcada como completed`);
    }

    // 5. Criar notificação para o closer agendar R2
    if (meeting.closer_id) {
      const { error: notifError } = await supabase
        .from('user_notifications')
        .insert({
          user_id: meeting.closer_id,
          type: 'contract_paid',
          title: '💰 Contrato Pago - Agendar R2',
          message: `${data.customerName || 'Cliente'} pagou o contrato! Agende a R2.`,
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

    console.log(`🎉 [AUTO-PAGO] Contrato marcado como pago automaticamente!`);
  } catch (err: any) {
    console.error('🎯 [AUTO-PAGO] Erro:', err.message);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const body = await req.json();
    const eventType = body.event_type || body.type;

    console.log('📥 Webhook recebido:', eventType);

    // Log do webhook
    const { data: logEntry } = await supabase
      .from('hubla_webhook_logs')
      .insert({
        event_type: eventType,
        event_data: body,
        status: 'processing',
      })
      .select()
      .single();

    let logId = logEntry?.id;

    try {
      // NewSale - extrair do body.event
      if (eventType === 'NewSale') {
        const eventData = body.event || {};
        const invoice = eventData.invoice || {};
        const productName = eventData.groupName || eventData.products?.[0]?.name || 'Produto Desconhecido';
        
        // Extrair valores corrigidos
        const { installment, installments } = extractSmartInstallment(invoice);
        const { grossValue, netValue, subtotalCents, installmentFeeCents } = extractCorrectValues(invoice);
        
        const productPrice = grossValue || parseFloat(eventData.totalAmount || eventData.amount || 0);
        const productCategory = mapProductCategory(productName);
        const saleDate = new Date(eventData.created_at || eventData.createdAt || Date.now()).toISOString();
        
        const transactionData = {
          hubla_id: eventData.id || `newsale-${Date.now()}`,
          event_type: 'NewSale',
          product_name: productName,
          product_code: eventData.productCode || null,
          product_price: productPrice,
          product_category: productCategory,
          // CORREÇÃO: userName/userEmail/userPhone são os campos corretos no NewSale
          customer_name: eventData.userName || eventData.customer?.name || eventData.customerName || null,
          customer_email: eventData.userEmail || eventData.customer?.email || eventData.customerEmail || null,
          customer_phone: eventData.userPhone || eventData.customer?.phone || eventData.customerPhone || null,
          utm_source: eventData.utm_source || eventData.utmSource || null,
          utm_medium: eventData.utm_medium || eventData.utmMedium || null,
          utm_campaign: eventData.utm_campaign || eventData.utmCampaign || null,
          payment_method: eventData.paymentMethod || null,
          sale_date: saleDate,
          sale_status: 'completed',
          raw_data: body,
          // Novos campos
          net_value: netValue,
          // CORREÇÃO: Math.round para evitar erro "invalid input syntax for type integer"
          subtotal_cents: Math.round(subtotalCents || 0),
          installment_fee_cents: Math.round(installmentFeeCents || 0),
          installment_number: installment,
          total_installments: installments,
          is_offer: false,
          // Não contar transações com net_value=0 (são apenas notificações)
          count_in_dashboard: (netValue || 0) > 0,
        };

        const { error } = await supabase
          .from('hubla_transactions')
          .upsert(transactionData, { onConflict: 'hubla_id' });

        if (error) throw error;

        // Se for A010 e for primeira parcela, inserir na tabela a010_sales e criar contato/deal no CRM
        if (productCategory === 'a010' && installment === 1) {
          await supabase
            .from('a010_sales')
            .upsert({
              customer_name: transactionData.customer_name || 'Cliente Desconhecido',
              customer_email: transactionData.customer_email,
              customer_phone: transactionData.customer_phone,
              net_value: netValue,
              sale_date: saleDate,
              status: 'completed',
            }, { onConflict: 'customer_email,sale_date', ignoreDuplicates: true });
          
          // Criar contato e deal no CRM para leads A010
          await createOrUpdateCRMContact(supabase, {
            email: transactionData.customer_email,
            phone: transactionData.customer_phone,
            name: transactionData.customer_name,
            originName: 'A010 Hubla',
            productName: productName,
            value: netValue
          });
        }
      }

      // invoice.payment_succeeded - extrair items individuais
      if (eventType === 'invoice.payment_succeeded') {
        const invoice = body.event?.invoice || body.invoice;
        const items = invoice?.items || [];
        
        // Extrair smartInstallment do invoice
        const { installment, installments } = extractSmartInstallment(invoice);
        const { grossValue, netValue, subtotalCents, installmentFeeCents } = extractCorrectValues(invoice);
        
        console.log(`📦 Processando ${items.length} items da invoice ${invoice?.id} (parcela ${installment}/${installments}) - Bruto: R$ ${grossValue} | Líquido: R$ ${netValue}`);

        // Se não tem items, criar transação do produto principal
        if (items.length === 0) {
          const product = body.event?.product || {};
          const productName = product.name || 'Produto Desconhecido';
          const productCategory = mapProductCategory(productName);
          const saleDate = new Date(invoice?.saleDate || invoice?.createdAt || Date.now()).toISOString();
          
          // CORREÇÃO: payer tem firstName/lastName, user só tem email
          const payer = invoice?.payer || {};
          const user = body.event?.user || {};
          
          const transactionData = {
            hubla_id: invoice?.id || `invoice-${Date.now()}`,
            event_type: 'invoice.payment_succeeded',
            product_name: productName,
            product_code: null,
            product_price: grossValue,
            product_category: productCategory,
            product_type: null,
            customer_name: `${payer.firstName || ''} ${payer.lastName || ''}`.trim() || user.name || null,
            customer_email: payer.email || user.email || null,
            customer_phone: payer.phone || user.phone || null,
            utm_source: null,
            utm_medium: null,
            utm_campaign: null,
            payment_method: invoice?.paymentMethod || null,
            sale_date: saleDate,
            sale_status: 'completed',
            raw_data: body,
            // Novos campos
            net_value: netValue,
            // CORREÇÃO: Math.round para evitar erro "invalid input syntax for type integer"
            subtotal_cents: Math.round(subtotalCents || 0),
            installment_fee_cents: Math.round(installmentFeeCents || 0),
            installment_number: installment,
            total_installments: installments,
            is_offer: false,
            count_in_dashboard: (netValue || 0) > 0,
          };

          console.log(`📝 [UPSERT] Salvando transação: ${transactionData.hubla_id} - ${productName}`);
          
          const { error } = await supabase
            .from('hubla_transactions')
            .upsert(transactionData, { onConflict: 'hubla_id' });

          if (error) {
            console.error(`❌ [UPSERT ERROR]:`, error);
            throw error;
          }

          // Se for A010 e for primeira parcela, inserir na tabela a010_sales e criar contato/deal no CRM
          if (productCategory === 'a010' && installment === 1) {
            await supabase
              .from('a010_sales')
              .upsert({
                customer_name: transactionData.customer_name || 'Cliente Desconhecido',
                customer_email: transactionData.customer_email,
                customer_phone: transactionData.customer_phone,
                net_value: netValue,
                sale_date: saleDate,
                status: 'completed',
              }, { onConflict: 'customer_email,sale_date', ignoreDuplicates: true });
            
            // Criar contato e deal no CRM para leads A010
            await createOrUpdateCRMContact(supabase, {
              email: transactionData.customer_email,
              phone: transactionData.customer_phone,
              name: transactionData.customer_name,
              originName: 'A010 Hubla',
              productName: productName,
              value: netValue
            });
          }
        }

        // Processar items individuais
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const isOffer = i > 0;
          const hublaId = isOffer ? `${invoice.id}-offer-${i}` : invoice.id;
          
          // Para offers, usar o nome do offer para categorização correta
          const productName = isOffer 
            ? (item.offer?.name || item.product?.name || item.name || 'Offer Desconhecido')
            : (item.product?.name || item.name || 'Produto Desconhecido');
          const productCode = item.product?.code || item.product_code || null;
          
          // Para items individuais, usar o price do item
          const itemPrice = parseFloat(item.price || item.amount || 0);
          
          const productCategory = mapProductCategory(productName, productCode);
          const saleDate = new Date(invoice.saleDate || invoice.created_at || invoice.createdAt || Date.now()).toISOString();
          
          // CORREÇÃO: payer tem firstName/lastName, user só tem email
          const payer = invoice?.payer || {};
          const user = body.event?.user || {};
          
          // Para offers, calcular net_value proporcional
          // Para item principal, usar o net_value calculado
          const itemNetValue = isOffer 
            ? itemPrice * 0.9417 // Offers usam taxa aproximada
            : netValue;
          
          const transactionData = {
            hubla_id: hublaId,
            event_type: 'invoice.payment_succeeded',
            product_name: productName,
            product_code: productCode,
            product_price: isOffer ? itemPrice : grossValue,
            product_category: productCategory,
            product_type: item.type || null,
            customer_name: `${payer.firstName || ''} ${payer.lastName || ''}`.trim() || invoice.customer?.name || invoice.customer_name || null,
            customer_email: payer.email || user.email || invoice.customer?.email || invoice.customer_email || null,
            customer_phone: payer.phone || user.phone || invoice.customer?.phone || invoice.customer_phone || null,
            utm_source: invoice.utm_source || null,
            utm_medium: invoice.utm_medium || null,
            utm_campaign: invoice.utm_campaign || null,
            payment_method: invoice.paymentMethod || invoice.payment_method || null,
            sale_date: saleDate,
            sale_status: 'completed',
            raw_data: body,
            // Novos campos
            net_value: itemNetValue,
            // CORREÇÃO: Math.round para evitar erro "invalid input syntax for type integer"
            subtotal_cents: Math.round(isOffer ? itemPrice * 100 : (subtotalCents || 0)),
            installment_fee_cents: Math.round(isOffer ? 0 : (installmentFeeCents || 0)),
            installment_number: installment,
            total_installments: installments,
            is_offer: isOffer,
            count_in_dashboard: (itemNetValue || 0) > 0,
          };

          console.log(`📝 [UPSERT] Item ${i + 1}: ${hublaId} - ${productName} (offer: ${isOffer})`);
          
          const { error } = await supabase
            .from('hubla_transactions')
            .upsert(transactionData, { onConflict: 'hubla_id' });

          if (error) {
            console.error(`❌ [UPSERT ERROR]:`, error);
            throw error;
          }

          // Se for A010, não for offer, e for primeira parcela, inserir na tabela a010_sales e criar contato/deal
          if (productCategory === 'a010' && !isOffer && installment === 1) {
            await supabase
              .from('a010_sales')
              .upsert({
                customer_name: transactionData.customer_name || 'Cliente Desconhecido',
                customer_email: transactionData.customer_email,
                customer_phone: transactionData.customer_phone,
                net_value: itemNetValue,
                sale_date: saleDate,
                status: 'completed',
              }, { onConflict: 'customer_email,sale_date', ignoreDuplicates: true });
            
            // Criar contato e deal no CRM para leads A010
            await createOrUpdateCRMContact(supabase, {
              email: transactionData.customer_email,
              phone: transactionData.customer_phone,
              name: transactionData.customer_name,
              originName: 'A010 Hubla',
              productName: productName,
              value: itemNetValue
            });
          }

          // Se for contrato, não for offer, e for primeira parcela, auto-marcar reunião R1 como contrato pago
          if (productCategory === 'contrato' && !isOffer && installment === 1) {
            console.log(`🎯 [CONTRATO] Pagamento detectado, buscando reunião R1 para auto-marcar...`);
            await autoMarkContractPaid(supabase, {
              customerEmail: transactionData.customer_email,
              customerPhone: transactionData.customer_phone,
              customerName: transactionData.customer_name,
              saleDate: saleDate
            });
          }
        }
      }

      // invoice.refunded
      if (eventType === 'invoice.refunded') {
        const invoice = body.event?.invoice || body.invoice;
        const hublaId = invoice?.id;

        if (hublaId) {
          await supabase
            .from('hubla_transactions')
            .update({ sale_status: 'refunded' })
            .eq('hubla_id', hublaId);

          await supabase
            .from('a010_sales')
            .update({ status: 'refunded' })
            .eq('customer_email', invoice.customer?.email || invoice.customer_email)
            .eq('sale_date', new Date(invoice.created_at || invoice.createdAt).toISOString().split('T')[0]);

          console.log(`🔄 Reembolso processado: ${hublaId}`);
        }
      }

      // lead.abandoned_checkout
      if (eventType === 'lead.abandoned_checkout') {
        console.log('🚪 Carrinho abandonado registrado');
      }

      // Atualizar log de sucesso
      const processingTime = Date.now() - startTime;
      if (logId) {
        await supabase
          .from('hubla_webhook_logs')
          .update({
            status: 'success',
            processed_at: new Date().toISOString(),
            processing_time_ms: processingTime,
          })
          .eq('id', logId);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Webhook processado', eventType }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error: any) {
      console.error('❌ Erro ao processar webhook:', error);
      
      // Atualizar log de erro
      if (logId) {
        await supabase
          .from('hubla_webhook_logs')
          .update({
            status: 'error',
            error_message: error.message,
            processed_at: new Date().toISOString(),
            processing_time_ms: Date.now() - startTime,
          })
          .eq('id', logId);
      }

      throw error;
    }

  } catch (error: any) {
    console.error('❌ Erro fatal:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
