import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AssetReportFilters {
  status?: string;
  tipo?: string;
  setor?: string;
  employeeId?: string;
}

export const useAssetReports = (filters?: AssetReportFilters) => {
  return useQuery({
    queryKey: ['asset-reports', filters],
    queryFn: async () => {
      // Fetch all assets
      let query = supabase
        .from('assets')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.status) query = query.eq('status', filters.status as any);
      if (filters?.tipo) query = query.eq('tipo', filters.tipo as any);

      const { data: assets, error } = await query;
      if (error) throw error;

      // Fetch active assignments with employee info
      const { data: assignments } = await supabase
        .from('asset_assignments')
        .select(`
          *,
          employee:employees(id, nome_completo, departamento, cargo),
          asset:assets(id, numero_patrimonio, tipo, marca, modelo, status)
        `)
        .eq('status', 'ativo');

      // Filter by employee/setor if needed
      let filteredAssignments = assignments || [];
      if (filters?.employeeId) {
        filteredAssignments = filteredAssignments.filter(a => a.employee_id === filters.employeeId);
      }
      if (filters?.setor) {
        filteredAssignments = filteredAssignments.filter(a => 
          (a.employee as any)?.departamento === filters.setor
        );
      }

      // Stats
      const stats = {
        total: assets?.length || 0,
        em_estoque: assets?.filter(a => a.status === 'em_estoque').length || 0,
        em_uso: assets?.filter(a => a.status === 'em_uso').length || 0,
        em_manutencao: assets?.filter(a => a.status === 'em_manutencao').length || 0,
        baixado: assets?.filter(a => a.status === 'baixado').length || 0,
        garantia_vencida: assets?.filter(a => {
          if (!a.garantia_fim) return false;
          return new Date(a.garantia_fim) < new Date();
        }).length || 0,
        garantia_proxima: assets?.filter(a => {
          if (!a.garantia_fim) return false;
          const end = new Date(a.garantia_fim);
          const now = new Date();
          const diff = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
          return diff > 0 && diff <= 30;
        }).length || 0,
      };

      // Group by setor
      const setores = new Map<string, number>();
      filteredAssignments.forEach(a => {
        const dept = (a.employee as any)?.departamento || 'Sem setor';
        setores.set(dept, (setores.get(dept) || 0) + 1);
      });

      return {
        assets: assets || [],
        assignments: filteredAssignments,
        stats,
        porSetor: Array.from(setores.entries()).map(([setor, count]) => ({ setor, count })),
      };
    },
  });
};
