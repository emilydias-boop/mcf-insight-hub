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
  // Enriquecimento (preenchido em useNoShowPendingReviews)
  deal?: {
    id: string;
    name: string | null;
    product_name: string | null;
    origin_name: string | null;
    original_sdr_email: string | null;
    r1_closer_email: string | null;
    r2_closer_email: string | null;
  } | null;
  // Dados do LEAD REAL (vem de meeting_slot_attendees, não do crm_deals.name)
  lead?: {
    name: string | null;
    phone: string | null;
  } | null;
  meeting?: {
    scheduled_at: string | null;
    duration_minutes: number | null;
    closer_name: string | null;
    closer_email: string | null;
    sdr_booked_name: string | null;
    sdr_booked_email: string | null;
    meeting_type: string | null;
  } | null;
  performed_by_profile?: {
    full_name: string | null;
    email: string | null;
  } | null;
  manager_review_by_profile?: {
    full_name: string | null;
  } | null;
  prior_no_shows_for_deal?: number;
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
      const rows = (data ?? []) as PendingReview[];
      if (rows.length === 0) return rows;

      const dealIds = Array.from(new Set(rows.map(r => r.deal_id).filter(Boolean))) as string[];
      const slotIds = Array.from(new Set(rows.map(r => r.meeting_slot_id).filter(Boolean))) as string[];
      const attendeeIds = Array.from(new Set(rows.map(r => r.attendee_id).filter(Boolean))) as string[];
      const performerIds = Array.from(new Set(rows.map(r => r.performed_by).filter(Boolean))) as string[];
      const reviewerIds = Array.from(new Set(rows.map(r => r.manager_review_by).filter(Boolean))) as string[];
      const profileIds = Array.from(new Set([...performerIds, ...reviewerIds]));

      const [dealsRes, slotsRes, attendeesRes, profilesRes] = await Promise.all([
        dealIds.length
          ? supabase
              .from("crm_deals")
              .select("id, name, product_name, original_sdr_email, r1_closer_email, r2_closer_email, origin_id, crm_origins(name)")
              .in("id", dealIds)
          : Promise.resolve({ data: [], error: null } as any),
        slotIds.length
          ? supabase
              .from("meeting_slots")
              .select("id, scheduled_at, duration_minutes, meeting_type, closer_id")
              .in("id", slotIds)
          : Promise.resolve({ data: [], error: null } as any),
        attendeeIds.length
          ? supabase
              .from("meeting_slot_attendees")
              .select("id, attendee_name, attendee_phone, booked_by")
              .in("id", attendeeIds)
          : Promise.resolve({ data: [], error: null } as any),
        profileIds.length
          ? supabase
              .from("profiles")
              .select("id, full_name, email")
              .in("id", profileIds)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      const dealsById = new Map<string, any>();
      (dealsRes.data ?? []).forEach((d: any) => dealsById.set(d.id, d));
      const profilesById = new Map<string, any>();
      (profilesRes.data ?? []).forEach((p: any) => profilesById.set(p.id, p));

      const attendeesById = new Map<string, any>();
      (attendeesRes.data ?? []).forEach((a: any) => attendeesById.set(a.id, a));

      // Resolver nomes dos closers (meeting_slots.closer_id) e dos SDRs que agendaram (attendee.booked_by)
      const slotCloserIds = Array.from(
        new Set(((slotsRes.data ?? []) as any[]).map((s) => s.closer_id).filter(Boolean))
      ) as string[];
      const bookedByIds = Array.from(
        new Set(((attendeesRes.data ?? []) as any[]).map((a) => a.booked_by).filter(Boolean))
      ) as string[];
      const missingProfileIds = [...slotCloserIds, ...bookedByIds].filter((id) => !profilesById.has(id));
      if (missingProfileIds.length) {
        const { data: extra } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", Array.from(new Set(missingProfileIds)));
        (extra ?? []).forEach((p: any) => profilesById.set(p.id, p));
      }
      const slotsById = new Map<string, any>();
      (slotsRes.data ?? []).forEach((s: any) => slotsById.set(s.id, s));

      // Contagem de no-shows anteriores por deal (apenas final_status approved/auto)
      let priorByDeal = new Map<string, number>();
      if (dealIds.length) {
        const { data: priors } = await supabase
          .from("no_show_validations")
          .select("deal_id, final_status, manager_review_status")
          .in("deal_id", dealIds);
        (priors ?? []).forEach((p: any) => {
          const isCounted =
            p.final_status === "approved" ||
            p.manager_review_status === "approved" ||
            (!p.manager_review_status && p.final_status === "approved");
          if (!isCounted) return;
          priorByDeal.set(p.deal_id, (priorByDeal.get(p.deal_id) ?? 0) + 1);
        });
      }

      return rows.map((r) => {
        const deal = r.deal_id ? dealsById.get(r.deal_id) : null;
        const slot = r.meeting_slot_id ? slotsById.get(r.meeting_slot_id) : null;
        const attendee = r.attendee_id ? attendeesById.get(r.attendee_id) : null;
        const closerProfile = slot?.closer_id ? profilesById.get(slot.closer_id) : null;
        const sdrBookedProfile = attendee?.booked_by ? profilesById.get(attendee.booked_by) : null;
        return {
          ...r,
          deal: deal
            ? {
                id: deal.id,
                name: deal.name ?? null,
                product_name: deal.product_name ?? null,
                origin_name: deal.crm_origins?.name ?? null,
                original_sdr_email: deal.original_sdr_email ?? null,
                r1_closer_email: deal.r1_closer_email ?? null,
                r2_closer_email: deal.r2_closer_email ?? null,
              }
            : null,
          lead: {
            name: attendee?.attendee_name ?? deal?.name ?? null,
            phone: attendee?.attendee_phone ?? r.lead_phone ?? null,
          },
          meeting: slot
            ? {
                scheduled_at: slot.scheduled_at ?? null,
                duration_minutes: slot.duration_minutes ?? null,
                meeting_type: slot.meeting_type ?? null,
                closer_name: closerProfile?.full_name ?? closerProfile?.email ?? null,
                closer_email: closerProfile?.email ?? null,
                sdr_booked_name: sdrBookedProfile?.full_name ?? sdrBookedProfile?.email ?? null,
                sdr_booked_email: sdrBookedProfile?.email ?? null,
              }
            : {
                scheduled_at: null,
                duration_minutes: null,
                meeting_type: null,
                closer_name: null,
                closer_email: null,
                sdr_booked_name: sdrBookedProfile?.full_name ?? sdrBookedProfile?.email ?? null,
                sdr_booked_email: sdrBookedProfile?.email ?? null,
              },
          performed_by_profile: r.performed_by ? profilesById.get(r.performed_by) ?? null : null,
          manager_review_by_profile: r.manager_review_by ? profilesById.get(r.manager_review_by) ?? null : null,
          // -1 porque o próprio registro entra na contagem se já aprovado; mantemos total bruto e a UI subtrai se quiser
          prior_no_shows_for_deal: r.deal_id ? priorByDeal.get(r.deal_id) ?? 0 : 0,
        } as PendingReview;
      });
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