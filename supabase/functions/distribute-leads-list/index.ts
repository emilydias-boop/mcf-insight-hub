import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SDR configuration with emails, profile IDs - equal distribution
const SDR_CONFIG = [
  { email: 'julia.caroline@minhacasafinanciada.com', profileId: '794a2257-422c-4b38-9014-3135d9e26361', name: 'Julia Caroline' },
  { email: 'caroline.souza@minhacasafinanciada.com', profileId: '4c947a4c-80c1-4439-bd31-2b38e3a3f1d0', name: 'Caroline Souza' },
  { email: 'carol.correa@minhacasafinanciada.com', profileId: 'c7005c87-76fc-43a9-8bfa-e1b41f48a9b7', name: 'Caroline Corrêa' },
  { email: 'juliana.rodrigues@minhacasafinanciada.com', profileId: 'baa6047c-6b41-42ef-bfd0-248eef9b560a', name: 'Juliana Rodrigues' },
  { email: 'leticia.nunes@minhacasafinanciada.com', profileId: 'c1ede6ed-e3ae-465f-91dd-a708200a85fc', name: 'Leticia Nunes' },
  { email: 'antony.elias@minhacasafinanciada.com', profileId: '70113bef-a779-414c-8ab4-ce8b13229d3a', name: 'Antony Elias' },
  { email: 'jessica.martins@minhacasafinanciada.com', profileId: 'b0ea004d-ca72-4190-ab69-a9685b34bd06', name: 'Jessica Martins' },
  { email: 'alex.dias@minhacasafinanciada.com', profileId: '16c5d025-9cda-45fa-ae2f-7170bfb8dee8', name: 'Alex Dias' },
];

