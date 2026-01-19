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
  
  // Variações do pipeline Inside Sales (com acento)
  'reunião 01 agendada': 'reuniao_1_agendada',
  'reunião 01 realizada': 'reuniao_1_realizada',
  'reunião 02 agendada': 'reuniao_2_agendada',
  'reunião 02 realizada': 'reuniao_2_realizada',
  
  // Variações do pipeline Inside Sales (sem acento)
  'reuniao 01 agendada': 'reuniao_1_agendada',
  'reuniao 01 realizada': 'reuniao_1_realizada',
  'reuniao 02 agendada': 'reuniao_2_agendada',
  'reuniao 02 realizada': 'reuniao_2_realizada',
  
  // Variações curtas (R1/R2)
  'agendamento': 'reuniao_1_agendada',
  'reunião agendada': 'reuniao_1_agendada',
  'r1 agendada': 'reuniao_1_agendada',
  'r1 realizada': 'reuniao_1_realizada',
  'r2 agendada': 'reuniao_2_agendada',
  'r2 realizada': 'reuniao_2_realizada',
  
  // Estágios finais
  'no-show': 'no_show',
  'no show': 'no_show',
  'noshow': 'no_show',
  'perdido': 'perdido',
  'sem interesse': 'sem_interesse',
  'contrato enviado': 'contrato_enviado',
  'venda realizada': 'venda_realizada',
  'contrato pago': 'contrato_pago',
  'ganho': 'ganho',
  'fechado': 'ganho',
};

const normalizeStageId = (stageName: string): string => {
  const normalized = stageName.toLowerCase().trim();
  return STAGE_NAME_MAP[normalized] || normalized.replace(/\s+/g, '_').replace(/-/g, '_');
};

export const useStagePermissions = () => {
  const { role } = useAuth();
  
  // Carregar permissões por role
  const { data: permissions = [], isLoading: permissionsLoading } = useQuery({
    queryKey: ['stage-permissions', role],
    queryFn: async () => {
      if (!role) return [];
      
      const { data, error } = await supabase
        .from('stage_permissions')
        .select('*')
        .eq('role', role);
      
      if (error) throw error;
      return data as StagePermission[];
    },
    enabled: !!role,
  });
  
  // Carregar mapeamento de stages UUID -> nome
  const { data: stagesMap = {}, isLoading: stagesLoading } = useQuery({
    queryKey: ['stages-map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_stages')
        .select('id, stage_name');
      
      if (error) throw error;
      
      const map: Record<string, string> = {};
      data?.forEach(s => { map[s.id] = s.stage_name; });
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
    return findPermission(stageId)?.can_view ?? false;
  };
  
  const canEditStage = (stageId: string) => {
    return findPermission(stageId)?.can_edit ?? false;
  };
  
  const canMoveFromStage = (stageId: string) => {
    return findPermission(stageId)?.can_move_from ?? false;
  };
  
  const canMoveToStage = (stageId: string) => {
    return findPermission(stageId)?.can_move_to ?? false;
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
