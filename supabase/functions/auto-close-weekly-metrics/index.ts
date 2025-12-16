import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Emily's user ID for notifications
const EMILY_USER_ID = '3e91331b-dc4c-4126-83e8-4435e3cc9b76';

function getWeekBounds(date: Date): { start: string; end: string; label: string } {
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
  
  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  const formatLabel = (d: Date) => `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  
  return {
    start: formatDate(saturday),
    end: formatDate(friday),
    label: `${formatLabel(saturday)} - ${formatLabel(friday)}/${friday.getFullYear()}`
  };
}

function getPreviousWeekBounds(): { start: string; end: string; label: string } {
  const now = new Date();
  // Voltar 7 dias para pegar a semana anterior
  now.setDate(now.getDate() - 7);
  return getWeekBounds(now);
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
    const previousWeek = getPreviousWeekBounds();
    
    console.log(`🔄 Auto-close iniciado para semana: ${previousWeek.label}`);
    console.log(`   Período: ${previousWeek.start} até ${previousWeek.end}`);

    // Verificar se já existe registro para essa semana
    const { data: existingMetric, error: checkError } = await supabase
      .from('weekly_metrics')
      .select('id, approval_status')
      .eq('week_start', previousWeek.start)
      .maybeSingle();

    if (checkError) {
      throw new Error(`Erro ao verificar métricas existentes: ${checkError.message}`);
    }

    if (existingMetric) {
      console.log(`⚠️ Métricas já existem para semana ${previousWeek.label}`);
      console.log(`   Status: ${existingMetric.approval_status}`);
      
      // Se já existe e está aprovada, não fazer nada
      if (existingMetric.approval_status === 'approved') {
        return new Response(
          JSON.stringify({
            success: true,
            message: `Métricas já aprovadas para semana ${previousWeek.label}`,
            skipped: true
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Se está pendente, apenas notificar novamente
      if (existingMetric.approval_status === 'pending') {
        await createNotification(supabase, previousWeek.label, existingMetric.id);
        return new Response(
          JSON.stringify({
            success: true,
            message: `Notificação reenviada para métricas pendentes da semana ${previousWeek.label}`,
            notified: true
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Chamar calculate-weekly-metrics para calcular os valores
    console.log(`📊 Calculando métricas da semana ${previousWeek.label}...`);
    
    const calcResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/calculate-weekly-metrics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        week_start: previousWeek.start,
        week_end: previousWeek.end,
      }),
    });

    if (!calcResponse.ok) {
      const errorText = await calcResponse.text();
      throw new Error(`Erro ao calcular métricas: ${errorText}`);
    }

    const calcResult = await calcResponse.json();
    console.log(`✅ Métricas calculadas com sucesso`);

    // Atualizar o registro para status 'pending'
    const { data: updatedMetric, error: updateError } = await supabase
      .from('weekly_metrics')
      .update({ approval_status: 'pending' })
      .eq('week_start', previousWeek.start)
      .select('id')
      .single();

    if (updateError) {
      console.error(`⚠️ Erro ao atualizar status: ${updateError.message}`);
    }

    // Criar notificação para Emily
    const metricId = updatedMetric?.id || existingMetric?.id;
    await createNotification(supabase, previousWeek.label, metricId);

    console.log(`🎉 Auto-close concluído com sucesso!`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Métricas da semana ${previousWeek.label} calculadas e aguardando aprovação`,
        week: previousWeek,
        metric_id: metricId
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro no auto-close:', error);
    
    // Notificar Emily sobre o erro
    try {
      const supabaseForNotification = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      await supabaseForNotification.from('user_notifications').insert({
        user_id: EMILY_USER_ID,
        title: '❌ Erro no Fechamento Semanal',
        message: `Ocorreu um erro ao calcular as métricas da semana: ${error.message}`,
        type: 'warning',
        action_url: '/',
        metadata: { error: error.message }
      });
    } catch (notifyError) {
      console.error('Erro ao notificar sobre falha:', notifyError);
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function createNotification(supabase: any, weekLabel: string, metricId: string | null) {
  try {
    // Verificar se já existe notificação não lida para esta semana
    const { data: existingNotification } = await supabase
      .from('user_notifications')
      .select('id')
      .eq('user_id', EMILY_USER_ID)
      .eq('read', false)
      .ilike('title', `%${weekLabel}%`)
      .maybeSingle();

    if (existingNotification) {
      console.log(`📬 Notificação já existe para semana ${weekLabel}`);
      return;
    }

    const { error: notifyError } = await supabase
      .from('user_notifications')
      .insert({
        user_id: EMILY_USER_ID,
        title: `📊 Métricas da semana ${weekLabel}`,
        message: `As métricas da semana ${weekLabel} foram calculadas automaticamente e aguardam sua aprovação.`,
        type: 'action_required',
        action_url: '/?approval=pending',
        metadata: { metric_id: metricId, week_label: weekLabel }
      });

    if (notifyError) {
      console.error(`Erro ao criar notificação: ${notifyError.message}`);
    } else {
      console.log(`📬 Notificação enviada para Emily`);
    }
  } catch (error) {
    console.error('Erro ao criar notificação:', error);
  }
}
