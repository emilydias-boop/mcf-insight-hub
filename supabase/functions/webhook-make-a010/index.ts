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

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Only accept POST
    if (req.method !== "POST") {
      console.log("❌ Method not allowed:", req.method);
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse body
    const body: MakeA010Payload = await req.json();
    console.log("📥 Webhook Make A010 recebido:", JSON.stringify(body, null, 2));

    // Validate required fields
    if (!body.data || !body.nome || !body.email || body.valor_liquido === undefined) {
      console.log("❌ Campos obrigatórios faltando:", { 
        data: !!body.data, 
        nome: !!body.nome, 
        email: !!body.email, 
        valor_liquido: body.valor_liquido !== undefined 
      });
      return new Response(
        JSON.stringify({ 
          error: "Campos obrigatórios: data, nome, email, valor_liquido",
          received: { data: body.data, nome: body.nome, email: body.email, valor_liquido: body.valor_liquido }
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse monetary values - handles both Brazilian (1.234,56) and international (1234.56) formats
    const parseMonetaryValue = (value: number | string | undefined): number => {
      if (value === undefined || value === null || value === "") return 0;
      if (typeof value === "number") return value;
      const str = String(value).replace(/[R$\s]/g, "");
      // Brazilian format: has comma as decimal separator
      if (str.includes(",")) {
        const cleaned = str.replace(/\./g, "").replace(",", ".");
        return parseFloat(cleaned) || 0;
      }
      // International format
      return parseFloat(str) || 0;
    };

    let netValue = parseMonetaryValue(body.valor_liquido);
    const grossValue = parseMonetaryValue(body.valor_bruto) || netValue;

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ===== VALIDAÇÃO CONTRA HUBLA =====
    // Detectar se valor parece ser taxa da Hubla (< 15% do bruto)
    const pareceSerTaxa = grossValue > 0 && netValue < grossValue * 0.15;
    let valorCorrigido = false;
    let valorOriginalMake = netValue;

    if (pareceSerTaxa) {
      console.log("⚠️ Valor parece ser taxa da Hubla:", { netValue, grossValue, ratio: netValue / grossValue });
      
      // Buscar registro Hubla correspondente (mesmo email, data ±1 dia, mesmo valor bruto)
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

      if (!hublaError && hublaMatch && hublaMatch.net_value) {
        console.log("✅ Match encontrado na Hubla! Corrigindo valor:", {
          makeOriginal: netValue,
          hublaCorreto: hublaMatch.net_value
        });
        
        netValue = hublaMatch.net_value;
        valorCorrigido = true;

        // Criar alerta sobre a correção
        const { error: alertError } = await supabase.from("alertas").insert({
          tipo: "correcao_valor",
          titulo: `Valor corrigido: ${body.nome}`,
          descricao: `Make enviou R$ ${valorOriginalMake.toFixed(2)} (taxa Hubla), corrigido para R$ ${netValue.toFixed(2)} (valor líquido Hubla)`,
          user_id: "00000000-0000-0000-0000-000000000000", // System user
          metadata: { 
            email: body.email, 
            valorOriginal: valorOriginalMake, 
            valorCorrigido: netValue,
            produto: "A010 - MCF Fundamentos",
            dataVenda: body.data
          }
        });
        
        if (alertError) {
          console.warn("⚠️ Não foi possível criar alerta:", alertError);
        }
      } else {
        console.log("⚠️ Nenhum match encontrado na Hubla, mantendo valor do Make");
      }
    }

    // Parse sale date
    let saleDate: string;
    let parsedSaleDate: Date;
    try {
      parsedSaleDate = new Date(body.data);
      if (isNaN(parsedSaleDate.getTime())) {
        throw new Error("Invalid date");
      }
      saleDate = parsedSaleDate.toISOString();
    } catch {
      console.log("⚠️ Data inválida, usando data atual:", body.data);
      parsedSaleDate = new Date();
      saleDate = parsedSaleDate.toISOString();
    }

    // ===== UPSERT: Buscar transação newsale- existente =====
    const dataInicio = new Date(parsedSaleDate);
    dataInicio.setDate(dataInicio.getDate() - 1);
    const dataFim = new Date(parsedSaleDate);
    dataFim.setDate(dataFim.getDate() + 1);

    console.log("🔍 Buscando transação newsale- existente para:", {
      email: body.email.toLowerCase(),
      dataInicio: dataInicio.toISOString(),
      dataFim: dataFim.toISOString()
    });

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

    if (searchError) {
      console.warn("⚠️ Erro ao buscar newsale- existente:", searchError);
    }

    let resultData: any;
    let operationType: "update" | "insert";

    if (existingNewsale) {
      // ===== UPDATE: Atualizar transação newsale- existente =====
      console.log("✅ Encontrado newsale- existente! Atualizando:", {
        id: existingNewsale.id,
        hubla_id_antigo: existingNewsale.hubla_id,
        nome_antigo: existingNewsale.customer_name,
        net_value_antigo: existingNewsale.net_value
      });

      const timestamp = Date.now();
      const emailHash = body.email.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 10);
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
          count_in_dashboard: true, // CRITICAL: incluir no dashboard
          raw_data: { 
            ...body, 
            valor_corrigido: valorCorrigido, 
            valor_original_make: valorOriginalMake,
            newsale_id_original: existingNewsale.hubla_id,
            updated_from_make: true
          },
          updated_at: new Date().toISOString()
        })
        .eq("id", existingNewsale.id)
        .select()
        .single();

      if (updateError) {
        console.error("❌ Erro ao atualizar newsale-:", updateError);
        return new Response(
          JSON.stringify({ 
            error: "Erro ao atualizar transação existente", 
            details: updateError.message 
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      resultData = updatedData;
      operationType = "update";
      console.log(`✅ Transação newsale- atualizada com sucesso: ${existingNewsale.id}`);

    } else {
      // ===== INSERT: Criar nova transação =====
      const timestamp = Date.now();
      const emailHash = body.email.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 10);
      const hublaId = `make_a010_${timestamp}_${emailHash}`;

      const transactionData = {
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
      };

      console.log("💾 Nenhum newsale- encontrado. Inserindo nova transação:", JSON.stringify(transactionData, null, 2));

      const { data: insertedData, error: insertError } = await supabase
        .from("hubla_transactions")
        .insert(transactionData)
        .select()
        .single();

      if (insertError) {
        console.error("❌ Erro ao inserir:", insertError);
        return new Response(
          JSON.stringify({ 
            error: "Erro ao inserir transação", 
            details: insertError.message 
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      resultData = insertedData;
      operationType = "insert";
    }

    const processingTime = Date.now() - startTime;
    console.log(`✅ Venda A010 ${operationType === "update" ? "atualizada" : "inserida"} com sucesso em ${processingTime}ms:`, resultData?.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: operationType === "update" 
          ? "Transação newsale- atualizada com dados do Make" 
          : "Venda A010 registrada com sucesso",
        operation: operationType,
        transaction_id: resultData?.id,
        hubla_id: resultData?.hubla_id,
        valor_liquido: netValue,
        valor_corrigido: valorCorrigido,
        valor_original_make: valorCorrigido ? valorOriginalMake : undefined,
        processing_time_ms: processingTime,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ Erro no webhook Make A010:", error);
    return new Response(
      JSON.stringify({ 
        error: "Erro interno", 
        details: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
