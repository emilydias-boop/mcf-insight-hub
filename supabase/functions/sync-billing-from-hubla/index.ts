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

    // 1b. Pre-fetch contacts for email matching
    const allEmails = [...new Set(transactions.map(tx => tx.customer_email?.toLowerCase()).filter(Boolean))];
    const contactMap = new Map<string, { id: string; deal_id: string | null }>();
    
    for (let i = 0; i < allEmails.length; i += 200) {
      const chunk = allEmails.slice(i, i + 200);
      const { data: contacts } = await supabase
        .from("crm_contacts")
        .select("id, email")
        .in("email", chunk);
      
      for (const c of contacts || []) {
        if (c.email) contactMap.set(c.email.toLowerCase(), { id: c.id, deal_id: null });
      }
    }

    // Fetch deals for matched contacts
    const contactIds = [...contactMap.values()].map(c => c.id);
    for (let i = 0; i < contactIds.length; i += 200) {
      const chunk = contactIds.slice(i, i + 200);
      const { data: deals } = await supabase
        .from("crm_deals")
        .select("id, contact_id")
        .in("contact_id", chunk)
        .order("created_at", { ascending: false });
      
      for (const d of deals || []) {
        // Find the email for this contact and set the deal_id (first/latest deal)
        for (const [email, info] of contactMap) {
          if (info.id === d.contact_id && !info.deal_id) {
            info.deal_id = d.id;
          }
        }
      }
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

        // Calculate data_fim_prevista based on interval and total installments
        let dataFimPrevista: string | null = null;
        let intervalDays = 30;
        if (txList.length >= 2) {
          const d1 = new Date(txList[0].sale_date).getTime();
          const d2 = new Date(txList[1].sale_date).getTime();
          const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
          if (diff > 0 && diff < 90) intervalDays = diff;
        }
        const fimDate = new Date(first.sale_date);
        fimDate.setDate(fimDate.getDate() + intervalDays * (totalInstallments - 1));
        dataFimPrevista = fimDate.toISOString().split('T')[0];

        // Resolve contact_id and deal_id
        const contactInfo = contactMap.get(email);
        const contactId = contactInfo?.id || null;
        const dealId = contactInfo?.deal_id || null;

        const existingId = existingSubMap.get(key);

        if (existingId) {
          subsToUpdate.push({
            id: existingId,
            data: {
              status, status_quitacao: statusQuitacao, total_parcelas: totalInstallments,
              valor_total_contrato: valorTotal, updated_at: new Date().toISOString(),
              data_fim_prevista: dataFimPrevista,
              ...(contactId ? { contact_id: contactId } : {}),
              ...(dealId ? { deal_id: dealId } : {}),
            }
          });
          subIdsForInstallments.push(existingId);
        } else {
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
            data_fim_prevista: dataFimPrevista,
            contact_id: contactId,
            deal_id: dealId,
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
        await supabase.from("billing_subscriptions").update(upd.data).eq("id", upd.id);
        subsUpdated++;
      }

      // Fetch existing installments for all subscription IDs in this batch
      const existingInstNums = new Map<string, Set<number>>();
      if (subIdsForInstallments.length > 0) {
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
        let batchIntervalDays = 30;
        if (txList.length >= 2) {
          const d1 = new Date(txList[0].sale_date).getTime();
          const d2 = new Date(txList[1].sale_date).getTime();
          const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
          if (diff > 0 && diff < 90) batchIntervalDays = diff;
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
            dueDate.setDate(dueDate.getDate() + batchIntervalDays * (i - 1));
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

    // 4. Run overdue status update
    await supabase.rpc('update_overdue_billing_status');

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
