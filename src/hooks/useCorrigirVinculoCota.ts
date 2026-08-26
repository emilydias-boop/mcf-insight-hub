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

export interface R1ConsorcioInfo {
  dia: string | null;
  closerName: string | null;
  temAgendador: boolean;
}

/** Versão rica do selo de R1 — inclui ids para cruzamentos (janela, closer, agendador). */
export interface R1ConsorcioDetalhe extends R1ConsorcioInfo {
  closerId: string | null;
  bookedBy: string | null;
}

/**
 * Núcleo da busca de R1 de consórcio, reutilizável fora de React Query
 * (ex.: verificação imperativa no submit do AddCartaModal).
 * Para cada lead: tem reunião elegível conduzida por closer da BU Consórcio?
 */
export async function fetchR1ConsorcioDetalhePorDeal(
  dealIds: string[],
): Promise<Map<string, R1ConsorcioDetalhe>> {
  const ids = [...new Set(dealIds)];
  const out = new Map<string, R1ConsorcioDetalhe>();
  if (ids.length === 0) return out;

  const { data: closers, error: closersError } = await supabase
    .from("closers")
    .select("id, name")
    .eq("bu", "consorcio");
  if (closersError) throw closersError;
  const closerName = new Map<string, string>();
  (closers || []).forEach((c: any) => closerName.set(String(c.id), c.name || ""));

  const { data: attendees, error: attError } = await supabase
    .from("meeting_slot_attendees")
    .select("deal_id, status, booked_by, meeting_slot_id")
    .in("deal_id", ids);
  if (attError) throw attError;
  const elegiveis = (attendees || []).filter(
    (a: any) => a.status !== "cancelled" && a.status !== "invited" && a.meeting_slot_id,
  );
  if (elegiveis.length === 0) return out;

  const slotIds = [...new Set(elegiveis.map((a: any) => String(a.meeting_slot_id)))];
  const { data: slots, error: slotsError } = await supabase
    .from("meeting_slots")
    .select("id, closer_id, scheduled_at")
    .in("id", slotIds);
  if (slotsError) throw slotsError;
  const slotInfo = new Map<string, { closerId: string; at: string | null }>();
  (slots || []).forEach((s: any) =>
    slotInfo.set(String(s.id), { closerId: String(s.closer_id), at: s.scheduled_at ?? null }),
  );

  elegiveis.forEach((a: any) => {
    const si = slotInfo.get(String(a.meeting_slot_id));
    if (!si || !closerName.has(si.closerId)) return;
    const atual = out.get(String(a.deal_id));
    const candidato: R1ConsorcioDetalhe = {
      dia: si.at,
      closerName: closerName.get(si.closerId) || null,
      temAgendador: !!a.booked_by,
      closerId: si.closerId,
      bookedBy: a.booked_by ? String(a.booked_by) : null,
    };
    // Mantém a mais recente e preserva "tem agendador" quando qualquer uma tiver.
    if (!atual || String(candidato.dia || "").localeCompare(String(atual.dia || "")) > 0) {
      out.set(String(a.deal_id), {
        ...candidato,
        temAgendador: candidato.temAgendador || !!atual?.temAgendador,
      });
    } else if (candidato.temAgendador) {
      out.set(String(a.deal_id), { ...atual, temAgendador: true });
    }
  });
  return out;
}

/**
 * Para cada lead da lista: tem reunião elegível conduzida por closer da BU
 * Consórcio? Sem isso, vincular a cota a esse lead NÃO credita a venda — e pode
 * desfazer uma atribuição existente. O selo evita a escolha às cegas.
 */
export function useR1ConsorcioPorDeal(dealIds: string[], enabled: boolean) {
  const ids = [...new Set(dealIds)].sort();
  return useQuery({
    queryKey: ["r1-consorcio-por-deal", ids.join("|")],
    enabled: enabled && ids.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<Map<string, R1ConsorcioInfo>> => {
      const detalhe = await fetchR1ConsorcioDetalhePorDeal(ids);
      const out = new Map<string, R1ConsorcioInfo>();
      detalhe.forEach((v, k) =>
        out.set(k, { dia: v.dia, closerName: v.closerName, temAgendador: v.temAgendador }),
      );
      return out;
    },
  });
}

function digits(v?: string | null): string {
  return (v || "").replace(/\D/g, "");
}

