import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CotaTitular {
  id: string;
  tipoPessoa: "pf" | "pj";
  nome: string | null;
  cpf: string | null;
  cnpj: string | null;
  telefone: string | null;
  email: string | null;
  dataContratacao: string | null;
}

/** Dados do titular da cota — base do pré-filtro do seletor de lead. */
export function useCotaTitular(cardId: string | null) {
  return useQuery({
    queryKey: ["cota-titular", cardId],
    enabled: !!cardId,
    staleTime: 30_000,
    queryFn: async (): Promise<CotaTitular | null> => {
      if (!cardId) return null;
      const { data, error } = await supabase
        .from("consortium_cards")
        .select("id, tipo_pessoa, nome_completo, razao_social, cpf, cnpj, telefone, email, data_contratacao")
        .eq("id", cardId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const d = data as any;
      return {
        id: d.id,
        tipoPessoa: (d.tipo_pessoa === "pj" ? "pj" : "pf") as "pf" | "pj",
        nome: d.nome_completo || d.razao_social || null,
        cpf: d.cpf || null,
        cnpj: d.cnpj || null,
        telefone: d.telefone || null,
        email: d.email || null,
        dataContratacao: d.data_contratacao || null,
      };
    },
  });
}

export interface LeadVinculoMatch {
  dealId: string;
  contactName: string | null;
  email: string | null;
  telefone: string | null;
  originName: string | null;
  stageName: string | null;
  /** Casou por documento/telefone/e-mail do titular da cota. */
  casaTitular: boolean;
}

function digits(v?: string | null): string {
  return (v || "").replace(/\D/g, "");
}

/**
 * Seletor de lead do modal de correção.
 * Padrão: só leads cujo contato casa com CPF/CNPJ, telefone (9 dígitos finais)
 * ou e-mail do titular da cota. Busca ampla é ação explícita do usuário.
 */
export function useLeadsParaVinculo(
  titular: CotaTitular | null | undefined,
  termo: string,
  buscaAmpla: boolean,
  enabled: boolean,
) {
  const term = termo.trim();
  return useQuery({
    queryKey: [
      "leads-para-vinculo",
      titular?.id ?? null,
      buscaAmpla,
      buscaAmpla ? term.toLowerCase() : "",
    ],
    enabled: enabled && !!titular && (!buscaAmpla || term.length >= 3),
    staleTime: 15_000,
    queryFn: async (): Promise<LeadVinculoMatch[]> => {
      if (!titular) return [];

      const telSuffix = digits(titular.telefone).slice(-9);
      const email = (titular.email || "").trim().toLowerCase();

      const ors: string[] = [];
      if (buscaAmpla) {
        const like = `%${term}%`;
        ors.push(`name.ilike.${like}`, `email.ilike.${like}`);
        const d = digits(term);
        if (d.length >= 4) ors.push(`phone.ilike.%${d}%`);
      } else {
        if (email) ors.push(`email.ilike.${email}`);
        if (telSuffix.length >= 8) ors.push(`phone.ilike.%${telSuffix}%`);
        if (titular.nome) ors.push(`name.ilike.%${titular.nome.trim()}%`);
      }
      if (ors.length === 0) return [];

      const { data: contacts, error } = await supabase
        .from("crm_contacts")
        .select("id, name, email, phone")
        .eq("is_archived", false)
        .or(ors.join(","))
        .limit(40);
      if (error) throw error;
      const contactIds = (contacts || []).map((c: any) => c.id);
      if (contactIds.length === 0) return [];
      const contactById = new Map<string, any>();
      (contacts || []).forEach((c: any) => contactById.set(c.id, c));

      const { data: deals } = await supabase
        .from("crm_deals")
        .select("id, contact_id, origin_id, stage_id, created_at, crm_origins(name, display_name), crm_stages(name)")
        .in("contact_id", contactIds)
        .order("created_at", { ascending: false })
        .limit(60);

      const out: LeadVinculoMatch[] = [];
      const vistos = new Set<string>();
      (deals || []).forEach((d: any) => {
        const c = contactById.get(d.contact_id) || {};
        const casa =
          (!!email && String(c.email || "").toLowerCase() === email) ||
          (telSuffix.length >= 8 && digits(c.phone).endsWith(telSuffix));
        vistos.add(String(d.id));
        out.push({
          dealId: d.id,
          contactName: c.name || null,
          email: c.email || null,
          telefone: c.phone || null,
          originName: d.crm_origins?.display_name || d.crm_origins?.name || null,
          stageName: d.crm_stages?.name || null,
          casaTitular: casa,
        });
      });

      // Reforço por CPF/CNPJ: leads já vinculados a outras cotas do MESMO documento.
      const doc = digits(titular.cpf) || digits(titular.cnpj);
      if (!buscaAmpla && doc.length >= 11) {
        const col = digits(titular.cpf).length >= 11 ? "cpf" : "cnpj";
        const { data: regsDoc } = await supabase
          .from("consorcio_pending_registrations")
          .select("deal_id")
          .eq(col, col === "cpf" ? titular.cpf! : titular.cnpj!)
          .not("deal_id", "is", null)
          .limit(20);
        const extraIds = [...new Set((regsDoc || []).map((r: any) => r.deal_id))].filter(
          (id) => id && !vistos.has(String(id)),
        ) as string[];
        if (extraIds.length > 0) {
          const { data: extraDeals } = await supabase
            .from("crm_deals")
            .select("id, name, crm_origins(name, display_name), crm_stages(name), crm_contacts(name, email, phone)")
            .in("id", extraIds);
          (extraDeals || []).forEach((d: any) => {
            out.push({
              dealId: d.id,
              contactName: d.crm_contacts?.name || d.name || null,
              email: d.crm_contacts?.email || null,
              telefone: d.crm_contacts?.phone || null,
              originName: d.crm_origins?.display_name || d.crm_origins?.name || null,
              stageName: d.crm_stages?.name || null,
              casaTitular: true,
            });
          });
        }
      }

      return out.sort((a, b) => Number(b.casaTitular) - Number(a.casaTitular));
    },
  });
}

export interface CorrigirVinculoResult {
  status: "ok" | "confirmacao_necessaria";
  acao?: string;
  registration_id?: string;
  outras_cotas?: number;
}

/** Grava a correção do vínculo cota → lead (auditada no banco). */
export function useCorrigirVinculoCota() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      cardId: string;
      dealId: string;
      registrationId?: string | null;
      confirmarDuplicado?: boolean;
    }): Promise<CorrigirVinculoResult> => {
      const { data, error } = await (supabase as any).rpc("consorcio_corrigir_vinculo_cota", {
        p_card_id: params.cardId,
        p_deal_id: params.dealId,
        p_registration_id: params.registrationId ?? null,
        p_confirmar_duplicado: params.confirmarDuplicado ?? false,
      });
      if (error) throw error;
      return (data || { status: "ok" }) as CorrigirVinculoResult;
    },
    onSuccess: (res) => {
      if (res.status !== "ok") return;
      toast.success(
        res.acao === "cadastro_criado_e_vinculado"
          ? "Cadastro criado e cota vinculada ao lead."
          : "Vínculo da cota corrigido.",
      );
      queryClient.invalidateQueries({ queryKey: ["consorcio-cotas-contratadas"] });
      queryClient.invalidateQueries({ queryKey: ["consorcio-pending-registrations"] });
      queryClient.invalidateQueries({ queryKey: ["ajustes-vinculo"] });
      queryClient.invalidateQueries({ queryKey: ["cota-titular"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao corrigir o vínculo."),
  });
}

export interface AjusteVinculoRow {
  id: string;
  createdAt: string;
  action: string;
  recordId: string | null;
  autorNome: string;
  de: string;
  para: string;
  contexto: string;
}

/** Correções de vínculo do período — tela de revisão da gestão. */
export function useAjustesVinculo(start: string, end: string) {
  return useQuery({
    queryKey: ["ajustes-vinculo", start, end],
    staleTime: 30_000,
    queryFn: async (): Promise<AjusteVinculoRow[]> => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, created_at, action, table_name, record_id, user_id, old_data, new_data")
        .in("action", [
          "pending_deal_link_changed",
          "pending_deal_link_created",
          "attendee_booked_by_changed",
        ])
        .gte("created_at", `${start}T00:00:00`)
        .lte("created_at", `${end}T23:59:59`)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const rows = (data || []) as any[];
      if (rows.length === 0) return [];

      // Nomes: autores + agendadores antigos/novos
      const profileIds = new Set<string>();
      const dealIds = new Set<string>();
      rows.forEach((r) => {
        if (r.user_id) profileIds.add(r.user_id);
        if (r.action === "attendee_booked_by_changed") {
          if (r.old_data?.booked_by) profileIds.add(r.old_data.booked_by);
          if (r.new_data?.booked_by) profileIds.add(r.new_data.booked_by);
        } else {
          if (r.old_data?.deal_id) dealIds.add(r.old_data.deal_id);
          if (r.new_data?.deal_id) dealIds.add(r.new_data.deal_id);
        }
      });

      const [{ data: profs }, { data: deals }] = await Promise.all([
        profileIds.size
          ? supabase.from("profiles").select("id, full_name, email").in("id", Array.from(profileIds))
          : Promise.resolve({ data: [] as any[] } as any),
        dealIds.size
          ? supabase.from("crm_deals").select("id, name").in("id", Array.from(dealIds))
          : Promise.resolve({ data: [] as any[] } as any),
      ]);
      const nomePorId = new Map<string, string>();
      (profs || []).forEach((p: any) => nomePorId.set(p.id, p.full_name || p.email || "—"));
      const dealNome = new Map<string, string>();
      (deals || []).forEach((d: any) => dealNome.set(d.id, d.name || "(sem nome)"));

      const label = (v: any, tipo: "deal" | "pessoa") => {
        if (!v) return "—";
        return tipo === "deal" ? dealNome.get(v) || "lead removido" : nomePorId.get(v) || "usuário";
      };

      return rows.map((r) => {
        const isAgendador = r.action === "attendee_booked_by_changed";
        return {
          id: r.id,
          createdAt: r.created_at,
          action: r.action,
          recordId: r.record_id,
          autorNome: r.user_id ? nomePorId.get(r.user_id) || "usuário" : "sistema",
          de: isAgendador
            ? label(r.old_data?.booked_by, "pessoa")
            : label(r.old_data?.deal_id, "deal"),
          para: isAgendador
            ? label(r.new_data?.booked_by, "pessoa")
            : label(r.new_data?.deal_id, "deal"),
          contexto: isAgendador
            ? "SDR que agendou a reunião"
            : r.action === "pending_deal_link_created"
              ? "Cadastro criado já vinculado à cota"
              : "Lead vinculado à cota",
        };
      });
    },
  });
}

/** Nome de exibição de um autor (selo de autoria). */
export function useProfileName(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["profile-name", userId],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string | null> => {
      if (!userId) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", userId)
        .maybeSingle();
      return (data as any)?.full_name || (data as any)?.email || null;
    },
  });
}