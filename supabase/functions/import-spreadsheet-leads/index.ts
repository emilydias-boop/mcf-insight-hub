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

      try {
        let contactId: string;

        if (lead.contact_id) {
          contactId = lead.contact_id;
        } else {
          let existingContact: any = null;

          if (emailNorm) {
            const { data } = await supabase
              .from('crm_contacts')
              .select('id')
              .ilike('email', emailNorm)
              .limit(1);
            if (data?.length) existingContact = data[0];
          }

          if (!existingContact && phoneSuffix) {
            const { data } = await supabase
              .from('crm_contacts')
              .select('id')
              .ilike('phone', `%${phoneSuffix}`)
              .limit(1);
            if (data?.length) existingContact = data[0];
          }

          // Fallback: últimos 8 dígitos (ignora dígito 9 variável do celular BR)
          if (!existingContact && phoneClean.length >= 8) {
            const phoneSuffix8 = phoneClean.slice(-8);
            const { data } = await supabase
              .from('crm_contacts')
              .select('id')
              .ilike('phone', `%${phoneSuffix8}`)
              .limit(1);
            if (data?.length) existingContact = data[0];
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

        // Check if deal already exists for this contact in this origin
        const { data: existingDeal } = await supabase
          .from('crm_deals')
          .select('id, stage_id, owner_id, tags')
          .eq('contact_id', contactId)
          .eq('origin_id', origin_id)
          .limit(1);

        if (existingDeal?.length) {
          // Deal já existe: só atualizar tags, preservar owner e stage
          const { error: updateError } = await supabase
            .from('crm_deals')
            .update({ tags: finalTags })
            .eq('id', existingDeal[0].id);

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
  } catch (err) {
    console.error('import-spreadsheet-leads error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
