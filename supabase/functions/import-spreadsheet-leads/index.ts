import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface LeadInput {
  name: string;
  email: string;
  phone: string;
  contact_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { leads, origin_id, owner_email, owner_profile_id, tags: customTags, stage_id: customStageId } = await req.json() as {
      leads: LeadInput[];
      origin_id: string;
      owner_email?: string;
      owner_profile_id?: string;
      tags?: string[];
      stage_id?: string;
    };

    if (!leads?.length || !origin_id) {
      return new Response(JSON.stringify({ error: 'leads and origin_id are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let firstStageId: string;

    if (customStageId) {
      firstStageId = customStageId;
    } else {
      const { data: stages, error: stagesError } = await supabase
        .from('crm_stages')
        .select('id, stage_name')
        .eq('origin_id', origin_id)
        .order('stage_order', { ascending: true })
        .limit(1);

      if (stagesError || !stages?.length) {
        return new Response(JSON.stringify({ error: 'Could not find stages for this pipeline' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      firstStageId = stages[0].id;
    }

    const baseTags = ['base clint'];
    const finalTags = customTags?.length ? [...baseTags, ...customTags] : baseTags;
    const timestamp = Date.now();
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      const cleanName = (lead.name || '').replace(/^["']|["']$/g, '').trim();
      const cleanPhone = (lead.phone || '').replace(/^["']|["']$/g, '').trim();
      const emailNorm = (lead.email || '').replace(/^["']|["']$/g, '').toLowerCase().trim();
      const phoneClean = cleanPhone.replace(/\D/g, '');
      const phoneSuffix = phoneClean.length >= 9 ? phoneClean.slice(-9) : phoneClean;
      // Escape LIKE wildcards to avoid `_` in emails matching any char.
      const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => '\\' + m);
      const emailLike = escapeLike(emailNorm);
      const phoneSuffixLike = escapeLike(phoneSuffix);

      try {
        let contactId: string;

        if (lead.contact_id) {
          contactId = lead.contact_id;
          // Backfill missing email/phone on the reused contact so deals never
          // show up empty. Never overwrite existing values.
          if (emailNorm || cleanPhone) {
            const { data: existing } = await supabase
              .from('crm_contacts')
              .select('email, phone')
              .eq('id', contactId)
              .maybeSingle();
            const patch: Record<string, string> = {};
            if (emailNorm && !existing?.email) patch.email = emailNorm;
            if (cleanPhone && !existing?.phone) patch.phone = cleanPhone;
            if (Object.keys(patch).length > 0) {
              await supabase.from('crm_contacts').update(patch).eq('id', contactId);
            }
          }
        } else {
          let existingContact: any = null;

          if (emailNorm) {
            const { data } = await supabase
              .from('crm_contacts')
              .select('id')
              .ilike('email', emailLike)
              .limit(1);
            if (data?.length) existingContact = data[0];
          }

          if (!existingContact && phoneSuffix) {
            const { data } = await supabase
              .from('crm_contacts')
              .select('id')
              .ilike('phone', `%${phoneSuffixLike}`)
              .limit(1);
            if (data?.length) existingContact = data[0];
          }

          // Fallback de 8 dígitos removido: gerava colisões (dois telefones
          // não relacionados terminando nos mesmos 8 dígitos), fazendo
          // reaproveitar contact_id errado e perder o telefone/email da planilha.

          // Backfill: se casamos por email/phone e o contato existente estiver
          // faltando o outro campo, preencher com os dados da planilha.
          if (existingContact && (emailNorm || cleanPhone)) {
            const { data: existing } = await supabase
              .from('crm_contacts')
              .select('email, phone')
              .eq('id', existingContact.id)
              .maybeSingle();
            const patch: Record<string, string> = {};
            if (emailNorm && !existing?.email) patch.email = emailNorm;
            if (cleanPhone && !existing?.phone) patch.phone = cleanPhone;
            if (Object.keys(patch).length > 0) {
              await supabase.from('crm_contacts').update(patch).eq('id', existingContact.id);
            }
          }

          if (existingContact) {
            contactId = existingContact.id;
          } else {
            const { data: newContact, error: contactError } = await supabase
              .from('crm_contacts')
              .insert({
                name: cleanName || 'Sem nome',
                email: emailNorm || null,
                phone: cleanPhone || null,
                clint_id: `spreadsheet_import_${timestamp}_${i}`,
              })
              .select('id')
              .single();

            if (contactError) {
              console.error(`Error creating contact for ${cleanName}:`, contactError);
              skipped++;
              continue;
            }
            contactId = newContact.id;
          }
        }

        // Check if deal already exists by identity (email/phone) in this origin
        const { data: existingDealId } = await supabase
          .rpc('check_duplicate_deal_by_identity', {
            p_email: emailNorm || '',
            p_phone_suffix: phoneSuffix || '',
            p_origin_id: origin_id,
          });

        if (existingDealId) {
          // Deal já existe: só atualizar tags, preservar owner e stage
          const { error: updateError } = await supabase
            .from('crm_deals')
            .update({ tags: finalTags })
            .eq('id', existingDealId);

          if (updateError) {
            console.error(`Error updating deal for ${lead.name}:`, updateError);
            skipped++;
          } else {
            updated++;
          }
          continue;
        }

        // Create deal
        const dealData: any = {
          name: cleanName || 'Lead importado',
          contact_id: contactId,
          origin_id: origin_id,
          stage_id: firstStageId,
          tags: finalTags,
          clint_id: `spreadsheet_import_${timestamp}_${i}`,
        };

        if (owner_email) dealData.owner_id = owner_email;
        if (owner_profile_id) dealData.owner_profile_id = owner_profile_id;

        const { error: dealError } = await supabase
          .from('crm_deals')
          .insert(dealData);

        if (dealError) {
          console.error(`Error creating deal for ${lead.name}:`, dealError);
          skipped++;
          continue;
        }

        created++;
      } catch (err) {
        console.error(`Error processing lead ${i}:`, err);
        skipped++;
      }
    }

    return new Response(JSON.stringify({ created, updated, skipped, total: leads.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('import-spreadsheet-leads error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