// Complete email list from user's spreadsheet
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
  'contato.com.noe@hotmail.com','contatobrnwowzk@gmail.com','costayz135@gmail.com',
  'cristianolopes.cls@gmail.com','cris_lauar@yahoo.com.br','cscconstrutora.ce@gmail.com',
  'daisserafim@yahoo.com.br','daniela.or.a@gmail.com','danielaraujo23games@gmail.com',
  'daniele.aos@outlook.com.br','danielvinyk@gmail.com','danilo.s.amaral@gmail.com',
  'danjorge@gmail.com','danyllo-sabtos@hotmail.com','dasilvaarquitetura@gmail.com',
  'daviocperes@gmail.com','deivisoncarneiro@gmail.com','deivisonreis1@gmail.com',
  'delanebastos@gmail.com','delong.eng@gmail.com','deniseabech@gmail.com',
  'desirrerodrigues1@gmail.com','dhonyarq@hotmail.com','diego.freisleben@gmail.com',
  'diegodias86@gmail.com','diegomercadoimobiliario@gmail.com','dimas.cyrela@gmail.com',
  'diogovmelo@hotmail.com','dirceu_roberto@hotmail.com','direito@outlook.com.br',
  'dmbrito56@gmail.com','douglasborba13@gmail.com','doutoreliazar@hotmail.com',
  'dr-scoton@hotmail.com','dr.fabio.froes@gmail.com','dra.hellenfranco@gmail.com',
  'drikaoliveiramat@gmail.com','drpaulolima@hotmail.com','drsamuelgc@gmail.com',
  'dsmariani98@gmail.com','duh.gomes00@gmail.com','ecorbras@gmail.com',
  'edeziocamargo@gmail.com','edilsonlog@hotmail.com','edsonpvilela@gmail.com',
  'edsonxerez@hotmail.com','edu.joao@yahoo.com.br','eduardo.bcf76@gmail.com',
  'eduardopalheta@hotmail.com','edudafiel.adv@gmail.com','eidernascimentooficiall@gmail.com',
  'elcorimoveis@gmail.com','elidablancoag@hotmail.com','elimarodrigues@outlook.com',
  'eliteimobiliariajoaovitor@outlook.com','eliza.bonine@gmail.com','eltondive@gmail.com',
  'emaisconte@gmail.com','emidioraine@gmail.com','eng.andremochi@gmail.com',
  'eng.isabellegondim@gmail.com','eng.rafaelmalty@gmail.com','engdanielmalcher@gmail.com',
  'engenheiroyurimonteiro@gmail.com','engmarceloaz@gmail.com','eniomalveira@gmail.com',
  'erickmoreiratc@gmail.com','erickwbm.arquiteto@gmail.com','erikasandoval100@gmail.com',
  'erlane_guerra@hotmail.com','estofafosmontreal@hotmail.com','evandroamorin@hotmail.com',
  'evarodermel@hotmail.com','everton.mata@gmail.com','everton_filho@outlook.com',
  'f.o.engineer@gmail.com','fabiana.radio@gmail.com','fabianacaldeirasantos@gmail.com',
  'fabiofernandesba@gmail.com','farantes570@gmail.com','fcoceliovieira@hotmail.com',
  'felipechisine@gmail.com','felipefurghestti@hotmail.com','felipemenezestrabalho@hotmail.com',
  'felipepinheirodamaso@gmail.com','felipesabbag@hotmail.com','felipe_jachs@hotmail.com',
  'fernandomf_fer@hotmail.com','ffleal2020@gmail.com','fmachado.rj@gmail.com',
  'foxmetal2022@gmail.com','francianymartins2@gmail.com','franiscap22.souza@gmail.com',
  'franlag47@gmail.com','fredstefanelli@hotmail.com','gabirossetto.gr@gmail.com',
  'gabriel.baines@gmail.com','gabrieladesouzafeitosa@gmail.com','gabrielburg11@hotmail.com',
  'gabrielsg033@gmail.com','gabrielteodoro261@gmail.com','gabrielyuriadv@gmail.com',
  'gama.hilton@gmail.com','gcamuttoni@gmail.com','gianpaolomsperanza@gmail.com',
  'gibamendes@hotmail.com','gildomunhoz@yahoo.com.br','gilmarpomponi@hotmail.com',
  'giselibarbara@gmail.com','gistar@uol.com.br','gpolessa@gmail.com',
  'grael.representacao@gmail.com','grupooficialsai@gmail.com','guilherme808c@hotmail.com',
  'guilherme@gemvidros.com.br','guilherme@gvcaeco.com','guilhermealpa@yahoo.com.br',
  'gupreza99@gmail.com','hafpereira@gmail.com','hannahgomes@hotmail.com',
  'hasse1500.ghds@gmail.com','hazinharibeiro@hotmail.com','heinzen67@hotmail.com',
  'helaynesalles@bol.com.br','helio.cps21@gmail.com','heliorob@yahoo.com.br',
  'helpcgb13@gmail.com','helysflabiojr@gmail.com','henriqepiovezan@gmail.com',
  'henriquelima10051@gmail.com','hftcpessoal@gmail.com','hilquias_san@hotmail.com',
  'hoowerson0317@gmail.com','hudsonpenajo@gmail.com','hullyteixeira@hotmail.com',
  'iandra.piedade@hotmail.com','ianyneumann21@gmail.com','igoralmadadev@gmail.com',
  'inaiarasantos@yahoo.com.br','isaafonseca@gmail.com','isesa4@gmail.com',
  'istivy@gmail.com','italo.empresa2000@hotmail.com','itarodrigo@gmail.com',
  'ivacyfonseca@gmail.com','jabezlogstica@gmail.com','jackferreiraoliveira@yahoo.com.br',
  'jailane.ms@gmail.com','jairosantos@jairosantos.adv.br','jaksonwitlar@gmail.com',
  'janeviazevedo@gmail.com','janio_alt@hotmail.com','jaquelinesantana33@gmail.com',
  'jardelhenriquek@gmail.com','jcbtreinamento@gmail.com','jeanaraujos@icloud.com',
  'jeancantuario15@gmail.com','jeanetecova@hotmail.com','jeanvitorjj@gmail.com',
  'jeffit.moraes1@gmail.com','jeova.mail@gmail.com','jeovasje@hotmail.com',
  'jesse.piresjr@gmail.com','jeymison@icloud.com','jjoaovvictor@hotmail.com',
  'joao.ataleia@gmail.com','joao.vitor.francaf125@gmail.com','joaoantmatias@gmail.com',
  'joaohebert@hotmail.com','joaohenriqueportela509@gmail.com','joaomarlonquintodealmeida@gmail.com',
  'joaonunesneto@icloud.com','jocenilda.souza@yahoo.com.br','joelsonadvo@gmail.com',
  'joiaralhan@gmail.com','jonasf.araujo@hotmail.com','jonatas_nx4@hotmail.com',
  'jonathasataide@gmail.com','joseantonelli3@gmail.com','josedossantos5223@gmail.com',
  'joseemidios.56@gmail.com','josuebastoscunha@gmail.com','josuepirescorretor@gmail.com',
  'jota3eng@gmail.com','jp.santanna@hotmail.com','jrnuneslopes@gmail.com',
  'jrs.engcivil@gmail.com','jrsantana0610@gmail.com','judiron@hotmail.com',
  'juliane.mineracao@gmail.com','juliano.evangelista@icloud.com','julio_joka@hotmail.com',
  'juniorhedlund20@gmail.com','jvercosa@outlook.com','kael_msc@hotmail.com',
  'kaloanmartinez@gmail.com','karinavmiranda@gmail.com','katiasoares2003@gmail.com',
  'kayocosta0@gmail.com','kbessa30@gmail.com','kedma_enf@hotmail.com',
  'keilicosta.arq@gmail.com','kleython50@gmail.com','kmpe22@yahoo.com.br',
  'landym24@yahoo.com.br','larissarossi@hotmail.com','lauropedraza@gmail.com',
  'leandrobizelli79@gmail.com','lemalanski91@hotmail.com','leonardo.ofreire@hotmail.com',
  'leonardofigueredonv1996@gmail.com','leonovaes61@hotmail.com','levytorres071999@gmail.com',
  'lila_cabralzinha@hotmail.com','lindsaydestefani@gmail.com','li_ballivian@hotmail.com',
  'li_costa1001@outlook.com','lmaa9691@gmail.com','lnagamin59@gmail.com',
  'lojalanmidia@gmail.com','lorieny.ferreira@hotmail.com','luagostinho78@gmail.com',
  'luanaalhoc@gmail.com','luanmen14@gmail.com','lucagean31@gmail.com',
  'lucas08@gmail.com','lucasacardoso@hotmail.com','lucasnormande@uol.com.br',
  'lucaspintebem@gmail.com','lucasrgouveia@gmail.com','lucas_spezialle@hotmail.com',
  'luciajander27@gmail.com','lucianodedeus@gmail.com','lucimfernandes@gmail.com',
  'lucosta.almeidacosta@gmail.com','lufsp@yahoo.com','luiz.freitas@3lamazon.com.br',
  'luizaoveiculos@hotmail.com.br','luizguilherme842@gmail.com','luizjamaral@gmail.com',
  'luizsouzar8@gmail.com','lumemora@hotmail.com','lupijr@hotmail.com',
  'luvictorrighetti@gmail.com','magdavinhosa@hotmail.com','magnoricardo79@gmail.com',
  'maia.ric@hotmail.com','makleysh@gmail.com','malhmvsc@hotmail.com',
  'manolo1@terra.com.br','maraarqui02@gmail.com','maralu.meira@hotmail.com',
  'marcelacavalcanti.aec@gmail.com','marcelmr@yahoo.com','marcelo.dimer@bomfuturo.com.br',
  'marceloadriano2000@gmail.com','marcelowpereira@gmail.com','marciadlt@hotmail.com',
  'marcialet2008@hotmail.com','marcio.controlecontabil@gmail.com','marco-a-casagrande@hotmail.com',
  'marcoliveirab@gmail.com','marcos.bonatti@hotmail.com','marcosantoniogarciajr@gmail.com',
  'mariamendesjdsconstrutora@gmail.com','marimenzoti@gmail.com','marquesrui@outlook.com',
  'marrcioroberto@gmail.com','martamonsuethmonsueth@gmail.com','martinsneide2301@gmail.com',
  'mateuslinekeeer06@gmail.com','mateusrg178@gmail.com','matheus10r76@gmail.com',
  'matheusafoltda@gmail.com','matheusbecke23@hotmail.com','matheusfr22silva@gmail.com',
  'matheusochi20029@gmail.com','matheustrader98@hotmail.com','mauricioagerelli@gmail.com',
  'max.maranhense@gmail.com','maxcostaterra@gmail.com','maxmiliano.felipe@gmail.com',
  'medmts@hotmail.com','megpizzani@gmail.com','mekodorea@gmail.com',
  'melmaia_arq@hotmail.com','mendesgilbertobatista@gmail.com','messias_25b@hotmail.com',
  'mikael_adriano@hotmail.com','mikenovaes@gmail.com','mikequintao@hotmail.com',
  'mm.armelin@gmail.com','mnunes.ti@gmail.com','moises_elias07@hotmail.com',
  'monique.galvao@gmail.com','monstergplay300@gmail.com','moraes.ajp@gmail.com',
  'mricardojorge@yahoo.com.br','mtsarah14@gmail.com','murilo@whmtelecom.com.br',
  'mvcp.eng@gmail.com','mxleo3d@gmail.com','nataliapaivatavares@gmail.com',
  'nayarabarrostils@gmail.com','nenoxs@gmail.com','nery@multiplariopreto.com.br',
  'neuton.oliveira4@gmail.com','nikaelrocha@yahoo.com.br','nobertos213@gmail.com',
  'nonatorosal@gmail.com','normelia61@gmail.com','nromeniacosta@hotmail.com',
  'oldai@hotmail.com','otacilio.liboriobrokers@gmail.com','palomabrito_@hotmail.com',
  'paulinomarcio657@gmail.com','paulo.dantasbjj@gmail.com','paulo.valencacosta@gmail.com',
  'paulocer81@gmail.com','paulofilhovieira@gmail.com','paulohenriquegalo@gmail.com',
  'paulomonteiro28011005@gmail.com','paulovictor.pinheiro@hotmail.com','pdrios@gmail.com',
  'pedro.chesine@gmail.com','pedrocavallcante@yahoo.com.br','pedrofmanco@outlook.com.br',
  'pedrojbertinato@gmail.com','pedrolira351@gmail.com','pedropipino17@gmail.com',
  'pedrosodre2709@gmail.com','phvolkmann@hotmail.com','pjblima@gmail.com',
  'poliana.mara@gmail.com','pramalhoufpi@yahoo.com.br','prattes.adriana@gmail.com',
  'pri.simon2@gmail.com','pseelig@gmail.com','psicologovitorluciano@gmail.com',
  'r-ricardocosta@hotmail.com','ra.auditoria@gmail.com','rafa.abessantos@gmail.com',
  'rafael12junior@hotmail.com','rafaelcdobner@gmail.com','rafaelfuentesfernandes@gmail.com',
  'rafaelmsdias@hotmail.com','rafcosta@hotmail.com','raimundocb2016@gmail.com',
  'ramon_mazevedo@hotmail.com','rbaiochi@yahoo.com.br','rcflima.skipp@gmail.com',
  'reclean2014@gmail.com','reinaldomjr@hotmail.com','renankempa@gmail.com',
  'renatocnogueirac@yahoo.com.br','renatokavalcanti@gmail.com','renatomeneses250@gmail.com',
  'renatorogerio2@hotmail.com','ribeiro.jardim66@gmail.com','ricardo.splitcenter@gmail.com',
  'ricardorodini@gmail.com','ricfmattos@yahoo.com.br','rickcostadp@gmail.com',
  'rivanilsoncabral33@gmail.com','rmo.rodrigo@hotmail.com','robertobrilhantecorrea@gmail.com',
  'robertor.gomes@hotmail.com','robertoroma@robertoroma.com.br','rochamogno@gmail.com',
  'rodolfo.ori@gmail.com','rodolphoemrichh@outlook.com','rogeriokrmmg@gmail.com',
  'romulomossoro@hotmail.com','ronaldojseverino@hotmail.com','ronaldorodroguea@gmail.com',
  'rossajuliocesar@gmail.com','roupasrosachoc@gmail.com','rpcovre84@gmail.com',
  'rpl_candian@hotmail.com','rrafaelcoelho@hotmail.com','rudson_carvalho@hotmail.com',
  'salleskarinasilva@gmail.com','samuels192002@gmail.com','saque107@yahoo.com',
  'sbritoclaudinei@gmail.com','selva7cardoso7@gmail.com','showkads@outlook.com',
  'si.diniz@hotmail.com','silviacristinakurtz@gmail.com','solangemion@gmail.com',
  'solicitaxx@gmail.com','sousariva@gmail.com','sp-sul@hotmail.com',
  'squillace1990@gmail.com','suyannemt@hotmail.com','talesvo@gmail.com',
  'tatiana.amorims@gmail.com','tay.bosss@hotmail.com','telmosulymana20@gmail.com',
  'thallysfmoraes@hotmail.com','thiago.eu1@gmail.com','thiagocayresfioravante@gmail.com',
  'thiagotkr@gmail.com','tiagocortezao.engcivil@gmail.com','tiago_tma@hotmail.com',
  'tomasarruda137@gmail.com','ufviegasarquitetura@gmail.com','valeriahoinhasadv@gmail.com',
  'vdosanjos930@gmail.com','venceslau.mateus96@hotmail.com','vera.sn.lucia@gmail.com',
  'vereadorallanpedrosa@gmail.com','victorhgsv@gmail.com','victormarinho.gerencia@gmail.com',
  'viniciusaugusto1350@gmail.com','viniciuskalil.eng@outlook.com','vinniciusmatheus.mls@gmail.com',
  'vitorbrando@live.com','wanderley.aragao36@gmail.com','wanellyvieira@gmail.com',
  'wavemastercomputer@hotmail.com','welbyelejandre@gmail.com','weslleygerencial@yahoo.com',
  'wilian.doarte@hotmail.com','will.santos.azevedo@gmail.com','william_basis@yahoo.com.br',
  'willyanbarbosaleal@gmail.com','wscoelhoeng@gmail.com','xandygm6@hotmail.com',
  'yagonetrix@gmail.com','zeca.erdmann@gmail.com'
];

