import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results = {
      inserted: [] as string[],
      updated: [] as string[],
      errors: [] as string[],
    };

    // 1. Valdir Mamede - A009 R$ 19.500 (23/12) - FALTANDO
    const { error: valdirError } = await supabase.from("hubla_transactions").upsert({
      hubla_id: "manual-valdir-a009-20251223",
      product_name: "A009 - MCF INCORPORADOR COMPLETO + THE CLUB",
      product_category: "incorporador",
      product_price: 19500,
      net_value: 3889.26,
      customer_name: "Valdir Mamede",
      customer_email: "valdiraiwa2025@gmail.com",
      customer_phone: "5583999031842",
      sale_date: "2025-12-23",
      sale_status: "completed",
      source: "manual_fix",
      event_type: "invoice.payment_succeeded",
      installment_number: 1,
      total_installments: 12,
    }, { onConflict: "hubla_id" });
    
    if (valdirError) {
      results.errors.push(`Valdir: ${valdirError.message}`);
    } else {
      results.inserted.push("Valdir Mamede - A009 R$ 19.500");
    }

    // 2. Jhonatan Gonçalves - Contrato Anticrise R$ 397 (23/12) - FALTANDO
    const { error: jhonatanError } = await supabase.from("hubla_transactions").upsert({
      hubla_id: "manual-jhonatan-contrato-20251223",
      product_name: "Contrato - Anticrise",
      product_category: "contrato",
      product_price: 397,
      net_value: 367.55,
      customer_name: "Jhonatan Gonçalves Domingos Costa",
      customer_email: "jhonatandomingoscosta@gmail.com",
      customer_phone: "5517997140864",
      sale_date: "2025-12-23",
      sale_status: "completed",
      source: "manual_fix",
      event_type: "invoice.payment_succeeded",
      installment_number: 1,
      total_installments: 1,
    }, { onConflict: "hubla_id" });
    
    if (jhonatanError) {
      results.errors.push(`Jhonatan: ${jhonatanError.message}`);
    } else {
      results.inserted.push("Jhonatan Gonçalves - Contrato R$ 397");
    }

    // 3. Lucas Daniel - A003 (26/12) - FALTANDO Hubla
    const { error: lucasError } = await supabase.from("hubla_transactions").upsert({
      hubla_id: "manual-lucas-a003-20251226",
      product_name: "A003 - MCF Plano Anticrise Completo",
      product_category: "incorporador",
      product_price: 7503,
      net_value: 963.57,
      customer_name: "Lucas Daniel Gonçalves dos Santos",
      customer_email: "goncalvesdossantosl50@gmail.com",
      customer_phone: "5538997576839",
      sale_date: "2025-12-26",
      sale_status: "completed",
      source: "manual_fix",
      event_type: "invoice.payment_succeeded",
      installment_number: 1,
      total_installments: 12,
    }, { onConflict: "hubla_id" });
    
    if (lucasError) {
      results.errors.push(`Lucas: ${lucasError.message}`);
    } else {
      results.inserted.push("Lucas Daniel - A003 R$ 7.503");
    }

    // 4. Pollyana - Atualizar valor para R$ 19.500 (estava R$ 10.000)
    const { data: pollyanaData, error: pollyanaFindError } = await supabase
      .from("hubla_transactions")
      .select("id, product_price")
      .ilike("customer_email", "pollyanaolemess@gmail.com")
      .gte("sale_date", "2025-12-23")
      .lt("sale_date", "2025-12-24")
      .eq("source", "hubla")
      .single();

    if (pollyanaData && pollyanaData.product_price !== 19500) {
      const { error: pollyanaUpdateError } = await supabase
        .from("hubla_transactions")
        .update({ product_price: 19500 })
        .eq("id", pollyanaData.id);
      
      if (pollyanaUpdateError) {
        results.errors.push(`Pollyana update: ${pollyanaUpdateError.message}`);
      } else {
        results.updated.push(`Pollyana - Atualizado de R$ ${pollyanaData.product_price} para R$ 19.500`);
      }
    }

    // 5. Roberto Francisco - A004 valor R$ 5.503 (estava ~R$ 250)
    const { data: robertoData } = await supabase
      .from("hubla_transactions")
      .select("id, product_price")
      .ilike("customer_email", "rf8218189@gmail.com")
      .gte("sale_date", "2025-12-23")
      .lt("sale_date", "2025-12-24")
      .eq("source", "hubla")
      .single();

    if (robertoData && robertoData.product_price !== 5503) {
      const { error: robertoUpdateError } = await supabase
        .from("hubla_transactions")
        .update({ product_price: 5503 })
        .eq("id", robertoData.id);
      
      if (robertoUpdateError) {
        results.errors.push(`Roberto update: ${robertoUpdateError.message}`);
      } else {
        results.updated.push(`Roberto - Atualizado de R$ ${robertoData.product_price} para R$ 5.503`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      results,
      message: `Inseridos: ${results.inserted.length}, Atualizados: ${results.updated.length}, Erros: ${results.errors.length}`
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