/** Remove acentos para comparação/label — o ilike do Postgres é sensível a acento. */
function semAcento(v: string): string {
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const DEAL_SELECT =
  "id, name, contact_id, is_archived, created_at, crm_origins(name, display_name), crm_stages(stage_name), crm_contacts(id, name, email, phone)";

function mapDeal(d: any, casa: boolean): LeadVinculoMatch {
  const ct = d.crm_contacts || {};
  return {
    dealId: d.id,
    contactName: ct.name || d.name || null,
    email: ct.email || null,
    telefone: ct.phone || null,
    originName: d.crm_origins?.display_name || d.crm_origins?.name || null,
    stageName: d.crm_stages?.stage_name || null,
    casaTitular: casa,
  };
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
      const nomeTitular = (titular.nome || "").trim();

      // 1) contatos que casam (e-mail / telefone / nome)
      const orsContato: string[] = [];
      // 2) o nome do lead também vive em `crm_deals.name` — muitos deals não têm contato
      const orsDealNome: string[] = [];

      if (buscaAmpla) {
        const d = digits(term);
        for (const t of new Set([term, semAcento(term)])) {
          orsContato.push(`name.ilike.%${t}%`, `email.ilike.%${t}%`);
          orsDealNome.push(`name.ilike.%${t}%`);
        }
        if (d.length >= 4) orsContato.push(`phone.ilike.%${d}%`);
      } else {
        if (email) orsContato.push(`email.ilike.${email}`);
        if (telSuffix.length >= 8) orsContato.push(`phone.ilike.%${telSuffix}%`);
        if (nomeTitular) {
          for (const t of new Set([nomeTitular, semAcento(nomeTitular)])) {
            orsContato.push(`name.ilike.%${t}%`);
            orsDealNome.push(`name.ilike.%${t}%`);
          }
        }
      }
      if (orsContato.length === 0) return [];

      const { data: contacts, error } = await supabase
        .from("crm_contacts")
        .select("id, name, email, phone")
        .eq("is_archived", false)
        .or(orsContato.join(","))
        .limit(40);
      if (error) throw error;
      const contactIds = (contacts || []).map((c: any) => c.id);

      const [porContato, porNomeDeal] = await Promise.all([
        contactIds.length
          ? supabase
              .from("crm_deals")
              .select(DEAL_SELECT)
              .eq("is_archived", false)
              .in("contact_id", contactIds)
              .order("created_at", { ascending: false })
              .limit(60)
          : Promise.resolve({ data: [] as any[] } as any),
        orsDealNome.length
          ? supabase
              .from("crm_deals")
              .select(DEAL_SELECT)
              .eq("is_archived", false)
              .or(orsDealNome.join(","))
              .order("created_at", { ascending: false })
              .limit(60)
          : Promise.resolve({ data: [] as any[] } as any),
      ]);
      if (porContato.error) throw porContato.error;
      if (porNomeDeal.error) throw porNomeDeal.error;

      const out: LeadVinculoMatch[] = [];
      const vistos = new Set<string>();
      const casaCom = (ct: any) =>
        (!!email && String(ct?.email || "").toLowerCase() === email) ||
        (telSuffix.length >= 8 && digits(ct?.phone).endsWith(telSuffix));

      for (const d of [...(porContato.data || []), ...(porNomeDeal.data || [])] as any[]) {
        if (vistos.has(String(d.id))) continue;
        vistos.add(String(d.id));
        out.push(mapDeal(d, casaCom(d.crm_contacts)));
      }

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
            .select(DEAL_SELECT)
            .in("id", extraIds);
          (extraDeals || []).forEach((d: any) => {
            if (vistos.has(String(d.id))) return;
            vistos.add(String(d.id));
            out.push(mapDeal(d, true));
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
  cotas_arrastadas?: number;
  credito_arrastado?: number;
}

/**
 * Outras cotas contratadas do MESMO cliente que serão arrastadas pela correção:
 * a atribuição de SDR é por cliente, então um único vínculo decide o destino de
 * todas as cotas dele.
 */
export function useCotasArrastadas(cardId: string | null) {
  return useQuery({
    queryKey: ["cotas-arrastadas", cardId],
    enabled: !!cardId,
    staleTime: 30_000,
    queryFn: async (): Promise<{ cotas: number; credito: number }> => {
      if (!cardId) return { cotas: 0, credito: 0 };
      const { data: card, error } = await supabase
        .from("consortium_cards")
        .select("id, cpf, cnpj, nome_completo")
        .eq("id", cardId)
        .maybeSingle();
      if (error) throw error;
      if (!card) return { cotas: 0, credito: 0 };
      const c = card as any;
      const doc = digits(c.cpf) || digits(c.cnpj);

      const { data: irmas, error: irmasError } = await supabase
        .from("consortium_cards")
        .select("id, cpf, cnpj, nome_completo, valor_credito")
        .eq("tipo_registro", "contratacao");
      if (irmasError) throw irmasError;

      const nome = String(c.nome_completo || "").trim().toUpperCase();
      const mesmas = (irmas || []).filter((o: any) => {
        if (String(o.id) === String(cardId)) return false;
        if (doc) return (digits(o.cpf) || digits(o.cnpj)) === doc;
        return !!nome && String(o.nome_completo || "").trim().toUpperCase() === nome;
      });
      return {
        cotas: mesmas.length,
        credito: mesmas.reduce((s: number, o: any) => s + (Number(o.valor_credito) || 0), 0),
      };
    },
  });
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
      // Via RPC: `profiles` é fechado por RLS para SDR/closer e o selo apareceria vazio.
      const { data, error } = await (supabase as any).rpc("nome_usuario", { p_id: userId });
      if (error) throw error;
      return (data as string | null) || null;
    },
  });
}