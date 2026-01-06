import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useMyProducts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-products', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // First get the employee id for this user
      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (!employee?.id) return [];
      
      // Then get the products for this employee
      const { data, error } = await supabase
        .from('employee_products')
        .select('product_code')
        .eq('employee_id', employee.id);
      
      if (error) throw error;
      return data?.map(p => p.product_code) || [];
    },
    enabled: !!user?.id,
  });
}
