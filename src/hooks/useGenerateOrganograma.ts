import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EmployeeForOrg {
  id: string;
  cargo_catalogo_id: string | null;
  gestor_id: string | null;
  departamento: string | null;
}

interface OrgNode {
  cargo_catalogo_id: string;
  parent_id: string | null;
  squad: string | null;
  departamento: string | null;
  posicao_ordem: number;
  ativo: boolean;
}

export function useGenerateOrganograma() {
  const queryClient = useQueryClient();

  const generateFromHR = useMutation({
    mutationFn: async () => {
      // 1. Buscar employees ativos com cargo_catalogo_id
      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('id, cargo_catalogo_id, gestor_id, departamento')
        .eq('status', 'ativo')
        .not('cargo_catalogo_id', 'is', null);

      if (empError) throw empError;
      if (!employees || employees.length === 0) {
        throw new Error('Nenhum colaborador com cargo do catálogo encontrado');
      }

      // 2. Buscar cargos do catálogo para obter o nível
      const cargoIds = [...new Set(employees.map(e => e.cargo_catalogo_id).filter(Boolean))];
      const { data: cargos, error: cargoError } = await supabase
        .from('cargos_catalogo')
        .select('id, nivel, area')
        .in('id', cargoIds);

      if (cargoError) throw cargoError;

      const cargoMap = new Map(cargos?.map(c => [c.id, c]) || []);

      // 3. Mapear departamento para squad
      const deptToSquad = (dept: string | null): string | null => {
        if (!dept) return null;
        const deptLower = dept.toLowerCase();
        if (deptLower.includes('consórcio') || deptLower.includes('consorcio')) return 'consorcio';
        if (deptLower.includes('crédito') || deptLower.includes('credito')) return 'credito';
        if (deptLower.includes('incorpor')) return 'incorporador';
        if (deptLower.includes('projeto')) return 'projetos';
        return null;
      };

      // 4. Criar mapa de cargos únicos por squad
      const cargoSquadMap = new Map<string, OrgNode>();
      
      for (const emp of employees as EmployeeForOrg[]) {
        if (!emp.cargo_catalogo_id) continue;
        
        const squad = deptToSquad(emp.departamento);
        const key = `${emp.cargo_catalogo_id}-${squad || 'geral'}`;
        
        if (!cargoSquadMap.has(key)) {
          const cargo = cargoMap.get(emp.cargo_catalogo_id);
          cargoSquadMap.set(key, {
            cargo_catalogo_id: emp.cargo_catalogo_id,
            squad,
            departamento: emp.departamento,
            parent_id: null, // Será preenchido depois
            posicao_ordem: cargo?.nivel || 100, // Usar nível como ordem
            ativo: true,
          });
        }
      }

      // 5. Limpar organograma existente
      const { error: deleteError } = await (supabase as any)
        .from('organograma')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (deleteError) throw deleteError;

      // 6. Inserir nodes no organograma
      const nodes = Array.from(cargoSquadMap.values());
      
      if (nodes.length > 0) {
        const { error: insertError } = await (supabase as any)
          .from('organograma')
          .insert(nodes);

        if (insertError) throw insertError;
      }

      return { nodesCreated: nodes.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["organograma"] });
      toast.success(`Organograma gerado com ${data.nodesCreated} posições`);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao gerar organograma: ${error.message}`);
    },
  });

  const clearOrganograma = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from('organograma')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organograma"] });
      toast.success("Organograma limpo com sucesso");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao limpar organograma: ${error.message}`);
    },
  });

  return { generateFromHR, clearOrganograma };
}
