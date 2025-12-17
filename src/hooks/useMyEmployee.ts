import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Employee, EmployeeDocument, EmployeeEvent, EmployeeNote, RhNfse } from '@/types/hr';

export function useMyEmployee() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-employee', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
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
