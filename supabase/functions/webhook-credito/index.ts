import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type EventType = 'new_deal' | 'update_deal' | 'stage_change' | 'new_partner';
type ProductCode = 'mcf_capital' | 'credito_he' | 'credito_construcao' | 'credito_pre_ct' | 'credito_imovel_pronto' | 'credito_condo';
type PartnerTipo = 'capital_proprio' | 'carta_consorcio';

interface CreditoPayload {
  event_type: EventType;
  
  // Identificação do produto (obrigatório para deals)
  produto?: ProductCode;
  
  // Dados do cliente
  cliente_nome?: string;
  cliente_cpf_cnpj?: string;
  cliente_email?: string;
  cliente_telefone?: string;
  
  // Dados do crédito
  valor_solicitado?: number;
  valor_aprovado?: number;
  taxa_juros?: number;
  prazo_meses?: number;
  garantia?: string;
  observacoes?: string;
  titulo?: string;
  
  // Para mudança de estágio e update
  deal_id?: string;
  stage_name?: string;
  
  // Vinculação com sócio
  socio_cpf_cnpj?: string;
  
  // Para novo sócio
  socio_nome?: string;
  socio_tipo?: PartnerTipo;
  socio_valor_aportado?: number;
  socio_consorcio_grupo_cota?: string;
  socio_email?: string;
  socio_telefone?: string;
  socio_observacoes?: string;
  
  // Origem e responsável
  origem?: string;
  vendedor_email?: string;
}

function parseMonetaryValue(value: any): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  
  const str = String(value)
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  
  return parseFloat(str) || 0;
}

