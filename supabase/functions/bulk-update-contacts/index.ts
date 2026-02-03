import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ContactInput {
  clint_id: string;
  name: string;
  email: string;
  phone: string;
}

interface ProcessingStats {
  total_received: number;
  duplicates_skipped: number;
  contacts_created: number;
  contacts_updated: number;
  contacts_found_existing: number;
  deals_linked: number;
  errors: string[];
}

function normalizePhone(phone: string): string {
  // Remove tudo exceto números
  return phone.replace(/\D/g, '');
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { contacts, owner_id }: { contacts: ContactInput[]; owner_id: string } = await req.json();

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Array de contatos é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!owner_id) {
      return new Response(
        JSON.stringify({ error: 'owner_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📥 Recebidos ${contacts.length} contatos para o owner: ${owner_id}`);

    const stats: ProcessingStats = {
      total_received: contacts.length,
      duplicates_skipped: 0,
      contacts_created: 0,
      contacts_updated: 0,
      contacts_found_existing: 0,
      deals_linked: 0,
      errors: [],
    };

    // Set para rastrear emails já processados (deduplicação)
    const processedEmails = new Set<string>();
    const results: { name: string; contact_id: string; deals_linked: number }[] = [];

    for (const contact of contacts) {
      try {
        const email = normalizeEmail(contact.email);
        const phone = normalizePhone(contact.phone);
        const name = contact.name.trim();
        const clintId = contact.clint_id;

        // Pular duplicados na lista
        if (processedEmails.has(email)) {
          console.log(`⏭️ Pulando duplicado: ${name} (${email})`);
          stats.duplicates_skipped++;
          continue;
        }
        processedEmails.add(email);

        let contactId: string | null = null;
        let wasCreated = false;
        let wasUpdated = false;

        // 1. Buscar por email
        const { data: existingByEmail } = await supabase
          .from('crm_contacts')
          .select('id, phone, clint_id')
          .eq('email', email)
          .maybeSingle();

        if (existingByEmail) {
          contactId = existingByEmail.id;
          stats.contacts_found_existing++;
          console.log(`✅ Encontrado por email: ${name} -> ${contactId}`);

          // Atualizar dados faltantes
          const updates: Record<string, string> = {};
          if (!existingByEmail.phone && phone) {
            updates.phone = phone;
          }
          if (!existingByEmail.clint_id && clintId) {
            updates.clint_id = clintId;
          }

          if (Object.keys(updates).length > 0) {
            await supabase
              .from('crm_contacts')
              .update(updates)
              .eq('id', contactId);
            wasUpdated = true;
            stats.contacts_updated++;
            console.log(`📝 Atualizado contato ${contactId} com:`, updates);
          }
        } else {
          // 2. Buscar por telefone normalizado
          const { data: existingByPhone } = await supabase
            .from('crm_contacts')
            .select('id, email, clint_id')
            .eq('phone', phone)
            .maybeSingle();

          if (existingByPhone) {
            contactId = existingByPhone.id;
            stats.contacts_found_existing++;
            console.log(`✅ Encontrado por telefone: ${name} -> ${contactId}`);

            // Atualizar dados faltantes
            const updates: Record<string, string> = {};
            if (!existingByPhone.email && email) {
              updates.email = email;
            }
            if (!existingByPhone.clint_id && clintId) {
              updates.clint_id = clintId;
            }

            if (Object.keys(updates).length > 0) {
              await supabase
                .from('crm_contacts')
                .update(updates)
                .eq('id', contactId);
              wasUpdated = true;
              stats.contacts_updated++;
              console.log(`📝 Atualizado contato ${contactId} com:`, updates);
            }
          } else {
            // 3. Criar novo contato
            const { data: newContact, error: insertError } = await supabase
              .from('crm_contacts')
              .insert({
                clint_id: clintId,
                name: name,
                email: email,
                phone: phone,
              })
              .select('id')
              .single();

            if (insertError) {
              console.error(`❌ Erro ao criar contato ${name}:`, insertError);
              stats.errors.push(`Erro ao criar ${name}: ${insertError.message}`);
              continue;
            }

            contactId = newContact.id;
            wasCreated = true;
            stats.contacts_created++;
            console.log(`🆕 Criado novo contato: ${name} -> ${contactId}`);
          }
        }

        // 4. Vincular aos deals do owner que batem com o nome
        if (contactId) {
          // Usar ILIKE para match flexível
          const { data: updatedDeals, error: updateError } = await supabase
            .from('crm_deals')
            .update({ contact_id: contactId })
            .eq('owner_id', owner_id)
            .ilike('name', `%${name}%`)
            .is('contact_id', null)
            .select('id');

          if (updateError) {
            console.error(`❌ Erro ao vincular deals para ${name}:`, updateError);
            stats.errors.push(`Erro ao vincular deals para ${name}: ${updateError.message}`);
          } else {
            const linkedCount = updatedDeals?.length || 0;
            stats.deals_linked += linkedCount;
            
            results.push({
              name,
              contact_id: contactId,
              deals_linked: linkedCount,
            });

            if (linkedCount > 0) {
              console.log(`🔗 Vinculados ${linkedCount} deals para ${name}`);
            }
          }
        }

      } catch (error: any) {
        console.error(`❌ Erro ao processar contato:`, error);
        stats.errors.push(`Erro inesperado: ${error.message}`);
      }
    }

    console.log('\n📊 Estatísticas finais:');
    console.log(`   Total recebidos: ${stats.total_received}`);
    console.log(`   Duplicados pulados: ${stats.duplicates_skipped}`);
    console.log(`   Contatos criados: ${stats.contacts_created}`);
    console.log(`   Contatos atualizados: ${stats.contacts_updated}`);
    console.log(`   Contatos já existentes: ${stats.contacts_found_existing}`);
    console.log(`   Deals vinculados: ${stats.deals_linked}`);
    console.log(`   Erros: ${stats.errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        results: results.slice(0, 50), // Limitar para não sobrecarregar resposta
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
