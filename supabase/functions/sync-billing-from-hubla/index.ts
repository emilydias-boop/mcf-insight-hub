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
    let installmentsUpdated = 0;

    let historyInserted = 0;

    // 3. Process in batches
    for (let b = 0; b < groupKeys.length; b += batchSize) {
      const historyEntries: any[] = [];
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
        const valorBruto = first.product_price || 0;
        // Smart net value: prefer P2+ net_value (more reliable), fallback with heuristic
        const p2tx = txList.find(tx => (tx.installment_number || 1) > 1);
        const valorLiquidoPerInstallment = p2tx
          ? (p2tx.net_value || p2tx.product_price || 0)
          : (first.net_value && first.net_value <= (first.product_price || 0) * 2
              ? first.net_value
              : first.product_price || 0);
        const valorLiquido = valorLiquidoPerInstallment;
        const valorTotal = valorBruto + Math.max(totalInstallments - 1, 0) * valorLiquidoPerInstallment;
        const distinctPaidNumbers = new Set(txList.map(tx => tx.installment_number || 1));
        const paidCount = distinctPaidNumbers.size;
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
        // Backtrack to estimate installment #1 date, then calculate end date
        const earliestNumber = first.installment_number || 1;
        const estimatedStartDate = new Date(first.sale_date);
        estimatedStartDate.setDate(estimatedStartDate.getDate() - intervalDays * (earliestNumber - 1));
        const fimDate = new Date(estimatedStartDate);
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
            data_inicio: estimatedStartDate.toISOString().split('T')[0],
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
      const existingInstStatus = new Map<string, Map<number, string>>();
      if (subIdsForInstallments.length > 0) {
        for (let i = 0; i < subIdsForInstallments.length; i += 200) {
          const chunk = subIdsForInstallments.slice(i, i + 200);
          const { data: existInst } = await supabase
            .from("billing_installments")
            .select("subscription_id, numero_parcela, status")
            .in("subscription_id", chunk);
          
          for (const inst of existInst || []) {
            if (!existingInstNums.has(inst.subscription_id)) {
              existingInstNums.set(inst.subscription_id, new Set());
              existingInstStatus.set(inst.subscription_id, new Map());
            }
            existingInstNums.get(inst.subscription_id)!.add(inst.numero_parcela);
            existingInstStatus.get(inst.subscription_id)!.set(inst.numero_parcela, inst.status);
          }
        }
      }

      // Build installments for this batch
      const installmentsToUpdateBatch: { subId: string; numero: number; paid: any }[] = [];
      const installmentsDueDateUpdates: { subId: string; numero: number; newDueDate: string; newStatus: string }[] = [];
      
      for (const key of batchKeys) {
        const txList = groups[key];
        const subId = existingSubMap.get(key);
        if (!subId) continue;

        const first = txList[0];
        const totalInstallments = first.total_installments || txList.length;
        const valorBruto = first.product_price || 0;
        // Recompute smart net value for installment creation
        const p2txInst = txList.find(tx => (tx.installment_number || 1) > 1);
        const valorLiquidoInst = p2txInst
          ? (p2txInst.net_value || p2txInst.product_price || 0)
          : (first.net_value && first.net_value <= (first.product_price || 0) * 2
              ? first.net_value
              : first.product_price || 0);
        const valorLiquido = valorLiquidoInst;
        const existingNums = existingInstNums.get(subId) || new Set();
        const statusMap = existingInstStatus.get(subId) || new Map();
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

        // Estimate the date of installment #1 by backtracking from the earliest known transaction
        const earliestKnownNumber = first.installment_number || 1;
        const firstDate = new Date(first.sale_date);
        firstDate.setDate(firstDate.getDate() - batchIntervalDays * (earliestKnownNumber - 1));

        for (let i = 1; i <= totalInstallments; i++) {
          if (existingNums.has(i)) {
            // Check if installment exists but isn't paid, and Hubla shows payment
            const currentStatus = statusMap.get(i);
            const paid = paidMap[i];
            if (paid && currentStatus !== 'pago') {
              installmentsToUpdateBatch.push({ subId, numero: i, paid });
            } else if (!paid && currentStatus !== 'pago') {
              // Recalculate due date for unpaid existing installments
              const correctDueDate = new Date(firstDate);
              correctDueDate.setDate(correctDueDate.getDate() + batchIntervalDays * (i - 1));
              const newStatus = correctDueDate < now ? "atrasado" : "pendente";
              installmentsDueDateUpdates.push({
                subId, numero: i,
                newDueDate: correctDueDate.toISOString(),
                newStatus,
              });
            }
            continue;
          }

          const paid = paidMap[i];
          if (paid) {
            // Parcela 1 = product_price (bruto), demais = net_value (líquido) sem fallback para bruto
            const valorPago = i === 1
              ? (paid.product_price || valorBruto)
              : (paid.net_value ?? 0);
            const valorOriginalInst = i === 1 ? valorBruto : valorLiquido;
            allInstallmentsToInsert.push({
              subscription_id: subId,
              numero_parcela: i,
              valor_original: valorOriginalInst,
              valor_pago: valorPago,
              valor_liquido: paid.net_value || null,
              data_vencimento: paid.sale_date,
              data_pagamento: paid.sale_date,
              status: "pago",
              hubla_transaction_id: paid.id,
            });
            // Register history entry for new paid installment
            historyEntries.push({
              subscription_id: subId,
              tipo: "parcela_paga",
              valor: paid.net_value || valorParcela,
              forma_pagamento: mapPaymentMethod(paid.sale_status || paid.event_type || ""),
              responsavel: "Sistema (Hubla Sync)",
              descricao: `Parcela ${i}/${totalInstallments} paga via Hubla (sync automático)`,
              status: "confirmado",
              metadata: { hubla_transaction_id: paid.id, numero_parcela: i, total_parcelas: totalInstallments },
              created_at: paid.sale_date,
            });
          } else {
            const dueDate = new Date(firstDate);
            dueDate.setDate(dueDate.getDate() + batchIntervalDays * (i - 1));
            const valorOriginalUnpaid = i === 1 ? valorBruto : valorLiquido;
            allInstallmentsToInsert.push({
              subscription_id: subId,
              numero_parcela: i,
              valor_original: valorOriginalUnpaid,
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

      // Bulk update existing installments that were paid
      for (const upd of installmentsToUpdateBatch) {
        // Parcela 1 = product_price (bruto), demais = net_value (líquido) sem fallback para bruto
        const valorPagoUpd = upd.numero === 1
          ? (upd.paid.product_price || upd.paid.net_value)
          : (upd.paid.net_value ?? 0);
        const { error: updErr } = await supabase
          .from("billing_installments")
          .update({
            status: "pago",
            valor_pago: valorPagoUpd,
            valor_liquido: upd.paid.net_value || null,
            data_pagamento: upd.paid.sale_date,
            hubla_transaction_id: upd.paid.id,
            updated_at: new Date().toISOString(),
          })
          .eq("subscription_id", upd.subId)
          .eq("numero_parcela", upd.numero);
        
        if (!updErr) {
          installmentsUpdated++;
          // Register history entry for updated installment
          const txList = groups[Object.keys(groups).find(k => existingSubMap.get(k) === upd.subId) || ""] || [];
          const totalInstallments = txList[0]?.total_installments || txList.length;
          historyEntries.push({
            subscription_id: upd.subId,
            tipo: "parcela_paga",
            valor: upd.paid.net_value || upd.paid.product_price,
            forma_pagamento: mapPaymentMethod(upd.paid.sale_status || upd.paid.event_type || ""),
            responsavel: "Sistema (Hubla Sync)",
            descricao: `Parcela ${upd.numero}/${totalInstallments} paga via Hubla (sync automático)`,
            status: "confirmado",
            metadata: { hubla_transaction_id: upd.paid.id, numero_parcela: upd.numero, total_parcelas: totalInstallments },
            created_at: upd.paid.sale_date,
          });
        }
      }

      // Update due dates for existing unpaid installments
      for (const upd of installmentsDueDateUpdates) {
        await supabase
          .from("billing_installments")
          .update({
            data_vencimento: upd.newDueDate,
            status: upd.newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("subscription_id", upd.subId)
          .eq("numero_parcela", upd.numero);
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

      // Bulk insert billing_history entries in chunks of 500
      for (let i = 0; i < historyEntries.length; i += 500) {
        const chunk = historyEntries.slice(i, i + 500);
        const { error: histErr } = await supabase
          .from("billing_history")
          .insert(chunk);
        if (histErr) {
          console.error("Bulk insert billing_history error:", histErr);
        } else {
          historyInserted += chunk.length;
        }
      }
    }

    // 4b. Process single-installment transactions (total_installments=1)
    // Optimized: batch queries instead of per-group loops
    let singleTxMatched = 0;
    {
      // Fetch all subscriptions
      const allSubs: { id: string; customer_email: string; product_name: string }[] = [];
      let subOffset = 0;
      while (true) {
        const { data: chunk } = await supabase
          .from("billing_subscriptions")
          .select("id, customer_email, product_name")
          .not("customer_email", "is", null)
          .range(subOffset, subOffset + 999);
        if (!chunk || chunk.length === 0) break;
        allSubs.push(...chunk);
        if (chunk.length < 1000) break;
        subOffset += 1000;
      }

      const subMap = new Map<string, string>();
      for (const s of allSubs) {
        subMap.set(`${(s.customer_email || "").toLowerCase()}::${s.product_name}`, s.id);
      }

      const alreadyProcessedKeys = new Set(Object.keys(groups));

      // Fetch single-installment transactions not yet linked (paginated)
      const allSingleTx: any[] = [];
      let singleOffset = 0;
      while (true) {
        const { data: chunk } = await supabase
          .from("hubla_transactions")
          .select("id, customer_email, product_name, net_value, sale_date, sale_status, event_type, product_price")
          .eq("total_installments", 1)
          .order("sale_date", { ascending: true })
          .range(singleOffset, singleOffset + 999);
        if (!chunk || chunk.length === 0) break;
        allSingleTx.push(...chunk);
        if (chunk.length < 1000) break;
        singleOffset += 1000;
      }

      if (allSingleTx.length > 0) {
        // Group by email::product, only if subscription exists and wasn't in installment group
        const singleGroups: Record<string, typeof allSingleTx> = {};
        const relevantSubIds = new Set<string>();
        for (const tx of allSingleTx) {
          if (!tx.customer_email) continue;
          const key = `${tx.customer_email.toLowerCase()}::${tx.product_name}`;
          if (!subMap.has(key) || alreadyProcessedKeys.has(key)) continue;
          if (!singleGroups[key]) singleGroups[key] = [];
          singleGroups[key].push(tx);
          relevantSubIds.add(subMap.get(key)!);
        }

        const relevantSubIdArr = [...relevantSubIds];
        if (relevantSubIdArr.length > 0) {
          // Batch fetch all overdue installments and linked tx ids for relevant subs
          const overdueBySubId = new Map<string, { id: string; numero_parcela: number; valor_original: number }[]>();
          const linkedTxBySubId = new Map<string, Set<string>>();

          for (let i = 0; i < relevantSubIdArr.length; i += 200) {
            const chunk = relevantSubIdArr.slice(i, i + 200);
            const [overdueRes, linkedRes] = await Promise.all([
              supabase.from("billing_installments")
                .select("id, subscription_id, numero_parcela, valor_original")
                .in("subscription_id", chunk)
                .eq("status", "atrasado")
                .is("hubla_transaction_id", null)
                .order("numero_parcela", { ascending: true }),
              supabase.from("billing_installments")
                .select("subscription_id, hubla_transaction_id")
                .in("subscription_id", chunk)
                .not("hubla_transaction_id", "is", null),
            ]);

            for (const inst of overdueRes.data || []) {
              if (!overdueBySubId.has(inst.subscription_id)) overdueBySubId.set(inst.subscription_id, []);
              overdueBySubId.get(inst.subscription_id)!.push(inst);
            }
            for (const li of linkedRes.data || []) {
              if (!linkedTxBySubId.has(li.subscription_id)) linkedTxBySubId.set(li.subscription_id, new Set());
              if (li.hubla_transaction_id) linkedTxBySubId.get(li.subscription_id)!.add(li.hubla_transaction_id);
            }
          }

          // Process matches
          const allHistoryEntries: any[] = [];
          const subsToRecalc: string[] = [];

          for (const [key, txList] of Object.entries(singleGroups)) {
            const subId = subMap.get(key)!;
            const overdueInst = overdueBySubId.get(subId);
            if (!overdueInst || overdueInst.length === 0) continue;

            const linkedIds = linkedTxBySubId.get(subId) || new Set();
            const unlinkedTx = txList.filter(tx => !linkedIds.has(tx.id));
            if (unlinkedTx.length === 0) continue;

            const matchCount = Math.min(overdueInst.length, unlinkedTx.length);
            for (let m = 0; m < matchCount; m++) {
              const inst = overdueInst[m];
              const tx = unlinkedTx[m];

              // Parcela 1 = product_price (bruto), demais = net_value (líquido)
              const singleValorPago = inst.numero_parcela === 1
                ? (tx.product_price || tx.net_value || inst.valor_original)
                : (tx.net_value || tx.product_price || inst.valor_original);
              await supabase.from("billing_installments").update({
                status: "pago",
                valor_pago: singleValorPago,
                valor_liquido: tx.net_value || null,
                data_pagamento: tx.sale_date,
                hubla_transaction_id: tx.id,
                updated_at: new Date().toISOString(),
              }).eq("id", inst.id);

              singleTxMatched++;
              installmentsUpdated++;
              allHistoryEntries.push({
                subscription_id: subId,
                tipo: "parcela_paga",
                valor: tx.net_value || tx.product_price,
                forma_pagamento: mapPaymentMethod(tx.sale_status || tx.event_type || ""),
                responsavel: "Sistema (Hubla Sync - Single TX)",
                descricao: `Parcela ${inst.numero_parcela} paga via Hubla (total_installments=1, sync)`,
                status: "confirmado",
                metadata: { hubla_transaction_id: tx.id, numero_parcela: inst.numero_parcela },
                created_at: tx.sale_date,
              });
            }
            if (matchCount > 0) subsToRecalc.push(subId);
          }

          // Bulk insert history
          for (let i = 0; i < allHistoryEntries.length; i += 500) {
            await supabase.from("billing_history").insert(allHistoryEntries.slice(i, i + 500));
          }

          // Batch recalculate subscription statuses
          if (subsToRecalc.length > 0) {
            for (let i = 0; i < subsToRecalc.length; i += 200) {
              const chunk = subsToRecalc.slice(i, i + 200);
              const { data: allInst } = await supabase
                .from("billing_installments")
                .select("subscription_id, status")
                .in("subscription_id", chunk);

              const statsBySubId = new Map<string, { paid: number; overdue: number; total: number }>();
              for (const inst of allInst || []) {
                if (!statsBySubId.has(inst.subscription_id)) statsBySubId.set(inst.subscription_id, { paid: 0, overdue: 0, total: 0 });
                const s = statsBySubId.get(inst.subscription_id)!;
                s.total++;
                if (inst.status === "pago") s.paid++;
                if (inst.status === "atrasado") s.overdue++;
              }

              for (const [subId, stats] of statsBySubId) {
                let newStatus = "em_dia";
                let newQuitacao = "parcialmente_pago";
                if (stats.paid >= stats.total) { newStatus = "quitada"; newQuitacao = "quitado"; }
                else if (stats.overdue > 0) { newStatus = "atrasada"; }
                if (stats.paid === 0) newQuitacao = "em_aberto";

                await supabase.from("billing_subscriptions").update({
                  status: newStatus, status_quitacao: newQuitacao, updated_at: new Date().toISOString(),
                }).eq("id", subId);
              }
            }
          }
        }
      }
    }

    // 5. Run overdue status update
    await supabase.rpc('update_overdue_billing_status');

    const hasMore = transactions.length >= 5000;
    const result = {
      message: "Sincronização concluída",
      totalGroups: groupKeys.length,
      subsCreated,
      subsUpdated,
      installmentsCreated,
      installmentsUpdated,
      singleTxMatched,
      historyInserted,
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
