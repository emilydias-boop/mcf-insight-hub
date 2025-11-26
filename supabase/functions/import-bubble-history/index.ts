import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BubbleRecord {
  clint_id?: string;
  email_clint?: string;
  tefone_clint?: string;
  nome_clint?: string;
  etapa_funil_clint?: string;
  'Creation Date'?: string;
  valor_clint?: string;
  dono_do_negocio_clint?: string;
  closer?: string;
  nota_clint?: string;
  tag?: string;
  status?: string;
  'Modified Date'?: string;
}

interface ImportPayload {
  origin_id: string;
  records: BubbleRecord[];
}

const BUBBLE_TO_CRM_STAGES: Record<string, string> = {
  'novo lead': 'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b',
  'Novo Lead': 'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b',
  'Lead Gratuito': 'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b',
  'Lead Qualificado': 'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b',
  'Lead Instagram': 'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b',
  'Reunião 01 Agendada': 'a8365215-fd31-4bdc-bbe7-77100fa39e53',
  'Reunião 01 Realizada': '34995d75-933e-4d67-b7fc-19fcb8b81680',
  'Reunião 02 Realizada': '34995d75-933e-4d67-b7fc-19fcb8b81680',
  'Contrato Pago': '062927f5-b7a3-496a-9d47-eb03b3d69b10',
  'Venda realizada': '3a2776e2-a536-4a2a-bb7b-a2f53c8941df',
};

function parseBubbleDate(dateStr: string): string {
  // Se vazio ou inválido, usar data atual
  if (!dateStr || dateStr.trim() === '') {
    console.log('[parseBubbleDate] Empty date, using current');
    return new Date().toISOString();
  }

  try {
    // Tentar parse direto
    const date = new Date(dateStr);
    
    // Verificar se é válido
    if (isNaN(date.getTime())) {
      console.log('[parseBubbleDate] Invalid date:', dateStr, '- using current');
      return new Date().toISOString();
    }
    
    return date.toISOString();
  } catch (error) {
    console.error('[parseBubbleDate] Error:', dateStr, error);
    return new Date().toISOString();
  }
}

function normalizePhone(phone: string): string {
  // Remove +55, espaços, traços, parênteses
  return phone.replace(/\D/g, '').replace(/^55/, '');
}

async function findClintIdFromContacts(
  supabase: any,
  email: string | undefined,
  phone: string | undefined
): Promise<string | null> {
  // Tentar por email primeiro
  if (email) {
    const { data } = await supabase
      .from('crm_contacts')
      .select('clint_id')
      .eq('email', email)
      .maybeSingle();
    if (data?.clint_id) {
      console.log(`[findClintId] ✅ Found via email: ${data.clint_id}`);
      return data.clint_id;
    }
  }
  
  // Tentar por telefone normalizado
  if (phone) {
    const normalizedPhone = normalizePhone(phone);
    const { data } = await supabase
      .from('crm_contacts')
      .select('clint_id')
      .eq('phone', normalizedPhone)
      .maybeSingle();
    if (data?.clint_id) {
      console.log(`[findClintId] ✅ Found via phone: ${data.clint_id}`);
      return data.clint_id;
    }
  }
  
  return null;
}

