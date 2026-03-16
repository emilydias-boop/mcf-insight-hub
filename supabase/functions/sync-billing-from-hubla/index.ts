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

    // Parse optional pagination params
    let body: any = {};
    try { body = await req.json(); } catch { /* empty */ }
    const batchSize = body.batchSize || 200;
    const offset = body.offset || 0;

    // 1. Fetch installment transactions in paginated batches
    const { data: transactions, error: txError } = await supabase
      .from("hubla_transactions")
      .select("id, customer_email, customer_name, customer_phone, product_name, product_category, product_price, net_value, installment_number, total_installments, sale_date, sale_status, event_type")
      .gt("total_installments", 1)
      .order("sale_date", { ascending: true })
      .range(offset, offset + 4999);

    if (txError) throw txError;
    if (!transactions || transactions.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhuma transação parcelada encontrada neste lote", synced: 0, done: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Group by customer_email + product_name
    const groups: Record<string, typeof transactions> = {};
    for (const tx of transactions) {
      if (!tx.customer_email) continue;
      const key = `${tx.customer_email.toLowerCase()}::${tx.product_name}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
    }

    const groupKeys = Object.keys(groups);
    let subsCreated = 0;
    let subsUpdated = 0;
    let installmentsCreated = 0;

    // 3. Process in batches
    for (let b = 0; b < groupKeys.length; b += batchSize) {
      const batchKeys = groupKeys.slice(b, b + batchSize);
      
      // Collect emails+products for this batch to check existing subs
      const batchEmails = batchKeys.map(k => k.split("::")[0]);
      const batchProducts = batchKeys.map(k => k.split("::")[1]);

      // Fetch existing subscriptions for this batch
      const { data: existingSubs } = await supabase
        .from("billing_subscriptions")
        .select("id, customer_email, product_name")
        .in("customer_email", [...new Set(batchEmails)]);

      const existingSubMap = new Map<string, string>();
      for (const sub of existingSubs || []) {
        existingSubMap.set(`${(sub.customer_email || "").toLowerCase()}::${sub.product_name}`, sub.id);
      }

      const subsToInsert: any[] = [];
      const subsToUpdate: { id: string; data: any }[] = [];
      const allInstallmentsToInsert: any[] = [];
      // Track which subscription IDs we need installments for
      const subIdsForInstallments: string[] = [];

      for (const key of batchKeys) {
        const txList = groups[key];
        const [email, productName] = key.split("::");
        const first = txList[0];
        const totalInstallments = first.total_installments || txList.length;
        const valorParcela = first.product_price || 0;
        const valorTotal = valorParcela * totalInstallments;
        const paidCount = txList.length;
        const now = new Date();

        let status: string;
        let statusQuitacao: string;

        if (paidCount >= totalInstallments) {
          status = "quitada";
          statusQuitacao = "quitado";
        } else {
          const lastPaidDate = new Date(txList[txList.length - 1].sale_date);
          const daysSinceLast = (now.getTime() - lastPaidDate.getTime()) / (1000 * 60 * 60 * 24);
          status = daysSinceLast > 45 ? "atrasada" : "em_dia";
          statusQuitacao = paidCount > 0 ? "parcialmente_pago" : "em_aberto";
        }

        const existingId = existingSubMap.get(key);

        if (existingId) {
          subsToUpdate.push({
            id: existingId,
            data: { status, status_quitacao: statusQuitacao, total_parcelas: totalInstallments, valor_total_contrato: valorTotal, updated_at: new Date().toISOString() }
          });
          subIdsForInstallments.push(existingId);
        } else {
          // We'll insert and get IDs back
          subsToInsert.push({
            customer_name: first.customer_name || email,
            customer_email: email,
            customer_phone: first.customer_phone || null,
            product_name: productName,
            product_category: first.product_category || null,
            valor_entrada: 0,
            valor_total_contrato: valorTotal,
            total_parcelas: totalInstallments,
            forma_pagamento: mapPaymentMethod(first.sale_status || first.event_type || ""),
            status,
            status_quitacao: statusQuitacao,
            data_inicio: first.sale_date,
          });
        }
      }

      // Bulk insert new subscriptions
      if (subsToInsert.length > 0) {
        const { data: inserted, error: insErr } = await supabase
          .from("billing_subscriptions")
          .insert(subsToInsert)
          .select("id, customer_email, product_name");
        
        if (insErr) {
          console.error("Bulk insert subs error:", insErr);
        } else {
          subsCreated += (inserted || []).length;
          for (const sub of inserted || []) {
            existingSubMap.set(`${(sub.customer_email || "").toLowerCase()}::${sub.product_name}`, sub.id);
            subIdsForInstallments.push(sub.id);
          }
        }
      }

      // Bulk update existing subscriptions
      for (const upd of subsToUpdate) {
        // Supabase JS doesn't support bulk update, but we batch the promises
        await supabase.from("billing_subscriptions").update(upd.data).eq("id", upd.id);
        subsUpdated++;
      }

      // Fetch existing installments for all subscription IDs in this batch
      const existingInstNums = new Map<string, Set<number>>();
      if (subIdsForInstallments.length > 0) {
        // Batch in chunks of 200 for .in()
        for (let i = 0; i < subIdsForInstallments.length; i += 200) {
          const chunk = subIdsForInstallments.slice(i, i + 200);
          const { data: existInst } = await supabase
            .from("billing_installments")
            .select("subscription_id, numero_parcela")
            .in("subscription_id", chunk);
          
          for (const inst of existInst || []) {
            if (!existingInstNums.has(inst.subscription_id)) {
              existingInstNums.set(inst.subscription_id, new Set());
            }
            existingInstNums.get(inst.subscription_id)!.add(inst.numero_parcela);
          }
        }
      }

      // Build installments for this batch
      for (const key of batchKeys) {
        const txList = groups[key];
        const subId = existingSubMap.get(key);
        if (!subId) continue;

        const first = txList[0];
        const totalInstallments = first.total_installments || txList.length;
        const valorParcela = first.product_price || 0;
        const existingNums = existingInstNums.get(subId) || new Set();
        const now = new Date();

        // Build paid map
        const paidMap: Record<number, (typeof txList)[0]> = {};
        for (const tx of txList) {
          paidMap[tx.installment_number || 1] = tx;
        }

        // Estimate interval
        let intervalDays = 30;
        if (txList.length >= 2) {
          const d1 = new Date(txList[0].sale_date).getTime();
          const d2 = new Date(txList[1].sale_date).getTime();
          const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
          if (diff > 0 && diff < 90) intervalDays = diff;
        }

        const firstDate = new Date(first.sale_date);

        for (let i = 1; i <= totalInstallments; i++) {
          if (existingNums.has(i)) continue;

          const paid = paidMap[i];
          if (paid) {
            allInstallmentsToInsert.push({
              subscription_id: subId,
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
            const dueDate = new Date(firstDate);
            dueDate.setDate(dueDate.getDate() + intervalDays * (i - 1));
            allInstallmentsToInsert.push({
              subscription_id: subId,
              numero_parcela: i,
              valor_original: valorParcela,
              valor_pago: 0,
              valor_liquido: 0,
              data_vencimento: dueDate.toISOString(),
              data_pagamento: null,
              status: dueDate < now ? "atrasado" : "pendente",
              hubla_transaction_id: null,
            });
          }
        }
      }

      // Bulk insert installments in chunks of 500
      for (let i = 0; i < allInstallmentsToInsert.length; i += 500) {
        const chunk = allInstallmentsToInsert.slice(i, i + 500);
        const { error: instErr } = await supabase
          .from("billing_installments")
          .insert(chunk);
        if (instErr) {
          console.error("Bulk insert installments error:", instErr);
        } else {
          installmentsCreated += chunk.length;
        }
      }
    }

    const hasMore = transactions.length >= 5000;
    const result = {
      message: "Sincronização concluída",
      totalGroups: groupKeys.length,
      subsCreated,
      subsUpdated,
      installmentsCreated,
      hasMore,
      nextOffset: hasMore ? offset + 5000 : null,
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
