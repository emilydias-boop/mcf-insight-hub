import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export type TargetBU = "consorcio" | "incorporador";

export const BU_TRANSFER_OPTIONS: { value: TargetBU; label: string }[] = [
  { value: "consorcio", label: "BU - Consórcio" },
  { value: "incorporador", label: "BU - Incorporador MCF" },
];

interface Params {
  dealIds: string[];
  targetBU: TargetBU;
  targetSdrProfileId?: string | null;
}

interface Result {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  results: any[];
}

export function useBUTransfer() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ dealIds, targetBU, targetSdrProfileId }: Params): Promise<Result> => {
      const actorName =
        (user?.user_metadata?.full_name as string | undefined) ||
        user?.email?.split("@")[0] ||
        "Sistema";

      const { data, error } = await supabase.functions.invoke("transfer-deals-to-bu", {
        body: {
          deal_ids: dealIds,
          target_bu: targetBU,
          target_sdr_profile_id: targetSdrProfileId ?? null,
          actor_id: user?.id ?? null,
          actor_name: actorName,
          bulk: dealIds.length > 1,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha na transferência");
      return data as Result;
    },
    onSuccess: (res) => {
      const parts: string[] = [];
      if (res.created) parts.push(`${res.created} criado${res.created > 1 ? "s" : ""}`);
      if (res.updated) parts.push(`${res.updated} atualizado${res.updated > 1 ? "s" : ""}`);
      if (res.skipped) parts.push(`${res.skipped} ignorado${res.skipped > 1 ? "s" : ""}`);
      if (res.failed) parts.push(`${res.failed} falha${res.failed > 1 ? "s" : ""}`);
      const summary = parts.length ? parts.join(", ") : `${res.total} processado(s)`;
      if (res.failed && res.failed === res.total) {
        toast.error(`Transferência falhou (${summary})`);
      } else if (res.failed) {
        toast.warning(`Transferência concluída com avisos: ${summary}`);
      } else {
        toast.success(`Transferência concluída: ${summary}`);
      }
      queryClient.invalidateQueries({ queryKey: ["crm-deals"] });
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
    },
    onError: (err: any) => {
      console.error("useBUTransfer error:", err);
      toast.error(err?.message || "Erro ao transferir leads entre BUs");
    },
  });
}