function cleanCpfCnpj(value: string): string {
  return value.replace(/[^\d]/g, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: CreditoPayload = await req.json();
    console.log('Webhook Crédito - Payload recebido:', JSON.stringify(payload));

    if (!payload.event_type) {
      return new Response(
        JSON.stringify({ success: false, error: 'Campo obrigatório: event_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Log do webhook
    const { data: logEntry } = await supabase
      .from('bu_webhook_logs')
      .insert({
        bu_type: 'credito',
        event_type: payload.event_type,
        payload: payload,
        status: 'processing'
      })
      .select('id')
      .single();

    const logId = logEntry?.id;

    // Helper para atualizar log com erro
    const logError = async (message: string) => {
      if (logId) {
        await supabase
          .from('bu_webhook_logs')
          .update({ status: 'error', error_message: message, processed_at: new Date().toISOString() })
          .eq('id', logId);
      }
    };

    // Helper para atualizar log com sucesso
    const logSuccess = async (recordId?: string) => {
      if (logId) {
        await supabase
          .from('bu_webhook_logs')
          .update({ status: 'processed', record_id: recordId, processed_at: new Date().toISOString() })
          .eq('id', logId);
      }
    };

    // ========== NEW_DEAL ==========
    if (payload.event_type === 'new_deal') {
      // Validações
      if (!payload.produto || !payload.cliente_nome || !payload.cliente_cpf_cnpj || !payload.valor_solicitado) {
        await logError('Campos obrigatórios para new_deal: produto, cliente_nome, cliente_cpf_cnpj, valor_solicitado');
        return new Response(
          JSON.stringify({ success: false, error: 'Campos obrigatórios: produto, cliente_nome, cliente_cpf_cnpj, valor_solicitado' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar produto
      const { data: product, error: productError } = await supabase
        .from('credit_products')
        .select('id, name')
        .eq('code', payload.produto)
        .eq('is_active', true)
        .single();

      if (productError || !product) {
        await logError(`Produto não encontrado: ${payload.produto}`);
        return new Response(
          JSON.stringify({ success: false, error: `Produto não encontrado: ${payload.produto}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar estágio inicial do produto
      const { data: initialStage, error: stageError } = await supabase
        .from('credit_stages')
        .select('id, name')
        .eq('product_id', product.id)
        .order('stage_order', { ascending: true })
        .limit(1)
        .single();

      if (stageError || !initialStage) {
        await logError(`Estágio inicial não encontrado para produto: ${payload.produto}`);
        return new Response(
          JSON.stringify({ success: false, error: 'Estágio inicial não configurado para este produto' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar/criar cliente
      const clientCpf = cleanCpfCnpj(payload.cliente_cpf_cnpj);
      const { data: existingClient } = await supabase
        .from('credit_clients')
        .select('id')
        .eq('cpf', clientCpf)
        .single();

      let clientId: string;

      if (existingClient) {
        clientId = existingClient.id;
        await supabase
          .from('credit_clients')
          .update({
            full_name: payload.cliente_nome,
            email: payload.cliente_email,
            phone: payload.cliente_telefone,
            updated_at: new Date().toISOString()
          })
          .eq('id', clientId);
      } else {
        const { data: newClient, error: clientError } = await supabase
          .from('credit_clients')
          .insert({
            full_name: payload.cliente_nome,
            cpf: clientCpf,
            email: payload.cliente_email,
            phone: payload.cliente_telefone,
            status: 'ativo'
          })
          .select('id')
          .single();

        if (clientError || !newClient) {
          await logError(`Erro ao criar cliente: ${clientError?.message}`);
          return new Response(
            JSON.stringify({ success: false, error: clientError?.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        clientId = newClient.id;
      }

      // Verificar se há sócio para vincular
      let partnerId: string | null = null;
      if (payload.socio_cpf_cnpj) {
        const { data: partner } = await supabase
          .from('credit_partners')
          .select('id')
          .eq('cpf_cnpj', cleanCpfCnpj(payload.socio_cpf_cnpj))
          .single();
        
        if (partner) {
          partnerId = partner.id;
        }
      }

      // Criar deal
      const dealTitle = payload.titulo || `${product.name} - ${payload.cliente_nome}`;
      const { data: newDeal, error: dealError } = await supabase
        .from('credit_deals')
        .insert({
          product_id: product.id,
          stage_id: initialStage.id,
          client_id: clientId,
          partner_id: partnerId,
          titulo: dealTitle,
          valor_solicitado: parseMonetaryValue(payload.valor_solicitado),
          valor_aprovado: payload.valor_aprovado ? parseMonetaryValue(payload.valor_aprovado) : null,
          taxa_juros: payload.taxa_juros,
          prazo_meses: payload.prazo_meses,
          garantia: payload.garantia,
          observacoes: payload.observacoes,
          data_solicitacao: new Date().toISOString()
        })
        .select('id')
        .single();

      if (dealError || !newDeal) {
        await logError(`Erro ao criar deal: ${dealError?.message}`);
        return new Response(
          JSON.stringify({ success: false, error: dealError?.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Se há sócio, criar vínculo em credit_partner_deals
      if (partnerId) {
        await supabase
          .from('credit_partner_deals')
          .insert({
            partner_id: partnerId,
            deal_id: newDeal.id
          });
      }

      // Criar atividade inicial
      await supabase
        .from('credit_deal_activities')
        .insert({
          deal_id: newDeal.id,
          activity_type: 'created',
          to_stage_id: initialStage.id,
          description: `Deal criado via webhook: ${dealTitle}`,
          metadata: { origem: payload.origem, vendedor_email: payload.vendedor_email }
        });

      await logSuccess(newDeal.id);

      const processingTime = Date.now() - startTime;
      console.log(`Webhook Crédito [new_deal] processado em ${processingTime}ms - Deal ID: ${newDeal.id}`);

      return new Response(
        JSON.stringify({
          success: true,
          deal_id: newDeal.id,
          client_id: clientId,
          product: payload.produto,
          stage: initialStage.name,
          partner_linked: !!partnerId,
          processing_time_ms: processingTime
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== UPDATE_DEAL ==========
    if (payload.event_type === 'update_deal') {
      if (!payload.deal_id) {
        await logError('Campo obrigatório para update_deal: deal_id');
        return new Response(
          JSON.stringify({ success: false, error: 'Campo obrigatório: deal_id' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar deal existente
      const { data: existingDeal, error: dealFetchError } = await supabase
        .from('credit_deals')
        .select('id, titulo')
        .eq('id', payload.deal_id)
        .single();

      if (dealFetchError || !existingDeal) {
        await logError(`Deal não encontrado: ${payload.deal_id}`);
        return new Response(
          JSON.stringify({ success: false, error: 'Deal não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Montar objeto de atualização
      const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
      
      if (payload.valor_solicitado) updateData.valor_solicitado = parseMonetaryValue(payload.valor_solicitado);
      if (payload.valor_aprovado) updateData.valor_aprovado = parseMonetaryValue(payload.valor_aprovado);
      if (payload.taxa_juros) updateData.taxa_juros = payload.taxa_juros;
      if (payload.prazo_meses) updateData.prazo_meses = payload.prazo_meses;
      if (payload.garantia) updateData.garantia = payload.garantia;
      if (payload.observacoes) updateData.observacoes = payload.observacoes;
      if (payload.titulo) updateData.titulo = payload.titulo;

      const { error: updateError } = await supabase
        .from('credit_deals')
        .update(updateData)
        .eq('id', payload.deal_id);

      if (updateError) {
        await logError(`Erro ao atualizar deal: ${updateError.message}`);
        return new Response(
          JSON.stringify({ success: false, error: updateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Criar atividade de atualização
      await supabase
        .from('credit_deal_activities')
        .insert({
          deal_id: payload.deal_id,
          activity_type: 'updated',
          description: 'Deal atualizado via webhook',
          metadata: { campos_atualizados: Object.keys(updateData).filter(k => k !== 'updated_at') }
        });

      await logSuccess(payload.deal_id);

      const processingTime = Date.now() - startTime;
      return new Response(
        JSON.stringify({
          success: true,
          deal_id: payload.deal_id,
          updated_fields: Object.keys(updateData).filter(k => k !== 'updated_at'),
          processing_time_ms: processingTime
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== STAGE_CHANGE ==========
    if (payload.event_type === 'stage_change') {
      if (!payload.deal_id || !payload.stage_name) {
        await logError('Campos obrigatórios para stage_change: deal_id, stage_name');
        return new Response(
          JSON.stringify({ success: false, error: 'Campos obrigatórios: deal_id, stage_name' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar deal e estágio atual
      const { data: deal, error: dealError } = await supabase
        .from('credit_deals')
        .select('id, stage_id, product_id')
        .eq('id', payload.deal_id)
        .single();

      if (dealError || !deal) {
        await logError(`Deal não encontrado: ${payload.deal_id}`);
        return new Response(
          JSON.stringify({ success: false, error: 'Deal não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar novo estágio pelo nome e produto
      const { data: newStage, error: stageError } = await supabase
        .from('credit_stages')
        .select('id, name, is_final, is_won')
        .eq('product_id', deal.product_id)
        .eq('name', payload.stage_name)
        .single();

      if (stageError || !newStage) {
        await logError(`Estágio não encontrado: ${payload.stage_name}`);
        return new Response(
          JSON.stringify({ success: false, error: `Estágio não encontrado: ${payload.stage_name}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Atualizar estágio do deal
      const updateData: Record<string, any> = { 
        stage_id: newStage.id, 
        updated_at: new Date().toISOString() 
      };

      // Se estágio for final ganho, setar data de aprovação/liberação
      if (newStage.is_final && newStage.is_won) {
        updateData.data_aprovacao = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from('credit_deals')
        .update(updateData)
        .eq('id', payload.deal_id);

      if (updateError) {
        await logError(`Erro ao atualizar estágio: ${updateError.message}`);
        return new Response(
          JSON.stringify({ success: false, error: updateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Criar atividade de mudança de estágio
      await supabase
        .from('credit_deal_activities')
        .insert({
          deal_id: payload.deal_id,
          activity_type: 'stage_change',
          from_stage_id: deal.stage_id,
          to_stage_id: newStage.id,
          description: `Movido para: ${newStage.name}`
        });

      await logSuccess(payload.deal_id);

      const processingTime = Date.now() - startTime;
      return new Response(
        JSON.stringify({
          success: true,
          deal_id: payload.deal_id,
          new_stage: newStage.name,
          is_final: newStage.is_final,
          is_won: newStage.is_won,
          processing_time_ms: processingTime
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== NEW_PARTNER ==========
    if (payload.event_type === 'new_partner') {
      if (!payload.socio_nome || !payload.socio_cpf_cnpj || !payload.socio_tipo) {
        await logError('Campos obrigatórios para new_partner: socio_nome, socio_cpf_cnpj, socio_tipo');
        return new Response(
          JSON.stringify({ success: false, error: 'Campos obrigatórios: socio_nome, socio_cpf_cnpj, socio_tipo' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const partnerCpfCnpj = cleanCpfCnpj(payload.socio_cpf_cnpj);

      // Verificar se sócio já existe
      const { data: existingPartner } = await supabase
        .from('credit_partners')
        .select('id')
        .eq('cpf_cnpj', partnerCpfCnpj)
        .single();

      let partnerId: string;
      let wasCreated = true;

      if (existingPartner) {
        partnerId = existingPartner.id;
        wasCreated = false;
        
        // Atualizar dados existentes
        await supabase
          .from('credit_partners')
          .update({
            full_name: payload.socio_nome,
            tipo: payload.socio_tipo,
            valor_aportado: payload.socio_valor_aportado ? parseMonetaryValue(payload.socio_valor_aportado) : null,
            email: payload.socio_email,
            phone: payload.socio_telefone,
            observacoes: payload.socio_observacoes,
            updated_at: new Date().toISOString()
          })
          .eq('id', partnerId);
      } else {
        // Verificar se há carta de consórcio para vincular
        let consorcioCardId: string | null = null;
        if (payload.socio_tipo === 'carta_consorcio' && payload.socio_consorcio_grupo_cota) {
          const [grupo, cota] = payload.socio_consorcio_grupo_cota.split('/');
          if (grupo && cota) {
            const { data: card } = await supabase
              .from('consortium_cards')
              .select('id')
              .eq('grupo', grupo.trim())
              .eq('cota', cota.trim())
              .single();
            
            if (card) {
              consorcioCardId = card.id;
            }
          }
        }

        // Criar novo sócio
        const { data: newPartner, error: partnerError } = await supabase
          .from('credit_partners')
          .insert({
            full_name: payload.socio_nome,
            cpf_cnpj: partnerCpfCnpj,
            tipo: payload.socio_tipo,
            valor_aportado: payload.socio_valor_aportado ? parseMonetaryValue(payload.socio_valor_aportado) : 0,
            email: payload.socio_email,
            phone: payload.socio_telefone,
            observacoes: payload.socio_observacoes,
            consorcio_card_id: consorcioCardId,
            status: 'prospect'
          })
          .select('id')
          .single();

        if (partnerError || !newPartner) {
          await logError(`Erro ao criar sócio: ${partnerError?.message}`);
          return new Response(
            JSON.stringify({ success: false, error: partnerError?.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        partnerId = newPartner.id;
      }

      await logSuccess(partnerId);

      const processingTime = Date.now() - startTime;
      return new Response(
        JSON.stringify({
          success: true,
          partner_id: partnerId,
          tipo: payload.socio_tipo,
          was_created: wasCreated,
          processing_time_ms: processingTime
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Event type não reconhecido
    await logError(`Event type não reconhecido: ${payload.event_type}`);
    return new Response(
      JSON.stringify({ success: false, error: `Event type não reconhecido: ${payload.event_type}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro no webhook crédito:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
