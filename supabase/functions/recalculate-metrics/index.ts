import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getWeekBounds(date: Date): { start: string; end: string } {
  // Semana customizada: Sábado até Sexta
  const dayOfWeek = date.getDay(); // 0 = Dom, 6 = Sáb
  
  // Calcular quantos dias voltar até o sábado
  const daysToSaturday = dayOfWeek === 6 ? 0 : (dayOfWeek + 1);
  
  const saturday = new Date(date);
  saturday.setDate(date.getDate() - daysToSaturday);
  saturday.setHours(0, 0, 0, 0);
  
  const friday = new Date(saturday);
  friday.setDate(saturday.getDate() + 6);
  friday.setHours(23, 59, 59, 999);
  
  return {
    start: saturday.toISOString().split('T')[0],
    end: friday.toISOString().split('T')[0],
  };
}

function* generateWeeks(startDate: Date, endDate: Date) {
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const { start, end } = getWeekBounds(current);
    yield { start, end };
    
    // Avançar 7 dias
    current.setDate(current.getDate() + 7);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const payload = await req.json();
    const { start_date, end_date } = payload;

    // Defaults: Jun/2024 até agora
    const startDate = start_date ? new Date(start_date) : new Date('2024-06-01');
    const endDate = end_date ? new Date(end_date) : new Date();

    console.log(`🔄 Recalculando métricas de ${startDate.toISOString()} até ${endDate.toISOString()}`);

    const weeks = Array.from(generateWeeks(startDate, endDate));
    console.log(`📅 Total de semanas: ${weeks.length}`);

    let processed = 0;
    let errors = 0;

    // Processar em lotes de 5 semanas para evitar timeout
    for (let i = 0; i < weeks.length; i += 5) {
      const batch = weeks.slice(i, i + 5);
      
      console.log(`\n📊 Processando lote ${i / 5 + 1}/${Math.ceil(weeks.length / 5)}`);
      
      for (const week of batch) {
        try {
          console.log(`   ⏳ ${week.start} - ${week.end}`);
          
          // Chamar calculate-weekly-metrics para cada semana
          const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/calculate-weekly-metrics`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              week_start: week.start,
              week_end: week.end,
            }),
          });

          if (response.ok) {
            processed++;
            console.log(`   ✅ Sucesso`);
          } else {
            errors++;
            const error = await response.text();
            console.error(`   ❌ Erro: ${error}`);
          }
        } catch (error) {
          errors++;
          console.error(`   ❌ Erro ao processar semana:`, error);
        }
      }
    }

    console.log(`\n📈 Resumo do recálculo:`);
    console.log(`   ✅ Processadas: ${processed}`);
    console.log(`   ❌ Erros: ${errors}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `${processed} semanas recalculadas com sucesso`,
        processed,
        errors,
        total: weeks.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro no recálculo:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});