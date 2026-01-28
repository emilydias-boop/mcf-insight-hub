import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface Exam {
  id: string;
  titulo: string;
  descricao: string | null;
  data_aplicacao: string;
  aplicador_id: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  participantes_count?: number;
}

export interface ExamScore {
  id: string;
  exam_id: string;
  employee_id: string;
  nota: number;
  observacao: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  employee?: {
    id: string;
    nome_completo: string;
    cargo: string | null;
  };
}

export interface CreateExamData {
  titulo: string;
  descricao?: string;
  data_aplicacao?: string;
}

export interface CreateScoreData {
  exam_id: string;
  employee_id: string;
  nota: number;
  observacao?: string;
}

// Lista todas as provas com contagem de participantes
export function useExams() {
  return useQuery({
    queryKey: ['employee_exams'],
    queryFn: async () => {
      const { data: exams, error } = await supabase
        .from('employee_exams')
        .select('*')
        .eq('ativo', true)
        .order('data_aplicacao', { ascending: false });

      if (error) throw error;

      // Buscar contagem de participantes para cada prova
      const examsWithCounts = await Promise.all(
        (exams || []).map(async (exam) => {
          const { count } = await supabase
            .from('employee_exam_scores')
            .select('*', { count: 'exact', head: true })
            .eq('exam_id', exam.id);
          
          return {
            ...exam,
            participantes_count: count || 0,
          };
        })
      );

      return examsWithCounts as Exam[];
    },
  });
}

// Detalhes de uma prova específica
export function useExam(examId: string | null) {
  return useQuery({
    queryKey: ['employee_exams', examId],
    enabled: !!examId,
    queryFn: async () => {
      if (!examId) return null;
      
      const { data, error } = await supabase
        .from('employee_exams')
        .select('*')
        .eq('id', examId)
        .maybeSingle();

      if (error) throw error;
      return data as Exam | null;
    },
  });
}

// Notas de uma prova específica
export function useExamScores(examId: string | null) {
  return useQuery({
    queryKey: ['employee_exam_scores', examId],
    enabled: !!examId,
    queryFn: async () => {
      if (!examId) return [];
      
      const { data, error } = await supabase
        .from('employee_exam_scores')
        .select('*')
        .eq('exam_id', examId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Buscar dados dos funcionários
      const employeeIds = [...new Set((data || []).map(s => s.employee_id))];
      
      if (employeeIds.length === 0) return [];

      const { data: employees } = await supabase
        .from('employees')
        .select('id, nome_completo, cargo')
        .in('id', employeeIds);

      const employeeMap = new Map((employees || []).map(e => [e.id, e]));

      return (data || []).map(score => ({
        ...score,
        employee: employeeMap.get(score.employee_id),
      })) as ExamScore[];
    },
  });
}

// Histórico de provas do colaborador
export function useEmployeeExamHistory(employeeId: string | null) {
  return useQuery({
    queryKey: ['employee_exam_history', employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      if (!employeeId) return [];
      
      const { data: scores, error } = await supabase
        .from('employee_exam_scores')
        .select('*')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Buscar dados das provas
      const examIds = [...new Set((scores || []).map(s => s.exam_id))];
      
      if (examIds.length === 0) return [];

      const { data: exams } = await supabase
        .from('employee_exams')
        .select('id, titulo, data_aplicacao')
        .in('id', examIds);

      const examMap = new Map((exams || []).map(e => [e.id, e]));

      return (scores || []).map(score => ({
        ...score,
        exam: examMap.get(score.exam_id),
      }));
    },
  });
}

// Mutations
export function useCreateExam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateExamData) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data: exam, error } = await supabase
        .from('employee_exams')
        .insert({
          titulo: data.titulo,
          descricao: data.descricao || null,
          data_aplicacao: data.data_aplicacao || new Date().toISOString().split('T')[0],
          aplicador_id: user.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return exam;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee_exams'] });
      toast({ title: 'Prova criada com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar prova', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteExam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (examId: string) => {
      const { error } = await supabase
        .from('employee_exams')
        .update({ ativo: false })
        .eq('id', examId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee_exams'] });
      toast({ title: 'Prova removida com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover prova', description: error.message, variant: 'destructive' });
    },
  });
}

export function useCreateScore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateScoreData) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data: score, error } = await supabase
        .from('employee_exam_scores')
        .insert({
          exam_id: data.exam_id,
          employee_id: data.employee_id,
          nota: data.nota,
          observacao: data.observacao || null,
          created_by: user.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return score;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employee_exam_scores', variables.exam_id] });
      queryClient.invalidateQueries({ queryKey: ['employee_exams'] });
      queryClient.invalidateQueries({ queryKey: ['employee_exam_history'] });
      toast({ title: 'Nota registrada com sucesso!' });
    },
    onError: (error: Error) => {
      if (error.message.includes('duplicate')) {
        toast({ title: 'Este colaborador já tem nota nesta prova', variant: 'destructive' });
      } else {
        toast({ title: 'Erro ao registrar nota', description: error.message, variant: 'destructive' });
      }
    },
  });
}

export function useUpdateScore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, nota, observacao }: { id: string; nota: number; observacao?: string }) => {
      const { error } = await supabase
        .from('employee_exam_scores')
        .update({ nota, observacao: observacao || null })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee_exam_scores'] });
      queryClient.invalidateQueries({ queryKey: ['employee_exam_history'] });
      toast({ title: 'Nota atualizada!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar nota', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteScore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (scoreId: string) => {
      const { error } = await supabase
        .from('employee_exam_scores')
        .delete()
        .eq('id', scoreId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee_exam_scores'] });
      queryClient.invalidateQueries({ queryKey: ['employee_exams'] });
      queryClient.invalidateQueries({ queryKey: ['employee_exam_history'] });
      toast({ title: 'Nota removida!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover nota', description: error.message, variant: 'destructive' });
    },
  });
}
