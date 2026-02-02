import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface StagePermission {
  stage_id: string;
  can_view: boolean;
  can_edit: boolean;
  can_move_from: boolean;
  can_move_to: boolean;
}

// Stages that should only be visible to closers (not SDRs)
// SDRs will not see these columns in the Kanban board
export const CLOSER_ONLY_STAGE_PATTERNS = [
  'reunião 01 realizada',
  'reunião 1 realizada',
  'r1 realizada',
  'reunião 02 agendada',
  'reunião 2 agendada',
  'r2 agendada',
  'reunião 02 realizada',
  'reunião 2 realizada', 
  'r2 realizada',
  'contrato pago',
  'venda realizada',
];

// Stages that represent "lost" deals
export const LOST_STAGE_PATTERNS = [
  'sem interesse',
  'perdido',
  'perdida',
  'não quer',
  'desistente',
  'cancelado',
];

// Check if a stage name matches closer-only patterns
export const isCloserOnlyStage = (stageName: string): boolean => {
  const normalized = stageName.toLowerCase().trim();
  return CLOSER_ONLY_STAGE_PATTERNS.some(pattern => 
    normalized.includes(pattern) || normalized === pattern
  );
};

// Check if a stage name matches lost patterns
export const isLostStage = (stageName: string): boolean => {
  const normalized = stageName.toLowerCase().trim();
  return LOST_STAGE_PATTERNS.some(pattern => 
    normalized.includes(pattern) || normalized === pattern
  );
};

// Mapa de normalização de nomes de stage para identificadores genéricos
const STAGE_NAME_MAP: Record<string, string> = {
  // Estágios base
  'base': 'novo_lead',
  'novo lead': 'novo_lead',
  'novo': 'novo_lead',
  'lead gratuito': 'lead_gratuito',
  'lead instagram': 'lead_instagram',
  'prospecção': 'lead_qualificado',
  'qualificado': 'lead_qualificado',
  'lead qualificado': 'lead_qualificado',
  
  // Variações do pipeline Inside Sales (com acento) -> mapeando para IDs reais em deal_stages
  'reunião 01 agendada': 'reuniao_1_agendada',
  'reunião 01 realizada': 'r1_realizada',    // NOTA: deal_stages usa r1_realizada
  'reunião 02 agendada': 'r2_agendada',      // NOTA: deal_stages usa r2_agendada
  'reunião 02 realizada': 'r2_realizada',
  
  // Variações sem acento
  'reuniao 01 agendada': 'reuniao_1_agendada',
  'reuniao 01 realizada': 'r1_realizada',
  'reuniao 02 agendada': 'r2_agendada',
  'reuniao 02 realizada': 'r2_realizada',
  
  // Variações curtas (R1/R2)
  'agendamento': 'reuniao_1_agendada',
  'reunião agendada': 'reuniao_1_agendada',
  'r1 agendada': 'reuniao_1_agendada',
  'r1 realizada': 'r1_realizada',
  'r2 agendada': 'r2_agendada',
  'r2 realizada': 'r2_realizada',
  
  // Estágios finais
  'no-show': 'no_show',
  'no show': 'no_show',
  'noshow': 'no_show',
  'perdido': 'perdido',
  'sem interesse': 'sem_interesse',
  'contrato enviado': 'contrato_pago',
  'venda realizada': 'venda_realizada',
  'contrato pago': 'contrato_pago',
  'ganho': 'venda_realizada',
  'fechado': 'venda_realizada',
};

const normalizeStageId = (stageName: string): string => {
  const normalized = stageName.toLowerCase().trim();
  return STAGE_NAME_MAP[normalized] || normalized.replace(/\s+/g, '_').replace(/-/g, '_');
};

export const useStagePermissions = () => {
  const { role, allRoles } = useAuth();
  
  // Carregar permissões para TODAS as roles do usuário (multi-role support)
  const { data: permissions = [], isLoading: permissionsLoading } = useQuery({
    queryKey: ['stage-permissions', allRoles],
    queryFn: async () => {
      if (!allRoles || allRoles.length === 0) return [];
      
      const { data, error } = await supabase
        .from('stage_permissions')
        .select('*')
        .in('role', allRoles);
      
      if (error) throw error;
      return data as StagePermission[];
    },
    enabled: allRoles && allRoles.length > 0,
  });
  
  // Carregar mapeamento de stages UUID -> nome (de ambas as tabelas)
  const { data: stagesMap = {}, isLoading: stagesLoading } = useQuery({
    queryKey: ['stages-map'],
    queryFn: async () => {
      // Buscar de ambas as tabelas em paralelo
      const [crmRes, localRes] = await Promise.all([
        supabase.from('crm_stages').select('id, stage_name'),
        supabase.from('local_pipeline_stages').select('id, name'),
      ]);
      
      const map: Record<string, string> = {};
      
      // Mapear crm_stages
      crmRes.data?.forEach(s => { 
        map[s.id] = s.stage_name; 
      });
      
      // Mapear local_pipeline_stages (name → stage_name)
      localRes.data?.forEach(s => { 
        map[s.id] = s.name; 
      });
      
      return map;
    },
  });
  
  const isLoading = permissionsLoading || stagesLoading;
  
  // Função auxiliar para encontrar permissão (por UUID direto ou por nome normalizado)
  const findPermission = (stageId: string): StagePermission | undefined => {
    // Primeiro tenta pelo ID direto
    let permission = permissions.find(p => p.stage_id === stageId);
    
    // Fallback: busca pelo nome normalizado
    if (!permission && stagesMap) {
      const stageName = stagesMap[stageId];
      if (stageName) {
        const normalizedId = normalizeStageId(stageName);
        permission = permissions.find(p => p.stage_id === normalizedId);
      }
    }
    
    return permission;
  };
  
  const getVisibleStages = () => {
    return permissions
      .filter(p => p.can_view)
      .map(p => p.stage_id);
  };
  
  const canViewStage = (stageId: string) => {
    const permission = findPermission(stageId);
    // Se não existe permissão explícita, permitir por padrão
    if (!permission) return true;
    return permission.can_view;
  };
  
  const canEditStage = (stageId: string) => {
    const permission = findPermission(stageId);
    if (!permission) return true;
    return permission.can_edit;
  };
  
  const canMoveFromStage = (stageId: string) => {
    const permission = findPermission(stageId);
    if (!permission) return true;
    return permission.can_move_from;
  };
  
  const canMoveToStage = (stageId: string) => {
    const permission = findPermission(stageId);
    if (!permission) return true;
    return permission.can_move_to;
  };
  
  return {
    permissions,
    isLoading,
    getVisibleStages,
    canViewStage,
    canEditStage,
    canMoveFromStage,
    canMoveToStage,
  };
};
