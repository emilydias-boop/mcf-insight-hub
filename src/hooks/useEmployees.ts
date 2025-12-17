import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Employee, EmployeeDocument, EmployeeEvent, EmployeeNote } from '@/types/hr';
import { toast } from 'sonner';

export function useEmployees() {
  return useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('nome_completo');
      
      if (error) throw error;
      return data as Employee[];
    },
  });
}

export function useEmployee(id: string | null) {
  return useQuery({
    queryKey: ['employee', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data as Employee | null;
    },
    enabled: !!id,
  });
}

export function useEmployeeDocuments(employeeId: string | null) {
  return useQuery({
    queryKey: ['employee-documents', employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await supabase
        .from('employee_documents')
        .select('*')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as EmployeeDocument[];
    },
    enabled: !!employeeId,
  });
}

export function useEmployeeEvents(employeeId: string | null) {
  return useQuery({
    queryKey: ['employee-events', employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await supabase
        .from('employee_events')
        .select('*')
        .eq('employee_id', employeeId)
        .order('data_evento', { ascending: false });
      
      if (error) throw error;
      return data as EmployeeEvent[];
    },
    enabled: !!employeeId,
  });
}

export function useEmployeeNotes(employeeId: string | null) {
  return useQuery({
    queryKey: ['employee-notes', employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await supabase
        .from('employee_notes')
        .select('*')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as EmployeeNote[];
    },
    enabled: !!employeeId,
  });
}

export function useEmployeeMutations() {
  const queryClient = useQueryClient();

  const createEmployee = useMutation({
    mutationFn: async (data: Partial<Employee>) => {
      const { data: result, error } = await supabase
        .from('employees')
        .insert(data as any)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Colaborador cadastrado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao cadastrar colaborador: ' + error.message);
    },
  });

  const updateEmployee = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Employee> }) => {
      const { data: result, error } = await supabase
        .from('employees')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee', variables.id] });
      toast.success('Colaborador atualizado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar colaborador: ' + error.message);
    },
  });

  const deleteEmployee = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Colaborador removido com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao remover colaborador: ' + error.message);
    },
  });

  const createNote = useMutation({
    mutationFn: async (data: Partial<EmployeeNote>) => {
      const { data: result, error } = await supabase
        .from('employee_notes')
        .insert(data as any)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employee-notes', variables.employee_id] });
      toast.success('Nota adicionada');
    },
    onError: (error) => {
      toast.error('Erro ao adicionar nota: ' + error.message);
    },
  });

  const updateNote = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EmployeeNote> }) => {
      const { data: result, error } = await supabase
        .from('employee_notes')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employee-notes'] });
      toast.success('Nota atualizada');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar nota: ' + error.message);
    },
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('employee_notes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-notes'] });
      toast.success('Nota removida');
    },
    onError: (error) => {
      toast.error('Erro ao remover nota: ' + error.message);
    },
  });

  const createEvent = useMutation({
    mutationFn: async (data: Partial<EmployeeEvent>) => {
      const { metadata, ...rest } = data;
      const { data: result, error } = await supabase
        .from('employee_events')
        .insert(rest as any)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employee-events', variables.employee_id] });
      toast.success('Evento registrado');
    },
    onError: (error) => {
      toast.error('Erro ao registrar evento: ' + error.message);
    },
  });

  const updateEvent = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EmployeeEvent> }) => {
      const { metadata, ...rest } = data;
      const { data: result, error } = await supabase
        .from('employee_events')
        .update(rest as any)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-events'] });
      toast.success('Evento atualizado');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar evento: ' + error.message);
    },
  });

  const deleteEvent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('employee_events')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-events'] });
      toast.success('Evento removido');
    },
    onError: (error) => {
      toast.error('Erro ao remover evento: ' + error.message);
    },
  });

  const createDocument = useMutation({
    mutationFn: async (data: Partial<EmployeeDocument>) => {
      const { data: result, error } = await supabase
        .from('employee_documents')
        .insert(data as any)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employee-documents', variables.employee_id] });
      toast.success('Documento adicionado');
    },
    onError: (error) => {
      toast.error('Erro ao adicionar documento: ' + error.message);
    },
  });

  const updateDocument = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EmployeeDocument> }) => {
      const { data: result, error } = await supabase
        .from('employee_documents')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-documents'] });
      toast.success('Documento atualizado');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar documento: ' + error.message);
    },
  });

  const deleteDocument = useMutation({
    mutationFn: async ({ id, storagePath }: { id: string; storagePath?: string }) => {
      // Delete file from storage if exists
      if (storagePath) {
        await supabase.storage.from('user-files').remove([storagePath]);
      }
      
      const { error } = await supabase
        .from('employee_documents')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-documents'] });
      toast.success('Documento removido');
    },
    onError: (error) => {
      toast.error('Erro ao remover documento: ' + error.message);
    },
  });

  return {
    createEmployee,
    updateEmployee,
    deleteEmployee,
    createNote,
    updateNote,
    deleteNote,
    createEvent,
    updateEvent,
    deleteEvent,
    createDocument,
    updateDocument,
    deleteDocument,
  };
}

// Hook para buscar dados de fechamento SDR vinculado ao colaborador
export function useEmployeeSdrPayouts(sdrId: string | null, limit = 6) {
  return useQuery({
    queryKey: ['employee-sdr-payouts', sdrId, limit],
    queryFn: async () => {
      if (!sdrId) return [];
      const { data, error } = await supabase
        .from('sdr_month_payout')
        .select(`
          *,
          sdr_month_kpi (*)
        `)
        .eq('sdr_id', sdrId)
        .order('ano_mes', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data;
    },
    enabled: !!sdrId,
  });
}
