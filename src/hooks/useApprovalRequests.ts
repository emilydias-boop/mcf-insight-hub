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

export interface EnrichedApproval extends ApprovalRequest {
  requester_name: string | null;
  requester_email: string | null;
  deal: {
    id: string;
    name: string | null;
    contact_name: string | null;
    contact_phone: string | null;
    contact_email: string | null;
    stage_name: string | null;
    origin_name: string | null;
    owner_id: string | null;
    owner_name: string | null;
    product_name: string | null;
  } | null;
  current_meeting: {
    scheduled_at: string | null;
    status: string | null;
    closer_id: string | null;
    closer_name: string | null;
    meeting_type: string | null;
  } | null;
  movements: Array<{
    id: string;
    created_at: string;
    movement_type: string | null;
    from_scheduled_at: string | null;
    to_scheduled_at: string | null;
    from_closer_name: string | null;
    to_closer_name: string | null;
    moved_by_name: string | null;
    reason: string | null;
  }>;
}

/** Enriquecimento (nome SDR, dados do lead, reunião alvo, histórico). */
export function useEnrichedPendingApprovals(requests: ApprovalRequest[]) {
  return useQuery({
    queryKey: [
      "approval-requests-enriched",
      requests.map((r) => r.id).sort().join(","),
    ],
    enabled: requests.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<EnrichedApproval[]> => {
      const userIds = Array.from(
        new Set(requests.map((r) => r.requested_by).filter(Boolean)),
      );
      const dealIds = Array.from(
        new Set(requests.map((r) => r.target_deal_id).filter(Boolean) as string[]),
      );

      const [profilesRes, dealsRes] = await Promise.all([
        userIds.length
          ? supabase
              .from("profiles")
              .select("id, full_name, email")
              .in("id", userIds)
          : Promise.resolve({ data: [], error: null } as any),
        dealIds.length
          ? supabase
              .from("crm_deals")
              .select(
                "id, name, contact_id, stage_id, origin_id, owner_id, owner_profile_id, product_name",
              )
              .in("id", dealIds)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      const profiles = (profilesRes.data || []) as any[];
      const deals = (dealsRes.data || []) as any[];

      const contactIds = Array.from(
        new Set(deals.map((d) => d.contact_id).filter(Boolean)),
      );
      const stageIds = Array.from(
        new Set(deals.map((d) => d.stage_id).filter(Boolean)),
      );
      const originIds = Array.from(
        new Set(deals.map((d) => d.origin_id).filter(Boolean)),
      );
      const ownerProfileIds = Array.from(
        new Set(deals.map((d) => d.owner_profile_id).filter(Boolean)),
      );

      const [contactsRes, stagesRes, originsRes, ownersRes, slotsRes] =
        await Promise.all([
          contactIds.length
            ? supabase
                .from("crm_contacts")
                .select("id, name, phone, email")
                .in("id", contactIds)
            : Promise.resolve({ data: [], error: null } as any),
          stageIds.length
            ? supabase
                .from("crm_stages")
                .select("id, stage_name")
                .in("id", stageIds)
            : Promise.resolve({ data: [], error: null } as any),
          originIds.length
            ? supabase
                .from("crm_origins")
                .select("id, name, display_name")
                .in("id", originIds)
            : Promise.resolve({ data: [], error: null } as any),
          ownerProfileIds.length
            ? supabase
                .from("profiles")
                .select("id, full_name, email")
                .in("id", ownerProfileIds)
            : Promise.resolve({ data: [], error: null } as any),
          dealIds.length
            ? supabase
                .from("meeting_slots")
                .select(
                  "id, deal_id, scheduled_at, status, closer_id, meeting_type",
                )
                .in("deal_id", dealIds)
                .in("status", ["scheduled", "rescheduled"])
                .order("scheduled_at", { ascending: false })
            : Promise.resolve({ data: [], error: null } as any),
        ]);

      const slots = (slotsRes.data || []) as any[];
      const closerIds = Array.from(
        new Set(slots.map((s) => s.closer_id).filter(Boolean)),
      );

      // Atendentes para encontrar movement logs (precisamos do attendee_id por deal).
      const [closersRes, attendeesRes] = await Promise.all([
        closerIds.length
          ? supabase
              .from("profiles")
              .select("id, full_name")
              .in("id", closerIds)
          : Promise.resolve({ data: [], error: null } as any),
        dealIds.length
          ? supabase
              .from("meeting_slot_attendees")
              .select("id, deal_id, created_at")
              .in("deal_id", dealIds)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      const attendees = (attendeesRes.data || []) as any[];
      const attendeeIds = attendees.map((a) => a.id);

      const movementsRes = attendeeIds.length
        ? await supabase
            .from("attendee_movement_logs")
            .select(
              "id, attendee_id, created_at, movement_type, from_scheduled_at, to_scheduled_at, from_closer_name, to_closer_name, moved_by_name, reason",
            )
            .in("attendee_id", attendeeIds)
            .order("created_at", { ascending: false })
        : { data: [] as any[] };

      const profileById = new Map<string, any>(
        profiles.map((p) => [p.id, p]),
      );
      const dealById = new Map<string, any>(deals.map((d) => [d.id, d]));
      const contactById = new Map<string, any>(
        ((contactsRes.data || []) as any[]).map((c) => [c.id, c]),
      );
      const stageById = new Map<string, any>(
        ((stagesRes.data || []) as any[]).map((s) => [s.id, s]),
      );
      const originById = new Map<string, any>(
        ((originsRes.data || []) as any[]).map((o) => [o.id, o]),
      );
      const ownerById = new Map<string, any>(
        ((ownersRes.data || []) as any[]).map((o) => [o.id, o]),
      );
      const closerById = new Map<string, any>(
        ((closersRes.data || []) as any[]).map((c) => [c.id, c]),
      );

      // mais recente reunião por deal
      const slotByDeal = new Map<string, any>();
      for (const s of slots) {
        if (!slotByDeal.has(s.deal_id)) slotByDeal.set(s.deal_id, s);
      }

      // movements por deal (via attendee → deal)
      const attendeeToDeal = new Map<string, string>();
      for (const a of attendees) attendeeToDeal.set(a.id, a.deal_id);
      const movementsByDeal = new Map<string, any[]>();
      for (const m of (movementsRes.data || []) as any[]) {
        const dealId = attendeeToDeal.get(m.attendee_id);
        if (!dealId) continue;
        const arr = movementsByDeal.get(dealId) || [];
        arr.push(m);
        movementsByDeal.set(dealId, arr);
      }

      return requests.map((req) => {
        const requester = profileById.get(req.requested_by);
        const deal = req.target_deal_id ? dealById.get(req.target_deal_id) : null;
        const contact = deal?.contact_id ? contactById.get(deal.contact_id) : null;
        const stage = deal?.stage_id ? stageById.get(deal.stage_id) : null;
        const origin = deal?.origin_id ? originById.get(deal.origin_id) : null;
        const owner = deal?.owner_profile_id
          ? ownerById.get(deal.owner_profile_id)
          : null;
        const slot = req.target_deal_id ? slotByDeal.get(req.target_deal_id) : null;
        const closer = slot?.closer_id ? closerById.get(slot.closer_id) : null;
        const movements =
          (req.target_deal_id && movementsByDeal.get(req.target_deal_id)) || [];

        return {
          ...req,
          requester_name: requester?.full_name ?? null,
          requester_email: requester?.email ?? null,
          deal: deal
            ? {
                id: deal.id,
                name: deal.name ?? null,
                contact_name: contact?.name ?? null,
                contact_phone: contact?.phone ?? null,
                contact_email: contact?.email ?? null,
                stage_name: stage?.stage_name ?? null,
                origin_name: origin?.display_name ?? origin?.name ?? null,
                owner_id: deal.owner_profile_id ?? null,
                owner_name: owner?.full_name ?? null,
                product_name: deal.product_name ?? null,
              }
            : null,
          current_meeting: slot
            ? {
                scheduled_at: slot.scheduled_at,
                status: slot.status,
                closer_id: slot.closer_id,
                closer_name: closer?.full_name ?? null,
                meeting_type: slot.meeting_type ?? null,
              }
            : null,
          movements: movements.map((m) => ({
            id: m.id,
            created_at: m.created_at,
            movement_type: m.movement_type,
            from_scheduled_at: m.from_scheduled_at,
            to_scheduled_at: m.to_scheduled_at,
            from_closer_name: m.from_closer_name,
            to_closer_name: m.to_closer_name,
            moved_by_name: m.moved_by_name,
            reason: m.reason,
          })),
        };
      });
    },
  });
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
      // Caso especial: aprovação de R1 pós-pago precisa criar a reunião.
      // A edge function `calendly-create-event` recebe `forceFromRequestId`,
      // valida o aprovador via RPC `is_r1_force_approver`, pula os guards
      // `deal_already_won`/`deal_already_paid`, cria a R1 (= reagendamento
      // normal, conta em todas as métricas) e marca o request como approved.
      if (input.action === "approved") {
        const { data: reqRow, error: reqErr } = await supabase
          .from("rule_approval_requests" as any)
          .select("rule_key, target_deal_id, payload, status")
          .eq("id", input.id)
          .maybeSingle();
        if (reqErr) throw reqErr;
        if (!reqRow) throw new Error("Pedido não encontrado");
        const r = reqRow as any;
        if (r.rule_key === "r1_force_paid_lead") {
          if (r.status !== "pending") {
            throw new Error(`Pedido já está ${r.status}`);
          }
          const p = r.payload || {};
          if (!r.target_deal_id || !p.closer_id || !p.scheduled_at) {
            throw new Error("Payload do pedido incompleto — recrie a solicitação.");
          }
          const { data, error } = await supabase.functions.invoke(
            "calendly-create-event",
            {
              body: {
                forceFromRequestId: input.id,
                closerId: p.closer_id,
                dealId: r.target_deal_id,
                contactId: p.contact_id ?? undefined,
                scheduledAt: p.scheduled_at,
                durationMinutes: p.duration_minutes ?? 60,
                notes: input.notes
                  ? `${p.notes ? p.notes + "\n\n" : ""}[Aprovado] ${input.notes}`
                  : (p.notes ?? undefined),
                leadType: p.lead_type ?? undefined,
                sdrEmail: p.sdr_email ?? undefined,
                alreadyBuilds: p.already_builds ?? null,
                parentAttendeeId: p.parent_attendee_id ?? undefined,
                bookedAt: p.booked_at ?? undefined,
                meetingType: "r1",
              },
            },
          );
          if (error) throw error;
          if (data && (data.success === false || data.error)) {
            throw new Error(
              data.message ||
                data.error ||
                "Falha ao criar R1 após aprovação",
            );
          }
          // Edge function já marcou o request como approved.
          return;
        }
      }

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
      queryClient.invalidateQueries({ queryKey: ["my-approval-requests"] });
      queryClient.invalidateQueries({ queryKey: ["agenda-meetings"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-meetings"] });
    },
  });
}
