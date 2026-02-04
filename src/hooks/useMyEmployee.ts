import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Employee, EmployeeDocument, EmployeeEvent, EmployeeNote, RhNfse } from '@/types/hr';

export function useMyEmployee() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-employee', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      // Primeiro tenta buscar por user_id
      let { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      // Fallback: buscar por email_pessoal se não encontrou por user_id
      if (!data && user.email) {
        const emailResult = await supabase
          .from('employees')
          .select('*')
          .ilike('email_pessoal', user.email)
          .maybeSingle();
        
        if (emailResult.data) {
          data = emailResult.data;
          console.log('Employee encontrado via email fallback:', data.nome_completo);
        }
      }
      
      if (error) throw error;
      return data as Employee | null;
    },
    enabled: !!user?.id,
  });
}

export function useMyEmployeeDocuments(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['my-employee-documents', employeeId],
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

export function useMyEmployeeEvents(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['my-employee-events', employeeId],
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

export function useMyEmployeeNfse(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['my-employee-nfse', employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      
      const { data, error } = await supabase
        .from('rh_nfse')
        .select('*')
        .eq('employee_id', employeeId)
        .order('ano', { ascending: false })
        .order('mes', { ascending: false });
      
      if (error) throw error;
      return data as RhNfse[];
    },
    enabled: !!employeeId,
  });
}

export function useMyEmployeeGestor(gestorId: string | null | undefined) {
  return useQuery({
    queryKey: ['my-employee-gestor', gestorId],
    queryFn: async () => {
      if (!gestorId) return null;
      
      const { data, error } = await supabase
        .from('employees')
        .select('nome_completo')
        .eq('id', gestorId)
        .maybeSingle();
      
      if (error) throw error;
      return data?.nome_completo || null;
    },
    enabled: !!gestorId,
  });
}

export interface UpdateMyEmployeeData {
  nome_completo?: string;
  cpf?: string;
  data_nascimento?: string | null;
  nacionalidade?: string;
  telefone?: string;
  email_pessoal?: string;
  cidade?: string;
  estado?: string;
}

export function useUpdateMyEmployee() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: UpdateMyEmployeeData) => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      
      const { data: result, error } = await supabase
        .from('employees')
        .update(data)
        .eq('user_id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-employee', user?.id] });
      toast.success('Dados atualizados com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar dados: ' + error.message);
    },
  });
}
