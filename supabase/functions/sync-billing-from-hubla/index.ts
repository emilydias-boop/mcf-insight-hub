import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Fetch all installment transactions from Hubla
    const { data: transactions, error: txError } = await supabase
      .from("hubla_transactions")
      .select("*")
      .gt("total_installments", 1)
      .order("sale_date", { ascending: true });

    if (txError) throw txError;
    if (!transactions || transactions.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhuma transação parcelada encontrada", synced: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Group by customer_email + product_name
    const groups: Record<string, typeof transactions> = {};
    for (const tx of transactions) {
      const key = `${(tx.customer_email || "").toLowerCase()}::${tx.product_name}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
    }

    let subsCreated = 0;
    let subsUpdated = 0;
    let installmentsCreated = 0;

    for (const [key, txList] of Object.entries(groups)) {
      const [email, productName] = key.split("::");
      if (!email || !productName) continue;

      const first = txList[0];
      const totalInstallments = first.total_installments || txList.length;
      const valorParcela = first.product_price || 0;
      const valorTotal = valorParcela * totalInstallments;
      const paidCount = txList.length;

      // Map payment method
      const paymentMethod = mapPaymentMethod(first.sale_status || first.event_type || "");

      // Determine subscription status
      let status: string;
      let statusQuitacao: string;
      const now = new Date();

      if (paidCount >= totalInstallments) {
        status = "quitada";
        statusQuitacao = "quitado";
      } else {
        // Check if any installment is overdue
        const lastPaidDate = new Date(txList[txList.length - 1].sale_date);
        const daysSinceLast = (now.getTime() - lastPaidDate.getTime()) / (1000 * 60 * 60 * 24);
        // If more than 45 days since last payment and still has pending, consider atrasada
        status = daysSinceLast > 45 ? "atrasada" : "em_dia";
        statusQuitacao = paidCount > 0 ? "parcialmente_pago" : "em_aberto";
      }

      // 3. Upsert billing_subscription
      // Check if subscription already exists for this email+product
      const { data: existingSub } = await supabase
        .from("billing_subscriptions")
        .select("id")
        .eq("customer_email", email)
        .eq("product_name", productName)
        .limit(1)
        .maybeSingle();

      let subscriptionId: string;

      if (existingSub) {
        subscriptionId = existingSub.id;
        // Update status
        await supabase
          .from("billing_subscriptions")
          .update({
            status,
            status_quitacao: statusQuitacao,
            total_parcelas: totalInstallments,
            valor_total_contrato: valorTotal,
            updated_at: new Date().toISOString(),
          })
          .eq("id", subscriptionId);
        subsUpdated++;
      } else {
        const { data: newSub, error: subErr } = await supabase
          .from("billing_subscriptions")
          .insert({
            customer_name: first.customer_name || email,
            customer_email: email,
            customer_phone: first.customer_phone || null,
            product_name: productName,
            product_category: first.product_category || null,
            valor_entrada: 0,
            valor_total_contrato: valorTotal,
            total_parcelas: totalInstallments,
            forma_pagamento: paymentMethod,
            status,
            status_quitacao: statusQuitacao,
            data_inicio: first.sale_date,
          })
          .select("id")
          .single();

        if (subErr) {
          console.error(`Error creating sub for ${key}:`, subErr);
          continue;
        }
        subscriptionId = newSub.id;
        subsCreated++;
      }

      // 4. Create installments
      // First get existing installments to avoid duplicates
      const { data: existingInst } = await supabase
        .from("billing_installments")
        .select("numero_parcela, hubla_transaction_id")
        .eq("subscription_id", subscriptionId);

      const existingMap = new Set(
        (existingInst || []).map((i) => i.numero_parcela)
      );
      const existingHublaIds = new Set(
        (existingInst || []).filter((i) => i.hubla_transaction_id).map((i) => i.hubla_transaction_id)
      );

      // Build a map of paid installments from Hubla
      const paidMap: Record<number, (typeof transactions)[0]> = {};
      for (const tx of txList) {
        const num = tx.installment_number || 1;
        paidMap[num] = tx;
      }

      // Estimate interval between installments (default 30 days)
      let intervalDays = 30;
      if (txList.length >= 2) {
        const d1 = new Date(txList[0].sale_date).getTime();
        const d2 = new Date(txList[1].sale_date).getTime();
        const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
        if (diff > 0 && diff < 90) intervalDays = diff;
      }

      const firstDate = new Date(first.sale_date);
      const installmentsToInsert: any[] = [];

      for (let i = 1; i <= totalInstallments; i++) {
        if (existingMap.has(i)) continue; // Already exists

        const paid = paidMap[i];
        if (paid && existingHublaIds.has(paid.id)) continue; // Already linked

        if (paid) {
          installmentsToInsert.push({
            subscription_id: subscriptionId,
            numero_parcela: i,
            valor_original: valorParcela,
            valor_pago: paid.net_value || valorParcela,
            valor_liquido: paid.net_value || null,
            data_vencimento: paid.sale_date,
            data_pagamento: paid.sale_date,
            status: "pago",
            hubla_transaction_id: paid.id,
          });
        } else {
          // Estimate due date
          const dueDate = new Date(firstDate);
          dueDate.setDate(dueDate.getDate() + intervalDays * (i - 1));
          const isOverdue = dueDate < now;

          installmentsToInsert.push({
            subscription_id: subscriptionId,
            numero_parcela: i,
            valor_original: valorParcela,
            valor_pago: 0,
            valor_liquido: 0,
            data_vencimento: dueDate.toISOString(),
            data_pagamento: null,
            status: isOverdue ? "atrasado" : "pendente",
            hubla_transaction_id: null,
          });
        }
      }

      if (installmentsToInsert.length > 0) {
        const { error: instErr } = await supabase
          .from("billing_installments")
          .insert(installmentsToInsert);

        if (instErr) {
          console.error(`Error creating installments for ${key}:`, instErr);
        } else {
          installmentsCreated += installmentsToInsert.length;
        }
      }
    }

    const result = {
      message: "Sincronização concluída",
      totalGroups: Object.keys(groups).length,
      subsCreated,
      subsUpdated,
      installmentsCreated,
    };

    console.log("Sync result:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function mapPaymentMethod(value: string): string {
  const lower = value.toLowerCase();
  if (lower.includes("pix")) return "pix";
  if (lower.includes("credit") || lower.includes("card") || lower.includes("cartao")) return "credit_card";
  if (lower.includes("boleto") || lower.includes("bank_slip") || lower.includes("slip")) return "bank_slip";
  return "outro";
}
