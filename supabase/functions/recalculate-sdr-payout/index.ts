import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Multiplier brackets based on percentage
const getMultiplier = (pct: number): number => {
  if (pct < 71) return 0;
  if (pct <= 85) return 0.5;
  if (pct <= 99) return 0.7;
  if (pct <= 119) return 1;
  return 1.5;
};

// Preços fixos por produto (sincronizado com frontend incorporadorPricing.ts)
const FIXED_GROSS_PRICES: { pattern: string; price: number }[] = [
  { pattern: 'a005', price: 0 },       // MCF P2 não conta no faturamento
  { pattern: 'mcf p2', price: 0 },
  { pattern: 'a009', price: 19500 },   // MCF + The Club
  { pattern: 'a001', price: 14500 },   // MCF Completo
  { pattern: 'a000', price: 497 },     // Contrato
  { pattern: 'contrato', price: 497 },
  { pattern: 'a010', price: 47 },
  { pattern: 'plano construtor', price: 997 },
  { pattern: 'a004', price: 5500 },    // Anticrise Básico
  { pattern: 'a003', price: 7500 },    // Anticrise Completo
];

const getFixedGrossPrice = (productName: string | null, originalPrice: number): number => {
  if (!productName) return originalPrice;
  const normalizedName = productName.toLowerCase().trim();
  
  for (const { pattern, price } of FIXED_GROSS_PRICES) {
    if (normalizedName.includes(pattern)) {
      return price;
    }
  }
  
  return originalPrice;
};

// Cálculo inverso do No-Show
const calculateNoShowPerformance = (noShows: number, agendadas: number): number => {
  if (agendadas <= 0) return 100;
  
  const taxaNoShow = (noShows / agendadas) * 100;
  
  if (taxaNoShow <= 30) {
    return Math.min(150, 100 + ((30 - taxaNoShow) / 30) * 50);
  } else {
    return Math.max(0, 100 - ((taxaNoShow - 30) / 30) * 100);
  }
};

interface CompPlan {
  meta_reunioes_agendadas: number;
  meta_reunioes_realizadas: number;
  meta_tentativas: number;
  meta_organizacao: number;
  valor_meta_rpg: number;
  valor_docs_reuniao: number;
  valor_tentativas: number;
  valor_organizacao: number;
  fixo_valor: number;
  ifood_mensal: number;
  ifood_ultrameta: number;
  dias_uteis: number;
  variavel_total: number;
}

interface Kpi {
  reunioes_agendadas: number;
  reunioes_realizadas: number;
  tentativas_ligacoes: number;
  score_organizacao: number;
  no_shows: number;
}

// Constantes de metas fixas (fallback quando não há métricas configuradas)
const META_TENTATIVAS_DIARIA = 84; // Meta fixa de 84 tentativas por dia
const META_ORGANIZACAO = 100; // Meta fixa de 100%

// Fallback OTE values by SDR level when no comp_plan exists
const DEFAULT_OTE_BY_LEVEL: Record<number, { 
  ote_total: number; 
  fixo_valor: number; 
  variavel_total: number 
}> = {
  1: { ote_total: 4000, fixo_valor: 2800, variavel_total: 1200 },
  2: { ote_total: 4500, fixo_valor: 3150, variavel_total: 1350 },
  3: { ote_total: 5000, fixo_valor: 3500, variavel_total: 1500 },
  4: { ote_total: 5500, fixo_valor: 3850, variavel_total: 1650 },
  5: { ote_total: 6000, fixo_valor: 4200, variavel_total: 1800 },
};

interface MetricaAtiva {
  nome_metrica: string;
  peso_percentual: number;
  meta_valor: number | null;
  meta_percentual: number | null; // Percentual para metas dinâmicas (ex: 30 = 30% das Realizadas)
  fonte_dados: string | null;
}

interface CargoInfo {
  ote_total: number;
  fixo_valor: number;
  variavel_valor: number;
}

// NOTE: calculateCloserPayoutValues foi removido (dead code - nunca era chamado).
// O cálculo real de Closers é feito inline no loop principal (linhas ~1063-1212).