function mapStage(bubbleStage: string): string {
  return BUBBLE_TO_CRM_STAGES[bubbleStage] || BUBBLE_TO_CRM_STAGES['Novo Lead'];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[import-bubble-history] 🚀 Starting import');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: ImportPayload = await req.json();
    const { origin_id, records } = payload;

    if (!origin_id || !records || records.length === 0) {
      throw new Error('Missing origin_id or records');
    }

    console.log(`[import-bubble-history] Processing ${records.length} records for origin ${origin_id}`);

    let created = 0;
    let updated = 0;
    let preserved = 0;
    let matchedViaContact = 0;
    let generatedId = 0;
    let activitiesCreated = 0;
    const errors: string[] = [];

    // Process in chunks of 100
    const chunkSize = 100;
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      console.log(`[import-bubble-history] Processing chunk ${i / chunkSize + 1}/${Math.ceil(records.length / chunkSize)}`);

      for (const record of chunk) {
        try {
          const createdAt = parseBubbleDate(record['Creation Date'] || '');
          const stageId = mapStage(record.etapa_funil_clint || 'Novo Lead');

          // 1. Determinar clint_id do registro
          let finalClintId = record.clint_id?.trim();

          if (!finalClintId) {
            // Tentar encontrar clint_id nos contatos existentes
            const foundClintId = await findClintIdFromContacts(
              supabase,
              record.email_clint,
              record.tefone_clint
            );
            
            if (foundClintId) {
              finalClintId = foundClintId;
              matchedViaContact++;
              console.log(`[import] ✅ Matched: ${record.nome_clint} -> ${finalClintId}`);
            } else {
              // Fallback: gerar ID sintético único
              const timestamp = Date.now();
              const random = Math.random().toString(36).substring(2, 9);
              finalClintId = `bubble_${timestamp}_${random}`;
              generatedId++;
              console.log(`[import] ⚠️ Generated ID: ${finalClintId} for ${record.nome_clint}`);
            }
          }

          // 2. Find existing deal by clint_id
          let existingDeal = null;
          const { data } = await supabase
            .from('crm_deals')
            .select('*')
            .eq('clint_id', finalClintId)
            .maybeSingle();
          existingDeal = data;

          let dealId: string;

          // 3. Handle deal creation/update based on data_source
          if (existingDeal) {
            dealId = finalClintId;

            if (existingDeal.data_source === 'webhook') {
              // Preserve webhook data - don't update
              preserved++;
              console.log(`[import-bubble-history] ✅ Preserved webhook deal: ${dealId}`);
            } else if (new Date(createdAt) > new Date(existingDeal.updated_at)) {
              // Update if Bubble is newer
              const { error } = await supabase
                .from('crm_deals')
                .update({
                  stage_id: stageId,
                  value: parseFloat(record.valor_clint || '0') || null,
                  owner_id: record.dono_do_negocio_clint || null,
                  tags: record.nota_clint ? [record.nota_clint] : (record.tag ? [record.tag] : null),
                  updated_at: createdAt,
                  data_source: 'bubble',
                })
                .eq('clint_id', dealId);

              if (error) throw error;
              updated++;
              console.log(`[import-bubble-history] 🔄 Updated deal: ${dealId}`);
            } else {
              preserved++;
            }
          } else {
            // Create new deal
            // Try to find or create contact
            let contactId = null;
            if (record.email_clint || record.tefone_clint) {
              // Buscar por email primeiro
              if (record.email_clint) {
                const { data: existingContact } = await supabase
                  .from('crm_contacts')
                  .select('id')
                  .eq('email', record.email_clint)
                  .maybeSingle();
                
                if (existingContact) {
                  contactId = existingContact.id;
                }
              }

              // Se não encontrou por email, tentar por telefone normalizado
              if (!contactId && record.tefone_clint) {
                const normalizedPhone = normalizePhone(record.tefone_clint);
                const { data: existingContact } = await supabase
                  .from('crm_contacts')
                  .select('id')
                  .eq('phone', normalizedPhone)
                  .maybeSingle();
                
                if (existingContact) {
                  contactId = existingContact.id;
                }
              }

              // Se não encontrou, criar novo contato
              if (!contactId) {
                const { data: newContact, error: contactError } = await supabase
                  .from('crm_contacts')
                  .insert({
                    clint_id: finalClintId,
                    name: record.nome_clint || 'Contato sem nome',
                    email: record.email_clint,
                    phone: record.tefone_clint ? normalizePhone(record.tefone_clint) : null,
                    origin_id,
                  })
                  .select()
                  .maybeSingle();

                if (contactError) {
                  console.error('[import-bubble-history] Error creating contact:', contactError);
                } else if (newContact) {
                  contactId = newContact.id;
                }
              }
            }

            const { data: newDeal, error } = await supabase
              .from('crm_deals')
              .insert({
                clint_id: finalClintId,
                name: record.nome_clint || 'Lead sem nome',
                stage_id: stageId,
                value: parseFloat(record.valor_clint || '0') || null,
                owner_id: record.dono_do_negocio_clint || null,
                tags: record.nota_clint ? [record.nota_clint] : (record.tag ? [record.tag] : null),
                origin_id,
                contact_id: contactId,
                created_at: createdAt,
                updated_at: createdAt,
                data_source: 'bubble',
              })
              .select()
              .maybeSingle();

            if (error) throw error;
            if (newDeal) {
              dealId = finalClintId;
              created++;
              console.log(`[import-bubble-history] ➕ Created deal: ${dealId}`);
            } else {
              throw new Error('Failed to create deal');
            }
          }

          // 4. ALWAYS add historical activity
          const { error: activityError } = await supabase
            .from('deal_activities')
            .insert({
              deal_id: finalClintId,
              activity_type: 'stage_change',
              to_stage: stageId,
              description: `Movido para ${record.etapa_funil_clint || 'Novo Lead'}`,
              created_at: createdAt,
              metadata: {
                source: 'bubble_import',
                closer: record.closer,
                value: record.valor_clint,
                owner: record.dono_do_negocio_clint,
                tags: record.nota_clint || record.tag,
                status: record.status,
              },
            });

          if (activityError) {
            console.error('[import-bubble-history] Error creating activity:', activityError);
          } else {
            activitiesCreated++;
          }

        } catch (error: any) {
          const errorMsg = error?.message || error?.details || error?.code || 'Unknown error';
          console.error('[import-bubble-history] Error:', errorMsg, {
            nome: record.nome_clint,
            email: record.email_clint,
            phone: record.tefone_clint,
            clint_id: record.clint_id,
          });
          errors.push(`${record.nome_clint || 'Sem nome'}: ${errorMsg}`);
        }
      }

      // Small delay between chunks to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('[import-bubble-history] ✅ Import completed');
    console.log(`[import-bubble-history] Created: ${created}, Updated: ${updated}, Preserved: ${preserved}`);
    console.log(`[import-bubble-history] Matched via contact: ${matchedViaContact}, Generated ID: ${generatedId}`);
    console.log(`[import-bubble-history] Activities created: ${activitiesCreated}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Import completed',
        stats: {
          total: records.length,
          created,
          updated,
          preserved,
          matchedViaContact,
          generatedId,
          activitiesCreated,
          errors: errors.length,
        },
        errors: errors.slice(0, 10), // Return first 10 errors
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[import-bubble-history] Fatal error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