const TAG_NAME = 'Lead-Lançamento';

// Helper to chunk array
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Starting distribution for ${EMAIL_LIST.length} emails`);

    // 1. Fetch contacts by email in batches (to avoid URL too long)
    const emailBatches = chunkArray(EMAIL_LIST.map(e => e.toLowerCase()), 50);
    const allContacts: { id: string; email: string }[] = [];

    for (const batch of emailBatches) {
      const { data: contacts, error: contactsError } = await supabase
        .from('crm_contacts')
        .select('id, email')
        .in('email', batch);

      if (contactsError) {
        console.error('Error fetching contacts batch:', contactsError);
        continue;
      }

      if (contacts) {
        allContacts.push(...contacts);
      }
    }

    console.log(`Found ${allContacts.length} contacts`);

    if (allContacts.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No contacts found matching the email list',
        updated: 0 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const contactIds = allContacts.map(c => c.id);

    // 2. Fetch orphan deals for these contacts in batches
    const contactBatches = chunkArray(contactIds, 100);
    const allOrphanDeals: { id: string; name: string; contact_id: string; tags: string[] | null }[] = [];

    for (const batch of contactBatches) {
      const { data: deals, error: dealsError } = await supabase
        .from('crm_deals')
        .select('id, name, contact_id, tags')
        .is('owner_id', null)
        .in('contact_id', batch);

      if (dealsError) {
        console.error('Error fetching deals batch:', dealsError);
        continue;
      }

      if (deals) {
        allOrphanDeals.push(...deals);
      }
    }

    console.log(`Found ${allOrphanDeals.length} orphan deals`);

    if (allOrphanDeals.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No orphan deals found to distribute',
        updated: 0,
        contacts_found: allContacts.length
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 3. Shuffle deals randomly for fair distribution
    const shuffledDeals = [...allOrphanDeals].sort(() => Math.random() - 0.5);

    // 4. Distribute deals equally using round-robin
    const assignments: { dealId: string; sdr: typeof SDR_CONFIG[0]; deal: typeof allOrphanDeals[0] }[] = [];

    for (let i = 0; i < shuffledDeals.length; i++) {
      const deal = shuffledDeals[i];
      const sdrIndex = i % SDR_CONFIG.length;
      const sdr = SDR_CONFIG[sdrIndex];
      assignments.push({ dealId: deal.id, sdr, deal });
    }

    // 5. Update deals with owner and tag
    const results = { updated: 0, activities: 0, errors: [] as string[] };

    for (const { dealId, sdr, deal } of assignments) {
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
          description: `Atribuído para ${sdr.name} via distribuição de lista específica`,
          metadata: {
            new_owner: sdr.email,
            new_owner_name: sdr.name,
            new_owner_profile_id: sdr.profileId,
            tag_added: TAG_NAME,
            distributed_at: new Date().toISOString(),
            batch_operation: 'specific-list-distribution'
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

    console.log(`Distribution complete: ${results.updated} deals updated`);

    return new Response(JSON.stringify({
      success: true,
      message: `Distributed ${results.updated} deals to ${SDR_CONFIG.length} SDRs equally`,
      updated: results.updated,
      activities_created: results.activities,
      contacts_found: allContacts.length,
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
