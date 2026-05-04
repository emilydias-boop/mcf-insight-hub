import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BlockedAttempt = {
  id: string;
  deal_id: string | null;
  attendee_id: string | null;
  meeting_slot_id: string | null;
  evidence_hash: string | null;
  evidence_path: string | null;
  lead_phone: string | null;
  lead_name: string | null;
  attempted_by: string;
  attempt_reason: "duplicate_hash" | "duplicate_active";
  conflicting_validation_id: string | null;
  conflicting_deal_id: string | null;
  ai_verdict: string | null;
  meeting_type: string | null;
  bu_origin_id: string | null;
  created_at: string;
  attempted_by_profile?: { full_name: string | null } | null;
};

export function useNoShowBlockedAttempts() {
  return useQuery({
    queryKey: ["no-show-blocked-attempts"],
    queryFn: async (): Promise<BlockedAttempt[]> => {
      const { data, error } = await supabase
        .from("no_show_blocked_attempts" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const rows = (data ?? []) as BlockedAttempt[];
      const ids = Array.from(new Set(rows.map((r) => r.attempted_by).filter(Boolean)));
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", ids);
        const byId = new Map((profs ?? []).map((p: any) => [p.id, p]));
        rows.forEach((r) => {
          r.attempted_by_profile = (byId.get(r.attempted_by) as any) ?? null;
        });
      }
      return rows;
    },
    staleTime: 30_000,
  });
}