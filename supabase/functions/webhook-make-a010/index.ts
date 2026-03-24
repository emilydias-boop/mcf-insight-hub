import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MakeA010Payload {
  data: string;
  nome: string;
  email: string;
  telefone?: string;
  valor_liquido: number | string;
  valor_bruto?: number | string;
}

const PARTNER_PATTERNS = ['A001', 'A002', 'A003', 'A004', 'A009', 'INCORPORADOR', 'ANTICRISE'];
const PIPELINE_INSIDE_SALES_ORIGIN = 'PIPELINE INSIDE SALES';

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return null;
  if (digits.startsWith('55') && digits.length >= 12) return `+${digits}`;
  if (digits.length === 11 || digits.length === 10) return `+55${digits}`;
  return digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: MakeA010Payload = await req.json();
    console.log("📥 Webhook Make A010 recebido:", JSON.stringify(body, null, 2));

    if (!body.data || !body.nome || !body.email || body.valor_liquido === undefined) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: data, nome, email, valor_liquido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parseMonetaryValue = (value: number | string | undefined): number => {
      if (value === undefined || value === null || value === "") return 0;
      if (typeof value === "number") return value;
      const str = String(value).replace(/[R$\s]/g, "");
      if (str.includes(",")) {
        return parseFloat(str.replace(/\./g, "").replace(",", ".")) || 0;
      }
      return parseFloat(str) || 0;
    };

    let netValue = parseMonetaryValue(body.valor_liquido);
    const grossValue = parseMonetaryValue(body.valor_bruto) || netValue;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ===== VALIDAÇÃO CONTRA HUBLA =====
    const pareceSerTaxa = grossValue > 0 && netValue < grossValue * 0.15;
    let valorCorrigido = false;
    const valorOriginalMake = netValue;

    if (pareceSerTaxa) {
      console.log("⚠️ Valor parece ser taxa da Hubla:", { netValue, grossValue });
      const parsedDate = new Date(body.data);
      const dataInicio = new Date(parsedDate);
      dataInicio.setDate(dataInicio.getDate() - 1);
      const dataFim = new Date(parsedDate);
      dataFim.setDate(dataFim.getDate() + 1);

      const { data: hublaMatch, error: hublaError } = await supabase
        .from("hubla_transactions")
        .select("net_value, product_price, customer_email")
        .eq("source", "hubla")
        .ilike("customer_email", body.email.toLowerCase())
        .gte("sale_date", dataInicio.toISOString())
        .lte("sale_date", dataFim.toISOString())
        .gte("product_price", grossValue * 0.95)
        .lte("product_price", grossValue * 1.05)
        .limit(1)
        .maybeSingle();

      if (!hublaError && hublaMatch?.net_value) {
        console.log("✅ Match Hubla! Corrigindo:", { de: netValue, para: hublaMatch.net_value });
        netValue = hublaMatch.net_value;
        valorCorrigido = true;

        await supabase.from("alertas").insert({
          tipo: "correcao_valor",
          titulo: `Valor corrigido: ${body.nome}`,
          descricao: `Make enviou R$ ${valorOriginalMake.toFixed(2)}, corrigido para R$ ${netValue.toFixed(2)}`,
          user_id: "00000000-0000-0000-0000-000000000000",
          metadata: { email: body.email, valorOriginal: valorOriginalMake, valorCorrigido: netValue, produto: "A010 - MCF Fundamentos", dataVenda: body.data }
        });
      }
    }

    // ===== PARSE DATE =====
    let saleDate: string;
    let parsedSaleDate: Date;
    try {
      parsedSaleDate = new Date(body.data);
      if (isNaN(parsedSaleDate.getTime())) throw new Error("Invalid date");
      saleDate = parsedSaleDate.toISOString();
    } catch {
      parsedSaleDate = new Date();
      saleDate = parsedSaleDate.toISOString();
    }

    // ===== UPSERT: Buscar transação newsale- existente =====
    const dataInicio = new Date(parsedSaleDate);
    dataInicio.setDate(dataInicio.getDate() - 1);
    const dataFim = new Date(parsedSaleDate);
    dataFim.setDate(dataFim.getDate() + 1);

    const { data: existingNewsale, error: searchError } = await supabase
      .from("hubla_transactions")
      .select("id, hubla_id, customer_name, net_value, product_price")
      .ilike("hubla_id", "newsale-%")
      .ilike("customer_email", body.email.toLowerCase().trim())
      .eq("product_category", "a010")
      .gte("sale_date", dataInicio.toISOString())
      .lte("sale_date", dataFim.toISOString())
      .limit(1)
      .maybeSingle();

    if (searchError) console.warn("⚠️ Erro ao buscar newsale-:", searchError);

    let resultData: any;
    let operationType: "update" | "insert";

    const timestamp = Date.now();
    const emailHash = body.email.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 10);

    if (existingNewsale) {
      const newHublaId = `make_a010_${timestamp}_${emailHash}`;
      const { data: updatedData, error: updateError } = await supabase
        .from("hubla_transactions")
        .update({
          hubla_id: newHublaId,
          customer_name: body.nome.trim(),
          customer_phone: body.telefone?.trim() || null,
          net_value: netValue,
          product_price: grossValue,
          sale_date: saleDate,
          source: "hubla_make_sync",
          count_in_dashboard: true,
          raw_data: { ...body, valor_corrigido: valorCorrigido, valor_original_make: valorOriginalMake, newsale_id_original: existingNewsale.hubla_id, updated_from_make: true },
          updated_at: new Date().toISOString()
        })
        .eq("id", existingNewsale.id)
        .select()
        .single();

      if (updateError) {
        console.error("❌ Erro ao atualizar newsale-:", updateError);
        return new Response(JSON.stringify({ error: "Erro ao atualizar transação", details: updateError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      resultData = updatedData;
      operationType = "update";
    } else {
      const hublaId = `make_a010_${timestamp}_${emailHash}`;
      const { data: insertedData, error: insertError } = await supabase
        .from("hubla_transactions")
        .insert({
          hubla_id: hublaId,
          customer_name: body.nome.trim(),
          customer_email: body.email.toLowerCase().trim(),
          customer_phone: body.telefone?.trim() || null,
          product_name: "A010 - MCF Fundamentos",
          product_category: "a010",
          net_value: netValue,
          product_price: grossValue,
          sale_date: saleDate,
          event_type: "invoice.payment_succeeded",
          sale_status: "completed",
          source: "make",
          count_in_dashboard: true,
          raw_data: { ...body, valor_corrigido: valorCorrigido, valor_original_make: valorOriginalMake },
        })
        .select()
        .single();

      if (insertError) {
        console.error("❌ Erro ao inserir:", insertError);
        return new Response(JSON.stringify({ error: "Erro ao inserir transação", details: insertError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      resultData = insertedData;
      operationType = "insert";
    }

    const processingTime = Date.now() - startTime;
    console.log(`✅ Transação A010 ${operationType} em ${processingTime}ms: ${resultData?.id}`);

    // ===== CRM: Criar contato e deal =====
    const crmResult = await createCrmDeal(supabase, {
      email: body.email.toLowerCase().trim(),
      name: body.nome.trim(),
      phone: body.telefone?.trim() || null,
      netValue,
      grossValue,
      saleDate,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: operationType === "update" ? "Transação newsale- atualizada" : "Venda A010 registrada",
        operation: operationType,
        transaction_id: resultData?.id,
        hubla_id: resultData?.hubla_id,
        valor_liquido: netValue,
        valor_corrigido: valorCorrigido,
        crm: crmResult,
        processing_time_ms: Date.now() - startTime,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ Erro no webhook Make A010:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ===== CRM DEAL CREATION (isolado para não bloquear a transação) =====
async function createCrmDeal(supabase: any, data: {
  email: string; name: string; phone: string | null; netValue: number; grossValue: number; saleDate: string;
}) {
  try {
    // 1. Buscar origin PIPELINE INSIDE SALES
    const { data: originData } = await supabase
      .from('crm_origins')
      .select('id')
      .ilike('name', PIPELINE_INSIDE_SALES_ORIGIN)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!originData) {
      console.warn("⚠️ CRM: Origin PIPELINE INSIDE SALES não encontrada");
      return { status: "skipped", reason: "origin_not_found" };
    }
    const originId = originData.id;

    // 2. Partner check
    const { data: partnerTxs } = await supabase
      .from('hubla_transactions')
      .select('product_name')
      .ilike('customer_email', data.email)
      .eq('sale_status', 'completed');

    const isPartner = (partnerTxs || []).some((tx: any) => {
      if (!tx.product_name) return false;
      const upper = tx.product_name.toUpperCase();
      return PARTNER_PATTERNS.some(p => upper.includes(p));
    });

    if (isPartner) {
      console.log("🤝 CRM: Parceiro detectado, registrando em partner_returns");
      await supabase.from('partner_returns').insert({
        customer_name: data.name,
        customer_email: data.email,
        customer_phone: data.phone,
        product_name: 'A010 - MCF Fundamentos',
        net_value: data.netValue,
        sale_date: data.saleDate,
        source: 'make',
        action_taken: 'registered_partner_return',
      }).catch((e: any) => console.warn("⚠️ partner_returns insert error:", e.message));
      return { status: "skipped", reason: "partner" };
    }

    // 3. Buscar/criar contato
    const { data: existingContact } = await supabase
      .from('crm_contacts')
      .select('id')
      .ilike('email', data.email)
      .limit(1)
      .maybeSingle();

    let contactId: string;
    if (existingContact) {
      contactId = existingContact.id;
      // Atualizar telefone se disponível
      if (data.phone) {
        const normalizedPhone = normalizePhone(data.phone);
        if (normalizedPhone) {
          await supabase.from('crm_contacts').update({ phone: normalizedPhone }).eq('id', contactId);
        }
      }
    } else {
      const normalizedPhone = normalizePhone(data.phone);
      const { data: newContact, error: contactError } = await supabase
        .from('crm_contacts')
        .insert({
          clint_id: `make-a010-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: data.name,
          email: data.email,
          phone: normalizedPhone,
          origin_id: originId,
          tags: ['A010', 'Make'],
          custom_fields: { source: 'make', product: 'A010 - MCF Fundamentos' },
        })
        .select('id')
        .single();

      if (contactError) {
        console.error("❌ CRM: Erro ao criar contato:", contactError);
        return { status: "error", reason: "contact_creation_failed", detail: contactError.message };
      }
      contactId = newContact.id;
    }

    // 4. Verificar deal existente
    const { data: existingDeal } = await supabase
      .from('crm_deals')
      .select('id, stage_id, value')
      .eq('contact_id', contactId)
      .eq('origin_id', originId)
      .limit(1)
      .maybeSingle();

    if (existingDeal) {
      console.log("✅ CRM: Deal já existe, atualizando valor:", existingDeal.id);
      // Atualizar valor líquido e bruto se necessário
      await supabase.from('crm_deals').update({
        value: data.netValue,
        custom_fields: { source: 'make', product: 'A010 - MCF Fundamentos', sale_date: data.saleDate, updated_by_make: true },
      }).eq('id', existingDeal.id);
      return { status: "updated", deal_id: existingDeal.id };
    }

    // 5. Buscar stage "Novo Lead"
    const { data: stageData } = await supabase
      .from('crm_stages')
      .select('id')
      .eq('origin_id', originId)
      .ilike('stage_name', '%Novo Lead%')
      .limit(1)
      .maybeSingle();

    const stageId = stageData?.id || null;

    // 6. Distribuir para SDR
    let ownerEmail: string | null = null;
    let ownerProfileId: string | null = null;
    const { data: nextOwner } = await supabase.rpc('get_next_lead_owner', { p_origin_id: originId });
    if (nextOwner) {
      ownerEmail = nextOwner;
      const { data: profile } = await supabase
        .from('profiles').select('id').ilike('email', nextOwner).limit(1).maybeSingle();
      ownerProfileId = profile?.id || null;
    }

    // 7. Criar deal
    const { data: newDeal, error: dealError } = await supabase
      .from('crm_deals')
      .insert({
        clint_id: `make-a010-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: `${data.name} - A010`,
        contact_id: contactId,
        origin_id: originId,
        stage_id: stageId,
        value: data.netValue,
        owner_id: ownerEmail,
        owner_profile_id: ownerProfileId,
        tags: ['A010', 'Make'],
        custom_fields: { source: 'make', product: 'A010 - MCF Fundamentos', sale_date: data.saleDate, distributed: !!ownerEmail, deal_user_original: ownerEmail },
        data_source: 'webhook',
      })
      .select('id')
      .single();

    if (dealError) {
      console.error("❌ CRM: Erro ao criar deal:", dealError);
      return { status: "error", reason: "deal_creation_failed", detail: dealError.message };
    }

    console.log(`✅ CRM: Deal criado ${newDeal.id} → owner: ${ownerEmail}`);

    // 8. Registrar atividade de distribuição
    if (newDeal?.id && ownerEmail) {
      await supabase.from('deal_activities').insert({
        deal_id: newDeal.id,
        activity_type: 'owner_change',
        description: `Lead A010 (Make) distribuído para ${ownerEmail}`,
        metadata: { owner_email: ownerEmail, source: 'webhook-make-a010', distributed: true },
      });
    }

    // 9. Upsert a010_sales
    await supabase.from('a010_sales').upsert({
      customer_name: data.name,
      customer_email: data.email,
      customer_phone: data.phone,
      net_value: data.netValue,
      sale_date: data.saleDate,
      status: 'completed',
    }, { onConflict: 'customer_email,sale_date', ignoreDuplicates: true });

    return { status: "created", deal_id: newDeal.id, owner: ownerEmail };

  } catch (err: any) {
    console.error("❌ CRM: Erro geral:", err.message);
    return { status: "error", reason: "unexpected", detail: err.message };
  }
}
