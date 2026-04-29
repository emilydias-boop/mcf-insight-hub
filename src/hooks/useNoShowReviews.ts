import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PendingReview {
  id: string;
  deal_id: string | null;
  meeting_slot_id: string | null;
  attendee_id: string | null;
  lead_phone: string | null;
  evidence_path: string;
  ai_verdict: string | null;
  ai_reasoning: string | null;
  ai_extracted_phone: string | null;
  phone_match: boolean | null;
  sdr_justification: string | null;
  performed_by: string | null;
  performed_by_role: string | null;
  bu_origin_id: string | null;
  meeting_type: string | null;
  created_at: string;
  manager_review_status: string | null;
  manager_review_by: string | null;
  manager_review_at: string | null;
  manager_review_notes: string | null;
  final_status: string | null;
  human_decision: string | null;
  human_overrode_ai: boolean | null;
}

export function useNoShowPendingReviews() {
  return useQuery({
    queryKey: ["no-show-all-reviews"],
    queryFn: async (): Promise<PendingReview[]> => {
      const { data, error } = await supabase
        .from("no_show_validations")
        .select(
          "id, deal_id, meeting_slot_id, attendee_id, lead_phone, evidence_path, ai_verdict, ai_reasoning, ai_extracted_phone, phone_match, sdr_justification, performed_by, performed_by_role, bu_origin_id, meeting_type, created_at, manager_review_status, manager_review_by, manager_review_at, manager_review_notes, final_status, human_decision, human_overrode_ai"
        )
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as PendingReview[];
    },
    staleTime: 30_000,
  });
}

export function useNoShowPendingReviewsCount() {
  return useQuery({
    queryKey: ["no-show-pending-reviews-count"],
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from("no_show_validations")
        .select("id", { count: "exact", head: true })
        .eq("manager_review_status", "pending");
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

export function useReviewNoShowContest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      validationId,
      decision,
      notes,
    }: {
      validationId: string;
      decision: "approved" | "rejected";
      notes?: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) throw new Error("Sessão inválida");
      const { error } = await supabase
        .from("no_show_validations")
        .update({
          manager_review_status: decision,
          manager_review_by: uid,
          manager_review_at: new Date().toISOString(),
          manager_review_notes: notes ?? null,
          final_status: decision === "approved" ? "approved" : "blocked",
        })
        .eq("id", validationId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["no-show-all-reviews"] });
      qc.invalidateQueries({ queryKey: ["no-show-pending-reviews-count"] });
      toast.success(vars.decision === "approved" ? "Contestação aprovada" : "Contestação rejeitada");
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao revisar"),
  });
}

export async function getEvidenceSignedUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage
    .from("no-show-evidence")
    .createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

/**
 * Lista as evidências de No-Show enviadas pelo usuário logado (SDR/Closer).
 * Read-only — usado em /crm/meus-no-shows e no drawer do lead.
 */
export function useMyNoShowEvidences(opts?: { dealId?: string | null }) {
  return useQuery({
    queryKey: ["my-no-show-evidences", opts?.dealId ?? "all"],
    queryFn: async (): Promise<PendingReview[]> => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) return [];
      let q = supabase
        .from("no_show_validations")
        .select(
          "id, deal_id, meeting_slot_id, attendee_id, lead_phone, evidence_path, ai_verdict, ai_reasoning, ai_extracted_phone, phone_match, sdr_justification, performed_by, performed_by_role, bu_origin_id, meeting_type, created_at, manager_review_status, manager_review_by, manager_review_at, manager_review_notes, final_status, human_decision, human_overrode_ai"
        )
        .eq("performed_by", uid)
        .order("created_at", { ascending: false })
        .limit(200);
      if (opts?.dealId) q = q.eq("deal_id", opts.dealId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PendingReview[];
    },
    staleTime: 30_000,
  });
}