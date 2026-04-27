import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Mapeia o squad do SDR para os product_codes equivalentes — usado como
 * fallback quando `employee_products` está vazio (cadastro pendente).
 * Sem esse fallback, SDRs/Closers de Consórcio e Incorporador novos não
 * conseguem ver os menus de BU no sidebar (gate por requiredProducts).
 */
function squadToProducts(squad: string | null | undefined): string[] {
  switch (squad) {
    case 'consorcio':
    case 'credito':
      return ['consorcio'];
    case 'incorporador':
      return ['incorporador'];
    default:
      return [];
  }
}

export function useMyProducts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-products', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // 1) Buscar employee + sdr (squad) em paralelo
      const [employeeRes, sdrRes] = await Promise.all([
        supabase
          .from('employees')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('sdr')
          .select('squad')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      const employeeId = employeeRes.data?.id;
      const squad = sdrRes.data?.squad as string | null | undefined;

      // 2) Buscar products explicitamente cadastrados no employee
      let products: string[] = [];
      if (employeeId) {
        const { data, error } = await supabase
          .from('employee_products')
          .select('product_code')
          .eq('employee_id', employeeId);
        if (error) throw error;
        products = (data || []).map(p => p.product_code).filter(Boolean) as string[];
      }

      // 3) Fallback: se vazio, derivar do squad do SDR.
      //    Migração para employee_products ainda não foi feita para todos
            //    os SDRs/Closers de Consórcio e Incorporador.
      if (products.length === 0) {
        products = squadToProducts(squad);
      }

      return products;
    },
    enabled: !!user?.id,
  });
}
