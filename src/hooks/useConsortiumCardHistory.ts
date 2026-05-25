import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CardActivityCategory = "parcela" | "boleto" | "documento" | "carta" | "sistema";
export type CardActivityEvent =
  | "installment_paid" | "installment_reverted" | "installment_value_changed"
  | "installment_due_changed" | "installment_form_changed" | "installment_created"
  | "installment_deleted" | "installment_recalculated"
  | "boleto_uploaded" | "boleto_replaced" | "boleto_deleted" | "boleto_sent"
  | "document_uploaded" | "document_deleted"
  | "card_created" | "card_field_changed" | "card_status_changed" | "card_deleted";

export interface CardActivityLog {
  id: string;
  card_id: string;
  subscription_id: string | null;
  installment_id: string | null;
  boleto_id: string | null;
  document_id: string | null;
  event_category: CardActivityCategory;
  event_type: CardActivityEvent;
  description: string;
  before_value: any;
  after_value: any;
  metadata: any;
  actor_id: string | null;
  actor_name: string | null;
  created_at: string;
}

export function useConsortiumCardHistory(cardId: string | null | undefined) {
  return useQuery({
    queryKey: ["consortium-card-history", cardId],
    queryFn: async (): Promise<CardActivityLog[]> => {
      if (!cardId) return [];
      const { data, error } = await (supabase as any)
        .from("consortium_card_activity_log")
        .select("*")
        .eq("card_id", cardId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as CardActivityLog[];
    },
    enabled: !!cardId,
  });
}