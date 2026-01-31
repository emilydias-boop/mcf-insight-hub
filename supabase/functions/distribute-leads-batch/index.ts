import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SDR configuration with emails, profile IDs and proportional distribution
const SDR_CONFIG = [
  { email: 'julia.caroline@minhacasafinanciada.com', profileId: '794a2257-422c-4b38-9014-3135d9e26361', name: 'Julia Caroline', count: 18 },
  { email: 'caroline.souza@minhacasafinanciada.com', profileId: '4c947a4c-80c1-4439-bd31-2b38e3a3f1d0', name: 'Caroline Souza', count: 17 },
  { email: 'carol.correa@minhacasafinanciada.com', profileId: 'c7005c87-76fc-43a9-8bfa-e1b41f48a9b7', name: 'Caroline Corrêa', count: 17 },
  { email: 'juliana.rodrigues@minhacasafinanciada.com', profileId: 'baa6047c-6b41-42ef-bfd0-248eef9b560a', name: 'Juliana Rodrigues', count: 17 },
  { email: 'leticia.nunes@minhacasafinanciada.com', profileId: 'c1ede6ed-e3ae-465f-91dd-a708200a85fc', name: 'Leticia Nunes', count: 17 },
  { email: 'antony.elias@minhacasafinanciada.com', profileId: '70113bef-a779-414c-8ab4-ce8b13229d3a', name: 'Antony Elias', count: 17 },
  { email: 'jessica.martins@minhacasafinanciada.com', profileId: 'b0ea004d-ca72-4190-ab69-a9685b34bd06', name: 'Jessica Martins', count: 17 },
  { email: 'alex.dias@minhacasafinanciada.com', profileId: '16c5d025-9cda-45fa-ae2f-7170bfb8dee8', name: 'Alex Dias', count: 18 },
];

const EMAIL_LIST = [
  '29rmassaro@gmail.com','7marxts@gmail.com','a.calacio@gmail.com','a.rafael.51@hotmail.com',
  'aadriane.ssouza@gmail.com','academico_diego@hotmail.com','accdmd@gmail.com',
  'acengenhariaeconsultoria9@gmail.com','adrielmarques@gmail.com','agrodf@gmail.com',
  'ailtoncardosojunqueira@gmail.com','ajoaciralcantara@gmail.com','alberthtrindadesouza@gmail.com',
  'aldrey_silverio19@hotmail.com','alessandracorretora22@hotmail.com','alexandre.desouza100@hotmail.com',
  'alexandreconsert@yahoo.com.br','alexkarvalho@hotmail.com','alexrferrari85@gmail.com',
  'alexsandernpi2014@gmail.com','aline@visaexpress.com.br','allanbamvakiadis@gmail.com',
  'aloisiofalcone@hotmail.com','alomarmoraes35@gmail.com','altemarvasconceicao@gmail.com',
  'alyssonmurada@gmail.com','amauribristotte7@gmail.com','amauryeng@hotmail.com',
  'anacarlarosa@hotmail.com','anderson.psantos@catolica.edu.br','anderson_versteeg@hotmail.com',
  'andredelamura@hotmail.com','andreh.santoss@gmail.com','andremarinhov@gmail.com',
  'andremenini@msn.com','andremoreira.agro@gmail.com','andrenunes.carvalho@gmail.com',
  'andreygomes07@gmail.com','andson1103@gmail.com','and_tiequer@hotmail.com',
  'anilsonmarques@yahoo.com.br','anselmosoares068@gmail.com','antonioalmeida8@gmail.com',
  'antoniocarloscrispe@gmail.com','apaulagodoiimoveis@gmail.com','arleidebp@terra.com.br',
  'arq.silvanafreitas@gmail.com','artsalomao23@outlook.com','assuncaoglass@gmail.com',
  'assynara1@gmail.com','aurivan1994@gmail.com','barbaralportella@gmail.com',
  'barrosomanu08@gmail.com','barugesso@gmail.com','benildogodoy@gmail.com',
  'bernardoapj@gmail.com','bertin82@yahoo.com.br','bmesel@hotmail.com',
  'boettger.rm@gmail.com','brunamagbarros@gmail.com','brunno_clp@hotmail.com',
  'brunoazca@hotmail.com','brunobarbosa.msn@gmail.com','brunofontesmkt@gmail.com',
  'brunoguedes298@gmail.com','brunojssantana@gmail.com','brunopmmartins@gmail.com',
  'brunoramon03@gmail.com','bs.projetos@outlook.com','bysorayahusseingm@gmail.com',
  'cacautransporte07@gmail.com','cae.oliveira@gmail.com','caio.oliver@live.com',
  'caioballack123@gmail.com','caiquemelocra@gmail.com','camargocaio345@gmail.com',
  'campionisrg@yahoo.com.br','capobianco.favio@hotmail.com','carlosegf@icloud.com',
  'carlosfernandesnj@me.com','carlosmiranda478@gmail.com','castrorenato@hotmail.com',
  'ccostap39@gmail.com','ceap.nat@gmail.com','cenairzorzo@outlook.com',
  'centralmaquinas495@gmail.com','cesariobelo@outlook.com','chacur@me.com',
  'clanebressan@hotmail.com','claudiaciarlini@hotmail.com','claudionogueiravg@gmail.com',
  'claytongcolombo@gmail.com','cleciogf@hotmail.com','cleitonalvesdemoraes@hotmail.com',
  'cleiton_lim@yahoo.com.br','clelio30@gmail.com','cocce@cocce.com.br',
  'cofabiobarbosa@gmail.com','comercialandersonjunior@gmail.com','conrado1967@outlook.com',
  'contato.com.noe@gmail.com','contatobrnwowzk@gmail.com','costayz135@gmail.com',
  'cristianolopes.cls@gmail.com','cris_lauar@yahoo.com.br','cscconstrutora.ce@gmail.com',
  'daisserafim@yahoo.com.br','daniela.or.a@gmail.com','danielaraujo23games@gmail.com',
  'daniele.aos@outlook.com.br','danielvinyk@gmail.com','danilo.s.amaral@gmail.com',
  'danjorge@gmail.com','danyllo-sabtos@hotmail.com','dasilvaarquitetura@gmail.com',
  'daviocperes@gmail.com'
];

