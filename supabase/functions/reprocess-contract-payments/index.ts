import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { dry_run = false, days_back = 7, customer_emails = [] } = await req.json().catch(() => ({}));

    console.log(`🔄 Reprocessando pagamentos de contrato (últimos ${days_back} dias)`);
    console.log(`🧪 Dry run: ${dry_run}`);
    if (customer_emails.length > 0) {
      console.log(`🎯 Filtrando por emails específicos: ${customer_emails.join(', ')}`);
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days_back);

    // Buscar transações de contrato recentes
    let query = supabase
      .from('hubla_transactions')
      .select('*')
      .gte('sale_date', cutoffDate.toISOString())
      .eq('installment_number', 1)
      .order('sale_date', { ascending: false });

    // Se tiver emails específicos, filtrar
    if (customer_emails.length > 0) {
      query = query.in('customer_email', customer_emails.map((e: string) => e.toLowerCase()));
    }

    const { data: transactions, error: txError } = await query;

    if (txError) throw txError;

    // Filtrar para encontrar contratos
    const contractTransactions = (transactions || []).filter(tx => {
      const productName = (tx.product_name || '').toUpperCase();
      const productCategory = tx.product_category || '';
      const price = tx.product_price || 0;

      return (
        productCategory === 'contrato' ||
        (productName.includes('A000') && productName.includes('CONTRATO')) ||
        (productCategory === 'incorporador' && price >= 490 && price <= 700)
      );
    });

    console.log(`📊 Encontradas ${contractTransactions.length} transações de contrato`);

    const results = {
      total: contractTransactions.length,
      processed: 0,
      already_paid: 0,
      no_attendee: 0,
      transferred: 0,
      errors: 0,
      details: [] as any[],
    };

    // Buscar estágio "Contrato Pago"
    const { data: contratoPagoStage } = await supabase
      .from('crm_stages')
      .select('id')
      .ilike('name', '%contrato%pago%')
      .limit(1)
      .maybeSingle();

    const contratoPagoStageId = contratoPagoStage?.id;
    console.log(`🎯 Estágio Contrato Pago: ${contratoPagoStageId || 'não encontrado'}`);

    for (const tx of contractTransactions) {
      try {
        const customerEmail = tx.customer_email?.toLowerCase() || '';
        const customerPhone = tx.customer_phone?.replace(/\D/g, '') || '';
        const phoneSuffix = customerPhone.slice(-9);

        console.log(`\n📝 Processando: ${tx.customer_name} (${customerEmail || phoneSuffix})`);
        console.log(`   Produto: ${tx.product_name} - R$ ${tx.product_price}`);

        // Buscar attendees R1 recentes - FILTRADO por meeting_type = 'r1'
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        const { data: attendees } = await supabase
          .from('meeting_slot_attendees')
          .select(`
            id, status, attendee_name, attendee_phone, deal_id, meeting_slot_id, contact_id,
            contact:crm_contacts(id, email, phone),
            slot:meeting_slots!inner(id, closer_id, status, meeting_type)
          `)
          .eq('slot.meeting_type', 'r1')
          .gte('slot.scheduled_at', fourteenDaysAgo.toISOString())
          .in('slot.status', ['scheduled', 'completed', 'rescheduled', 'contract_paid'])
          .in('status', ['scheduled', 'invited', 'completed'])
          .eq('is_partner', false)
          .order('created_at', { ascending: false });

        // Encontrar attendee por email do contato ou telefone
        let matchedAttendee = null;
        let matchType = '';

        // Primeiro: match por email do contato vinculado
        if (customerEmail) {
          matchedAttendee = attendees?.find(a => {
            const contact = a.contact as any;
            return contact?.email?.toLowerCase() === customerEmail;
          });
          if (matchedAttendee) matchType = 'email';
        }

        // Segundo: match por telefone do attendee
        if (!matchedAttendee && phoneSuffix) {
          matchedAttendee = attendees?.find(a => {
            const attendeePhone = a.attendee_phone?.replace(/\D/g, '') || '';
            return attendeePhone.slice(-9) === phoneSuffix;
          });
          if (matchedAttendee) matchType = 'phone';
        }

        if (!matchedAttendee) {
          console.log(`   ❌ Nenhum attendee encontrado`);
          results.no_attendee++;
          results.details.push({
            customer: tx.customer_name,
            email: customerEmail,
            phone: phoneSuffix,
            status: 'no_attendee',
          });
          continue;
        }

        console.log(`   ✅ Attendee encontrado via ${matchType}: ${matchedAttendee.attendee_name}`);
        console.log(`   Status atual: ${matchedAttendee.status}`);

        if (matchedAttendee.status === 'contract_paid') {
          console.log(`   ⏭️ Já está marcado como contract_paid`);
          results.already_paid++;
          results.details.push({
            customer: tx.customer_name,
            attendee_id: matchedAttendee.id,
            status: 'already_paid',
          });
          continue;
        }

        results.processed++;

        if (dry_run) {
          console.log(`   🧪 [DRY RUN] Seria marcado como contract_paid e ownership transferido`);
          results.details.push({
            customer: tx.customer_name,
            attendee_id: matchedAttendee.id,
            deal_id: matchedAttendee.deal_id,
            status: 'would_process',
            dry_run: true,
          });
          continue;
        }

        // Marcar attendee como contract_paid
        const { error: attendeeError } = await supabase
          .from('meeting_slot_attendees')
          .update({ 
            status: 'contract_paid',
            updated_at: new Date().toISOString(),
          })
          .eq('id', matchedAttendee.id);

        if (attendeeError) {
          console.error(`   ❌ Erro ao atualizar attendee:`, attendeeError.message);
          results.errors++;
          continue;
        }

        // Marcar slot como completed usando meeting_slot_id
        const slotId = matchedAttendee.meeting_slot_id;
        const slots = matchedAttendee.slot as any[];
        const meetingSlot = slots?.[0];
        
        if (slotId) {
          await supabase
            .from('meeting_slots')
            .update({ 
              status: 'completed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', slotId);
        }

        // Buscar closer para transferência de ownership
        const closerId = meetingSlot?.closer_id;
        if (closerId && matchedAttendee.deal_id) {
          // Buscar email do closer
          const { data: closer } = await supabase
            .from('closers')
            .select('email, employee_id')
            .eq('id', closerId)
            .maybeSingle();

          if (closer?.email) {
            // Buscar deal atual
            const { data: deal } = await supabase
              .from('crm_deals')
              .select('owner_id, original_sdr_email, stage_id')
              .eq('id', matchedAttendee.deal_id)
              .maybeSingle();

            const updateData: any = {
              owner_id: closer.email,
              r1_closer_email: closer.email,
              updated_at: new Date().toISOString(),
            };

            // Preservar SDR original
            if (!deal?.original_sdr_email && deal?.owner_id) {
              updateData.original_sdr_email = deal.owner_id;
            }

            // Atualizar owner_profile_id se tiver employee_id
            if (closer.employee_id) {
              updateData.owner_profile_id = closer.employee_id;
            }

            // Mover para estágio Contrato Pago
            if (contratoPagoStageId) {
              updateData.stage_id = contratoPagoStageId;
            }

            const { error: dealError } = await supabase
              .from('crm_deals')
              .update(updateData)
              .eq('id', matchedAttendee.deal_id);

            if (dealError) {
              console.error(`   ❌ Erro ao atualizar deal:`, dealError.message);
            } else {
              console.log(`   ✅ Ownership transferido para ${closer.email}`);
              results.transferred++;
            }

            results.details.push({
              customer: tx.customer_name,
              attendee_id: matchedAttendee.id,
              deal_id: matchedAttendee.deal_id,
              old_owner: deal?.owner_id,
              new_owner: closer.email,
              status: 'transferred',
            });
          }
        }

      } catch (err: any) {
        console.error(`   ❌ Erro processando ${tx.customer_name}:`, err.message);
        results.errors++;
      }
    }

    console.log(`\n🎉 Reprocessamento concluído!`);
    console.log(`   - Total: ${results.total}`);
    console.log(`   - Processados: ${results.processed}`);
    console.log(`   - Já pagos: ${results.already_paid}`);
    console.log(`   - Sem attendee: ${results.no_attendee}`);
    console.log(`   - Transferidos: ${results.transferred}`);
    console.log(`   - Erros: ${results.errors}`);

    return new Response(
      JSON.stringify({
        success: true,
        dry_run,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro fatal:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