const calculatePayoutValues = (
  compPlan: CompPlan, 
  kpi: Kpi, 
  sdrMetaDiaria: number, 
  calendarIfoodMensal?: number, 
  diasUteisMes?: number, 
  isCloser: boolean = false,
  metricasAtivas?: MetricaAtiva[]
) => {
  // Dias úteis do mês (do calendário ou padrão)
  const diasUteisReal = diasUteisMes || compPlan.dias_uteis || 19;

  // Verificar se há métricas ativas configuradas
  const hasActiveMetrics = metricasAtivas && metricasAtivas.length > 0;
  
  // Se há métricas ativas, usar apenas as configuradas
  const metricaAgendadas = metricasAtivas?.find(m => m.nome_metrica === 'agendamentos');
  const metricaRealizadas = metricasAtivas?.find(m => m.nome_metrica === 'realizadas');
  const metricaTentativas = metricasAtivas?.find(m => m.nome_metrica === 'tentativas');
  const metricaOrganizacao = metricasAtivas?.find(m => m.nome_metrica === 'organizacao');
  const metricaContratos = metricasAtivas?.find(m => m.nome_metrica === 'contratos');

  // Meta de agendadas = meta_diaria do SDR × dias úteis do mês
  const metaAgendadasAjustada = Math.round((sdrMetaDiaria || 0) * diasUteisReal);
  
  // Meta de Realizadas = 70% das agendadas REAIS (sincronizado com frontend)
  const metaRealizadasAjustada = Math.round((kpi.reunioes_agendadas || 0) * 0.7);
  
  // Meta de Tentativas = 84/dia × dias úteis (meta fixa para todos) - APENAS SDR
  const metaTentativasAjustada = isCloser ? 0 : Math.round(META_TENTATIVAS_DIARIA * diasUteisReal);

  // Calcular percentuais
  const pct_reunioes_agendadas = metaAgendadasAjustada > 0 
    ? (kpi.reunioes_agendadas / metaAgendadasAjustada) * 100 
    : 0;
  const pct_reunioes_realizadas = metaRealizadasAjustada > 0
    ? (kpi.reunioes_realizadas / metaRealizadasAjustada) * 100
    : 0;
  
  // Tentativas e Organização: ZERAR para Closers (não se aplicam)
  const pct_tentativas = isCloser ? 100 : (metaTentativasAjustada > 0
    ? (kpi.tentativas_ligacoes / metaTentativasAjustada) * 100
    : 0);
  // Organização = meta fixa de 100% - para Closers, considerar 100% automaticamente
  const pct_organizacao = isCloser ? 100 : (kpi.score_organizacao / META_ORGANIZACAO) * 100;

  const pct_no_show = calculateNoShowPerformance(kpi.no_shows || 0, kpi.reunioes_agendadas || 0);

  const cappedPctAgendadas = Math.min(pct_reunioes_agendadas, 120);
  const cappedPctRealizadas = Math.min(pct_reunioes_realizadas, 120);
  const cappedPctTentativas = isCloser ? 100 : Math.min(pct_tentativas, 120);
  const cappedPctOrganizacao = isCloser ? 100 : Math.min(pct_organizacao, 120);
  const cappedPctNoShow = Math.min(pct_no_show, 120);

  const mult_reunioes_agendadas = getMultiplier(cappedPctAgendadas);
  const mult_reunioes_realizadas = getMultiplier(cappedPctRealizadas);
  const mult_tentativas = isCloser ? 1 : getMultiplier(cappedPctTentativas);
  const mult_organizacao = isCloser ? 1 : getMultiplier(cappedPctOrganizacao);
  const mult_no_show = getMultiplier(cappedPctNoShow);

  // Calcular valores finais
  // Se há métricas ativas configuradas, usar pesos proporcionais
  let valor_reunioes_agendadas: number;
  let valor_reunioes_realizadas: number;
  let valor_tentativas: number;
  let valor_organizacao: number;

  if (hasActiveMetrics) {
    // Usar variavel_total do compPlan como fonte da verdade, com fallback para soma dos valores individuais
    const variavelTotal = compPlan.variavel_total || 
      (compPlan.valor_meta_rpg + compPlan.valor_docs_reuniao + 
       compPlan.valor_tentativas + compPlan.valor_organizacao);
    
    // Aplicar pesos das métricas ativas
    const pesoAgendadas = metricaAgendadas?.peso_percentual || 0;
    const pesoRealizadas = metricaRealizadas?.peso_percentual || 0;
    const pesoTentativas = metricaTentativas?.peso_percentual || 0;
    const pesoOrganizacao = metricaOrganizacao?.peso_percentual || 0;
    const pesoTotal = pesoAgendadas + pesoRealizadas + pesoTentativas + pesoOrganizacao;
    
    // PRIORIZAR valores específicos do compPlan > cálculo dinâmico por peso
    // Se o valor específico no plano individual for maior que zero, usá-lo
    // Caso contrário, usar o cálculo dinâmico baseado no peso percentual
    
    if (compPlan.valor_meta_rpg > 0) {
      valor_reunioes_agendadas = compPlan.valor_meta_rpg * mult_reunioes_agendadas;
    } else if (pesoAgendadas > 0) {
      valor_reunioes_agendadas = (variavelTotal * (pesoAgendadas / 100)) * mult_reunioes_agendadas;
    } else {
      valor_reunioes_agendadas = 0;
    }
    
    if (compPlan.valor_docs_reuniao > 0) {
      valor_reunioes_realizadas = compPlan.valor_docs_reuniao * mult_reunioes_realizadas;
    } else if (pesoRealizadas > 0) {
      valor_reunioes_realizadas = (variavelTotal * (pesoRealizadas / 100)) * mult_reunioes_realizadas;
    } else {
      valor_reunioes_realizadas = 0;
    }
    
    if (!isCloser && compPlan.valor_tentativas > 0) {
      valor_tentativas = compPlan.valor_tentativas * mult_tentativas;
    } else if (pesoTentativas > 0 && !isCloser) {
      valor_tentativas = (variavelTotal * (pesoTentativas / 100)) * mult_tentativas;
    } else {
      valor_tentativas = 0;
    }
    
    if (!isCloser && compPlan.valor_organizacao > 0) {
      valor_organizacao = compPlan.valor_organizacao * mult_organizacao;
    } else if (pesoOrganizacao > 0 && !isCloser) {
      valor_organizacao = (variavelTotal * (pesoOrganizacao / 100)) * mult_organizacao;
    } else {
      valor_organizacao = 0;
    }
    
    console.log(`   💰 Valores calculados (prioridade compPlan): Agendadas=R$ ${valor_reunioes_agendadas.toFixed(2)}, Realizadas=R$ ${valor_reunioes_realizadas.toFixed(2)}, Tentativas=R$ ${valor_tentativas.toFixed(2)}, Org=R$ ${valor_organizacao.toFixed(2)}`);
  } else {
    // Sem métricas ativas, usar valores fixos do comp_plan
    valor_reunioes_agendadas = compPlan.valor_meta_rpg * mult_reunioes_agendadas;
    valor_reunioes_realizadas = compPlan.valor_docs_reuniao * mult_reunioes_realizadas;
    valor_tentativas = isCloser ? 0 : compPlan.valor_tentativas * mult_tentativas;
    valor_organizacao = isCloser ? 0 : compPlan.valor_organizacao * mult_organizacao;
  }

  const valor_variavel_total = valor_reunioes_agendadas + valor_reunioes_realizadas + valor_tentativas + valor_organizacao;
  const valor_fixo = compPlan.fixo_valor;
  const total_conta = valor_fixo + valor_variavel_total;

  // Para Closers: média global considera apenas 2 indicadores (agendadas e realizadas)
  const pct_media_global = isCloser
    ? (cappedPctAgendadas + cappedPctRealizadas) / 2
    : (cappedPctAgendadas + cappedPctRealizadas + cappedPctTentativas + cappedPctOrganizacao) / 4;
  const ifood_mensal = calendarIfoodMensal ?? compPlan.ifood_mensal;
  const ifood_ultrameta = pct_media_global >= 100 ? compPlan.ifood_ultrameta : 0;
  const total_ifood = ifood_mensal + ifood_ultrameta;

  return {
    pct_reunioes_agendadas,
    pct_reunioes_realizadas,
    pct_tentativas,
    pct_organizacao,
    pct_no_show,
    mult_reunioes_agendadas,
    mult_reunioes_realizadas,
    mult_tentativas,
    mult_organizacao,
    mult_no_show,
    valor_reunioes_agendadas,
    valor_reunioes_realizadas,
    valor_tentativas,
    valor_organizacao,
    valor_variavel_total,
    valor_fixo,
    total_conta,
    ifood_mensal,
    ifood_ultrameta,
    total_ifood,
    // Metas ajustadas para salvar no payout
    meta_agendadas_ajustada: metaAgendadasAjustada,
    meta_realizadas_ajustada: metaRealizadasAjustada,
    meta_tentativas_ajustada: metaTentativasAjustada,
    dias_uteis_mes: diasUteisReal,
  };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { sdr_id, ano_mes } = await req.json();

    if (!ano_mes) {
      return new Response(
        JSON.stringify({ error: 'ano_mes is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔄 Recalculando payout para ${sdr_id ? `SDR ${sdr_id}` : 'todos os SDRs'} no mês ${ano_mes}`);

    // Fetch working days calendar for this month
    const { data: calendarData, error: calendarError } = await supabase
      .from('working_days_calendar')
      .select('ifood_mensal_calculado, dias_uteis_final, ifood_valor_dia')
      .eq('ano_mes', ano_mes)
      .single();

    if (calendarError && calendarError.code !== 'PGRST116') {
      console.log(`⚠️ Erro ao buscar calendário: ${calendarError.message}`);
    }

    const calendarIfoodMensal = calendarData?.ifood_mensal_calculado ?? null;
    console.log(`📅 Calendário ${ano_mes}: iFood Mensal = ${calendarIfoodMensal ?? 'não definido'}`);

    // ===== BUSCAR METAS DA EQUIPE =====
    // Vamos buscar para todas as BUs e processar por SDR
    const { data: teamGoals } = await supabase
      .from('team_monthly_goals')
      .select('*')
      .eq('ano_mes', ano_mes);
    
    const teamGoalsByBU: Record<string, any> = {};
    (teamGoals || []).forEach(goal => {
      teamGoalsByBU[goal.bu] = goal;
    });
    
    console.log(`📊 Metas de equipe carregadas: ${Object.keys(teamGoalsByBU).join(', ') || 'nenhuma'}`);

    // ===== CALCULAR FATURAMENTO POR BU (mesma lógica do useUltrametaByBU) =====
    const buRevenue: Record<string, number> = {};
    
    // Fetch first transaction IDs for deduplication
    const { data: firstIdsData } = await supabase.rpc('get_first_transaction_ids');
    const firstIdSet = new Set((firstIdsData || []).map((r: { id: string }) => r.id));
    
    // Date calculations for BU revenue
    const [year, month] = ano_mes.split('-').map(Number);
    const monthStartDate = new Date(year, month - 1, 1);
    const monthEndDate = new Date(year, month, 0);
    const monthStartStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = monthEndDate.getDate();
    const monthEndStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    
    // Format dates for RPC with timezone
    const formatDateForRpc = (date: Date, isEndOfDay = false): string => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const time = isEndOfDay ? '23:59:59' : '00:00:00';
      return `${y}-${m}-${d}T${time}-03:00`;
    };
    
    // Incorporador revenue
    const { data: incorporadorTxs } = await supabase.rpc('get_all_hubla_transactions', {
      p_start_date: formatDateForRpc(monthStartDate),
      p_end_date: formatDateForRpc(monthEndDate, true),
      p_limit: 10000,
      p_search: null,
      p_products: null,
    });
    
    // Calculate incorporador with deduplication (sincronizado com frontend)
    const getDeduplicatedGross = (tx: any, isFirst: boolean): number => {
      // Regra 1: Parcela > 1 sempre tem bruto zerado
      const installment = tx.installment_number || 1;
      if (installment > 1) {
        return 0;
      }
      
      // Regra 2: Override manual tem prioridade absoluta
      if (tx.gross_override !== null && tx.gross_override !== undefined) {
        return tx.gross_override;
      }
      
      // Regra 3: NÃO é primeira transação do grupo cliente+produto = 0
      if (!isFirst) {
        return 0;
      }
      
      // Regra 4: É primeira - usar preço fixo do produto
      return getFixedGrossPrice(tx.product_name, tx.product_price || 0);
    };
    
    buRevenue['incorporador'] = (incorporadorTxs || []).reduce((sum: number, t: any) => {
      const isFirst = firstIdSet.has(t.id);
      return sum + getDeduplicatedGross(t, isFirst);
    }, 0);
    
    // Consórcio revenue (valor_credito from consortium_cards)
    const { data: consorcioCards } = await supabase
      .from('consortium_cards')
      .select('valor_credito')
      .gte('data_contratacao', monthStartStr)
      .lte('data_contratacao', monthEndStr)
      .not('valor_credito', 'is', null);
    
    buRevenue['consorcio'] = (consorcioCards || []).reduce((sum: number, row: any) => 
      sum + (row.valor_credito || 0), 0);
    
    // Leilão revenue
    const { data: leilaoTxs } = await supabase
      .from('hubla_transactions')
      .select('net_value, product_price, gross_override')
      .eq('product_category', 'clube_arremate')
      .gte('sale_date', monthStartDate.toISOString())
      .lte('sale_date', monthEndDate.toISOString());
    
    buRevenue['leilao'] = (leilaoTxs || []).reduce((sum: number, row: any) => {
      const value = row.gross_override ?? row.product_price ?? row.net_value ?? 0;
      return sum + value;
    }, 0);
    
    buRevenue['credito'] = 0; // No data source yet
    buRevenue['projetos'] = 0;
    
    console.log(`💰 Faturamento por BU: Incorporador=${buRevenue['incorporador']?.toLocaleString()}, Consórcio=${buRevenue['consorcio']?.toLocaleString()}, Leilão=${buRevenue['leilao']?.toLocaleString()}`);
    
    // Check which BUs hit ultrameta/divina
    const buUltrametaHit: Record<string, boolean> = {};
    const buDivinaHit: Record<string, boolean> = {};
    
    Object.keys(teamGoalsByBU).forEach(bu => {
      const goal = teamGoalsByBU[bu];
      const revenue = buRevenue[bu] || 0;
      buUltrametaHit[bu] = revenue >= goal.ultrameta_valor;
      buDivinaHit[bu] = revenue >= goal.meta_divina_valor;
      
      if (buUltrametaHit[bu]) {
        console.log(`🎯 BU ${bu}: ULTRAMETA BATIDA! (${revenue.toLocaleString()} >= ${goal.ultrameta_valor.toLocaleString()})`);
      }
      if (buDivinaHit[bu]) {
        console.log(`🌟 BU ${bu}: META DIVINA BATIDA! (${revenue.toLocaleString()} >= ${goal.meta_divina_valor.toLocaleString()})`);
      }
    });

    // Track payouts for Meta Divina winner calculation
    const processedPayouts: Array<{
      sdr_id: string;
      sdr_name: string;
      squad: string;
      isCloser: boolean;
      pct_media_global: number;
    }> = [];

    // Get SDRs to process (with email and role_type for RPC call)
    let sdrsQuery = supabase.from('sdr').select('id, name, email, meta_diaria, role_type, squad').eq('active', true);
    if (sdr_id) {
      sdrsQuery = sdrsQuery.eq('id', sdr_id);
    }
    
    const { data: sdrs, error: sdrsError } = await sdrsQuery;
    if (sdrsError) throw sdrsError;

    if (!sdrs || sdrs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No SDRs to process', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate date range for the month (reusing year/month from above)
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    console.log(`📅 Período: ${monthStart} até ${monthEnd}`);

    const results = [];
    let processed = 0;
    let errors = 0;

    for (const sdr of sdrs) {
      try {
        const isCloser = sdr.role_type === 'closer';
        console.log(`   ⏳ Processando ${isCloser ? 'Closer' : 'SDR'}: ${sdr.name} (${sdr.id}) - BU: ${sdr.squad || 'N/A'}`);

        // ===== BUSCAR MÉTRICAS - LÓGICA DIFERENTE PARA SDR VS CLOSER =====
        let reunioesAgendadas = 0;
        let noShows = 0;
        let reunioesRealizadas = 0;
        let taxaNoShow = 0;
        let contratosPagos = 0; // Novo: contratos pagos para Closers

        if (sdr.email) {
          if (isCloser) {
            // CLOSER: Buscar o closer_id correspondente na tabela closers pelo email
            const { data: closerRecord } = await supabase
              .from('closers')
              .select('id')
              .eq('email', sdr.email)
              .single();

            if (closerRecord) {
              // Buscar reuniões na meeting_slots pelo closer_id
              const { data: closerSlots, error: slotsError } = await supabase
                .from('meeting_slots')
                .select('id, status, scheduled_at')
                .eq('closer_id', closerRecord.id)
                .gte('scheduled_at', monthStart)
                .lte('scheduled_at', monthEnd);

              if (slotsError) {
                console.log(`   ⚠️ Erro ao buscar slots de Closer para ${sdr.name}: ${slotsError.message}`);
              } else if (closerSlots) {
                // Para Closer: agendadas = total de reuniões alocadas
                reunioesAgendadas = closerSlots.length;
                
                // Buscar attendees para contar realizadas, no-shows e contratos
                const slotIds = closerSlots.map(s => s.id);
                
                if (slotIds.length > 0) {
                  // Buscar attendees desses slots
                  const { data: attendeesData } = await supabase
                    .from('meeting_slot_attendees')
                    .select('id, status, contract_paid_at')
                    .in('slot_id', slotIds);
                  
                  if (attendeesData) {
                    // Realizadas = attendees com status completed, contract_paid ou refunded
                    reunioesRealizadas = attendeesData.filter(a => 
                      ['completed', 'contract_paid', 'refunded'].includes(a.status)
                    ).length;
                    
                    // No-shows = attendees com status no_show
                    noShows = attendeesData.filter(a => a.status === 'no_show').length;
                  }
                }
                
                taxaNoShow = reunioesAgendadas > 0 ? (noShows / reunioesAgendadas) * 100 : 0;
                
                // ===== CONTRATOS PAGOS: Buscar pela DATA DO PAGAMENTO (igual ao hook useCloserAgendaMetrics) =====
                // Método 1: Contratos com contract_paid_at no período (nova lógica)
                const { data: contractsByPaymentDate } = await supabase
                  .from('meeting_slot_attendees')
                  .select('id, status, contract_paid_at, meeting_slot:meeting_slots!inner(closer_id)')
                  .eq('meeting_slot.closer_id', closerRecord.id)
                  .in('status', ['contract_paid', 'refunded'])
                  .not('contract_paid_at', 'is', null)
                  .gte('contract_paid_at', `${monthStart}T00:00:00`)
                  .lte('contract_paid_at', `${monthEnd}T23:59:59`);
                
                const contractsNewCount = contractsByPaymentDate?.length || 0;
                
                // Método 2: Fallback para contratos antigos sem contract_paid_at (usa scheduled_at)
                const { data: contractsLegacy } = await supabase
                  .from('meeting_slot_attendees')
                  .select('id, status, meeting_slot:meeting_slots!inner(closer_id, scheduled_at)')
                  .eq('meeting_slot.closer_id', closerRecord.id)
                  .in('status', ['contract_paid', 'refunded'])
                  .is('contract_paid_at', null)
                  .gte('meeting_slot.scheduled_at', `${monthStart}T00:00:00`)
                  .lte('meeting_slot.scheduled_at', `${monthEnd}T23:59:59`);
                
                const contractsLegacyCount = contractsLegacy?.length || 0;
                
                contratosPagos = contractsNewCount + contractsLegacyCount;
                
                console.log(`   📊 Métricas de Closer para ${sdr.name}: Alocadas=${reunioesAgendadas}, Realizadas=${reunioesRealizadas}, No-Shows=${noShows}`);
                console.log(`   📊 Contratos para ${sdr.name}: Por data pagamento=${contractsNewCount}, Legacy=${contractsLegacyCount}, Total=${contratosPagos}`);
              }
            } else {
              console.log(`   ⚠️ Closer ${sdr.name} não encontrado na tabela closers`);
            }
          } else {
            // SDR: Usar RPC get_sdr_metrics_from_agenda (mesma fonte de dados do frontend)
            const { data: metricsData, error: metricsError } = await supabase.rpc('get_sdr_metrics_from_agenda', {
              start_date: monthStart,
              end_date: monthEnd,
              sdr_email_filter: sdr.email
            });

            if (metricsError) {
              console.log(`   ⚠️ Erro ao buscar métricas RPC para ${sdr.name}: ${metricsError.message}`);
            } else if (metricsData && metricsData.metrics && metricsData.metrics.length > 0) {
              const metrics = metricsData.metrics[0];
              // Campos da RPC get_sdr_metrics_from_agenda
              // IMPORTANTE: usar agendamentos (criados NO período) ao invés de r1_agendada (marcadas PARA o período)
              reunioesAgendadas = metrics.agendamentos || 0;
              reunioesRealizadas = metrics.r1_realizada || 0;
              // NOVA LÓGICA: No-Show = Agendamentos - Realizadas (garantir conta sempre feche)
              noShows = Math.max(0, reunioesAgendadas - reunioesRealizadas);
              taxaNoShow = reunioesAgendadas > 0 ? (noShows / reunioesAgendadas) * 100 : 0;
              
              console.log(`   📊 Métricas da Agenda para ${sdr.name}: Agendadas=${reunioesAgendadas}, No-Shows=${noShows}, Realizadas=${reunioesRealizadas}`);
            } else {
              console.log(`   ⚠️ Nenhuma métrica encontrada na RPC para ${sdr.name}`);
            }
          }
        } else {
          console.log(`   ⚠️ ${isCloser ? 'Closer' : 'SDR'} ${sdr.name} não tem email configurado`);
        }

        // ===== BUSCAR EMPLOYEE PRIMEIRO (necessário para fallback e elegibilidade ultrameta) =====
        const { data: employeeData } = await supabase
          .from('employees')
          .select('cargo_catalogo_id, data_admissao')
          .eq('sdr_id', sdr.id)
          .eq('status', 'ativo')
          .maybeSingle();

        // ===== VERIFICAR ELEGIBILIDADE PARA ULTRAMETA (precisa estar desde o início do mês) =====
        const dataAdmissao = employeeData?.data_admissao 
          ? new Date(employeeData.data_admissao) 
          : null;
        const inicioMes = new Date(year, month - 1, 1);
        // Elegível se entrou antes do início do mês OU se data_admissao é null
        const elegivelUltrameta = !dataAdmissao || dataAdmissao < inicioMes;
        
        if (!elegivelUltrameta) {
          console.log(`   ⏭️ ${sdr.name} NÃO elegível para Ultrameta (admissão em ${dataAdmissao?.toISOString().split('T')[0]})`);
        } else {
          console.log(`   ✅ ${sdr.name} elegível para Ultrameta (admissão: ${dataAdmissao?.toISOString().split('T')[0] || 'antes do período'})`);
        }

        // ===== BUSCAR CARGO_CATALOGO PARA CLOSERS =====
        let cargoInfo: CargoInfo | null = null;
        if (employeeData?.cargo_catalogo_id) {
          const { data: cargoData } = await supabase
            .from('cargos_catalogo')
            .select('ote_total, fixo_valor, variavel_valor')
            .eq('id', employeeData.cargo_catalogo_id)
            .single();
          
          if (cargoData) {
            cargoInfo = cargoData as CargoInfo;
            console.log(`   💼 Cargo: OTE=${cargoInfo.ote_total}, Fixo=${cargoInfo.fixo_valor}, Variável=${cargoInfo.variavel_valor}`);
          }
        }

        // Get comp plan
        const { data: compPlanResult, error: compError } = await supabase
          .from('sdr_comp_plan')
          .select('*')
          .eq('sdr_id', sdr.id)
          .lte('vigencia_inicio', monthStart)
          .or(`vigencia_fim.is.null,vigencia_fim.gte.${monthStart}`)
          .order('vigencia_inicio', { ascending: false })
          .limit(1)
          .single();

        let compPlan = compPlanResult;

        // ===== FALLBACK: Criar comp_plan automático se não existir =====
        if (compError || !compPlan) {
          console.log(`   ⚠️ Plano vigente não encontrado para ${sdr.name}. Criando fallback...`);
          
          // Buscar nivel do SDR
          const { data: sdrFull } = await supabase
            .from('sdr')
            .select('nivel')
            .eq('id', sdr.id)
            .single();
          
          const nivel = sdrFull?.nivel || 1;
          const fallbackDefault = DEFAULT_OTE_BY_LEVEL[nivel] ?? DEFAULT_OTE_BY_LEVEL[1];
          let fallbackValues = { ...fallbackDefault };
          
          // Tentar usar cargo_catalogo se disponível
          if (cargoInfo && cargoInfo.ote_total > 0) {
            fallbackValues = {
              ote_total: cargoInfo.ote_total,
              fixo_valor: cargoInfo.fixo_valor,
              variavel_total: cargoInfo.variavel_valor,
            };
            console.log(`   📋 Usando valores do cargo_catalogo para ${sdr.name}`);
          }
          
          const diasUteis = calendarData?.dias_uteis_final || 22;
          
          // Criar comp_plan implícito para o mês
          const newPlan = {
            sdr_id: sdr.id,
            vigencia_inicio: monthStart,
            vigencia_fim: monthEnd,
            ote_total: fallbackValues.ote_total,
            fixo_valor: fallbackValues.fixo_valor,
            variavel_total: fallbackValues.variavel_total,
            // Pesos corretos: Agendadas 35%, Realizadas 55%, Tentativas 0%, Organização 10%
            valor_meta_rpg: Math.round(fallbackValues.variavel_total * 0.35),
            valor_docs_reuniao: Math.round(fallbackValues.variavel_total * 0.55),
            valor_tentativas: 0,
            valor_organizacao: Math.round(fallbackValues.variavel_total * 0.10),
            // iFood por nível: SDR 2 = R$ 570, outros = R$ 600
            ifood_mensal: nivel === 2 ? 570 : 600,
            ifood_ultrameta: 50,
            meta_reunioes_agendadas: 15,
            meta_reunioes_realizadas: 12,
            meta_tentativas: 400,
            meta_organizacao: 100,
            dias_uteis: diasUteis,
            meta_no_show_pct: 30,
            status: 'APPROVED',
          };
          
          const { data: createdPlan, error: createError } = await supabase
            .from('sdr_comp_plan')
            .insert(newPlan)
            .select()
            .single();
          
          if (createError) {
            console.error(`   ❌ Erro ao criar comp_plan fallback: ${createError.message}`);
            continue;
          }
          
          compPlan = createdPlan;
          console.log(`   ✅ Comp plan fallback criado para ${sdr.name} (Nível ${nivel}): OTE R$${fallbackValues.ote_total}`);
        }

        // ===== BUSCAR MÉTRICAS ATIVAS CONFIGURADAS (COM FALLBACK PARA meta_percentual) =====
        let metricasAtivas: MetricaAtiva[] = [];
        if (employeeData?.cargo_catalogo_id) {
          let metricas: MetricaAtiva[] | null = null;
          let metricasGenericas: MetricaAtiva[] | null = null;
          
          // Primeiro: buscar métricas genéricas (squad = null) - precisamos delas para fallback
          const { data: genericData } = await supabase
            .from('fechamento_metricas_mes')
            .select('nome_metrica, peso_percentual, meta_valor, meta_percentual, fonte_dados')
            .eq('ano_mes', ano_mes)
            .eq('cargo_catalogo_id', employeeData.cargo_catalogo_id)
            .is('squad', null)
            .eq('ativo', true);
          
          if (genericData && genericData.length > 0) {
            metricasGenericas = genericData;
            console.log(`   📋 Métricas genéricas encontradas: ${metricasGenericas.map(m => `${m.nome_metrica}(meta%=${m.meta_percentual || 'null'})`).join(', ')}`);
          }
          
          // Segundo: buscar métricas específicas do squad
          if (sdr.squad) {
            const { data: metricasSquad } = await supabase
              .from('fechamento_metricas_mes')
              .select('nome_metrica, peso_percentual, meta_valor, meta_percentual, fonte_dados')
              .eq('ano_mes', ano_mes)
              .eq('cargo_catalogo_id', employeeData.cargo_catalogo_id)
              .eq('squad', sdr.squad)
              .eq('ativo', true);
            
            if (metricasSquad && metricasSquad.length > 0) {
              metricas = metricasSquad;
              console.log(`   📋 Métricas específicas do squad '${sdr.squad}' encontradas`);
              
              // ===== FALLBACK: Se métrica de contratos do squad não tem meta_percentual, usar da genérica =====
              const metricaContratosSquad = metricas.find(m => m.nome_metrica === 'contratos');
              if (metricaContratosSquad && !metricaContratosSquad.meta_percentual && metricasGenericas) {
                const metricaContratosGenerica = metricasGenericas.find(m => m.nome_metrica === 'contratos');
                if (metricaContratosGenerica?.meta_percentual) {
                  console.log(`   🔄 Fallback: Usando meta_percentual=${metricaContratosGenerica.meta_percentual}% da métrica genérica para contratos`);
                  metricas = metricas.map(m => 
                    m.nome_metrica === 'contratos' 
                      ? { ...m, meta_percentual: metricaContratosGenerica.meta_percentual }
                      : m
                  );
                }
              }
            }
          }
          
          // Fallback: métricas genéricas se não encontrou específicas do squad
          if (!metricas || metricas.length === 0) {
            if (metricasGenericas && metricasGenericas.length > 0) {
              metricas = metricasGenericas;
              console.log(`   📋 Usando métricas genéricas (sem squad)`);
            }
          }
          
          if (metricas && metricas.length > 0) {
            metricasAtivas = metricas;
            console.log(`   📋 Métricas ativas para ${sdr.name}:`, 
              metricas.map(m => `${m.nome_metrica}(${m.peso_percentual}%${m.meta_percentual ? `, meta%=${m.meta_percentual}` : ''})`).join(', '));
          }
        }

        // ===== BUSCAR KPI EXISTENTE (NÃO SOBRESCREVER VALORES MANUAIS) =====
        const { data: existingKpi } = await supabase
          .from('sdr_month_kpi')
          .select('*')
          .eq('sdr_id', sdr.id)
          .eq('ano_mes', ano_mes)
          .maybeSingle();

        let kpi;
        if (existingKpi) {
          // KPI já existe - SEMPRE atualizar campos da Agenda, preservar campos manuais
          console.log(`   📊 KPI existente encontrado. Atualizando campos da Agenda...`);
          console.log(`   📊 Valores anteriores:`, {
            reunioes_agendadas: existingKpi.reunioes_agendadas,
            reunioes_realizadas: existingKpi.reunioes_realizadas,
            no_shows: existingKpi.no_shows,
          });
          console.log(`   📊 Novos valores da Agenda:`, {
            reunioes_agendadas: reunioesAgendadas,
            reunioes_realizadas: reunioesRealizadas,
            no_shows: noShows,
          });
          
          // PRESERVAR valores manuais se KPI foi editado recentemente (< 10 segundos)
          // Isso permite que edições manuais do usuário sejam preservadas
          const kpiUpdatedAt = existingKpi.updated_at ? new Date(existingKpi.updated_at).getTime() : 0;
          const now = Date.now();
          const wasManuallyEdited = (now - kpiUpdatedAt) < 10000; // 10 segundos
          
          if (wasManuallyEdited) {
            console.log(`   🔒 KPI foi editado manualmente há ${Math.round((now - kpiUpdatedAt) / 1000)}s - PRESERVANDO valores manuais`);
          }
          
          const updateFields: Record<string, unknown> = {
            // Se foi edição manual recente, preservar valores do usuário
            reunioes_agendadas: wasManuallyEdited 
              ? existingKpi.reunioes_agendadas
              : (reunioesAgendadas > 0 ? reunioesAgendadas : existingKpi.reunioes_agendadas),
            
            reunioes_realizadas: wasManuallyEdited
              ? existingKpi.reunioes_realizadas
              : (reunioesRealizadas > 0 ? reunioesRealizadas : existingKpi.reunioes_realizadas),
            
            no_shows: wasManuallyEdited
              ? existingKpi.no_shows
              : (reunioesAgendadas > 0 ? noShows : existingKpi.no_shows),
            
            taxa_no_show: wasManuallyEdited
              ? existingKpi.taxa_no_show
              : (reunioesAgendadas > 0 ? taxaNoShow : existingKpi.taxa_no_show),
            
            updated_at: new Date().toISOString(),
          };
          
          console.log(`   📊 Valores finais: Agendadas=${updateFields.reunioes_agendadas}, Realizadas=${updateFields.reunioes_realizadas} (${wasManuallyEdited ? 'Manual Preservado' : reunioesAgendadas > 0 ? 'Agenda' : 'Existente'})`);
          
          const { data: updatedKpi, error: updateError } = await supabase
            .from('sdr_month_kpi')
            .update(updateFields)
            .eq('id', existingKpi.id)
            .select()
            .single();
          
          if (updateError) {
            console.error(`   ❌ Erro ao atualizar KPI: ${updateError.message}`);
            errors++;
            continue;
          }
          
          kpi = updatedKpi;
          console.log(`   ✅ KPI atualizado com dados frescos da Agenda`);
        } else {
          // KPI não existe - criar com dados da RPC
          const kpiData = {
            sdr_id: sdr.id,
            ano_mes: ano_mes,
            reunioes_agendadas: reunioesAgendadas,
            no_shows: noShows,
            reunioes_realizadas: reunioesRealizadas,
            taxa_no_show: taxaNoShow,
            tentativas_ligacoes: 0,
            score_organizacao: 0,
            intermediacoes_contrato: isCloser ? contratosPagos : 0,
            updated_at: new Date().toISOString(),
          };

          const { data: newKpi, error: createError } = await supabase
            .from('sdr_month_kpi')
            .insert(kpiData)
            .select()
            .single();
          
          if (createError) {
            console.error(`   ❌ Erro ao criar KPI: ${createError.message}`);
            errors++;
            continue;
          }
          kpi = newKpi;
          console.log(`   📊 Novo KPI criado com dados da RPC`);
        }

        console.log(`   📊 KPI atualizado para ${sdr.name}:`, {
          reunioes_agendadas: kpi.reunioes_agendadas,
          reunioes_realizadas: kpi.reunioes_realizadas,
          no_shows: kpi.no_shows,
        });

        // Count intermediações
        const { count: interCount } = await supabase
          .from('sdr_intermediacoes')
          .select('*', { count: 'exact', head: true })
          .eq('sdr_id', sdr.id)
          .eq('ano_mes', ano_mes);

        if (interCount !== null && interCount !== kpi.intermediacoes_contrato) {
          await supabase
            .from('sdr_month_kpi')
            .update({ intermediacoes_contrato: interCount })
            .eq('id', kpi.id);
          kpi.intermediacoes_contrato = interCount;
        }

        // Calculate values - lógica diferente para Closers com métricas ativas
        const diasUteisMes = calendarData?.dias_uteis_final ?? null;
        let calculatedValues;
        
        if (isCloser && metricasAtivas.length > 0 && cargoInfo) {
          // ===== NOVO: Usar cálculo específico para Closers com métricas dinâmicas =====
          
          // Criar KPI com contratos pagos para o cálculo
          const kpiForCloser: Kpi = {
            reunioes_agendadas: kpi.reunioes_agendadas || 0,
            reunioes_realizadas: kpi.reunioes_realizadas || 0,
            tentativas_ligacoes: 0,
            score_organizacao: kpi.score_organizacao || 0,
            no_shows: kpi.no_shows || 0,
          };
          
          // Buscar contratos pagos reais para Closer
          const metricaContratos = metricasAtivas.find(m => m.nome_metrica === 'contratos');
          let metaContratosCalculada = 0;
          let pctContratos = 0;
          let multContratos = 0;
          let valorContratos = 0;
          
          if (metricaContratos && metricaContratos.peso_percentual > 0) {
            const pesoContratos = metricaContratos.peso_percentual;
            const valorBaseContratos = (cargoInfo.variavel_valor * pesoContratos) / 100;
            
            // Se meta_percentual está preenchido, calcular meta como % das Realizadas
            if (metricaContratos.meta_percentual && metricaContratos.meta_percentual > 0) {
              const realizadas = kpiForCloser.reunioes_realizadas;
              metaContratosCalculada = Math.round((realizadas * metricaContratos.meta_percentual) / 100);
              console.log(`   📊 Meta Contratos: ${metricaContratos.meta_percentual}% de ${realizadas} = ${metaContratosCalculada}`);
            } else {
              // Fallback: meta_valor × dias úteis
              metaContratosCalculada = (metricaContratos.meta_valor || 1) * (diasUteisMes || 19);
            }
            
            // Evitar divisão por zero
            if (metaContratosCalculada > 0) {
              pctContratos = (contratosPagos / metaContratosCalculada) * 100;
            }
            
            multContratos = getMultiplier(Math.min(pctContratos, 120));
            valorContratos = valorBaseContratos * multContratos;
            
            console.log(`   📊 Contratos: Real=${contratosPagos}, Meta=${metaContratosCalculada}, %=${pctContratos.toFixed(1)}%, Mult=${multContratos}, Valor=R$ ${valorContratos.toFixed(2)}`);
          }
          
          // Calcular organização
          const metricaOrganizacao = metricasAtivas.find(m => m.nome_metrica === 'organizacao');
          let pctOrganizacao = 0;
          let multOrganizacao = 0;
          let valorOrganizacao = 0;
          
          if (metricaOrganizacao && metricaOrganizacao.peso_percentual > 0) {
            const pesoOrganizacao = metricaOrganizacao.peso_percentual;
            const valorBaseOrganizacao = (cargoInfo.variavel_valor * pesoOrganizacao) / 100;
            
            pctOrganizacao = (kpiForCloser.score_organizacao / META_ORGANIZACAO) * 100;
            multOrganizacao = getMultiplier(Math.min(pctOrganizacao, 120));
            valorOrganizacao = valorBaseOrganizacao * multOrganizacao;
            
            console.log(`   📊 Organização: Score=${kpiForCloser.score_organizacao}%, Mult=${multOrganizacao}, Valor=R$ ${valorOrganizacao.toFixed(2)}`);
          }
          
          // Calcular realizadas (se configurado para Closer)
          const metricaRealizadas = metricasAtivas.find(m => m.nome_metrica === 'realizadas');
          let pctRealizadas = 0;
          let multRealizadas = 0;
          let valorRealizadas = 0;
          let metaRealizadasCalculada = 0;
          
          if (metricaRealizadas && metricaRealizadas.peso_percentual > 0) {
            const pesoRealizadas = metricaRealizadas.peso_percentual;
            const valorBaseRealizadas = (cargoInfo.variavel_valor * pesoRealizadas) / 100;
            
            metaRealizadasCalculada = (metricaRealizadas.meta_valor || 10) * (diasUteisMes || 19);
            pctRealizadas = metaRealizadasCalculada > 0 
              ? (kpiForCloser.reunioes_realizadas / metaRealizadasCalculada) * 100 
              : 0;
            multRealizadas = getMultiplier(Math.min(pctRealizadas, 120));
            valorRealizadas = valorBaseRealizadas * multRealizadas;
            
            console.log(`   📊 Realizadas: Real=${kpiForCloser.reunioes_realizadas}, Meta=${metaRealizadasCalculada}, %=${pctRealizadas.toFixed(1)}%, Mult=${multRealizadas}, Valor=R$ ${valorRealizadas.toFixed(2)}`);
          }
          
          // Vendas Parceria
          const metricaVendasParceria = metricasAtivas.find(m => m.nome_metrica === 'vendas_parceria');
          let valorVendasParceria = 0;
          
          if (metricaVendasParceria && metricaVendasParceria.peso_percentual > 0) {
            const pesoVendasParceria = metricaVendasParceria.peso_percentual;
            // Por enquanto, sem multiplicador para vendas parceria
            valorVendasParceria = (cargoInfo.variavel_valor * pesoVendasParceria) / 100;
            console.log(`   📊 Vendas Parceria: Peso=${pesoVendasParceria}%, Valor Base=R$ ${valorVendasParceria.toFixed(2)}`);
          }
          
          const valorVariavelTotal = valorContratos + valorOrganizacao + valorRealizadas + valorVendasParceria;
          const fixoValor = cargoInfo.fixo_valor;
          const totalConta = fixoValor + valorVariavelTotal;
          
          // iFood para Closers - AJUSTE: Usar ultrameta do time se batida
          const pctMediaGlobal = pctContratos; // Para Closers, usar contratos como principal métrica
          const ifoodMensal = calendarIfoodMensal ?? compPlan.ifood_mensal;
          
          // Verificar se a BU do SDR bateu ultrameta do time
          const sdrSquad = sdr.squad || 'incorporador';
          const teamGoal = teamGoalsByBU[sdrSquad];
          const teamUltrametaHit = buUltrametaHit[sdrSquad] || false;
          
          // Se ultrameta do time foi batida, usar o prêmio configurado na meta do time
          // Caso contrário, usar lógica individual (apenas se performance >= 100%)
          // IMPORTANTE: Só é elegível quem estava na equipe desde o início do mês
          let ifoodUltrameta = 0;
          if (teamUltrametaHit && teamGoal && elegivelUltrameta) {
            ifoodUltrameta = teamGoal.ultrameta_premio_ifood || 0;
            console.log(`   🎁 Ultrameta do Time batida! iFood Ultrameta = R$ ${ifoodUltrameta}`);
          } else if (teamUltrametaHit && teamGoal && !elegivelUltrameta) {
            ifoodUltrameta = 0;
            console.log(`   ⏭️ ${sdr.name} não elegível para Ultrameta (entrou no meio do mês)`);
          } else if (pctMediaGlobal >= 100 && elegivelUltrameta) {
            ifoodUltrameta = compPlan.ifood_ultrameta || 0;
          }
          
          const totalIfood = ifoodMensal + ifoodUltrameta;
          
          console.log(`   💰 Closer Total: Variável=R$ ${valorVariavelTotal.toFixed(2)}, Fixo=R$ ${fixoValor}, Total=R$ ${totalConta.toFixed(2)}`);
          
          calculatedValues = {
            pct_reunioes_agendadas: pctContratos, // Para Closers, armazena % de Contratos
            pct_reunioes_realizadas: pctRealizadas,
            pct_tentativas: 0,
            pct_organizacao: pctOrganizacao,
            pct_no_show: 0,
            mult_reunioes_agendadas: 0,
            mult_reunioes_realizadas: multRealizadas,
            mult_tentativas: 0,
            mult_organizacao: multOrganizacao,
            mult_no_show: 0,
            valor_reunioes_agendadas: 0,
            valor_reunioes_realizadas: valorRealizadas + valorContratos, // Incluir contratos aqui para compatibilidade
            valor_tentativas: 0,
            valor_organizacao: valorOrganizacao,
            valor_variavel_total: valorVariavelTotal,
            valor_fixo: fixoValor,
            total_conta: totalConta,
            ifood_mensal: ifoodMensal,
            ifood_ultrameta: ifoodUltrameta,
            total_ifood: totalIfood,
            meta_agendadas_ajustada: 0,
            meta_realizadas_ajustada: metaRealizadasCalculada || metaContratosCalculada,
            meta_tentativas_ajustada: 0,
            dias_uteis_mes: diasUteisMes || 19,
          };
        } else {
          // Usar cálculo padrão para SDRs
          const baseValues = calculatePayoutValues(
            compPlan as CompPlan, 
            kpi as Kpi, 
            sdr.meta_diaria || 0, 
            calendarIfoodMensal, 
            diasUteisMes, 
            isCloser,
            metricasAtivas.length > 0 ? metricasAtivas : undefined
          );
          
          // AJUSTE: Verificar se a BU do SDR bateu ultrameta do time
          const sdrSquad = sdr.squad || 'incorporador';
          const teamGoal = teamGoalsByBU[sdrSquad];
          const teamUltrametaHit = buUltrametaHit[sdrSquad] || false;
          
          if (teamUltrametaHit && teamGoal && elegivelUltrameta) {
            // Substituir ifood_ultrameta pelo valor do prêmio do time
            baseValues.ifood_ultrameta = teamGoal.ultrameta_premio_ifood || 0;
            baseValues.total_ifood = baseValues.ifood_mensal + baseValues.ifood_ultrameta;
            console.log(`   🎁 Ultrameta do Time batida para SDR! iFood Ultrameta = R$ ${baseValues.ifood_ultrameta}`);
          } else if (teamUltrametaHit && teamGoal && !elegivelUltrameta) {
            // Colaborador entrou no meio do mês - não recebe ultrameta
            baseValues.ifood_ultrameta = 0;
            baseValues.total_ifood = baseValues.ifood_mensal;
            console.log(`   ⏭️ SDR ${sdr.name} não elegível para Ultrameta (entrou no meio do mês)`);
          }
          
          calculatedValues = baseValues;
        }
        
        console.log(`   💰 Valores calculados para ${sdr.name}:`, {
          pct_agendadas: calculatedValues.pct_reunioes_agendadas.toFixed(1),
          pct_realizadas: calculatedValues.pct_reunioes_realizadas.toFixed(1),
          valor_variavel: calculatedValues.valor_variavel_total.toFixed(2),
          ifood_mensal: calculatedValues.ifood_mensal,
          dias_uteis_mes: calculatedValues.dias_uteis_mes,
          meta_agendadas_ajustada: calculatedValues.meta_agendadas_ajustada,
        });

        // Get existing payout to preserve ifood_ultrameta_autorizado
        const { data: existingPayout } = await supabase
          .from('sdr_month_payout')
          .select('ifood_ultrameta_autorizado, ifood_ultrameta_autorizado_por, ifood_ultrameta_autorizado_em, status')
          .eq('sdr_id', sdr.id)
          .eq('ano_mes', ano_mes)
          .single();

        // Only update if not LOCKED or APPROVED
        if (existingPayout?.status === 'LOCKED') {
          console.log(`   ⏭️ Payout travado (LOCKED) para ${sdr.name}, pulando`);
          continue;
        }
        if (existingPayout?.status === 'APPROVED') {
          console.log(`   ⏭️ Payout aprovado (APPROVED) para ${sdr.name}, pulando`);
          continue;
        }

        // Remove campos que não existem na tabela sdr_month_payout
        const { pct_no_show, mult_no_show, ...payoutFields } = calculatedValues;

        // Upsert payout
        const { data: payout, error: payoutError } = await supabase
          .from('sdr_month_payout')
          .upsert({
            sdr_id: sdr.id,
            ano_mes: ano_mes,
            ...payoutFields,
            status: existingPayout?.status || 'DRAFT',
            ifood_ultrameta_autorizado: existingPayout?.ifood_ultrameta_autorizado || false,
            ifood_ultrameta_autorizado_por: existingPayout?.ifood_ultrameta_autorizado_por || null,
            ifood_ultrameta_autorizado_em: existingPayout?.ifood_ultrameta_autorizado_em || null,
          }, {
            onConflict: 'sdr_id,ano_mes',
          })
          .select()
          .single();

        if (payoutError) {
          console.error(`   ❌ Erro ao salvar payout: ${payoutError.message}`);
          errors++;
          continue;
        }

        results.push({ sdr_id: sdr.id, sdr_name: sdr.name, payout_id: payout.id });
        processed++;
        
        // Track for Meta Divina calculation
        const sdrSquad = sdr.squad || 'incorporador';
        const pctMediaGlobal = isCloser 
          ? calculatedValues.pct_reunioes_agendadas // Para Closers, armazena % Contratos
          : (calculatedValues.pct_reunioes_agendadas + calculatedValues.pct_reunioes_realizadas + 
             calculatedValues.pct_tentativas + calculatedValues.pct_organizacao) / 4;
        
        processedPayouts.push({
          sdr_id: sdr.id,
          sdr_name: sdr.name,
          squad: sdrSquad,
          isCloser,
          pct_media_global: pctMediaGlobal,
        });
        
        console.log(`   ✅ Sucesso para ${sdr.name}`);
      } catch (e: any) {
        console.error(`   ❌ Erro ao processar ${sdr.name}: ${e.message}`);
        errors++;
      }
    }

    console.log(`📊 Resultado: ${processed} processados, ${errors} erros`);

    // ===== REGISTRAR VENCEDORES META DIVINA =====
    for (const bu of Object.keys(buDivinaHit)) {
      if (!buDivinaHit[bu]) continue;
      
      const teamGoal = teamGoalsByBU[bu];
      if (!teamGoal) continue;
      
      console.log(`🌟 Processando vencedores Meta Divina para BU ${bu}...`);
      
      // Filtrar payouts por BU
      const buPayouts = processedPayouts.filter(p => p.squad === bu);
      const sdrPayouts = buPayouts.filter(p => !p.isCloser);
      const closerPayouts = buPayouts.filter(p => p.isCloser);
      
      // Melhor SDR
      if (sdrPayouts.length > 0) {
        const bestSdr = sdrPayouts.reduce((max, p) => 
          p.pct_media_global > max.pct_media_global ? p : max
        );
        
        // Verificar se já existe registro
        const { data: existingWinner } = await supabase
          .from('team_monthly_goal_winners')
          .select('id')
          .eq('goal_id', teamGoal.id)
          .eq('tipo_premio', 'divina_sdr')
          .maybeSingle();
        
        if (!existingWinner) {
          const { error: insertError } = await supabase
            .from('team_monthly_goal_winners')
            .insert({
              goal_id: teamGoal.id,
              tipo_premio: 'divina_sdr',
              sdr_id: bestSdr.sdr_id,
              valor_premio: teamGoal.meta_divina_premio_sdr,
              autorizado: false,
            });
          
          if (insertError) {
            console.error(`   ❌ Erro ao registrar vencedor SDR: ${insertError.message}`);
          } else {
            console.log(`   🏆 Melhor SDR registrado: ${bestSdr.sdr_name} (${bestSdr.pct_media_global.toFixed(1)}%)`);
          }
        } else {
          // Atualizar vencedor se mudou
          await supabase
            .from('team_monthly_goal_winners')
            .update({ sdr_id: bestSdr.sdr_id })
            .eq('id', existingWinner.id);
          console.log(`   🔄 Vencedor SDR atualizado: ${bestSdr.sdr_name}`);
        }
      }
      
      // Melhor Closer
      if (closerPayouts.length > 0) {
        const bestCloser = closerPayouts.reduce((max, p) => 
          p.pct_media_global > max.pct_media_global ? p : max
        );
        
        // Verificar se já existe registro
        const { data: existingWinner } = await supabase
          .from('team_monthly_goal_winners')
          .select('id')
          .eq('goal_id', teamGoal.id)
          .eq('tipo_premio', 'divina_closer')
          .maybeSingle();
        
        if (!existingWinner) {
          const { error: insertError } = await supabase
            .from('team_monthly_goal_winners')
            .insert({
              goal_id: teamGoal.id,
              tipo_premio: 'divina_closer',
              sdr_id: bestCloser.sdr_id,
              valor_premio: teamGoal.meta_divina_premio_closer,
              autorizado: false,
            });
          
          if (insertError) {
            console.error(`   ❌ Erro ao registrar vencedor Closer: ${insertError.message}`);
          } else {
            console.log(`   🏆 Melhor Closer registrado: ${bestCloser.sdr_name} (${bestCloser.pct_media_global.toFixed(1)}%)`);
          }
        } else {
          // Atualizar vencedor se mudou
          await supabase
            .from('team_monthly_goal_winners')
            .update({ sdr_id: bestCloser.sdr_id })
            .eq('id', existingWinner.id);
          console.log(`   🔄 Vencedor Closer atualizado: ${bestCloser.sdr_name}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        errors,
        total: sdrs.length,
        results,
        calendarIfoodMensal,
        buRevenue,
        ultrametaHit: buUltrametaHit,
        divinaHit: buDivinaHit,
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
