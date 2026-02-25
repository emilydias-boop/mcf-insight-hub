import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ProductConfiguration {
  id: string;
  product_name: string;
  product_code: string | null;
  display_name: string | null;
  product_category: string;
  target_bu: string | null;
  reference_price: number;
  is_active: boolean;
  count_in_dashboard: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductConfigurationUpdate {
  product_code?: string | null;
  display_name?: string | null;
  product_category?: string;
  target_bu?: string | null;
  reference_price?: number;
  is_active?: boolean;
  count_in_dashboard?: boolean;
  notes?: string | null;
}

export const useProductConfigurations = () => {
  return useQuery({
    queryKey: ["product-configurations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_configurations")
        .select("*")
        .order("product_name", { ascending: true });

      if (error) throw error;
      return data as ProductConfiguration[];
    },
  });
};

export const useUpdateProductConfiguration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
      effectiveFrom,
    }: {
      id: string;
      updates: ProductConfigurationUpdate;
      effectiveFrom?: Date;
    }) => {
      const { data, error } = await supabase
        .from("product_configurations")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Se houve mudança de preço e uma data de vigência foi informada,
      // atualiza o effective_from do registro mais recente do histórico
      if (effectiveFrom && updates.reference_price !== undefined) {
        // Converte para início do dia em São Paulo (BRT = UTC-3)
        const year = effectiveFrom.getFullYear();
        const month = String(effectiveFrom.getMonth() + 1).padStart(2, '0');
        const day = String(effectiveFrom.getDate()).padStart(2, '0');
        const effectiveFromISO = `${year}-${month}-${day}T00:00:00-03:00`;

        // Busca o registro mais recente criado pelo trigger, filtrando por new_price
        const { data: latestHistory, error: historyFetchError } = await supabase
          .from("product_price_history")
          .select("id")
          .eq("product_config_id", id)
          .eq("new_price", updates.reference_price)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (historyFetchError || !latestHistory) {
          console.error("Erro ao buscar histórico de preço:", historyFetchError);
          toast.warning("Preço salvo, mas a vigência não foi aplicada. Registro de histórico não encontrado.");
        } else {
          const { error: historyUpdateError } = await supabase
            .from("product_price_history")
            .update({ effective_from: effectiveFromISO })
            .eq("id", latestHistory.id);

          if (historyUpdateError) {
            console.error("Erro ao atualizar vigência:", historyUpdateError);
            toast.warning(`Preço salvo, mas a vigência não foi aplicada: ${historyUpdateError.message}`);
          }
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-configurations"] });
      queryClient.invalidateQueries({ queryKey: ["price-history"] });
      toast.success("Produto atualizado com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar produto: ${error.message}`);
    },
  });
};

export const useSyncProductsFromTransactions = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Busca produtos únicos das transações que ainda não estão na tabela de configurações
      const { data: existingProducts, error: fetchError } = await supabase
        .from("product_configurations")
        .select("product_name");

      if (fetchError) throw fetchError;

      const existingNames = new Set(existingProducts?.map((p) => p.product_name) || []);

      const { data: transactions, error: transError } = await supabase
        .from("hubla_transactions")
        .select("product_name, product_category, product_price")
        .not("product_name", "is", null);

      if (transError) throw transError;

      // Agrupa por product_name para pegar o maior preço
      const productMap = new Map<string, { category: string; price: number }>();
      
      for (const t of transactions || []) {
        if (!t.product_name || existingNames.has(t.product_name)) continue;
        
        const existing = productMap.get(t.product_name);
        const price = t.product_price || 0;
        
        if (!existing || price > existing.price) {
          productMap.set(t.product_name, {
            category: t.product_category || "outros",
            price: price,
          });
        }
      }

      if (productMap.size === 0) {
        return { inserted: 0 };
      }

      const newProducts = Array.from(productMap.entries()).map(([name, data]) => ({
        product_name: name,
        product_category: data.category,
        reference_price: data.price,
      }));

      const { error: insertError } = await supabase
        .from("product_configurations")
        .insert(newProducts);

      if (insertError) throw insertError;

      return { inserted: newProducts.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["product-configurations"] });
      if (data.inserted > 0) {
        toast.success(`${data.inserted} novos produtos sincronizados!`);
      } else {
        toast.info("Nenhum produto novo para sincronizar.");
      }
    },
    onError: (error) => {
      toast.error(`Erro ao sincronizar: ${error.message}`);
    },
  });
};

// Opções de BU disponíveis
export const TARGET_BU_OPTIONS = [
  { value: "incorporador", label: "Incorporador MCF" },
  { value: "consorcio", label: "Consórcio" },
  { value: "credito", label: "Crédito" },
  { value: "projetos", label: "Projetos" },
  { value: "outros", label: "Outros" },
];

// Categorias disponíveis (baseado nos dados existentes)
export const PRODUCT_CATEGORY_OPTIONS = [
  { value: "a010", label: "A010 - Consultoria" },
  { value: "incorporador", label: "Incorporador" },
  { value: "contrato", label: "Contrato" },
  { value: "consorcio", label: "Consórcio" },
  { value: "credito", label: "Crédito" },
  { value: "outros", label: "Outros" },
];
