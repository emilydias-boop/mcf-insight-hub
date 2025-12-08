import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const netValue = parseMonetaryValue(body.valor_liquido);
    const grossValue = parseMonetaryValue(body.valor_bruto) || netValue;

    // Generate unique hubla_id
    const timestamp = Date.now();
    const emailHash = body.email.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 10);
    const hublaId = `make_a010_${timestamp}_${emailHash}`;

    // Parse sale date
    let saleDate: string;
    try {
      const parsedDate = new Date(body.data);
      if (isNaN(parsedDate.getTime())) {
        throw new Error("Invalid date");
      }
      saleDate = parsedDate.toISOString();
    } catch {
      console.log("⚠️ Data inválida, usando data atual:", body.data);
      saleDate = new Date().toISOString();
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Prepare transaction data
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
      raw_data: body,
    };

    console.log("💾 Inserindo transação:", JSON.stringify(transactionData, null, 2));

    // Insert into hubla_transactions
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

    const processingTime = Date.now() - startTime;
    console.log(`✅ Venda A010 inserida com sucesso em ${processingTime}ms:`, insertedData?.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Venda A010 registrada com sucesso",
        transaction_id: insertedData?.id,
        hubla_id: hublaId,
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
