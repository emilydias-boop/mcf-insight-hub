import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface ApprovalRequest {
  id: string;
  bu: string | null;
  rule_key: string;
  requested_by: string;
  requester_role: "sdr" | "closer";
  target_deal_id: string | null;
  payload: any;
  status: ApprovalStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Lista pedidos pendentes (para aprovadores). */
export function usePendingApprovals(buFilter?: string | null) {
  return useQuery({
    queryKey: ["approval-requests-pending", buFilter ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("rule_approval_requests" as any)
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (buFilter) q = q.eq("bu", buFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as ApprovalRequest[];
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

/** Conta pedidos pendentes (para badge no sidebar). */
export function usePendingApprovalsCount() {
  return useQuery({
    queryKey: ["approval-requests-pending-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("rule_approval_requests" as any)
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) return 0;
      return count ?? 0;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/** Histórico (todos os status). */
export function useApprovalHistory(limit = 100) {
  return useQuery({
    queryKey: ["approval-requests-history", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rule_approval_requests" as any)
        .select("*")
        .neq("status", "pending")
        .order("reviewed_at", { ascending: false, nullsFirst: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as unknown as ApprovalRequest[];
    },
    staleTime: 30_000,
  });
}

/** Pedidos do próprio solicitante. */
export function useMyApprovalRequests() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-approval-requests", user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as ApprovalRequest[];
      const { data, error } = await supabase
        .from("rule_approval_requests" as any)
        .select("*")
        .eq("requested_by", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ApprovalRequest[];
    },
    enabled: !!user?.id,
    staleTime: 15_000,
  });
}

/** Cria um pedido (chamado quando SDR/Closer atinge limite). */
export function useCreateApprovalRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      bu: string | null;
      rule_key: string;
      requester_role: "sdr" | "closer";
      target_deal_id?: string | null;
      payload?: any;
    }) => {
      if (!user?.id) throw new Error("Não autenticado");
      const { data, error } = await supabase
        .from("rule_approval_requests" as any)
        .insert({
          bu: input.bu,
          rule_key: input.rule_key,
          requester_role: input.requester_role,
          requested_by: user.id,
          target_deal_id: input.target_deal_id ?? null,
          payload: input.payload ?? {},
          status: "pending",
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ApprovalRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-approval-requests"] });
      queryClient.invalidateQueries({ queryKey: ["approval-requests-pending"] });
      queryClient.invalidateQueries({ queryKey: ["approval-requests-pending-count"] });
    },
  });
}

/** Aprovar / Rejeitar (somente aprovadores). */
export function useReviewApprovalRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      action: "approved" | "rejected";
      notes?: string;
    }) => {
      const { error } = await supabase
        .from("rule_approval_requests" as any)
        .update({
          status: input.action,
          reviewed_by: user?.id ?? null,
          reviewed_at: new Date().toISOString(),
          review_notes: input.notes ?? null,
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approval-requests-pending"] });
      queryClient.invalidateQueries({ queryKey: ["approval-requests-pending-count"] });
      queryClient.invalidateQueries({ queryKey: ["approval-requests-history"] });
    },
  });
}
