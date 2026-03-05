import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface LeadInput {
  name: string;
  email: string;
  phone: string;
  contact_id?: string; // When provided, skip contact creation
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { leads, origin_id, owner_email, owner_profile_id } = await req.json() as {
      leads: LeadInput[];
      origin_id: string;
      owner_email?: string;
      owner_profile_id?: string;
    };

    if (!leads?.length || !origin_id) {
      return new Response(JSON.stringify({ error: 'leads and origin_id are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get first stage of the pipeline
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

    const firstStageId = stages[0].id;
    const timestamp = Date.now();
    let created = 0;
    let skipped = 0;

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      const emailNorm = (lead.email || '').toLowerCase().trim();
      const phoneClean = (lead.phone || '').replace(/\D/g, '');
      const phoneSuffix = phoneClean.length >= 9 ? phoneClean.slice(-9) : phoneClean;

      try {
        let contactId: string;

        // If contact_id is provided, use it directly (contact already exists)
        if (lead.contact_id) {
          contactId = lead.contact_id;
        } else {
          // Deduplicate contact: email → phone
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

          if (existingContact) {
            contactId = existingContact.id;
          } else {
            // Create contact
            const { data: newContact, error: contactError } = await supabase
              .from('crm_contacts')
              .insert({
                name: lead.name || 'Sem nome',
                email: emailNorm || null,
                phone: lead.phone || null,
                clint_id: `spreadsheet_import_${timestamp}_${i}`,
              })
              .select('id')
              .single();

            if (contactError) {
              console.error(`Error creating contact for ${lead.name}:`, contactError);
              skipped++;
              continue;
            }
            contactId = newContact.id;
          }
        }

        // Check if deal already exists for this contact in this origin
        const { data: existingDeal } = await supabase
          .from('crm_deals')
          .select('id')
          .eq('contact_id', contactId)
          .eq('origin_id', origin_id)
          .limit(1);

        if (existingDeal?.length) {
          skipped++;
          continue;
        }

        // Create deal with optional owner
        const dealData: any = {
          name: lead.name || 'Lead importado',
          contact_id: contactId,
          origin_id: origin_id,
          stage_id: firstStageId,
          tags: ['base clint'],
          clint_id: `spreadsheet_import_${timestamp}_${i}`,
        };

        if (owner_email) {
          dealData.owner_id = owner_email;
        }
        if (owner_profile_id) {
          dealData.owner_profile_id = owner_profile_id;
        }

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

    return new Response(JSON.stringify({ created, skipped, total: leads.length }), {
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
