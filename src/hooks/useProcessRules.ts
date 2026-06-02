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
  applies_from: string;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

export const RULE_KEYS = {
  MAX_MEETINGS: "max_meetings_per_week",
  MAX_NOSHOWS: "max_noshows_counted",
  RESCHEDULE_APPROVAL: "reschedule_approval_threshold",
  APPROVERS: "approval_required_roles",
  R1_COOLDOWN_DAYS: "r1_cooldown_days",
} as const;

/**
 * Rule keys usadas apenas em `rule_approval_requests` (não em `process_rules`).
 * Representam pedidos pontuais (não regras configuráveis por BU/cargo).
 */
export const APPROVAL_REQUEST_KEYS = {
  /** SDR/Closer pediu para reagendar R1 em lead já pago/won (libera admin/manager/coordenador + Jessica). */
  R1_FORCE_PAID_LEAD: "r1_force_paid_lead",
  /** SDR/Closer pediu liberação para reagendar R1 dentro da janela de cooldown (ex: 30 dias da R1 anterior). */
  R1_COOLDOWN_BYPASS: "r1_cooldown_bypass",
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
      applies_from?: string | null;
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
        const updatePayload: Record<string, any> = {
          rule_value: input.rule_value,
          is_active: input.is_active ?? true,
          description: input.description,
          updated_by: user?.id ?? null,
        };
        if (input.applies_from !== undefined) {
          updatePayload.applies_from = input.applies_from ?? new Date().toISOString();
        }
        const { error } = await supabase
          .from("process_rules" as any)
          .update(updatePayload)
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
          applies_from: input.applies_from ?? new Date().toISOString(),
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
