import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface CloserInfo {
  id: string;
  name: string;
  email: string;
  color: string | null;
}

export const useGestorClosers = (meetingType?: 'r1' | 'r2') => {
  const { role, user } = useAuth();
  
  return useQuery({
    queryKey: ['gestor-closers', user?.id, role, meetingType],
    queryFn: async (): Promise<CloserInfo[]> => {
      // Admin e manager veem todos os closers
      if (role === 'admin' || role === 'manager') {
        let query = supabase
          .from('closers')
          .select('id, name, email, color')
          .eq('is_active', true);
        
        if (meetingType) {
          query = query.eq('meeting_type', meetingType);
        }
        
        const { data, error } = await query.order('name');
        
        if (error) throw error;
        return data || [];
      }
      
      // Coordenador vê closers do seu squad via employees
      if (role === 'coordenador') {
        // Primeiro buscar o employee_id e squad do coordenador
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user?.id)
          .single();
        
        if (!profile) return [];
        
        // Buscar employees que são closers onde o gestor_id é o coordenador
        const { data: managedEmployees, error: empError } = await supabase
          .from('employees')
          .select('id')
          .eq('gestor_id', profile.id);
        
        if (empError) throw empError;
        
        const employeeIds = (managedEmployees || []).map(e => e.id);
        
        if (employeeIds.length === 0) {
          // Se não tem employees gerenciados, retornar array vazio
          return [];
        }
        
        // Buscar closers que correspondem a esses employees
        let closerQuery = supabase
          .from('closers')
          .select('id, name, email, color, employee_id')
          .eq('is_active', true)
          .in('employee_id', employeeIds);
        
        if (meetingType) {
          closerQuery = closerQuery.eq('meeting_type', meetingType);
        }
        
        const { data: closers, error: closerError } = await closerQuery.order('name');
        
        if (closerError) throw closerError;
        return closers || [];
      }
      
      // Outros roles não veem closers
      return [];
    },
    enabled: !!user?.id && !!role,
    staleTime: 5 * 60 * 1000,
  });
};