const ORIGIN_ID = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c';
const TAG_NAME = 'Lead-Lançamento';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch all orphan deals matching the email list
    const { data: contacts, error: contactsError } = await supabase
      .from('crm_contacts')
      .select('id, email')
      .in('email', EMAIL_LIST.map(e => e.toLowerCase()));

    if (contactsError) throw contactsError;

    const contactIds = contacts?.map(c => c.id) || [];
    const emailMap = new Map(contacts?.map(c => [c.id, c.email]) || []);

    // 2. Fetch orphan deals for these contacts
    const { data: orphanDeals, error: dealsError } = await supabase
      .from('crm_deals')
      .select('id, name, contact_id, tags')
      .eq('origin_id', ORIGIN_ID)
      .is('owner_id', null)
      .in('contact_id', contactIds);

    if (dealsError) throw dealsError;

    if (!orphanDeals || orphanDeals.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No orphan deals found to distribute',
        updated: 0 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 3. Shuffle deals randomly for fair distribution
    const shuffledDeals = [...orphanDeals].sort(() => Math.random() - 0.5);

    // 4. Distribute deals to SDRs
    let currentSdrIndex = 0;
    let currentSdrCount = 0;
    const assignments: { dealId: string; sdr: typeof SDR_CONFIG[0] }[] = [];

    for (const deal of shuffledDeals) {
      const sdr = SDR_CONFIG[currentSdrIndex];
      assignments.push({ dealId: deal.id, sdr });
      
      currentSdrCount++;
      if (currentSdrCount >= sdr.count) {
        currentSdrIndex++;
        currentSdrCount = 0;
        if (currentSdrIndex >= SDR_CONFIG.length) {
          // If more deals than expected, cycle back
          currentSdrIndex = 0;
        }
      }
    }

    // 5. Update deals with owner and tag
    const results = { updated: 0, activities: 0, errors: [] as string[] };

    for (const { dealId, sdr } of assignments) {
      const deal = orphanDeals.find(d => d.id === dealId);
      if (!deal) continue;

      // Update deal with owner and tag
      const newTags = deal.tags 
        ? (deal.tags.includes(TAG_NAME) ? deal.tags : [...deal.tags, TAG_NAME])
        : [TAG_NAME];

      const { error: updateError } = await supabase
        .from('crm_deals')
        .update({
          owner_id: sdr.email,
          owner_profile_id: sdr.profileId,
          tags: newTags,
          updated_at: new Date().toISOString()
        })
        .eq('id', dealId);

      if (updateError) {
        results.errors.push(`Deal ${dealId}: ${updateError.message}`);
        continue;
      }
      results.updated++;

      // Create activity log
      const { error: activityError } = await supabase
        .from('deal_activities')
        .insert({
          deal_id: dealId,
          activity_type: 'owner_change',
          description: `Atribuído para ${sdr.name} via distribuição de lançamento`,
          metadata: {
            new_owner: sdr.email,
            new_owner_name: sdr.name,
            new_owner_profile_id: sdr.profileId,
            tag_added: TAG_NAME,
            distributed_at: new Date().toISOString(),
            batch_operation: 'lead-lancamento-distribution'
          }
        });

      if (!activityError) {
        results.activities++;
      }
    }

    // 6. Summary by SDR
    const summary = SDR_CONFIG.map(sdr => ({
      name: sdr.name,
      email: sdr.email,
      assigned: assignments.filter(a => a.sdr.email === sdr.email).length
    }));

    return new Response(JSON.stringify({
      success: true,
      message: `Distributed ${results.updated} deals to ${SDR_CONFIG.length} SDRs`,
      updated: results.updated,
      activities_created: results.activities,
      errors: results.errors.length > 0 ? results.errors : undefined,
      distribution: summary
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Distribution error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
