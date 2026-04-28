import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ProcessRuleRole = "sdr" | "closer";

export interface ProcessRule {
  id: string;
  bu: string | null;
  role: ProcessRuleRole;
  rule_key: string;
  rule_value: any;
  is_active: boolean;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

export const RULE_KEYS = {
  MAX_MEETINGS: "max_meetings_per_week",
  MAX_NOSHOWS: "max_noshows_counted",
  RESCHEDULE_APPROVAL: "reschedule_approval_threshold",
  APPROVERS: "approval_required_roles",
} as const;

/** Busca todas as regras (admin view). */
export function useAllProcessRules() {
  return useQuery({
    queryKey: ["process-rules-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("process_rules" as any)
        .select("*")
        .order("bu", { ascending: true, nullsFirst: true })
        .order("role")
        .order("rule_key");
      if (error) throw error;
      return (data || []) as unknown as ProcessRule[];
    },
    staleTime: 30_000,
  });
}

/** Resolve uma regra efetiva para BU+role+key (BU-specific overrides global). */
export function useEffectiveRule(
  bu: string | null | undefined,
  role: ProcessRuleRole,
  ruleKey: string,
) {
  return useQuery({
    queryKey: ["process-rule-effective", bu ?? "__global__", role, ruleKey],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_process_rule" as any, {
        _bu: bu ?? null,
        _role: role,
        _rule_key: ruleKey,
      });
      if (error) throw error;
      return (data ?? null) as any;
    },
    staleTime: 60_000,
  });
}

/** Mutation para upsert de regra. */
export function useUpsertProcessRule() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      bu: string | null;
      role: ProcessRuleRole;
      rule_key: string;
      rule_value: any;
      is_active?: boolean;
      description?: string | null;
    }) => {
      // Procura existente
      let q = supabase
        .from("process_rules" as any)
        .select("id")
        .eq("role", input.role)
        .eq("rule_key", input.rule_key);
      if (input.bu === null) q = q.is("bu", null);
      else q = q.eq("bu", input.bu);
      const { data: existing } = await q.maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("process_rules" as any)
          .update({
            rule_value: input.rule_value,
            is_active: input.is_active ?? true,
            description: input.description,
            updated_by: user?.id ?? null,
          })
          .eq("id", (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("process_rules" as any).insert({
          bu: input.bu,
          role: input.role,
          rule_key: input.rule_key,
          rule_value: input.rule_value,
          is_active: input.is_active ?? true,
          description: input.description ?? null,
          updated_by: user?.id ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-rules-all"] });
      queryClient.invalidateQueries({ queryKey: ["process-rule-effective"] });
    },
  });
}
