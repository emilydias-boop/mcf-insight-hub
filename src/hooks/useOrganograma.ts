import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CargoMetricaConfig, OrganogramaNode, CargoCatalogo } from "@/types/organograma";
import { toast } from "sonner";

// Fetch all cargos from catalog
export function useCargos() {
  return useQuery({
    queryKey: ["cargos-catalogo"],
    queryFn: async (): Promise<CargoCatalogo[]> => {
      const { data, error } = await supabase
        .from("cargos_catalogo")
        .select("*")
        .eq("ativo", true)
        .order("area", { ascending: true })
        .order("nivel", { ascending: true });

      if (error) throw error;
      return (data as CargoCatalogo[]) || [];
    },
  });
}

// Fetch organograma hierarchy
export function useOrganograma(squad?: string) {
  return useQuery({
    queryKey: ["organograma", squad],
    queryFn: async (): Promise<OrganogramaNode[]> => {
      let query = (supabase as any)
        .from("organograma")
        .select(`
          *,
          cargo:cargos_catalogo (
            id,
            nome_exibicao,
            cargo_base,
            area
          )
        `)
        .eq("ativo", true)
        .order("posicao_ordem", { ascending: true });

      if (squad) {
        query = query.eq("squad", squad);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as OrganogramaNode[]) || [];
    },
  });
}

// Fetch metrics config for a specific cargo
export function useCargoMetricas(cargoId: string | null, squad?: string | null) {
  return useQuery({
    queryKey: ["cargo-metricas", cargoId, squad],
    queryFn: async (): Promise<CargoMetricaConfig[]> => {
      if (!cargoId) return [];

      let query = (supabase as any)
        .from("cargo_metricas_config")
        .select("*")
        .eq("cargo_catalogo_id", cargoId)
        .eq("ativo", true)
        .order("ordem", { ascending: true });

      if (squad) {
        query = query.or(`squad.eq.${squad},squad.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as CargoMetricaConfig[]) || [];
    },
    enabled: !!cargoId,
  });
}

// Mutations for cargo metrics
export function useCargoMetricasMutations() {
  const queryClient = useQueryClient();

  const createMetrica = useMutation({
    mutationFn: async (metrica: Omit<CargoMetricaConfig, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await (supabase as any)
        .from("cargo_metricas_config")
        .insert(metrica)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cargo-metricas"] });
      toast.success("Métrica adicionada com sucesso");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao adicionar métrica: ${error.message}`);
    },
  });

  const updateMetrica = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CargoMetricaConfig> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from("cargo_metricas_config")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cargo-metricas"] });
      toast.success("Métrica atualizada com sucesso");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar métrica: ${error.message}`);
    },
  });

  const deleteMetrica = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("cargo_metricas_config")
        .update({ ativo: false, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cargo-metricas"] });
      toast.success("Métrica removida com sucesso");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover métrica: ${error.message}`);
    },
  });

  return { createMetrica, updateMetrica, deleteMetrica };
}

// Mutations for organograma nodes
export function useOrganogramaMutations() {
  const queryClient = useQueryClient();

  const createNode = useMutation({
    mutationFn: async (node: Omit<OrganogramaNode, 'id' | 'created_at' | 'updated_at' | 'cargo' | 'children'>) => {
      const { data, error } = await (supabase as any)
        .from("organograma")
        .insert(node)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organograma"] });
      toast.success("Posição adicionada com sucesso");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao adicionar posição: ${error.message}`);
    },
  });

  const updateNode = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<OrganogramaNode> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from("organograma")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organograma"] });
      toast.success("Posição atualizada com sucesso");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar posição: ${error.message}`);
    },
  });

  const deleteNode = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("organograma")
        .update({ ativo: false, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organograma"] });
      toast.success("Posição removida com sucesso");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover posição: ${error.message}`);
    },
  });

  return { createNode, updateNode, deleteNode };
}
