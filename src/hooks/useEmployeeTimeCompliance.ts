import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Time Records
export function useEmployeeTimeRecords(employeeId: string | null) {
  return useQuery({
    queryKey: ['employee-time-records', employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await supabase
        .from('employee_time_records')
        .select('*')
        .eq('employee_id', employeeId)
        .order('data_inicio', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!employeeId,
  });
}

export function useTimeRecordMutations() {
  const queryClient = useQueryClient();

  const createRecord = useMutation({
    mutationFn: async (data: any) => {
      const { data: result, error } = await supabase.from('employee_time_records').insert(data).select().single();
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employee-time-records', variables.employee_id] });
      toast.success('Registro adicionado');
    },
    onError: (error: any) => toast.error('Erro: ' + error.message),
  });

  const updateRecord = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { data: result, error } = await supabase.from('employee_time_records').update(data).eq('id', id).select().single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-time-records'] });
      toast.success('Registro atualizado');
    },
    onError: (error: any) => toast.error('Erro: ' + error.message),
  });

  const deleteRecord = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('employee_time_records').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-time-records'] });
      toast.success('Registro removido');
    },
    onError: (error: any) => toast.error('Erro: ' + error.message),
  });

  return { createRecord, updateRecord, deleteRecord };
}

// Compliance
export function useEmployeeCompliance(employeeId: string | null) {
  return useQuery({
    queryKey: ['employee-compliance', employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await supabase
        .from('employee_compliance')
        .select('*')
        .eq('employee_id', employeeId)
        .order('data_ocorrencia', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!employeeId,
  });
}

export function useComplianceMutations() {
  const queryClient = useQueryClient();

  const createCompliance = useMutation({
    mutationFn: async (data: any) => {
      const { data: result, error } = await supabase.from('employee_compliance').insert(data).select().single();
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employee-compliance', variables.employee_id] });
      toast.success('Registro de compliance adicionado');
    },
    onError: (error: any) => toast.error('Erro: ' + error.message),
  });

  const updateCompliance = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { data: result, error } = await supabase.from('employee_compliance').update(data).eq('id', id).select().single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-compliance'] });
      toast.success('Registro atualizado');
    },
    onError: (error: any) => toast.error('Erro: ' + error.message),
  });

  const deleteCompliance = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('employee_compliance').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-compliance'] });
      toast.success('Registro removido');
    },
    onError: (error: any) => toast.error('Erro: ' + error.message),
  });

  return { createCompliance, updateCompliance, deleteCompliance };
}
