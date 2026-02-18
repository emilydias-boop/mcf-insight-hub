import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface A010LinkMapping {
  id: string;
  name: string;
  offer: string;
  origin: string;
  channel: string;
  match_utm_source: string | null;
  match_utm_campaign: string | null;
  match_utm_medium: string | null;
  match_source: string | null;
  priority: number;
  is_active: boolean;
  created_at: string;
}

export type A010LinkMappingInsert = Omit<A010LinkMapping, "id" | "created_at">;

export function useA010LinkMappings() {
  return useQuery({
    queryKey: ["a010-link-mappings"],
    queryFn: async (): Promise<A010LinkMapping[]> => {
      const { data, error } = await supabase
        .from("a010_link_mappings" as any)
        .select("*")
        .order("priority", { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as A010LinkMapping[];
    },
  });
}

export function useCreateA010LinkMapping() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (mapping: A010LinkMappingInsert) => {
      const { error } = await supabase
        .from("a010_link_mappings" as any)
        .insert(mapping as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["a010-link-mappings"] });
      toast.success("Mapeamento criado com sucesso");
    },
    onError: (err: any) => toast.error("Erro ao criar mapeamento: " + err.message),
  });
}

export function useUpdateA010LinkMapping() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...mapping }: Partial<A010LinkMapping> & { id: string }) => {
      const { error } = await supabase
        .from("a010_link_mappings" as any)
        .update(mapping as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["a010-link-mappings"] });
      toast.success("Mapeamento atualizado");
    },
    onError: (err: any) => toast.error("Erro ao atualizar: " + err.message),
  });
}

export function useDeleteA010LinkMapping() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("a010_link_mappings" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["a010-link-mappings"] });
      toast.success("Mapeamento excluído");
    },
    onError: (err: any) => toast.error("Erro ao excluir: " + err.message),
  });
}
