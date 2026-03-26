import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface EmployeePdi {
  id: string;
  employee_id: string;
  titulo: string;
  descricao: string | null;
  categoria: 'competencia' | 'tecnico' | 'comportamental' | 'lideranca' | 'outro';
  status: 'nao_iniciado' | 'em_andamento' | 'concluido' | 'cancelado';
  prioridade: 'baixa' | 'media' | 'alta';
  data_inicio: string | null;
  data_prevista: string | null;
  data_conclusao: string | null;
  progresso: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface EmployeePdiComment {
  id: string;
  pdi_id: string;
  conteudo: string;
  autor_nome: string | null;
  autor_tipo: 'colaborador' | 'gestor' | 'rh';
  created_at: string;
  created_by: string | null;
}

export const PDI_STATUS_LABELS: Record<EmployeePdi['status'], { label: string; color: string }> = {
  nao_iniciado: { label: 'Não iniciado', color: 'bg-gray-500' },
  em_andamento: { label: 'Em andamento', color: 'bg-yellow-500' },
  concluido: { label: 'Concluído', color: 'bg-green-500' },
  cancelado: { label: 'Cancelado', color: 'bg-red-500' },
};

export const PDI_CATEGORIA_LABELS: Record<EmployeePdi['categoria'], { label: string; color: string }> = {
  competencia: { label: 'Competência', color: 'bg-blue-500' },
  tecnico: { label: 'Técnico', color: 'bg-purple-500' },
  comportamental: { label: 'Comportamental', color: 'bg-orange-500' },
  lideranca: { label: 'Liderança', color: 'bg-indigo-500' },
  outro: { label: 'Outro', color: 'bg-gray-500' },
};

export const PDI_PRIORIDADE_LABELS: Record<EmployeePdi['prioridade'], { label: string; color: string }> = {
  baixa: { label: 'Baixa', color: 'bg-green-500' },
  media: { label: 'Média', color: 'bg-yellow-500' },
  alta: { label: 'Alta', color: 'bg-red-500' },
};

export function useMyPdis(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['my-pdis', employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await supabase
        .from('employee_pdi')
        .select('*')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as EmployeePdi[];
    },
    enabled: !!employeeId,
  });
}

export function useMyPdiComments(pdiId: string | undefined) {
  return useQuery({
    queryKey: ['my-pdi-comments', pdiId],
    queryFn: async () => {
      if (!pdiId) return [];
      const { data, error } = await supabase
        .from('employee_pdi_comments')
        .select('*')
        .eq('pdi_id', pdiId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as EmployeePdiComment[];
    },
    enabled: !!pdiId,
  });
}

export function useAddPdiComment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ pdiId, conteudo, autorNome }: { pdiId: string; conteudo: string; autorNome?: string }) => {
      const { data, error } = await supabase
        .from('employee_pdi_comments')
        .insert({
          pdi_id: pdiId,
          conteudo,
          autor_nome: autorNome || 'Colaborador',
          autor_tipo: 'colaborador',
          created_by: user?.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['my-pdi-comments', variables.pdiId] });
      toast.success('Comentário adicionado');
    },
    onError: (error) => {
      toast.error('Erro ao adicionar comentário: ' + error.message);
    },
  });
}
