import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEmployees } from '@/hooks/useEmployees';

export interface ExamStats {
  totalExams: number;
  totalScores: number;
  overallAverage: number | null;
  highestScore: number | null;
  lowestScore: number | null;
  participationRate: number | null;
  lastExamDate: string | null;
}

export function useAllExamStats() {
  const { data: employees = [] } = useEmployees();
  const activeCount = employees.filter(e => e.status === 'ativo').length;

  return useQuery({
    queryKey: ['all_exam_stats'],
    queryFn: async () => {
      const { data: exams, error: exErr } = await supabase
        .from('employee_exams')
        .select('id, data_aplicacao')
        .eq('ativo', true)
        .order('data_aplicacao', { ascending: false });

      if (exErr) throw exErr;

      const examIds = (exams || []).map(e => e.id);
      if (examIds.length === 0) {
        return {
          totalExams: 0,
          totalScores: 0,
          overallAverage: null,
          highestScore: null,
          lowestScore: null,
          participationRate: null,
          lastExamDate: null,
        } as ExamStats;
      }

      const { data: scores, error: scErr } = await supabase
        .from('employee_exam_scores')
        .select('nota')
        .in('exam_id', examIds);

      if (scErr) throw scErr;

      const notas = (scores || []).map(s => Number(s.nota));
      const totalExams = exams!.length;
      const totalScores = notas.length;

      return {
        totalExams,
        totalScores,
        overallAverage: notas.length > 0 ? notas.reduce((a, b) => a + b, 0) / notas.length : null,
        highestScore: notas.length > 0 ? Math.max(...notas) : null,
        lowestScore: notas.length > 0 ? Math.min(...notas) : null,
        participationRate: activeCount > 0 && totalExams > 0
          ? (totalScores / (totalExams * activeCount)) * 100
          : null,
        lastExamDate: exams![0]?.data_aplicacao || null,
      } as ExamStats;
    },
  });
}
