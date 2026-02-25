import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/formatters";
import { History, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface PriceHistoryEntry {
  id: string;
  old_price: number;
  new_price: number;
  effective_from: string;
  created_at: string;
}

interface PriceHistorySectionProps {
  productConfigId: string | null;
}

const usePriceHistory = (productConfigId: string | null) => {
  return useQuery({
    queryKey: ["price-history", productConfigId],
    queryFn: async () => {
      if (!productConfigId) return [];
      const { data, error } = await supabase
        .from("product_price_history")
        .select("id, old_price, new_price, effective_from, created_at")
        .eq("product_config_id", productConfigId)
        .order("effective_from", { ascending: false });
      if (error) throw error;
      return data as PriceHistoryEntry[];
    },
    enabled: !!productConfigId,
  });
};

export function PriceHistorySection({ productConfigId }: PriceHistorySectionProps) {
  const { data: history, isLoading } = usePriceHistory(productConfigId);

  // Filtrar baseline (old_price === new_price) para exibição limpa
  const realChanges = history?.filter(h => h.old_price !== h.new_price) || [];

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground py-2">Carregando histórico...</div>
    );
  }

  if (realChanges.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <Separator />
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Histórico de Preço</span>
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {realChanges.map((entry) => {
          const diff = entry.new_price - entry.old_price;
          const Icon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
          const colorClass = diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : "text-muted-foreground";

          return (
            <div
              key={entry.id}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2">
                <Icon className={`h-3.5 w-3.5 ${colorClass}`} />
                <span className="text-muted-foreground">
                  {format(new Date(entry.effective_from), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground line-through">
                  {formatCurrency(entry.old_price)}
                </span>
                <span>→</span>
                <span className={`font-medium ${colorClass}`}>
                  {formatCurrency(entry.new_price)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
