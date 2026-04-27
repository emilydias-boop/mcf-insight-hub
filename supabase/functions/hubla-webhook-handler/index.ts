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
  'CLUBE DO ARREMATE': 'clube_arremate',
  'CONTRATO - CLUBE DO ARREMATE': 'contrato_clube_arremate',
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
  
  // ===== PRIORIDADE 1: Detectar produtos de consórcio =====
  // Contrato - Clube do Arremate (mais específico primeiro)
  if (name.includes('CONTRATO') && name.includes('CLUBE')) {
    return 'contrato_clube_arremate';
  }
  
  // Clube do Arremate (genérico)
  if (name.includes('CLUBE') && name.includes('ARREMATE')) {
    return 'clube_arremate';
  }
  
  // ===== PRIORIDADE 2: Verificar se é produto excluído do Incorporador 50k =====
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

// ============= HELPER: Normalizar documento (CPF/CNPJ) =============
// Mantém apenas dígitos. Retorna null se vazio. Aceita CPF (11) e CNPJ (14).
function normalizeDocument(doc: string | null | undefined): string | null {
  if (!doc) return null;
  const clean = String(doc).replace(/\D/g, '');
  return clean.length > 0 ? clean : null;
}

// ============= HELPER: Extrair CPF do payload Hubla (todos os formatos) =============
function extractCustomerDocument(eventOrInvoice: any, body: any): string | null {
  return normalizeDocument(
    eventOrInvoice?.userDocument ||
    eventOrInvoice?.customerDocument ||
    eventOrInvoice?.customer?.document ||
    eventOrInvoice?.user?.document ||
    eventOrInvoice?.payer?.document ||
    body?.event?.user?.document ||
    body?.event?.invoice?.payer?.document ||
    body?.event?.payer?.document ||
    body?.user?.document ||
    body?.payer?.document ||
    body?.['Documento do cliente'] ||
    null
  );
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

// CONSTANTE: Origin canônico para todos os leads A010
const PIPELINE_INSIDE_SALES_ORIGIN = 'PIPELINE INSIDE SALES';

// ============= HELPER: Verificar se é parceiro existente =============
async function checkIfPartner(supabase: any, email: string | null): Promise<{isPartner: boolean, product: string | null}> {
  if (!email) return { isPartner: false, product: null };
  
  const PARTNER_PRODUCTS = ['A001', 'A002', 'A003', 'A004', 'A009'];
  
  const { data: transactions } = await supabase
    .from('hubla_transactions')
    .select('product_name')
    .ilike('customer_email', email)
    .eq('sale_status', 'completed')
    .limit(50);
  
  if (!transactions?.length) return { isPartner: false, product: null };
  
  for (const tx of transactions) {
    const name = (tx.product_name || '').toUpperCase();
    for (const code of PARTNER_PRODUCTS) {
      if (name.includes(code)) {
        return { isPartner: true, product: code };
      }
    }
    if (name.includes('INCORPORADOR') && !name.includes('CONTRATO') && !name.includes('A010')) {
      return { isPartner: true, product: 'MCF Incorporador' };
    }
    if (name.includes('ANTICRISE') && !name.includes('CONTRATO')) {
      return { isPartner: true, product: 'Anticrise' };
    }
  }
  
  return { isPartner: false, product: null };
}

async function createOrUpdateCRMContact(supabase: any, data: CRMContactData): Promise<void> {
  if (!data.email && !data.phone) {
    console.log('[CRM] Sem email ou telefone, pulando criação de contato');
    return;
  }
  
  // === VERIFICAÇÃO DE PARCEIRO: Bloquear reentrada no fluxo ===
  const partnerCheck = await checkIfPartner(supabase, data.email);
  if (partnerCheck.isPartner) {
    console.log(`[CRM] 🚫 PARCEIRO DETECTADO: ${data.email} - Produto: ${partnerCheck.product}. Bloqueando entrada no fluxo.`);
    
    // Buscar contact_id se existir
    let contactId: string | null = null;
    if (data.email) {
      const { data: contact } = await supabase
        .from('crm_contacts')
        .select('id')
        .ilike('email', data.email)
        .limit(1)
        .maybeSingle();
      contactId = contact?.id || null;
    }
    
    // Registrar em partner_returns
    await supabase.from('partner_returns').insert({
      contact_id: contactId,
      contact_email: data.email,
      contact_name: data.name,
      partner_product: partnerCheck.product,
      return_source: 'hubla_a010',
      return_product: data.productName,
      return_value: data.value || 0,
      blocked: true,
    });
    
    console.log(`[CRM] Retorno de parceiro registrado em partner_returns`);
    return; // NÃO criar/atualizar deal
  }
  
  // Normalizar telefone
  const normalizedPhone = normalizePhone(data.phone);
  console.log(`[CRM] Telefone normalizado: ${data.phone} -> ${normalizedPhone}`);
  
  // CORREÇÃO: Sempre usar PIPELINE INSIDE SALES para A010 (evitar criar origens duplicadas)
  const targetOriginName = data.originName === 'A010 Hubla' ? PIPELINE_INSIDE_SALES_ORIGIN : data.originName;
  console.log(`[CRM] Origem target: ${targetOriginName} (original: ${data.originName})`);
  
  try {
    // 1. Buscar ou criar origem
    let originId: string | null = null;
    const { data: existingOrigins } = await supabase
      .from('crm_origins')
      .select('id')
      .ilike('name', targetOriginName)
      .order('created_at', { ascending: true })
      .limit(1);
    
    if (existingOrigins && existingOrigins.length > 0) {
      originId = existingOrigins[0].id;
      console.log(`[CRM] Origem existente encontrada: ${targetOriginName} (${originId})`);
    } else {
      // Criar nova origem apenas se não existir NENHUMA
      const { data: newOrigin } = await supabase
        .from('crm_origins')
        .insert({
          clint_id: `hubla-origin-${Date.now()}`,
          name: targetOriginName,
          description: 'Criada automaticamente via webhook Hubla'
        })
        .select('id')
        .single();
      
      if (newOrigin) {
        originId = newOrigin.id;
        console.log(`[CRM] Origem criada: ${targetOriginName} (${originId})`);
      }
    }
    
    // 2. Buscar contato existente pelo EMAIL primeiro (prioridade)
    // IMPORTANTE: Buscar TODOS os contatos com esse email para verificar se algum já tem deal
    let contactId: string | null = null;
    let existingContact: any = null;
    
    if (data.email) {
      const { data: allByEmail } = await supabase
        .from('crm_contacts')
        .select('id, phone')
        .ilike('email', data.email)
        .eq('is_archived', false)
        .order('created_at', { ascending: true })
        .limit(20);
      
      if (allByEmail && allByEmail.length > 0) {
        // Check if any of these contacts already has a deal in this origin
        for (const c of allByEmail) {
          const { data: dealForContact } = await supabase
            .from('crm_deals')
            .select('id')
            .eq('contact_id', c.id)
            .eq('origin_id', originId)
            .limit(1)
            .maybeSingle();
          if (dealForContact) {
            contactId = c.id;
            existingContact = c;
            console.log(`[CRM] Contato com deal existente por email: ${contactId} (deal ${dealForContact.id})`);
            break;
          }
        }
        // If none has a deal, use the oldest one
        if (!contactId) {
          contactId = allByEmail[0].id;
          existingContact = allByEmail[0];
          console.log(`[CRM] Contato mais antigo por email: ${contactId}`);
        }
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
          phone: normalizedPhone,
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
    
    // === NOVO: VERIFICAR SE JÁ EXISTE DEAL PARA ESTE CONTATO NO PIPELINE ===
    let existingDeal: any = null;
    if (contactId && originId) {
      const { data: dealByContactOrigin } = await supabase
        .from('crm_deals')
        .select('id, tags, value, custom_fields')
        .eq('contact_id', contactId)
        .eq('origin_id', originId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (dealByContactOrigin) {
        existingDeal = dealByContactOrigin;
        console.log(`[CRM] Deal existente encontrado para contato: ${existingDeal.id}`);
      }
    }
    
    // Se deal existe, ATUALIZAR tags + valor (não criar novo)
    if (existingDeal) {
      const currentTags = existingDeal.tags || [];
      const newTags = currentTags.includes('A010') ? currentTags : [...currentTags, 'A010'];
      
      // Merge custom_fields preservando dados existentes
      const currentCustomFields = existingDeal.custom_fields || {};
      const updatedCustomFields = {
        ...currentCustomFields,
        a010_compra: true,
        a010_produto: data.productName,
        a010_data: new Date().toISOString(),
      };
      
      // Atualizar valor se o novo for maior (upsell)
      const newValue = Math.max(existingDeal.value || 0, data.value || 0);
      
      await supabase
        .from('crm_deals')
        .update({
          tags: newTags,
          value: newValue,
          custom_fields: updatedCustomFields,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingDeal.id);
      
      console.log(`[CRM] Deal atualizado com tag A010: ${existingDeal.id} - Valor: R$ ${newValue}`);
      return; // Não criar novo deal
    }
    
    // === CONTINUAR COM CRIAÇÃO DE DEAL SE NÃO EXISTIR ===
    
    // 6. Buscar estágio "Novo Lead" para a origem (por nome, não por ordem)
    let stageId: string | null = null;
    if (originId) {
      // Primeiro: buscar stage "Novo Lead" por nome
      const { data: novoLeadStage } = await supabase
        .from('crm_stages')
        .select('id')
        .eq('origin_id', originId)
        .ilike('stage_name', '%Novo Lead%')
        .limit(1)
        .maybeSingle();
      
      if (novoLeadStage) {
        stageId = novoLeadStage.id;
        console.log(`[CRM] Stage "Novo Lead" encontrado por nome: ${stageId}`);
      } else {
        // Fallback: primeira stage por ordem (caso não exista "Novo Lead")
        const { data: fallbackStage } = await supabase
          .from('crm_stages')
          .select('id')
          .eq('origin_id', originId)
          .order('stage_order', { ascending: true })
          .limit(1)
          .maybeSingle();
        stageId = fallbackStage?.id;
        console.log(`[CRM] Stage fallback por ordem: ${stageId}`);
      }
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
    
    // 7. Criar deal usando UPSERT atômico (previne duplicação por race condition)
    if (contactId && originId) {
      // 7.1 Verificar se existe distribuição ativa para esta origin
      let distributedOwnerId: string | null = null;
      let distributedOwnerProfileId: string | null = null;
      let wasDistributed = false;

      try {
        const { data: distConfig } = await supabase
          .from('lead_distribution_config')
          .select('id')
          .eq('origin_id', originId)
          .eq('is_active', true)
          .limit(1);

        if (distConfig && distConfig.length > 0) {
          const { data: nextOwnerEmail } = await supabase.rpc('get_next_lead_owner', { p_origin_id: originId });
          if (nextOwnerEmail) {
            distributedOwnerId = nextOwnerEmail;
            wasDistributed = true;
            console.log(`[CRM][Hubla] Distribuição ativa - owner atribuído: ${distributedOwnerId}`);

            // Buscar profile_id do owner distribuído
            const { data: ownerProfile } = await supabase
              .from('profiles')
              .select('id')
              .ilike('email', distributedOwnerId)
              .maybeSingle();
            if (ownerProfile) {
              distributedOwnerProfileId = ownerProfile.id;
            }
          }
        }
      } catch (distError) {
        console.error(`[CRM][Hubla] Erro ao verificar distribuição:`, distError);
      }

      // 7.2 Fallback: herdar owner de outro deal do mesmo contato
      let inheritedOwnerId: string | null = null;
      let inheritedOwnerProfileId: string | null = null;

      if (!wasDistributed) {
        const { data: dealWithOwner } = await supabase
          .from('crm_deals')
          .select('owner_id, owner_profile_id')
          .eq('contact_id', contactId)
          .not('owner_id', 'is', null)
          .limit(1)
          .maybeSingle();
        
        if (dealWithOwner?.owner_id) {
          inheritedOwnerId = dealWithOwner.owner_id;
          inheritedOwnerProfileId = dealWithOwner.owner_profile_id;
          console.log(`[CRM] Owner herdado de outro deal: ${inheritedOwnerId}`);
          
          if (!inheritedOwnerProfileId && inheritedOwnerId) {
            const { data: ownerProfile } = await supabase
              .from('profiles')
              .select('id')
              .eq('email', inheritedOwnerId)
              .maybeSingle();
            
            if (ownerProfile) {
              inheritedOwnerProfileId = ownerProfile.id;
            }
          }
        }
      }

      const finalOwnerId = wasDistributed ? distributedOwnerId : inheritedOwnerId;
      const finalOwnerProfileId = wasDistributed ? distributedOwnerProfileId : inheritedOwnerProfileId;

      // 7.3 Usar UPSERT atômico
      const dealData = {
        clint_id: `hubla-deal-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        name: `${data.name || 'Cliente'} - A010`,
        value: data.value || 0,
        contact_id: contactId,
        origin_id: originId,
        stage_id: stageId,
        owner_id: finalOwnerId,
        owner_profile_id: finalOwnerProfileId,
        product_name: data.productName,
        tags: ['A010', 'Hubla'],
        custom_fields: { 
          source: 'hubla', 
          product: data.productName,
          a010_compra: true,
          a010_data: new Date().toISOString(),
          ...(wasDistributed ? { distributed: true, owner_original: inheritedOwnerId || null } : {})
        },
        data_source: 'webhook',
        stage_moved_at: new Date().toISOString()
      };
      
      const { data: newDeal, error: dealError } = await supabase
        .from('crm_deals')
        .insert(dealData)
        .select('id')
        .maybeSingle();
      
      let createdDealId: string | null = newDeal?.id || null;
      
      if (dealError) {
        if (dealError.code === '23505' || dealError.message?.includes('duplicate')) {
          console.log(`[CRM] Deal já existe para contact_id=${contactId}, origin_id=${originId} (duplicata ignorada)`);
          // Buscar o deal existente para usar o ID
          const { data: existingDeal } = await supabase
            .from('crm_deals')
            .select('id')
            .eq('contact_id', contactId)
            .eq('origin_id', originId)
            .maybeSingle();
          createdDealId = existingDeal?.id || null;
        } else {
          console.error('[CRM] Erro ao criar deal:', dealError);
        }
      } else if (newDeal) {
        console.log(`[CRM] Deal criado: ${data.name} - A010 (${newDeal.id}) com owner: ${inheritedOwnerId || 'nenhum'}`);
      }
      
      // 8. Gerar tarefas automáticas baseadas nos templates do estágio
      if (createdDealId && stageId) {
        // Só gerar tarefas se o deal foi recém-criado (newDeal não era null)
        if (newDeal || (!newDeal && !dealError)) {
          await generateTasksForDeal(supabase, {
            dealId: createdDealId,
            contactId: contactId,
            ownerId: inheritedOwnerId,
            originId,
            stageId,
          });
        }
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
  customerDocument?: string | null;
  saleDate: string;
  transactionHublaId?: string | null;
  offerName?: string | null;
}

// Ofertas que qualificam um pagamento como "Outside" (alinhado com src/hooks/outsideOfferConstants.ts)
const OUTSIDE_OFFER_NAMES = [
  'Contrato - Curso R$ 97,00',
  'Contrato Perfil A - Vitrine A010',
];

function isOutsideOffer(offerName: string | null | undefined): boolean {
  if (!offerName) return false;
  const normalized = offerName.toLowerCase().trim();
  return OUTSIDE_OFFER_NAMES.some(n => n.toLowerCase() === normalized);
}

// Normalizar nome para match fuzzy
function normalizeNameForMatch(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9]/g, '') // Só alfanuméricos
    .trim();
}

async function autoMarkContractPaid(supabase: any, data: AutoMarkData): Promise<void> {
  if (!data.customerEmail && !data.customerPhone && !data.customerName && !data.customerDocument) {
    console.log('🎯 [AUTO-PAGO] Sem email, telefone, nome ou CPF para buscar reunião');
    return;
  }

  // Normalizar dados para busca
  const phoneDigits = data.customerPhone?.replace(/\D/g, '') || '';
  const phoneSuffix = phoneDigits.slice(-9);
  const emailLower = data.customerEmail?.toLowerCase()?.trim() || '';
  const normalizedSearchName = normalizeNameForMatch(data.customerName || '');
  const cpfDigits = (data.customerDocument || '').replace(/\D/g, '');

  console.log(`🎯 [AUTO-PAGO] Buscando match para: cpf="${cpfDigits || '(vazio)'}", email="${emailLower}", phone_suffix="${phoneSuffix}", name="${data.customerName}" (normalized="${normalizedSearchName}")`);

  try {
    // CORREÇÃO 1: Limitar busca aos últimos 14 dias
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    // CORREÇÃO PRINCIPAL: Usar JOIN para buscar dados do contato em uma única query
    // Elimina o padrão N+1 que causava timeouts
    const { data: attendeesRaw, error: queryError } = await supabase
      .from('meeting_slot_attendees')
      .select(`
        id,
        status,
        meeting_slot_id,
        attendee_name,
        attendee_phone,
        deal_id,
        cpf,
        meeting_slots!inner(
          id,
          scheduled_at,
          status,
          meeting_type,
          closer_id
        ),
        crm_deals!deal_id(
          id,
          crm_contacts!contact_id(
            email,
            phone
          )
        )
      `)
      .eq('meeting_slots.meeting_type', 'r1')
      .gte('meeting_slots.scheduled_at', twoWeeksAgo.toISOString())
      .in('meeting_slots.status', ['scheduled', 'completed', 'rescheduled', 'contract_paid'])
      .in('status', ['scheduled', 'invited', 'completed'])
      .eq('is_partner', false);

    if (queryError) {
      console.error('🎯 [AUTO-PAGO] Erro na query:', queryError.message);
      return;
    }

    if (!attendeesRaw?.length) {
      console.log('🎯 [AUTO-PAGO] Nenhum attendee R1 encontrado nos últimos 14 dias');
      return;
    }

    // CORREÇÃO 2: Ordenar em JavaScript (mais confiável que ordenação nested do Supabase)
    const attendees = [...attendeesRaw].sort((a: any, b: any) => {
      const dateA = new Date(a.meeting_slots?.scheduled_at || 0).getTime();
      const dateB = new Date(b.meeting_slots?.scheduled_at || 0).getTime();
      return dateB - dateA; // Mais recente primeiro
    });

    console.log(`🎯 [AUTO-PAGO] ${attendees.length} attendees encontrados (últimos 14 dias)`);

    // CORREÇÃO 3: Match em três fases - email primeiro, telefone depois, nome como fallback
    let matchingAttendee: any = null;
    let meeting: any = null;
    let matchType: string = '';
    let phoneMatchCandidate: { attendee: any; meeting: any } | null = null;
    let nameMatchCandidate: { attendee: any; meeting: any } | null = null;

    for (const attendee of attendees) {
      if (!attendee.deal_id) {
        continue;
      }

      // Acessar dados do contato diretamente via JOIN (SEM query adicional!)
      const contactEmail = attendee.crm_deals?.crm_contacts?.email?.toLowerCase()?.trim() || '';
      const contactPhone = attendee.crm_deals?.crm_contacts?.phone?.replace(/\D/g, '') || '';
      const attendeePhoneClean = attendee.attendee_phone?.replace(/\D/g, '') || '';
      const normalizedAttendeeName = normalizeNameForMatch(attendee.attendee_name);
      const attendeeCpf = (attendee.cpf || '').replace(/\D/g, '');

      // Log para debug detalhado (apenas primeiros 5 para não poluir)
      if (attendees.indexOf(attendee) < 5) {
        console.log(`🔍 Verificando: ${attendee.attendee_name} | cpf: "${attendeeCpf}" | email: "${contactEmail}" | phone: "${contactPhone.slice(-9)}" | deal: ${attendee.deal_id}`);
      }

      // Match por CPF (prioridade MÁXIMA - chave única e imutável) - break imediato
      if (cpfDigits && cpfDigits.length >= 11 && attendeeCpf && attendeeCpf === cpfDigits) {
        matchingAttendee = attendee;
        meeting = attendee.meeting_slots;
        matchType = 'cpf';
        console.log(`✅ [AUTO-PAGO] Match por CPF: ${attendee.attendee_name} - deal: ${attendee.deal_id}`);
        break;
      }

      // Match por EMAIL (prioridade 1) - break imediato
      if (emailLower && contactEmail && contactEmail === emailLower) {
        matchingAttendee = attendee;
        meeting = attendee.meeting_slots;
        matchType = 'email';
        console.log(`✅ [AUTO-PAGO] Match por EMAIL: ${attendee.attendee_name} - deal: ${attendee.deal_id}`);
        break;
      }

      // Match por TELEFONE (prioridade 2) - guardar como candidato
      if (phoneSuffix.length >= 8 && !phoneMatchCandidate) {
        if (contactPhone.endsWith(phoneSuffix) || attendeePhoneClean.endsWith(phoneSuffix)) {
          phoneMatchCandidate = { attendee, meeting: attendee.meeting_slots };
          console.log(`📞 [AUTO-PAGO] Candidato por TELEFONE: ${attendee.attendee_name} - deal: ${attendee.deal_id}`);
        }
      }

      // Match por NOME (prioridade 3) - guardar como candidato
      if (normalizedSearchName && !nameMatchCandidate && normalizedAttendeeName) {
        if (normalizedAttendeeName === normalizedSearchName) {
          nameMatchCandidate = { attendee, meeting: attendee.meeting_slots };
          console.log(`📝 [AUTO-PAGO] Candidato por NOME: ${attendee.attendee_name} - deal: ${attendee.deal_id}`);
        }
      }
    }

    // Usar candidatos na ordem de prioridade: email > telefone > nome
    if (!matchingAttendee && phoneMatchCandidate) {
      matchingAttendee = phoneMatchCandidate.attendee;
      meeting = phoneMatchCandidate.meeting;
      matchType = 'telefone';
      console.log(`✅ [AUTO-PAGO] Match final por TELEFONE: ${matchingAttendee.attendee_name} - deal: ${matchingAttendee.deal_id}`);
    }

    if (!matchingAttendee && nameMatchCandidate) {
      matchingAttendee = nameMatchCandidate.attendee;
      meeting = nameMatchCandidate.meeting;
      matchType = 'nome';
      console.log(`✅ [AUTO-PAGO] Match final por NOME: ${matchingAttendee.attendee_name} - deal: ${matchingAttendee.deal_id}`);
    }

    // Log detalhado quando não encontra match
    if (!matchingAttendee) {
      console.log(`❌ [AUTO-PAGO] Nenhum match encontrado:`);
      console.log(`   - Email buscado: "${emailLower}"`);
      console.log(`   - Phone suffix: "${phoneSuffix}"`);
      console.log(`   - Nome normalizado: "${normalizedSearchName}"`);
      console.log(`   - Total attendees verificados: ${attendees.length}`);
      console.log(`   - Attendees com deal_id: ${attendees.filter((a: any) => a.deal_id).length}`);

      // ============ OUTSIDE LEAD AUTO-DISTRIBUTION ============
      // Sem attendee R1 + offer_name de Outside = lead Outside legítimo.
      // - Deal SEM owner → distribui automaticamente para SDR
      // - Deal COM owner → move para "Contrato Pago" + tag Outside + notifica SDR
      const offerIsOutside = isOutsideOffer(data.offerName);
      if (emailLower && offerIsOutside) {
        try {
          console.log(`🔄 [AUTO-PAGO][OUTSIDE] Oferta Outside detectada ("${data.offerName}"). Buscando deal para email: ${emailLower}`);

          // Buscar contact pelo email
          const { data: outsideContact } = await supabase
            .from('crm_contacts')
            .select('id')
            .ilike('email', emailLower)
            .limit(1)
            .maybeSingle();

          if (outsideContact?.id) {
            // Buscar deal no PIPELINE INSIDE SALES (com OU sem owner)
            const { data: outsideOrigin } = await supabase
              .from('crm_origins')
              .select('id')
              .ilike('name', '%PIPELINE INSIDE SALES%')
              .limit(1)
              .maybeSingle();

            if (outsideOrigin?.id) {
              const { data: outsideDeal } = await supabase
                .from('crm_deals')
                .select('id, owner_id, owner_profile_id, origin_id, tags, stage_id')
                .eq('contact_id', outsideContact.id)
                .eq('origin_id', outsideOrigin.id)
                .limit(1)
                .maybeSingle();

              if (outsideDeal) {
                // Buscar stage "Contrato Pago" no pipeline
                const { data: contractPaidStage } = await supabase
                  .from('crm_stages')
                  .select('id')
                  .eq('origin_id', outsideOrigin.id)
                  .ilike('stage_name', '%Contrato Pago%')
                  .maybeSingle();

                const currentTags = Array.isArray(outsideDeal.tags) ? outsideDeal.tags : [];
                const newTags = currentTags.includes('Outside') ? currentTags : [...currentTags, 'Outside'];

                let assignedOwnerEmail: string | null = outsideDeal.owner_id || null;
                let assignedOwnerProfileId: string | null = outsideDeal.owner_profile_id || null;

                // CASO A: Deal SEM owner → distribuir automaticamente
                if (!outsideDeal.owner_id) {
                  console.log(`🎯 [AUTO-PAGO][OUTSIDE] Deal SEM owner ${outsideDeal.id}. Iniciando distribuição.`);
                  const { data: distConfig } = await supabase
                    .from('lead_distribution_config')
                    .select('id')
                    .eq('origin_id', outsideOrigin.id)
                    .eq('is_active', true)
                    .limit(1);

                  if (distConfig && distConfig.length > 0) {
                    const { data: nextOwnerEmail } = await supabase.rpc('get_next_lead_owner', {
                      p_origin_id: outsideOrigin.id
                    });

                    if (nextOwnerEmail) {
                      assignedOwnerEmail = nextOwnerEmail;
                      const { data: ownerProfile } = await supabase
                        .from('profiles')
                        .select('id')
                        .ilike('email', nextOwnerEmail)
                        .maybeSingle();
                      assignedOwnerProfileId = ownerProfile?.id || null;
                      console.log(`✅ [AUTO-PAGO][OUTSIDE] Deal ${outsideDeal.id} será atribuído a ${nextOwnerEmail}`);
                    } else {
                      console.log(`⚠️ [AUTO-PAGO][OUTSIDE] Fila de distribuição vazia para origin ${outsideOrigin.id}`);
                    }
                  } else {
                    console.log(`ℹ️ [AUTO-PAGO][OUTSIDE] Sem configuração de distribuição ativa para origin ${outsideOrigin.id}`);
                  }
                } else {
                  console.log(`🎯 [AUTO-PAGO][OUTSIDE] Deal COM owner (${outsideDeal.owner_id}) ${outsideDeal.id}. Movendo para Contrato Pago + tag Outside.`);
                }

                // Atualizar deal: tags + (opcional) owner + stage Contrato Pago
                const updatePayload: Record<string, unknown> = {
                  tags: newTags,
                  updated_at: new Date().toISOString(),
                };
                if (!outsideDeal.owner_id && assignedOwnerEmail) {
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

                // Registrar atividade
                await supabase
                  .from('deal_activities')
                  .insert({
                    deal_id: outsideDeal.id,
                    activity_type: !outsideDeal.owner_id && assignedOwnerEmail ? 'owner_change' : 'stage_change',
                    description: !outsideDeal.owner_id && assignedOwnerEmail
                      ? `Auto-distribuído como lead Outside para ${assignedOwnerEmail} via webhook Hubla`
                      : `Movido para Contrato Pago como Outside (pagamento sem R1) via webhook Hubla`,
                    metadata: {
                      new_owner: assignedOwnerEmail,
                      new_owner_profile_id: assignedOwnerProfileId,
                      distributed_at: new Date().toISOString(),
                      distribution_type: !outsideDeal.owner_id ? 'outside_webhook' : 'outside_owner_kept',
                      contact_email: emailLower,
                      offer_name: data.offerName,
                      trigger: 'contract_paid_no_r1',
                      moved_to_stage: contractPaidStage?.id || null,
                    }
                  });

                // Vincular transação ao deal (sem attendee)
                if (data.transactionHublaId) {
                  await supabase
                    .from('hubla_transactions')
                    .update({ linked_deal_id: outsideDeal.id })
                    .eq('hubla_id', data.transactionHublaId);
                }

                // Notificar SDR dono (existente OU recém-atribuído)
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
                    console.log(`🔔 [AUTO-PAGO][OUTSIDE] Notificação criada para SDR ${assignedOwnerEmail}`);
                  }
                }
              } else {
                console.log(`ℹ️ [AUTO-PAGO][OUTSIDE] Nenhum deal encontrado no Pipeline Inside Sales para esse contato`);
              }
            }
          } else {
            console.log(`ℹ️ [AUTO-PAGO][OUTSIDE] Contato não encontrado para email: ${emailLower}`);
          }
        } catch (outsideErr: any) {
          console.error(`❌ [AUTO-PAGO][OUTSIDE] Erro ao distribuir Outside:`, outsideErr.message);
        }
      } else if (emailLower && !offerIsOutside) {
        console.log(`ℹ️ [AUTO-PAGO][OUTSIDE] Pagamento sem R1 mas offer_name="${data.offerName}" não é Outside. Ignorando.`);
      }
      // ============ FIM OUTSIDE LEAD AUTO-DISTRIBUTION ============

      return;
    }

    console.log(`🎉 [AUTO-PAGO] Match por ${matchType.toUpperCase()}: Attendee ${matchingAttendee.id} (${matchingAttendee.attendee_name}) - Reunião: ${meeting.id}`);

    // VERIFICAÇÃO: Evitar duplicatas - se deal_id já tem outro attendee pago, ignorar
    if (matchingAttendee.deal_id) {
      const { data: existingPaid } = await supabase
        .from('meeting_slot_attendees')
        .select('id, attendee_name')
        .eq('deal_id', matchingAttendee.deal_id)
        .not('contract_paid_at', 'is', null)
        .neq('id', matchingAttendee.id)
        .limit(1)
        .maybeSingle();
      
      if (existingPaid) {
        console.log(`⚠️ [AUTO-PAGO] Deal ${matchingAttendee.deal_id} JÁ possui outro attendee pago (${existingPaid.id} - ${existingPaid.attendee_name}). Pulando para evitar duplicata.`);
        return;
      }
    }

    // 3. Atualizar attendee para contract_paid com a data REAL do pagamento (saleDate da Hubla)
    const { error: updateError } = await supabase
      .from('meeting_slot_attendees')
      .update({
        status: 'contract_paid',
        contract_paid_at: data.saleDate // Usar data real do pagamento da Hubla!
      })
      .eq('id', matchingAttendee.id);

    if (updateError) {
      console.error('🎯 [AUTO-PAGO] Erro ao atualizar attendee:', updateError.message);
      return;
    }

    console.log(`✅ [AUTO-PAGO] Attendee ${matchingAttendee.id} marcado como contract_paid`);

    // 🔗 Vincular transação Hubla ao attendee para rastreabilidade completa
    if (data.transactionHublaId) {
      const { error: linkError } = await supabase
        .from('hubla_transactions')
        .update({
          linked_attendee_id: matchingAttendee.id,
          linked_method: 'auto',
          linked_at: new Date().toISOString(),
          linked_by_user_id: null,
        })
        .eq('hubla_id', data.transactionHublaId);

      if (linkError) {
        console.error(`⚠️ [AUTO-PAGO] Erro ao vincular transação ${data.transactionHublaId} ao attendee:`, linkError.message);
      } else {
        console.log(`🔗 [AUTO-PAGO] Transação ${data.transactionHublaId} vinculada ao attendee ${matchingAttendee.id}`);
      }
    }

    // 4. Atualizar reunião para completed se ainda não estiver
    if (meeting.status === 'scheduled' || meeting.status === 'rescheduled') {
      await supabase
        .from('meeting_slots')
        .update({ status: 'completed' })
        .eq('id', meeting.id);
      
      console.log(`✅ [AUTO-PAGO] Reunião ${meeting.id} marcada como completed`);
    }

    // 5. Criar notificação para o closer agendar R2
    if (meeting.closer_id) {
      const { error: notifError } = await supabase
        .from('user_notifications')
        .insert({
          user_id: meeting.closer_id,
          type: 'contract_paid',
          title: '💰 Contrato Pago - Agendar R2',
          message: `${data.customerName || matchingAttendee.attendee_name || 'Cliente'} pagou o contrato! Agende a R2.`,
          metadata: {
            attendee_id: matchingAttendee.id,
            meeting_id: meeting.id,
            customer_name: data.customerName,
            sale_date: data.saleDate,
            attendee_name: matchingAttendee.attendee_name,
            match_type: matchType
          },
          read: false
        });

      if (notifError) {
        console.error('🎯 [AUTO-PAGO] Erro ao criar notificação:', notifError.message);
      } else {
        console.log(`🔔 [AUTO-PAGO] Notificação criada para closer: ${meeting.closer_id}`);
      }
    }

    // 6. TRANSFERIR OWNERSHIP E MOVER ESTÁGIO DO DEAL
    if (matchingAttendee.deal_id && meeting.closer_id) {
      try {
        // Buscar email do closer
        const { data: closerData } = await supabase
          .from('closers')
          .select('email')
          .eq('id', meeting.closer_id)
          .maybeSingle();
        
        const closerEmail = closerData?.email;
        
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
            
            const { error: updateError } = await supabase
              .from('crm_deals')
              .update(updatePayload)
              .eq('id', matchingAttendee.deal_id);
            
            if (updateError) {
              console.error(`❌ [AUTO-PAGO] Erro ao transferir deal:`, updateError.message);
            } else {
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

    console.log(`🎉 [AUTO-PAGO] Contrato marcado como pago automaticamente via ${matchType.toUpperCase()}!`);
  } catch (err: any) {
    console.error('🎯 [AUTO-PAGO] Erro:', err.message);
  }
}

// ============= BILLING: Sincronização automática de cobranças =============
function mapPaymentMethodForBilling(value: string): string {
  const lower = (value || '').toLowerCase();
  if (lower.includes('pix')) return 'pix';
  if (lower.includes('credit') || lower.includes('card') || lower.includes('cartao')) return 'credit_card';
  if (lower.includes('boleto') || lower.includes('bank_slip') || lower.includes('slip')) return 'bank_slip';
  return 'outro';
}

async function syncBillingFromTransaction(supabase: any, tx: {
  customer_email: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  product_name: string;
  product_category: string;
  product_price: number;
  net_value: number;
  installment_number: number;
  total_installments: number;
  sale_date: string;
  transaction_id: string;
  payment_method: string | null;
}): Promise<void> {
  try {
    // Só processar parcelados (total_installments > 1)
    if (!tx.total_installments || tx.total_installments <= 1) return;
    if (!tx.customer_email) return;

    const emailLower = tx.customer_email.toLowerCase();
    console.log(`💳 [BILLING] Sync automático: ${emailLower} - ${tx.product_name} (parcela ${tx.installment_number}/${tx.total_installments})`);

    // Buscar subscription existente por email + produto
    const { data: existingSub } = await supabase
      .from('billing_subscriptions')
      .select('id, total_parcelas, valor_total_contrato, status')
      .ilike('customer_email', emailLower)
      .eq('product_name', tx.product_name)
      .maybeSingle();

    if (existingSub) {
      console.log(`💳 [BILLING] Subscription existente: ${existingSub.id}`);

      // Marcar parcela correspondente como paga
      const { data: installment } = await supabase
        .from('billing_installments')
        .select('id, status')
        .eq('subscription_id', existingSub.id)
        .eq('numero_parcela', tx.installment_number)
        .maybeSingle();

      if (installment) {
        if (installment.status !== 'pago') {
          await supabase
            .from('billing_installments')
            .update({
              status: 'pago',
              valor_pago: tx.net_value || tx.product_price,
              valor_liquido: tx.net_value || null,
              data_pagamento: tx.sale_date,
              hubla_transaction_id: tx.transaction_id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', installment.id);
          console.log(`💳 [BILLING] Parcela ${tx.installment_number} marcada como paga`);
        } else {
          console.log(`💳 [BILLING] Parcela ${tx.installment_number} já estava paga`);
        }
      } else {
        // Parcela não existe ainda — criar como paga
        await supabase
          .from('billing_installments')
          .insert({
            subscription_id: existingSub.id,
            numero_parcela: tx.installment_number,
            valor_original: tx.product_price,
            valor_pago: tx.net_value || tx.product_price,
            valor_liquido: tx.net_value || null,
            data_vencimento: tx.sale_date,
            data_pagamento: tx.sale_date,
            status: 'pago',
            hubla_transaction_id: tx.transaction_id,
          });
        console.log(`💳 [BILLING] Parcela ${tx.installment_number} criada como paga`);
      }

      // Recalcular status da subscription
      const { data: allInstallments } = await supabase
        .from('billing_installments')
        .select('status')
        .eq('subscription_id', existingSub.id);

      const total = allInstallments?.length || 0;
      const paidCount = allInstallments?.filter((i: any) => i.status === 'pago').length || 0;
      const overdueCount = allInstallments?.filter((i: any) => i.status === 'atrasado').length || 0;

      let newStatus: string;
      let newQuitacao: string;
      if (paidCount >= existingSub.total_parcelas) {
        newStatus = 'quitada';
        newQuitacao = 'quitado';
      } else if (overdueCount > 0) {
        newStatus = 'atrasada';
        newQuitacao = 'parcialmente_pago';
      } else {
        newStatus = 'em_dia';
        newQuitacao = paidCount > 0 ? 'parcialmente_pago' : 'em_aberto';
      }

      await supabase
        .from('billing_subscriptions')
        .update({ status: newStatus, status_quitacao: newQuitacao, updated_at: new Date().toISOString() })
        .eq('id', existingSub.id);

      console.log(`💳 [BILLING] Subscription atualizada: status=${newStatus}, quitacao=${newQuitacao} (${paidCount}/${existingSub.total_parcelas})`);

    } else {
      // Criar nova subscription + parcelas
      console.log(`💳 [BILLING] Criando nova subscription para ${emailLower} - ${tx.product_name}`);

      const valorParcela = tx.product_price;
      const valorTotal = valorParcela * tx.total_installments;
      const firstDate = new Date(tx.sale_date);

      // data_fim_prevista
      const fimDate = new Date(firstDate);
      fimDate.setDate(fimDate.getDate() + 30 * (tx.total_installments - 1));

      // Resolve contact_id
      let contactId: string | null = null;
      let dealId: string | null = null;
      const { data: contact } = await supabase
        .from('crm_contacts')
        .select('id')
        .ilike('email', emailLower)
        .limit(1)
        .maybeSingle();
      if (contact) {
        contactId = contact.id;
        const { data: deal } = await supabase
          .from('crm_deals')
          .select('id')
          .eq('contact_id', contact.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (deal) dealId = deal.id;
      }

      const { data: newSub, error: subErr } = await supabase
        .from('billing_subscriptions')
        .insert({
          customer_name: tx.customer_name || emailLower,
          customer_email: emailLower,
          customer_phone: tx.customer_phone || null,
          product_name: tx.product_name,
          product_category: tx.product_category || null,
          valor_entrada: 0,
          valor_total_contrato: valorTotal,
          total_parcelas: tx.total_installments,
          forma_pagamento: mapPaymentMethodForBilling(tx.payment_method || ''),
          status: 'em_dia',
          status_quitacao: 'parcialmente_pago',
          data_inicio: tx.sale_date,
          data_fim_prevista: fimDate.toISOString().split('T')[0],
          contact_id: contactId,
          deal_id: dealId,
        })
        .select('id')
        .single();

      if (subErr) {
        console.error(`💳 [BILLING] Erro ao criar subscription:`, subErr);
        return;
      }

      console.log(`💳 [BILLING] Subscription criada: ${newSub.id}`);

      // Criar todas as parcelas
      const now = new Date();
      const installments: any[] = [];
      for (let i = 1; i <= tx.total_installments; i++) {
        const isPaid = i === tx.installment_number;
        const dueDate = new Date(firstDate);
        dueDate.setDate(dueDate.getDate() + 30 * (i - 1));

        installments.push({
          subscription_id: newSub.id,
          numero_parcela: i,
          valor_original: valorParcela,
          valor_pago: isPaid ? (tx.net_value || valorParcela) : 0,
          valor_liquido: isPaid ? (tx.net_value || null) : null,
          data_vencimento: isPaid ? tx.sale_date : dueDate.toISOString(),
          data_pagamento: isPaid ? tx.sale_date : null,
          status: isPaid ? 'pago' : (dueDate < now ? 'atrasado' : 'pendente'),
          hubla_transaction_id: isPaid ? tx.transaction_id : null,
        });
      }

      const { error: instErr } = await supabase
        .from('billing_installments')
        .insert(installments);

      if (instErr) {
        console.error(`💳 [BILLING] Erro ao criar parcelas:`, instErr);
      } else {
        console.log(`💳 [BILLING] ${installments.length} parcelas criadas (parcela ${tx.installment_number} como paga)`);
      }
    }
  } catch (err: any) {
    console.error(`💳 [BILLING] Erro no sync automático:`, err.message);
  }
}

// ============= CONSÓRCIO: Configuração e Função de Criação de Deals =============
const CONSORCIO_ORIGIN_ID = '7d7b1cb5-2a44-4552-9eff-c3b798646b78';
const VIVER_ALUGUEL_ORIGIN_ID = '4e2b810a-6782-4ce9-9c0d-10d04c018636';
const STAGE_CLUBE_ARREMATE = 'bf370a4f-1476-4933-8c70-01a38cfdb34f';
const STAGE_RENOVACAO_HUBLA = '3e545cd2-4214-4510-9ec4-dfcc6eccede8';
const STAGE_VIVER_ALUGUEL_NOVO_LEAD = '2c69bf1d-94d5-4b6d-928d-dcf12da2d78c';

const CONSORCIO_STAGE_MAP: Record<string, string> = {
  'clube_arremate': STAGE_CLUBE_ARREMATE,
  'contrato_clube_arremate': STAGE_CLUBE_ARREMATE,
  'renovacao': STAGE_RENOVACAO_HUBLA,
  'ob_construir_alugar': STAGE_VIVER_ALUGUEL_NOVO_LEAD,
};

const CONSORCIO_PRODUCT_CATEGORIES = ['clube_arremate', 'contrato_clube_arremate', 'renovacao', 'ob_construir_alugar'];

interface ConsorcioDealData {
  email: string | null;
  phone: string | null;
  name: string | null;
  productName: string;
  productCategory: string;
  value: number;
  saleDate: string;
}

async function createDealForConsorcioProduct(supabase: any, data: ConsorcioDealData): Promise<void> {
  console.log(`🏦 [CONSÓRCIO] Iniciando criação de deal para: ${data.productName} (${data.productCategory})`);
  
  // 1. Determinar stage de destino
  const stageId = CONSORCIO_STAGE_MAP[data.productCategory];
  if (!stageId) {
    console.log(`🏦 [CONSÓRCIO] Categoria não mapeada para Consórcio: ${data.productCategory}`);
    return;
  }
  
  console.log(`🏦 [CONSÓRCIO] Stage destino: ${stageId}`);
  
  // Normalizar telefone
  const normalizedPhone = normalizePhone(data.phone);
  
  try {
    // 2. Buscar contato existente por EMAIL primeiro
    let contactId: string | null = null;
    
    if (data.email) {
      const { data: byEmail } = await supabase
        .from('crm_contacts')
        .select('id')
        .ilike('email', data.email)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      
      if (byEmail) {
        contactId = byEmail.id;
        console.log(`🏦 [CONSÓRCIO] Contato existente por email: ${contactId}`);
      }
    }
    
    // 3. Se não encontrou por email, buscar por telefone
    if (!contactId && normalizedPhone) {
      const phoneDigits = normalizedPhone.replace(/\D/g, '');
      const { data: byPhone } = await supabase
        .from('crm_contacts')
        .select('id')
        .or(`phone.eq.${normalizedPhone},phone.eq.+${phoneDigits},phone.eq.${phoneDigits}`)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      
      if (byPhone) {
        contactId = byPhone.id;
        console.log(`🏦 [CONSÓRCIO] Contato existente por telefone: ${contactId}`);
      }
    }
    
    // Determinar origin_id correto baseado na categoria
    const originId = data.productCategory === 'ob_construir_alugar' 
      ? VIVER_ALUGUEL_ORIGIN_ID 
      : CONSORCIO_ORIGIN_ID;
    
    // 4. Se não encontrou, criar novo contato
    if (!contactId) {
      const { data: newContact, error: contactError } = await supabase
        .from('crm_contacts')
        .insert({
          clint_id: `consorcio-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          name: data.name || 'Cliente Consórcio',
          email: data.email,
          phone: normalizedPhone,
          origin_id: originId,
          tags: data.productCategory === 'ob_construir_alugar' 
            ? ['Construir-Alugar', 'Hubla'] 
            : [data.productCategory, 'Hubla', 'Consórcio'],
          custom_fields: { source: 'hubla_consorcio', product: data.productName }
        })
        .select('id')
        .single();
      
      if (contactError) {
        console.error('🏦 [CONSÓRCIO] Erro ao criar contato:', contactError);
        return;
      }
      
      contactId = newContact?.id;
      console.log(`🏦 [CONSÓRCIO] Novo contato criado: ${contactId}`);
    }
    
    if (!contactId) {
      console.log('🏦 [CONSÓRCIO] Não foi possível obter contactId');
      return;
    }
    
    // 5. Verificar deal existente do contato em QUALQUER pipeline (para vinculação)
    let linkedDealId: string | null = null;
    const { data: existingDeal } = await supabase
      .from('crm_deals')
      .select('id, origin_id, name, tags')
      .eq('contact_id', contactId)
      .neq('origin_id', CONSORCIO_ORIGIN_ID)
      .neq('origin_id', VIVER_ALUGUEL_ORIGIN_ID)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (existingDeal) {
      linkedDealId = existingDeal.id;
      console.log(`🏦 [CONSÓRCIO] Deal existente para vincular: ${linkedDealId} (${existingDeal.name})`);
    }
    
    // 5b. Se é ob_construir_alugar, fazer verificação DEDICADA de A010/Inside Sales
    // Buscar em TODOS os contatos com este email (não só o contactId encontrado)
    if (data.productCategory === 'ob_construir_alugar') {
      const INSIDE_SALES_ORIGIN_ID = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c';
      
      // Verificação 1: Deal no Inside Sales para ESTE contato
      const { data: insideSalesDeal } = await supabase
        .from('crm_deals')
        .select('id, tags')
        .eq('contact_id', contactId)
        .eq('origin_id', INSIDE_SALES_ORIGIN_ID)
        .limit(1)
        .maybeSingle();
      
      if (insideSalesDeal) {
        console.log(`🏦 [CONSÓRCIO] ob_construir_alugar: Contato já tem deal no Inside Sales (${insideSalesDeal.id}). Adicionando tag.`);
        const currentTags = insideSalesDeal.tags || [];
        if (!currentTags.includes('ob-construir-alugar')) {
          await supabase.from('crm_deals').update({
            tags: [...currentTags, 'ob-construir-alugar'],
            updated_at: new Date().toISOString()
          }).eq('id', insideSalesDeal.id);
        }
        await supabase.from('deal_activities').insert({
          deal_id: insideSalesDeal.id,
          activity_type: 'note',
          description: `🔗 Cliente comprou order bump "Construir Para Alugar" — registrado como tag (deal já no Inside Sales)`,
          metadata: { product_name: data.productName, value: data.value }
        });
        return;
      }
      
      // Verificação 2: Deal no Inside Sales via OUTROS contatos com mesmo email
      if (data.email) {
        const { data: crossEmailDeal } = await supabase
          .from('crm_deals')
          .select('id, tags, crm_contacts!inner(email)')
          .eq('origin_id', INSIDE_SALES_ORIGIN_ID)
          .ilike('crm_contacts.email', data.email)
          .limit(1)
          .maybeSingle();
        
        if (crossEmailDeal) {
          console.log(`🏦 [CONSÓRCIO] ob_construir_alugar: Deal no Inside Sales encontrado via cross-email (${crossEmailDeal.id}). Adicionando tag.`);
          const currentTags = crossEmailDeal.tags || [];
          if (!currentTags.includes('ob-construir-alugar')) {
            await supabase.from('crm_deals').update({
              tags: [...currentTags, 'ob-construir-alugar'],
              updated_at: new Date().toISOString()
            }).eq('id', crossEmailDeal.id);
          }
          await supabase.from('deal_activities').insert({
            deal_id: crossEmailDeal.id,
            activity_type: 'note',
            description: `🔗 Cliente comprou order bump "Construir Para Alugar" — registrado como tag (deal no Inside Sales via cross-email)`,
            metadata: { product_name: data.productName, value: data.value }
          });
          return;
        }
      }
      
      // Verificação 3: Deal no Inside Sales via telefone (sufixo 9 dígitos)
      if (normalizedPhone) {
        const phoneDigits = normalizedPhone.replace(/\D/g, '');
        const phoneSuffix = phoneDigits.slice(-9);
        if (phoneSuffix.length >= 8) {
          const { data: crossPhoneDeal } = await supabase
            .from('crm_deals')
            .select('id, tags, crm_contacts!inner(phone)')
            .eq('origin_id', INSIDE_SALES_ORIGIN_ID)
            .like('crm_contacts.phone', `%${phoneSuffix}`)
            .limit(1)
            .maybeSingle();
          
          if (crossPhoneDeal) {
            console.log(`🏦 [CONSÓRCIO] ob_construir_alugar: Deal no Inside Sales encontrado via cross-phone (${crossPhoneDeal.id}). Adicionando tag.`);
            const currentTags = crossPhoneDeal.tags || [];
            if (!currentTags.includes('ob-construir-alugar')) {
              await supabase.from('crm_deals').update({
                tags: [...currentTags, 'ob-construir-alugar'],
                updated_at: new Date().toISOString()
              }).eq('id', crossPhoneDeal.id);
            }
            await supabase.from('deal_activities').insert({
              deal_id: crossPhoneDeal.id,
              activity_type: 'note',
              description: `🔗 Cliente comprou order bump "Construir Para Alugar" — registrado como tag (deal no Inside Sales via cross-phone)`,
              metadata: { product_name: data.productName, value: data.value }
            });
            return;
          }
        }
      }
      
      // Verificação 4: Compra A010 confirmada SEM deal ainda — bloquear Viver
      if (data.email) {
        const { data: a010Purchase } = await supabase
          .from('hubla_transactions')
          .select('id')
          .ilike('customer_email', data.email)
          .in('product_category', ['a010'])
          .eq('sale_status', 'completed')
          .limit(1)
          .maybeSingle();
        
        if (a010Purchase) {
          console.log(`🏦 [CONSÓRCIO] ob_construir_alugar: Compra A010 confirmada mas sem deal. Bloqueando Viver (A010 webhook criará o deal).`);
          return;
        }
      }
    }
    
    // 6. Verificar se já existe deal no pipeline correto para evitar duplicação
    const { data: dealInConsorcio } = await supabase
      .from('crm_deals')
      .select('id, custom_fields, tags, value')
      .eq('contact_id', contactId)
      .eq('origin_id', originId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (dealInConsorcio) {
      console.log(`🏦 [CONSÓRCIO] Deal já existe no pipeline Consórcio: ${dealInConsorcio.id} - Atualizando...`);
      
      // Atualizar deal existente com novos dados
      const currentCustomFields = dealInConsorcio.custom_fields || {};
      const updatedCustomFields = {
        ...currentCustomFields,
        ultima_compra_consorcio: new Date().toISOString(),
        ultimo_produto: data.productName,
        linked_deal_id: linkedDealId || currentCustomFields.linked_deal_id,
      };
      
      const currentTags = dealInConsorcio.tags || [];
      const newTag = data.productCategory.replace(/_/g, '-');
      const newTags = currentTags.includes(newTag) ? currentTags : [...currentTags, newTag];
      
      await supabase
        .from('crm_deals')
        .update({
          custom_fields: updatedCustomFields,
          tags: newTags,
          value: Math.max(dealInConsorcio.value || 0, data.value || 0),
          updated_at: new Date().toISOString()
        })
        .eq('id', dealInConsorcio.id);
      
      console.log(`🏦 [CONSÓRCIO] Deal atualizado: ${dealInConsorcio.id}`);
      return;
    }
    
    // 7. Criar novo deal no Consórcio
    const dealData = {
      clint_id: `consorcio-deal-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      name: `${data.name || 'Cliente'} - ${data.productName}`,
      value: data.value || 0,
      contact_id: contactId,
      origin_id: originId,
      stage_id: stageId,
      product_name: data.productName,
      tags: [data.productCategory.replace(/_/g, '-'), 'Hubla', 'Consórcio'],
      custom_fields: {
        source: 'hubla_consorcio',
        product: data.productName,
        product_category: data.productCategory,
        sale_date: data.saleDate,
        linked_deal_id: linkedDealId,
      },
      data_source: 'webhook',
    };
    
    const { data: newDeal, error: dealError } = await supabase
      .from('crm_deals')
      .insert(dealData)
      .select('id')
      .single();
    
    if (dealError) {
      if (dealError.code === '23505' || dealError.message?.includes('duplicate')) {
        console.log(`🏦 [CONSÓRCIO] Deal já existe (constraint) - ignorando`);
      } else {
        console.error('🏦 [CONSÓRCIO] Erro ao criar deal:', dealError);
      }
      return;
    }
    
    console.log(`✅ [CONSÓRCIO] Deal criado: ${newDeal.id} - ${dealData.name}`);
    
    // 8. Registrar atividade no deal original (se existir)
    if (linkedDealId && newDeal?.id) {
      const activityDescription = `🔗 Cliente comprou "${data.productName}" - Deal criado no pipeline Consórcio (ID: ${newDeal.id})`;
      
      await supabase
        .from('deal_activities')
        .insert({
          deal_id: linkedDealId,
          activity_type: 'note',
          description: activityDescription,
          metadata: {
            consorcio_deal_id: newDeal.id,
            product_name: data.productName,
            product_category: data.productCategory,
            value: data.value,
            created_by: 'hubla_webhook'
          }
        });
      
      console.log(`🏦 [CONSÓRCIO] Atividade registrada no deal original: ${linkedDealId}`);
    }
    
    // 9. Gerar tarefas automáticas para o novo deal
    await generateTasksForDeal(supabase, {
      dealId: newDeal.id,
      contactId: contactId,
      ownerId: null,
      originId: CONSORCIO_ORIGIN_ID,
      stageId,
    });
    
  } catch (err) {
    console.error('🏦 [CONSÓRCIO] Erro ao criar deal:', err);
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

  // Painel "Movimentações de Leads" (webhook_events)
  let wlLogId: string | null = null;
  let wlMappedType = 'purchase.unknown';
  let wlPayloadSnapshot: any = null;
  let wlFinalStatus: 'success' | 'error' = 'success';
  let wlFinalError: string | undefined;
  const finalizeWebhookLog = async () => {
    try {
      if (!wlLogId) {
        await supabase.from('webhook_events').insert({
          event_type: wlMappedType,
          event_data: wlPayloadSnapshot ?? {},
          status: wlFinalStatus,
          processed_at: new Date().toISOString(),
          processing_time_ms: Date.now() - startTime,
          error_message: wlFinalError ?? null,
        });
      } else {
        await supabase.from('webhook_events').update({
          status: wlFinalStatus,
          processed_at: new Date().toISOString(),
          processing_time_ms: Date.now() - startTime,
          error_message: wlFinalError ?? null,
        }).eq('id', wlLogId);
      }
    } catch (_) { /* nunca quebra fluxo */ }
  };

  try {
  try {
    const body = await req.json();
    const eventType = body.event_type || body.type;

    console.log('📥 Webhook recebido:', eventType);

    // Mapear evento Hubla → event_type do painel de movimentações
    wlPayloadSnapshot = body;
    if (eventType === 'invoice.refunded') {
      wlMappedType = 'purchase.refunded';
    } else if (eventType === 'invoice.payment_succeeded' || eventType === 'NewSale' || eventType === 'invoice.created') {
      wlMappedType = 'purchase.completed';
    } else if (eventType === 'lead.abandoned_checkout') {
      wlMappedType = 'lead.abandoned_checkout';
    } else {
      wlMappedType = `hubla.${eventType ?? 'unknown'}`;
    }
    try {
      const { data: wlLog } = await supabase
        .from('webhook_events')
        .insert({
          event_type: wlMappedType,
          event_data: body,
          status: 'processing',
        })
        .select('id')
        .single();
      wlLogId = wlLog?.id ?? null;
    } catch (_) { /* nunca quebra fluxo */ }

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
        
        // CORREÇÃO: Extrair UTMs de paymentSession.utm (novo formato Hubla)
        const paymentUtm = invoice?.paymentSession?.utm || {};
        const utmSource = paymentUtm.source || invoice?.utm_source || eventData?.utm_source || eventData?.utmSource || null;
        const utmMedium = paymentUtm.medium || invoice?.utm_medium || eventData?.utm_medium || eventData?.utmMedium || null;
        const utmCampaign = paymentUtm.campaign || invoice?.utm_campaign || eventData?.utm_campaign || eventData?.utmCampaign || null;
        const utmContent = paymentUtm.content || invoice?.utm_content || null;
        
        // Extrair offer_id e offer_name do webhook
        const offerIdNewSale = eventData.groupId || eventData.products?.[0]?.offers?.[0]?.id || null;
        const offerNameNewSale = eventData.products?.[0]?.offers?.[0]?.name || null;

        const transactionData = {
          hubla_id: eventData.id || `newsale-${Date.now()}`,
          event_type: 'NewSale',
          product_name: productName,
          product_code: eventData.productCode || null,
          product_price: productPrice,
          product_category: productCategory,
          offer_id: offerIdNewSale,
          offer_name: offerNameNewSale,
          // CORREÇÃO: userName/userEmail/userPhone são os campos corretos no NewSale
          customer_name: eventData.userName || eventData.customer?.name || eventData.customerName || null,
          customer_email: eventData.userEmail || eventData.customer?.email || eventData.customerEmail || null,
          customer_phone: eventData.userPhone || eventData.customer?.phone || eventData.customerPhone || null,
          customer_document: extractCustomerDocument(eventData, body),
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign,
          utm_content: utmContent,
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

        // 💳 BILLING: Sincronização automática de cobranças
        await syncBillingFromTransaction(supabase, {
          customer_email: transactionData.customer_email,
          customer_name: transactionData.customer_name,
          customer_phone: transactionData.customer_phone,
          product_name: productName,
          product_category: productCategory,
          product_price: productPrice,
          net_value: netValue,
          installment_number: installment,
          total_installments: installments,
          sale_date: saleDate,
          transaction_id: transactionData.hubla_id,
          payment_method: transactionData.payment_method,
        });

        // 🚫 [CRM] NewSale NÃO cria mais lead/deal/a010_sales no CRM.
        // O lead será criado apenas quando o `invoice.payment_succeeded` chegar,
        // evitando duplicação por race condition (NewSale + payment_succeeded simultâneos)
        // e leads-fantasma de boletos não pagos.
        // Mantemos apenas a transação em `hubla_transactions` e o sync de billing acima.
        if (productCategory === 'a010' && installment === 1) {
          console.log(`[CRM] NewSale A010 recebido (${transactionData.customer_email}) — lead será criado quando invoice.payment_succeeded chegar`);
        }
        if (CONSORCIO_PRODUCT_CATEGORIES.includes(productCategory) && installment === 1) {
          console.log(`[CRM] NewSale Consórcio recebido (${productName}) — deal será criado quando invoice.payment_succeeded chegar`);
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
          
          // CORREÇÃO: Extrair UTMs de paymentSession.utm (novo formato Hubla)
          const paymentUtm = invoice?.paymentSession?.utm || {};
          const utmSource = paymentUtm.source || invoice?.utm_source || null;
          const utmMedium = paymentUtm.medium || invoice?.utm_medium || null;
          const utmCampaign = paymentUtm.campaign || invoice?.utm_campaign || null;
          const utmContent = paymentUtm.content || invoice?.utm_content || null;
          
          // Extrair offer_id e offer_name (sem items) - body.event.products é fonte primária
          const offerIdNoItems = body.event?.groupId || body.event?.products?.[0]?.offers?.[0]?.id || invoice?.products?.[0]?.offers?.[0]?.id || null;
          const offerNameNoItems = body.event?.products?.[0]?.offers?.[0]?.name || invoice?.products?.[0]?.offers?.[0]?.name || null;

          const transactionData = {
            hubla_id: invoice?.id || `invoice-${Date.now()}`,
            event_type: 'invoice.payment_succeeded',
            product_name: productName,
            product_code: null,
            product_price: grossValue,
            product_category: productCategory,
            product_type: null,
            offer_id: offerIdNoItems,
            offer_name: offerNameNoItems,
            customer_name: `${payer.firstName || ''} ${payer.lastName || ''}`.trim() || user.name || null,
            customer_email: payer.email || user.email || null,
            customer_phone: payer.phone || user.phone || null,
            customer_document: extractCustomerDocument({ payer, user }, body),
            utm_source: utmSource,
            utm_medium: utmMedium,
            utm_campaign: utmCampaign,
            utm_content: utmContent,
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

          // 💳 BILLING: Sincronização automática de cobranças (invoice sem items)
          await syncBillingFromTransaction(supabase, {
            customer_email: transactionData.customer_email,
            customer_name: transactionData.customer_name,
            customer_phone: transactionData.customer_phone,
            product_name: productName,
            product_category: productCategory,
            product_price: grossValue,
            net_value: netValue,
            installment_number: installment,
            total_installments: installments,
            sale_date: saleDate,
            transaction_id: transactionData.hubla_id,
            payment_method: transactionData.payment_method,
          });

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
          
          // 🎯 CORREÇÃO: Detectar contrato pago mesmo quando items.length === 0
          const isContratoPago = (
            productCategory === 'contrato' || 
            (productCategory === 'incorporador' && grossValue >= 490 && grossValue <= 510) ||
            (productName.toUpperCase().includes('A000') && productName.toUpperCase().includes('CONTRATO'))
          );
          
          if (isContratoPago && installment === 1) {
            console.log(`🎯 [CONTRATO HUBLA] Pagamento detectado (sem items), buscando reunião R1...`);
            await autoMarkContractPaid(supabase, {
              customerEmail: transactionData.customer_email,
              customerPhone: transactionData.customer_phone,
              customerName: transactionData.customer_name,
              customerDocument: transactionData.customer_document,
              saleDate: saleDate,
              transactionHublaId: transactionData.hubla_id,
              offerName: transactionData.offer_name,
            });
          }
          
          // 🏦 CONSÓRCIO: Se for produto de consórcio e primeira parcela, criar deal
          if (CONSORCIO_PRODUCT_CATEGORIES.includes(productCategory) && installment === 1) {
            console.log(`🏦 [CONSÓRCIO invoice.payment_succeeded] Detectado (sem items): ${productName} (${productCategory})`);
            await createDealForConsorcioProduct(supabase, {
              email: transactionData.customer_email,
              phone: transactionData.customer_phone,
              name: transactionData.customer_name,
              productName: productName,
              productCategory: productCategory,
              value: netValue,
              saleDate: saleDate,
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
          
          // CORREÇÃO: Extrair UTMs de paymentSession.utm (novo formato Hubla)
          const paymentUtmItems = invoice?.paymentSession?.utm || {};
          const utmSourceItems = paymentUtmItems.source || invoice.utm_source || null;
          const utmMediumItems = paymentUtmItems.medium || invoice.utm_medium || null;
          const utmCampaignItems = paymentUtmItems.campaign || invoice.utm_campaign || null;
          const utmContentItems = paymentUtmItems.content || invoice.utm_content || null;
          
          // Para offers, calcular net_value proporcional
          // Para item principal, usar o net_value calculado
          const itemNetValue = isOffer 
            ? itemPrice * 0.9417 // Offers usam taxa aproximada
            : netValue;
          
          // Extrair offer_id e offer_name do item
          const itemOfferId = item.offer?.id || item.product?.offers?.[0]?.id || body.event?.groupId || null;
          const itemOfferName = item.offer?.name || item.product?.offers?.[0]?.name || null;

          const transactionData = {
            hubla_id: hublaId,
            event_type: 'invoice.payment_succeeded',
            product_name: productName,
            product_code: productCode,
            product_price: isOffer ? itemPrice : grossValue,
            product_category: productCategory,
            product_type: item.type || null,
            offer_id: itemOfferId,
            offer_name: itemOfferName,
            customer_name: `${payer.firstName || ''} ${payer.lastName || ''}`.trim() || invoice.customer?.name || invoice.customer_name || null,
            customer_email: payer.email || user.email || invoice.customer?.email || invoice.customer_email || null,
            customer_phone: payer.phone || user.phone || invoice.customer?.phone || invoice.customer_phone || null,
            customer_document: extractCustomerDocument({ payer, user, customer: invoice.customer }, body),
            utm_source: utmSourceItems,
            utm_medium: utmMediumItems,
            utm_campaign: utmCampaignItems,
            utm_content: utmContentItems,
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

          // 💳 BILLING: Sincronização automática de cobranças (invoice com items)
          if (!isOffer) {
            await syncBillingFromTransaction(supabase, {
              customer_email: transactionData.customer_email,
              customer_name: transactionData.customer_name,
              customer_phone: transactionData.customer_phone,
              product_name: productName,
              product_category: productCategory,
              product_price: isOffer ? itemPrice : grossValue,
              net_value: itemNetValue,
              installment_number: installment,
              total_installments: installments,
              sale_date: saleDate,
              transaction_id: hublaId,
              payment_method: transactionData.payment_method,
            });
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

          // Detectar se é um pagamento de contrato (categoria 'contrato' OU produto A000 com valor ~R$ 497)
          // Isso cobre casos onde A000-Contrato é categorizado como 'incorporador' mas é realmente um contrato
          const itemPriceForContractCheck = isOffer ? itemPrice : grossValue;
          const isContratoPago = (
            productCategory === 'contrato' || 
            (productCategory === 'incorporador' && itemPriceForContractCheck >= 490 && itemPriceForContractCheck <= 510) ||
            (productName.toUpperCase().includes('A000') && productName.toUpperCase().includes('CONTRATO'))
          );

          // Se for contrato, não for offer, e for primeira parcela, auto-marcar reunião R1 como contrato pago
          // NOTA: Este webhook só processa dados da Hubla (source = 'hubla'), nunca do Make
          if (isContratoPago && !isOffer && installment === 1) {
            console.log(`🎯 [CONTRATO HUBLA] Pagamento detectado (categoria: ${productCategory}, produto: ${productName}, valor: R$ ${itemPriceForContractCheck}), buscando reunião R1...`);
            await autoMarkContractPaid(supabase, {
              customerEmail: transactionData.customer_email,
              customerPhone: transactionData.customer_phone,
              customerName: transactionData.customer_name,
              customerDocument: transactionData.customer_document,
              saleDate: saleDate,
              transactionHublaId: hublaId,
              offerName: transactionData.offer_name,
            });
          }
          
          // 🏦 CONSÓRCIO: Se for produto de consórcio, não for offer, e primeira parcela, criar deal
          if (CONSORCIO_PRODUCT_CATEGORIES.includes(productCategory) && !isOffer && installment === 1) {
            console.log(`🏦 [CONSÓRCIO invoice.payment_succeeded] Detectado (item): ${productName} (${productCategory})`);
            await createDealForConsorcioProduct(supabase, {
              email: transactionData.customer_email,
              phone: transactionData.customer_phone,
              name: transactionData.customer_name,
              productName: productName,
              productCategory: productCategory,
              value: itemNetValue,
              saleDate: saleDate,
            });
          }
        }

        // Pós-loop: Se algum item A010 ficou como offer (idx > 0) e não criou lead, criar agora
        if (installment === 1) {
          const a010OfferIndex = items.findIndex((item: any, idx: number) => {
            const name = item.product?.name || item.offer?.name || item.name || '';
            const code = item.product?.code || item.product_code || null;
            return idx > 0 && mapProductCategory(name, code) === 'a010';
          });

          if (a010OfferIndex >= 0) {
            const a010Item = items[a010OfferIndex];
            const a010Name = a010Item.product?.name || a010Item.offer?.name || a010Item.name || 'A010';
            const a010Price = parseFloat(a010Item.price || a010Item.amount || 0);
            const payer = invoice?.payer || {};
            const user = body.event?.user || {};
            const customerEmail = payer.email || user.email || null;
            const customerPhone = payer.phone || user.phone || null;
            const customerName = `${payer.firstName || ''} ${payer.lastName || ''}`.trim() || user.name || null;
            const saleDate = new Date(invoice.saleDate || invoice.created_at || invoice.createdAt || Date.now()).toISOString();

            console.log(`🔄 [A010 como offer] Detectado no slot ${a010OfferIndex}, criando lead e a010_sales...`);

            // a010_sales
            await supabase.from('a010_sales').upsert({
              customer_name: customerName || 'Cliente Desconhecido',
              customer_email: customerEmail,
              customer_phone: customerPhone,
              net_value: a010Price,
              sale_date: saleDate,
              status: 'completed',
            }, { onConflict: 'customer_email,sale_date', ignoreDuplicates: true });

            // CRM contact + deal
            await createOrUpdateCRMContact(supabase, {
              email: customerEmail,
              phone: customerPhone,
              name: customerName,
              originName: 'A010 Hubla',
              productName: a010Name,
              value: a010Price,
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
          
          // === NOVO: Atualizar deal no CRM com badge de reembolso ===
          const customerEmail = invoice.customer?.email || invoice.customer_email || invoice.payer?.email;
          if (customerEmail) {
            console.log(`🔴 [REEMBOLSO CRM] Buscando contato por email: ${customerEmail}`);
            
            const { data: contact } = await supabase
              .from('crm_contacts')
              .select('id')
              .ilike('email', customerEmail)
              .limit(1)
              .maybeSingle();
            
            if (contact) {
              // Buscar deals do contato para atualizar
              const { data: deals } = await supabase
                .from('crm_deals')
                .select('id, custom_fields, tags')
                .eq('contact_id', contact.id);
              
              if (deals && deals.length > 0) {
                for (const deal of deals) {
                  // Merge custom_fields preservando dados existentes
                  const currentCustomFields = deal.custom_fields || {};
                  const updatedCustomFields = {
                    ...currentCustomFields,
                    reembolso_solicitado: true,
                    reembolso_em: new Date().toISOString(),
                    motivo_reembolso: 'Reembolso automático via Hubla'
                  };
                  
                  // Adicionar tag Reembolso se não existir
                  const currentTags = deal.tags || [];
                  const newTags = currentTags.includes('Reembolso') ? currentTags : [...currentTags, 'Reembolso'];
                  
                  await supabase
                    .from('crm_deals')
                    .update({
                      custom_fields: updatedCustomFields,
                      tags: newTags,
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', deal.id);
                  
                  console.log(`🔴 [REEMBOLSO CRM] Deal ${deal.id} marcado com badge de reembolso`);
                }
              }
            } else {
              console.log(`🔴 [REEMBOLSO CRM] Contato não encontrado para email: ${customerEmail}`);
            }
          }
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
    wlFinalStatus = 'error';
    wlFinalError = error?.message || 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  } finally {
    await finalizeWebhookLog();
  }
});
