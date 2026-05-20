// Automation Processor - Cron job to process automation queue
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 50;
const MAX_RETRIES = 3;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const startTime = Date.now();
  const results = {
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [] as string[]
  };

  try {
    console.log('[AUTOMATION-PROCESSOR] Starting processing...');

    // 1. Fetch pending items that are due
    const { data: queueItems, error: fetchError } = await supabase
      .from('automation_queue')
      .select(`
        id,
        deal_id,
        contact_id,
        flow_id,
        step_id,
        scheduled_at,
        attempts,
        automation_steps:step_id (
          id,
          channel,
          template_id,
          automation_templates:template_id (
            id,
            name,
            channel,
            content,
            subject,
            twilio_template_sid,
            activecampaign_template_id,
            variables
          )
        ),
        automation_flows:flow_id (
          id,
          name,
          stage_id
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      throw fetchError;
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('[AUTOMATION-PROCESSOR] No pending items to process');
      return new Response(
        JSON.stringify({ success: true, ...results, message: 'No pending items' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[AUTOMATION-PROCESSOR] Found ${queueItems.length} items to process`);

    // 2. Process each item
    for (const item of queueItems) {
      results.processed++;
      
      try {
        // Validate step and template exist
        const step = item.automation_steps as any;
        const flow = item.automation_flows as any;
        
        if (!step || !step.automation_templates) {
          console.warn(`[AUTOMATION-PROCESSOR] Item ${item.id} has no valid step/template`);
          await markAsSkipped(supabase, item.id, 'Missing step or template');
          results.skipped++;
          continue;
        }

        const template = step.automation_templates;

        // 3. Verify deal is still in the same stage
        const { data: deal } = await supabase
          .from('crm_deals')
          .select('id, stage_id, contact_id')
          .eq('id', item.deal_id)
          .maybeSingle();

        if (!deal) {
          console.warn(`[AUTOMATION-PROCESSOR] Deal ${item.deal_id} not found`);
          await markAsSkipped(supabase, item.id, 'Deal not found');
          results.skipped++;
          continue;
        }

        if (flow.stage_id && deal.stage_id !== flow.stage_id) {
          console.log(`[AUTOMATION-PROCESSOR] Deal ${item.deal_id} moved to different stage, skipping`);
          await markAsSkipped(supabase, item.id, 'Deal moved to different stage');
          results.skipped++;
          continue;
        }

        // Onda 3: revalida reunião para steps ancorados em meeting_start/meeting_end.
        // Detecta âncora pelo nome do stage atual do flow (mesma regra do enqueue).
        const { data: stageMeta } = await supabase
          .from('crm_stages')
          .select('stage_name')
          .eq('id', deal.stage_id)
          .maybeSingle();
        const stageNameRaw = (stageMeta?.stage_name || '')
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
        const isMeetingAnchored =
          /\b(reuniao|consultoria)\s+(agendad|realizad)/.test(stageNameRaw) ||
          /\br[12]\s+(agendad|realizad)/.test(stageNameRaw) ||
          /\b(1a|2a|1°|2°|1\.|2\.)\s*reuniao\s+(agendad|realizad)/.test(stageNameRaw) ||
          /^agendamento$/.test(stageNameRaw);
        if (isMeetingAnchored) {
          const { data: slot } = await supabase
            .from('meeting_slots')
            .select('status')
            .eq('deal_id', item.deal_id)
            .order('scheduled_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          const status = (slot?.status || '').toLowerCase();
          if (['cancelled', 'no_show', 'rescheduled'].includes(status)) {
            console.log(`[AUTOMATION-PROCESSOR] Meeting no longer active (${status}) for deal ${item.deal_id}, skipping`);
            await markAsSkipped(supabase, item.id, `meeting_no_longer_active:${status}`);
            results.skipped++;
            continue;
          }
        }

        // 4. Get contact info for variables
        const { data: contact } = await supabase
          .from('crm_contacts')
          .select('id, name, email, phone')
          .eq('id', item.contact_id || deal.contact_id)
          .maybeSingle();

        if (!contact) {
          console.warn(`[AUTOMATION-PROCESSOR] Contact not found for deal ${item.deal_id}`);
          await markAsSkipped(supabase, item.id, 'Contact not found');
          results.skipped++;
          continue;
        }

        // 5. Check blacklist
        const { data: blacklisted } = await supabase
          .from('automation_blacklist')
          .select('id')
          .or(`contact_id.eq.${contact.id},email.eq.${contact.email},phone.eq.${contact.phone}`)
          .maybeSingle();

        if (blacklisted) {
          console.log(`[AUTOMATION-PROCESSOR] Contact ${contact.id} is blacklisted`);
          await markAsSkipped(supabase, item.id, 'Contact blacklisted');
          results.skipped++;
          continue;
        }

        // 6. Resolver dono dinâmico (SDR/Closer conforme estágio)
        const { data: ownerRows, error: ownerErr } = await supabase
          .rpc('resolve_deal_owner', { _deal_id: item.deal_id });
        if (ownerErr) {
          console.error(`[AUTOMATION-PROCESSOR] resolve_deal_owner erro deal ${item.deal_id}:`, ownerErr.message);
        }
        const owner = Array.isArray(ownerRows) ? ownerRows[0] : ownerRows;
        const donoNome = owner?.first_name || owner?.full_name || '';
        const donoTelefone = owner?.telefone || '';

        // Defesa: dono desligado → cancela item (não tem para quem mandar)
        if (owner?.email || owner?.email_pessoal) {
          const ownerEmail = (owner.email_pessoal || owner.email || '').toLowerCase();
          if (ownerEmail) {
            const { data: emp } = await supabase
              .from('employees')
              .select('status')
              .ilike('email_pessoal', ownerEmail)
              .maybeSingle();
            if (emp && emp.status && emp.status !== 'ativo') {
              console.warn(`[AUTOMATION-PROCESSOR] Deal ${item.deal_id} dono desligado (${ownerEmail}) — cancelando`);
              await markAsSkipped(supabase, item.id, `Owner desligado (${emp.status})`);
              results.skipped++;
              continue;
            }
          }
        }

        const donoLinkWa = donoTelefone
          ? `https://wa.me/${donoTelefone}`
          : '';

        // Determinar papel do dono pelo nome do estágio (mesma cascata do resolve_deal_owner)
        const { data: stageRow } = await supabase
          .from('deal_stages')
          .select('stage_name')
          .eq('id', deal.stage_id)
          .maybeSingle();
        const stageName = (stageRow?.stage_name || '').trim();
        const isCloserR2 = ['R2 Agendada', 'Contrato Pago'].includes(stageName);
        const isCloserR1 = ['R1 Agendada', 'R1 Realizada', 'No-Show'].includes(stageName);
        const WA_DEFAULT_MSG_SDR = 'Olá, quero agendar minha reunião';
        const WA_DEFAULT_MSG_CLOSER = 'Olá, quero confirmar minha reunião';
        const msgPorPapel = (isCloserR1 || isCloserR2) ? WA_DEFAULT_MSG_CLOSER : WA_DEFAULT_MSG_SDR;
        const donoLinkWaAgendar = donoTelefone
          ? `https://wa.me/${donoTelefone}?text=${encodeURIComponent(msgPorPapel)}`
          : '';
        // Texto já URL-encoded para uso em URL de botão Twilio (prefixo fixo é obrigatório).
        const waAgendarText = encodeURIComponent(msgPorPapel);

        // Token único (base64url) com {p,t} para o redirector wa-redirect.
        // Necessário porque a Meta só aceita 1 variável no FINAL da URL do botão CTA.
        let waAgendarToken = '';
        if (donoTelefone) {
          const payload = JSON.stringify({ p: donoTelefone.replace(/\D/g, ''), t: msgPorPapel });
          waAgendarToken = btoa(payload)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
        }

        // Defesa: o template WhatsApp tem {{wa_agendar_token}} dentro da URL do botão.
        // Se vier vazio, Twilio rejeita com 21656 ("Content Variables parameter is invalid").
        const templateExpectsToken: string[] = Array.isArray(template.variables) ? template.variables : [];
        if (templateExpectsToken.includes('wa_agendar_token') && !waAgendarToken) {
          console.warn(`[AUTOMATION-PROCESSOR] Deal ${item.deal_id} sem wa_agendar_token (dono sem telefone) — pulando para evitar erro Twilio 21656`);
          await markAsSkipped(supabase, item.id, 'Dono sem telefone — wa_agendar_token vazio');
          results.skipped++;
          continue;
        }

        // Se o template usa qualquer variável que dependa do telefone do dono → pular se não houver
        const templateText = `${template.content || ''} ${JSON.stringify(template.buttons_config || [])}`;
        const usesDonoPhone = /\{\{\s*(dono_(telefone|link_wa|link_wa_agendar)|wa_agendar_text|wa_agendar_token)\s*\}\}/i.test(templateText);
        if (usesDonoPhone && !donoTelefone) {
          console.warn(`[AUTOMATION-PROCESSOR] Deal ${item.deal_id} sem telefone do dono — pulando`);
          await markAsSkipped(supabase, item.id, 'Dono sem telefone cadastrado em employees.telefone');
          results.skipped++;
          continue;
        }

        // 7. Build message content with variables
        const variables: Record<string, string> = {
          nome: contact.name || '',
          email: contact.email || '',
          telefone: contact.phone || '',
          sdr: donoNome, // retrocompat
          dono_nome: donoNome,
          dono_telefone: donoTelefone,
          dono_link_wa: donoLinkWa,
          dono_link_wa_agendar: donoLinkWaAgendar,
          wa_agendar_text: waAgendarText,
          wa_agendar_token: waAgendarToken,
          data: new Date().toLocaleDateString('pt-BR'),
          link: ''
        };

        const content = replaceVariables(template.content, variables);
        const subject = template.subject ? replaceVariables(template.subject, variables) : undefined;

        // Monta ContentVariables posicional respeitando a ordem definida em template.variables.
        // Sem isso, Twilio recebe valores trocados (ex.: {{2}} = email em vez de dono_link_wa_agendar).
        const templateVarNames: string[] = Array.isArray(template.variables) ? template.variables : [];
        const contentVariables: Record<string, string> = {};
        templateVarNames.forEach((name, idx) => {
          contentVariables[String(idx + 1)] = variables[name] ?? '';
        });

        // 8. Send via appropriate channel
        let sendResult: { success: boolean; externalId?: string; error?: string };

        if (step.channel === 'whatsapp') {
          sendResult = await sendWhatsApp(supabase, {
            to: contact.phone,
            templateSid: template.twilio_template_sid,
            content,
            variables,
            contentVariables,
          });
        } else if (step.channel === 'email') {
          sendResult = await sendEmail(supabase, {
            to: contact.email,
            name: contact.name,
            subject: subject || 'Mensagem automática',
            content,
            templateId: template.activecampaign_template_id
          });
        } else {
          sendResult = { success: false, error: `Unknown channel: ${step.channel}` };
        }

        // 9. Log the result
        await supabase.from('automation_logs').insert({
          flow_id: item.flow_id,
          step_id: item.step_id,
          template_id: template.id,
          deal_id: item.deal_id,
          contact_id: contact.id,
          channel: step.channel,
          recipient: step.channel === 'whatsapp' ? contact.phone : contact.email,
          content_sent: content,
          status: sendResult.success ? 'sent' : 'failed',
          external_id: sendResult.externalId,
          error_message: sendResult.error,
          sent_at: sendResult.success ? new Date().toISOString() : null
        });

        // 10. Update queue item status
        if (sendResult.success) {
          await supabase
            .from('automation_queue')
            .update({
              status: 'sent',
              processed_at: new Date().toISOString()
            })
            .eq('id', item.id);
          results.sent++;
          console.log(`[AUTOMATION-PROCESSOR] Sent ${step.channel} to ${contact.name}`);
        } else {
          const newAttempts = (item.attempts || 0) + 1;
          const newStatus = newAttempts >= MAX_RETRIES ? 'failed' : 'pending';
          
          await supabase
            .from('automation_queue')
            .update({
              status: newStatus,
              attempts: newAttempts,
              last_attempt_at: new Date().toISOString(),
              error_message: sendResult.error
            })
            .eq('id', item.id);
          
          if (newStatus === 'failed') {
            results.failed++;
            results.errors.push(`${step.channel} to ${contact.email}: ${sendResult.error}`);
          }
          console.error(`[AUTOMATION-PROCESSOR] Failed ${step.channel} to ${contact.name}: ${sendResult.error}`);
        }

      } catch (itemError: any) {
        console.error(`[AUTOMATION-PROCESSOR] Error processing item ${item.id}:`, itemError.message);
        results.failed++;
        results.errors.push(itemError.message);
        
        await supabase
          .from('automation_queue')
          .update({
            status: 'failed',
            error_message: itemError.message,
            processed_at: new Date().toISOString()
          })
          .eq('id', item.id);
      }
    }

    const processingTime = Date.now() - startTime;
    console.log(`[AUTOMATION-PROCESSOR] Completed in ${processingTime}ms:`, results);

    return new Response(
      JSON.stringify({ success: true, ...results, processingTime }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[AUTOMATION-PROCESSOR] Fatal error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message, ...results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

async function markAsSkipped(supabase: any, itemId: string, reason: string) {
  await supabase
    .from('automation_queue')
    .update({
      status: 'cancelled',
      error_message: reason,
      processed_at: new Date().toISOString()
    })
    .eq('id', itemId);
}

function replaceVariables(content: string, variables: Record<string, string>): string {
  let result = content;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'gi'), value || '');
  }
  return result;
}

async function sendWhatsApp(
  supabase: any,
  params: { to: string; templateSid?: string; content: string; variables: Record<string, string>; contentVariables?: Record<string, string> }
): Promise<{ success: boolean; externalId?: string; error?: string }> {
  try {
    if (!params.to) {
      return { success: false, error: 'No phone number' };
    }

    // Call the twilio-whatsapp-send edge function
    const { data, error } = await supabase.functions.invoke('twilio-whatsapp-send', {
      body: {
        to: params.to,
        templateSid: params.templateSid,
        body: params.content,
        variables: params.variables,
        contentVariables: params.contentVariables,
      }
    });

    if (error) {
      // supabase.functions.invoke loses the response body on non-2xx.
      // Try to extract the real Twilio error (code + message) from error.context.
      let detailed = error.message;
      try {
        const resp = (error as any)?.context?.response ?? (error as any)?.context;
        if (resp && typeof resp.text === 'function') {
          const txt = await resp.text();
          if (txt) detailed = `${error.message} | body=${txt.slice(0, 500)}`;
        }
      } catch (_) { /* ignore */ }
      return { success: false, error: detailed };
    }

    return { success: data?.success, externalId: data?.messageSid, error: data?.error };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function sendEmail(
  supabase: any,
  params: { to: string; name: string; subject: string; content: string; templateId?: string }
): Promise<{ success: boolean; externalId?: string; error?: string }> {
  try {
    if (!params.to) {
      return { success: false, error: 'No email address' };
    }

    // Call the brevo-send edge function
    const { data, error } = await supabase.functions.invoke('brevo-send', {
      body: {
        to: params.to,
        name: params.name,
        subject: params.subject,
        htmlContent: params.content,
        tags: ['automation', params.templateId || 'generic'],
      }
    });

    if (error) {
      let detailed = error.message;
      try {
        const resp = (error as any)?.context?.response ?? (error as any)?.context;
        if (resp && typeof resp.text === 'function') {
          const txt = await resp.text();
          if (txt) detailed = `${error.message} | body=${txt.slice(0, 500)}`;
        }
      } catch (_) { /* ignore */ }
      return { success: false, error: detailed };
    }

    return { success: data?.success, externalId: data?.messageId, error: data?.error };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
