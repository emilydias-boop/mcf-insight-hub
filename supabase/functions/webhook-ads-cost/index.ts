import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function parseDate(dateStr: string): string {
  // Mapeamento de meses em português
  const monthsPT: Record<string, string> = {
    'janeiro': '01',
    'fevereiro': '02',
    'março': '03',
    'abril': '04',
    'maio': '05',
    'junho': '06',
    'julho': '07',
    'agosto': '08',
    'setembro': '09',
    'outubro': '10',
    'novembro': '11',
    'dezembro': '12'
  };

  // Formato português: "9 de março de 2025 às 00:00"
  const ptMatch = dateStr.match(/^(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
  if (ptMatch) {
    const day = ptMatch[1].padStart(2, '0');
    const monthName = ptMatch[2].toLowerCase();
    const year = ptMatch[3];
    const month = monthsPT[monthName];
    
    if (month) {
      return `${year}-${month}-${day}`;
    }
  }
  
  // Se já está no formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // Se está no formato DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split('/');
    return `${year}-${month}-${day}`;
  }
  
  // Se está no formato ISO (com T e timezone)
  if (dateStr.includes('T')) {
    return dateStr.split('T')[0];
  }
  
  throw new Error(`Formato de data não reconhecido: ${dateStr}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const payload = await req.json();
    console.log('📊 Recebendo custo de ads:', payload);

    const { date, amount, source = 'facebook', campaign_name } = payload;

    if (!date || amount === undefined) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: date, amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse amount se vier como string brasileira
    let parsedAmount = typeof amount === 'string' 
      ? parseFloat(amount.replace(/[^\d,]/g, '').replace(',', '.'))
      : amount;

    // Detectar se o valor está em centavos (Facebook API envia valores em centavos)
    // Se o valor é muito alto (>100k) e é inteiro, provavelmente está em centavos
    if (typeof parsedAmount === 'number' && parsedAmount > 100000 && Number.isInteger(parsedAmount)) {
      console.log(`⚠️ Valor detectado em centavos: R$ ${parsedAmount} → R$ ${parsedAmount / 100}`);
      parsedAmount = parsedAmount / 100;
    }

    // Parse da data para formato YYYY-MM-DD
    let parsedDate: string;
    try {
      parsedDate = parseDate(date);
      console.log(`📅 Data convertida: ${date} → ${parsedDate}`);
    } catch (error) {
      console.error('❌ Erro ao converter data:', error);
      return new Response(
        JSON.stringify({ error: `Invalid date format: ${date}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upsert no banco
    const { data, error } = await supabase
      .from('daily_costs')
      .upsert({
        date: parsedDate,
        cost_type: 'ads',
        source,
        amount: parsedAmount,
        campaign_name,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'date,cost_type,source'
      })
      .select();

    if (error) {
      console.error('❌ Erro ao inserir custo:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Custo registrado:', data);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Custo de ads registrado com sucesso',
        data 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro no webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
