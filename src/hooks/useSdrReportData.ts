import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, format } from 'date-fns';

// UUID mappings from Bubble imports - CORRIGIDO
const STAGE_UUID_MAP: Record<string, string> = {
  'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b': 'Novo Lead',
  'a8365215-fd31-4bdc-bbe7-77100fa39e53': 'Reunião 01 Agendada',
  '34995d75-933e-4d67-b7fc-19fcb8b81680': 'Reunião 01 Realizada',
  '062927f5-b7a3-496a-9d47-eb03b3d69b10': 'No-Show', // Corrigido para No-Show
  '3a2776e2-a536-4a2a-bb7b-a2f53c8941df': 'Venda realizada', // Usado como Contrato
};

// Text stage names from webhooks
const STAGE_NAMES = {
  AGENDADA: ['Reunião 01 Agendada', 'R1 Agendada'],
  REALIZADA: ['Reunião 01 Realizada', 'R1 Realizada'],
  NO_SHOW: ['No-Show', 'No Show', 'NoShow'],
  CONTRATO: ['Contrato Pago', 'Contrato', 'Venda realizada', 'Venda Realizada'],
};

export interface SdrReportMetrics {
  sdr_email: string;
  sdr_name: string;
  r1_agendada: number;
  r1_realizada: number;
  no_shows: number;
  contratos: number;
  taxa_conversao: number;
  taxa_no_show: number;
}

interface DealActivity {
  id: string;
  deal_id: string;
  activity_type: string;
  from_stage: string | null;
  to_stage: string | null;
  created_at: string;
  metadata: any;
}

function normalizeStage(stage: string | null): string {
  if (!stage) return '';
  
  // Check if it's a UUID
  if (STAGE_UUID_MAP[stage]) {
    return STAGE_UUID_MAP[stage];
  }
  
  return stage;
}

function matchesStage(stage: string | null, stageNames: string[]): boolean {
  const normalized = normalizeStage(stage);
  return stageNames.some(name => 
    normalized.toLowerCase().includes(name.toLowerCase())
  );
}

function extractSdrEmail(activity: DealActivity): string | null {
  const metadata = activity.metadata;
  if (!metadata) return null;
  
  // Webhook format (deal_user)
  if (metadata.deal_user && typeof metadata.deal_user === 'string' 
      && metadata.deal_user.includes('@')) {
    return metadata.deal_user.toLowerCase();
  }
  
  // Bubble format (owner)
  if (metadata.owner && typeof metadata.owner === 'string' 
      && metadata.owner.includes('@')) {
    return metadata.owner.toLowerCase();
  }
  
  return null;
}

// Função para buscar todos os dados com paginação (bypassa limite de 1000)
async function fetchAllActivities(start: string, end: string): Promise<DealActivity[]> {
  const allActivities: DealActivity[] = [];
  const pageSize = 1000;
  let page = 0;
  let hasMore = true;
  
  while (hasMore) {
    const { data, error } = await supabase
      .from('deal_activities')
      .select('*')
      .gte('created_at', `${start}T00:00:00`)
      .lte('created_at', `${end}T23:59:59`)
      .eq('activity_type', 'stage_change')
      .range(page * pageSize, (page + 1) * pageSize - 1)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    allActivities.push(...(data || []));
    hasMore = (data?.length || 0) === pageSize;
    page++;
  }
  
  return allActivities;
}

export function useSdrReportData(startDate: Date | null, endDate: Date | null) {
  return useQuery({
    queryKey: ['sdr-report', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      if (!startDate || !endDate) return [];
      
      const start = format(startOfDay(startDate), 'yyyy-MM-dd');
      const end = format(endOfDay(endDate), 'yyyy-MM-dd');
      
      // Buscar lista de SDRs válidos do banco
      const { data: sdrList, error: sdrError } = await supabase
        .from('sdr')
        .select('email, name')
        .eq('active', true);
      
      if (sdrError) throw sdrError;
      
      // Criar Set com emails válidos (lowercase) e mapa de nomes
      const validSdrEmails = new Set(
        (sdrList || [])
          .filter(sdr => sdr.email)
          .map(sdr => sdr.email!.toLowerCase())
      );
      
      const sdrNameMap = new Map(
        (sdrList || [])
          .filter(sdr => sdr.email)
          .map(sdr => [sdr.email!.toLowerCase(), sdr.name])
      );
      
      // Query deal_activities com paginação para buscar TODOS os registros
      const activities = await fetchAllActivities(start, end);
      
      // Group by SDR email
      const sdrMetrics = new Map<string, {
        r1_agendada: Set<string>;
        r1_realizada: Set<string>;
        no_shows: Set<string>;
        contratos: Set<string>;
      }>();
      
      (activities || []).forEach((activity: DealActivity) => {
        const sdrEmail = extractSdrEmail(activity);
        
        // REGRA: só processar se email estiver na lista de SDRs cadastrados
        if (!sdrEmail || !validSdrEmails.has(sdrEmail)) return;
        
        if (!sdrMetrics.has(sdrEmail)) {
          sdrMetrics.set(sdrEmail, {
            r1_agendada: new Set(),
            r1_realizada: new Set(),
            no_shows: new Set(),
            contratos: new Set(),
          });
        }
        
        const metrics = sdrMetrics.get(sdrEmail)!;
        const toStage = activity.to_stage;
        const dealId = activity.deal_id;
        
        if (matchesStage(toStage, STAGE_NAMES.AGENDADA)) {
          metrics.r1_agendada.add(dealId);
        }
        if (matchesStage(toStage, STAGE_NAMES.REALIZADA)) {
          metrics.r1_realizada.add(dealId);
        }
        if (matchesStage(toStage, STAGE_NAMES.NO_SHOW)) {
          metrics.no_shows.add(dealId);
        }
        if (matchesStage(toStage, STAGE_NAMES.CONTRATO)) {
          metrics.contratos.add(dealId);
        }
      });
      
      // Convert to array with calculations
      const result: SdrReportMetrics[] = [];
      
      sdrMetrics.forEach((metrics, email) => {
        const agendadas = metrics.r1_agendada.size;
        const realizadas = metrics.r1_realizada.size;
        const noShows = metrics.no_shows.size;
        const contratos = metrics.contratos.size;
        
        result.push({
          sdr_email: email,
          sdr_name: sdrNameMap.get(email) || email, // Usa nome do banco
          r1_agendada: agendadas,
          r1_realizada: realizadas,
          no_shows: noShows,
          contratos: contratos,
          taxa_conversao: agendadas > 0 ? (realizadas / agendadas) * 100 : 0,
          taxa_no_show: agendadas > 0 ? (noShows / agendadas) * 100 : 0,
        });
      });
      
      // Sort by agendadas descending
      result.sort((a, b) => b.r1_agendada - a.r1_agendada);
      
      return result;
    },
    enabled: !!startDate && !!endDate,
  });
}
