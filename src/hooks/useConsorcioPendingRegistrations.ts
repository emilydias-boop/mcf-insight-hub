import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { CreateConsorcioCardInput, TipoDocumento } from '@/types/consorcio';
import { calcularComissao } from '@/lib/commissionCalculator';
import { getProdutoComissaoContext } from '@/lib/produtoComissaoLookup';
import { calcularProximoDiaUtil } from '@/lib/businessDays';
import { montarParcelasCota, inserirParcelas } from '@/lib/consorcioCronograma';
import { fetchAllPages, fetchAllByIds } from '@/lib/supabasePaginacao';
import { getParcelasEmpresa, type ParcelaEmpresa } from '@/lib/consorcioParcelasEmpresa';
import { formatOrigemLabel } from '@/lib/consorcioOrigemLabel';
import { dispatchCartaCadastradaWebhook } from '@/lib/consorcioCartaWebhook';
import { fetchPendingRegsWithDocs } from '@/lib/consorcioDocumentosPendentes';

export interface PendingRegistration {
  id: string;
  proposal_id: string | null;
  deal_id: string | null;
  status: string;
  tipo_pessoa: 'pf' | 'pj';
  // PF
  nome_completo: string | null;
  rg: string | null;
  cpf: string | null;
  cpf_conjuge: string | null;
  profissao: string | null;
  telefone: string | null;
  email: string | null;
  endereco_completo: string | null;
  endereco_cep: string | null;
  renda: number | null;
  patrimonio: number | null;
  pix: string | null;
  // PJ
  razao_social: string | null;
  cnpj: string | null;
  natureza_juridica: string | null;
  inscricao_estadual: string | null;
  data_fundacao: string | null;
  telefone_comercial: string | null;
  email_comercial: string | null;
  endereco_comercial: string | null;
  endereco_comercial_cep: string | null;
  num_funcionarios: number | null;
  faturamento_mensal: number | null;
  socios: Array<{ nome?: string; cpf: string; renda: number }>;
  // Meta
  vendedor_name: string | null;
  aceite_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Cota (gestor)
  categoria: string | null;
  grupo: string | null;
  cota: string | null;
  valor_credito: number | null;
  prazo_meses: number | null;
  tipo_produto: string | null;
  produto_codigo: string | null;
  condicao_pagamento: string | null;
  inclui_seguro: boolean | null;
  empresa_paga_parcelas: string | null;
  tipo_contrato: string | null;
  parcelas_pagas_empresa: number | null;
  dia_vencimento: number | null;
  inicio_segunda_parcela: string | null;
  data_contratacao: string | null;
  origem: string | null;
  origem_detalhe: string | null;
  vendedor_id: string | null;
  vendedor_name_cota: string | null;
  valor_comissao: number | null;
  e_transferencia: boolean | null;
  transferido_de: string | null;
  observacoes: string | null;
  consortium_card_id: string | null;
}

const PENDING_REGISTRATION_LIST_SELECT = `
  id,
  status,
  tipo_pessoa,
  nome_completo,
  razao_social,
  cpf,
  cnpj,
  telefone,
  telefone_comercial,
  email,
  email_comercial,
  endereco_completo,
  endereco_comercial,
  renda,
  faturamento_mensal,
  socios,
  valor_credito,
  prazo_meses,
  empresa_paga_parcelas,
  tipo_contrato,
  parcelas_pagas_empresa,
  tipo_produto,
  vendedor_name_cota,
  vendedor_id,
  proposal_id,
  deal_id,
  created_at,
  vendedor_name,
  aceite_date,
  motivo_declinio,
  declinada_at,
  consortium_card_id,
  deal:crm_deals!deal_id(
    contact:crm_contacts!contact_id(name, email, phone),
    owner_id,
    original_sdr_email,
    origin:crm_origins!origin_id(name, display_name)
  )
`;

const PENDING_REGISTRATION_DETAIL_SELECT = `*`;

const normalizeEmail = (email: string | null | undefined) => String(email || '').trim().toLowerCase();

export interface EnrichedPendingRegistration {
  id: string;
  proposal_id: string | null;
  tipo_pessoa: 'pf' | 'pj';
  nome_completo: string | null;
  razao_social: string | null;
  cpf: string | null;
  cnpj: string | null;
  telefone: string | null;
  telefone_comercial: string | null;
  email: string | null;
  email_comercial: string | null;
  socios: Array<{ nome?: string; cpf: string; renda: number }> | null;
  vendedor_name: string | null;
  aceite_date: string | null;
  created_at: string;
  status: string;
  valor_credito: number | null;
  prazo_meses: number | null;
  empresa_paga_parcelas: string | null;
  tipo_contrato: string | null;
  parcelas_pagas_empresa: number | null;
  tipo_produto: string | null;
  // Derived
  origem_label: string;
  closer_name: string | null;
  sdr_name: string | null;
  parcelas_empresa: ParcelaEmpresa[];
  valor_total_empresa: number;
  cotas_existentes_count: number;
  parte_atual: number;
  total_destinado: number;
  motivo_declinio?: string | null;
  declinada_at?: string | null;
  /** Cota já criada/vinculada — nulo significa que ainda não virou cota. */
  consortium_card_id?: string | null;
  /** Checklist de dados do cadastro incompleto (campos obrigatórios faltando). */
  checklist_incompleto: boolean;
  /** Nenhum documento anexado ao cadastro pendente. */
  documentos_faltando: boolean;
}

export function usePendingRegistrations(statuses: string[] = ['aguardando_abertura']) {
  return useQuery({
    queryKey: ['consorcio-pending-registrations', statuses.slice().sort().join(',')],
    queryFn: async (): Promise<EnrichedPendingRegistration[]> => {
      const data = await fetchAllPages<any>((from, to) =>
        supabase
          .from('consorcio_pending_registrations')
          .select(PENDING_REGISTRATION_LIST_SELECT)
          .in('status', statuses)
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to),
      );
      const rows = (data || []) as any[];

      // Documentos anexados por cadastro pendente (selo de pendência).
      // Critério único compartilhado com a aba de Cartas Negociadas (useProposals):
      // docs do próprio pending_registration_id OU do card vinculado a ele.
      const regsWithDocs = await fetchPendingRegsWithDocs(rows as any[]);

      const isChecklistIncompleto = (r: any) =>
        r.tipo_pessoa === 'pj'
          ? !(r.razao_social && r.cnpj && r.telefone_comercial && r.email_comercial && r.endereco_comercial && r.faturamento_mensal)
          : !(r.nome_completo && r.cpf && r.telefone && r.email && r.endereco_completo && r.renda);

      // Resolver nomes de closer (owner_id → profiles/employees) e SDR (original_sdr_email → employees.email_pessoal / profiles.email)
      // owner_id em crm_deals é TEXT: pode conter UUID OU e-mail do owner. Tratamos os dois casos.
      const ownerRaw = Array.from(new Set(rows.map((r) => r.deal?.owner_id).filter(Boolean))) as string[];
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const ownerIds = ownerRaw.filter((v) => uuidRegex.test(v));
      const ownerEmails = ownerRaw.filter((v) => !uuidRegex.test(v)).map(normalizeEmail);
      const sdrEmails = Array.from(
        new Set(rows.map((r) => normalizeEmail(r.deal?.original_sdr_email)).filter(Boolean)),
      );

      const profilesById = new Map<string, string>();
      const profilesByEmail = new Map<string, string>();
      const employeesByEmail = new Map<string, string>();
      const ownersByEmail = new Map<string, string>();
      if (ownerIds.length) {
        const { data: profsById } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', ownerIds);

        (profsById || []).forEach((p) => {
          if (p.id) profilesById.set(p.id, p.full_name || p.email);
        });
      }
      if (ownerEmails.length) {
        const [{ data: ownerProfs }, { data: ownerEmps }] = await Promise.all([
          supabase.from('profiles').select('full_name, email').in('email', ownerEmails),
          supabase.from('employees').select('nome_completo, email_pessoal').in('email_pessoal', ownerEmails),
        ]);
        (ownerProfs || []).forEach((p) => {
          const email = normalizeEmail(p.email);
          if (email) ownersByEmail.set(email, p.full_name || p.email);
        });
        (ownerEmps || []).forEach((e) => {
          const email = normalizeEmail(e.email_pessoal);
          if (email && !ownersByEmail.has(email)) ownersByEmail.set(email, e.nome_completo);
        });
      }
      if (sdrEmails.length) {
        const { data: profsByEmail } = await supabase
          .from('profiles')
          .select('full_name, email')
          .in('email', sdrEmails);

        (profsByEmail || []).forEach((p) => {
          const email = normalizeEmail(p.email);
          if (email) profilesByEmail.set(email, p.full_name || p.email);
        });

        const { data: employees } = await supabase
          .from('employees')
          .select('nome_completo, email_pessoal')
          .in('email_pessoal', sdrEmails);

        (employees || []).forEach((e) => {
          const email = normalizeEmail(e.email_pessoal);
          if (email) employeesByEmail.set(email, e.nome_completo);
        });
      }

      // Cotas existentes por CPF/CNPJ
      const cpfs = Array.from(new Set(rows.map((r) => r.cpf).filter(Boolean))) as string[];
      const cnpjs = Array.from(new Set(rows.map((r) => r.cnpj).filter(Boolean))) as string[];
      const cotasCountByDoc = new Map<string, number>();
      if (cpfs.length || cnpjs.length) {
        // Quebrado em lotes + paginado: `.or(... in ...)` estoura tanto o tamanho
        // da URL quanto o teto de 1000 linhas por resposta.
        const cardsCpf = await fetchAllByIds<any>(cpfs, (lote, from, to) =>
          supabase
            .from('consortium_cards')
            .select('cpf, cnpj')
            .in('cpf', lote)
            .order('id', { ascending: true })
            .range(from, to),
        );
        const cardsCnpj = await fetchAllByIds<any>(cnpjs, (lote, from, to) =>
          supabase
            .from('consortium_cards')
            .select('cpf, cnpj')
            .in('cnpj', lote)
            .order('id', { ascending: true })
            .range(from, to),
        );
        [...cardsCpf, ...cardsCnpj].forEach((c: any) => {
          const k = c.cpf || c.cnpj;
          if (k) cotasCountByDoc.set(k, (cotasCountByDoc.get(k) || 0) + 1);
        });
      }

      // Agrupar pendentes por documento para 1 de N
      const byDoc = new Map<string, any[]>();
      // Ordenar por created_at ASC para que "1 de N" seja o mais antigo
      [...rows]
        .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
        .forEach((r) => {
          const k = r.cpf || r.cnpj;
          if (!k) return;
          const arr = byDoc.get(k) || [];
          arr.push(r);
          byDoc.set(k, arr);
        });

      return rows.map((r) => {
        const docKey = r.cpf || r.cnpj;
        const group = docKey ? byDoc.get(docKey) || [] : [];
        const parteAtual = docKey ? group.findIndex((g) => g.id === r.id) + 1 : 1;
        const totalDestinado = group.length || 1;

        const parcelas = getParcelasEmpresa({
          prazo_meses: r.prazo_meses,
          parcelas_pagas_empresa: r.parcelas_pagas_empresa,
          tipo_contrato: r.tipo_contrato,
          valor_credito: r.valor_credito,
          empresa_paga_parcelas: r.empresa_paga_parcelas,
        });

        const ownerRawVal = r.deal?.owner_id as string | null | undefined;
        const closerName = (() => {
          if (!ownerRawVal) return null;
          if (uuidRegex.test(ownerRawVal)) return profilesById.get(ownerRawVal) || null;
          const email = normalizeEmail(ownerRawVal);
          return ownersByEmail.get(email) || email || null;
        })() || r.vendedor_name_cota || null;
        const sdrEmail = normalizeEmail(r.deal?.original_sdr_email);
        const sdrName = sdrEmail ? employeesByEmail.get(sdrEmail) || profilesByEmail.get(sdrEmail) || sdrEmail : null;
        const originName = r.deal?.origin?.display_name || r.deal?.origin?.name || null;

        return {
          id: r.id,
          proposal_id: r.proposal_id ?? null,
          tipo_pessoa: r.tipo_pessoa,
          nome_completo: r.nome_completo || r.deal?.contact?.name || null,
          razao_social: r.razao_social,
          cpf: r.cpf,
          cnpj: r.cnpj,
          telefone: r.telefone || r.deal?.contact?.phone || null,
          telefone_comercial: r.telefone_comercial,
          email: r.email || r.deal?.contact?.email || null,
          email_comercial: r.email_comercial,
          socios: r.socios || null,
          vendedor_name: r.vendedor_name || null,
          aceite_date: r.aceite_date,
          created_at: r.created_at,
          status: r.status,
          valor_credito: r.valor_credito,
          prazo_meses: r.prazo_meses,
          empresa_paga_parcelas: r.empresa_paga_parcelas,
          tipo_contrato: r.tipo_contrato,
          parcelas_pagas_empresa: r.parcelas_pagas_empresa,
          tipo_produto: r.tipo_produto || null,
          origem_label: formatOrigemLabel(
            originName,
            r.aceite_date || r.created_at?.slice(0, 10),
            // Cadastros manuais não têm deal: "Origem / Parceiro" fica em vendedor_name.
            r.deal_id ? null : r.vendedor_name,
          ),
          closer_name: closerName,
          sdr_name: sdrName,
          parcelas_empresa: parcelas,
          valor_total_empresa: parcelas.reduce((s, p) => s + p.valor, 0),
          cotas_existentes_count: docKey ? cotasCountByDoc.get(docKey) || 0 : 0,
          parte_atual: parteAtual || 1,
          total_destinado: totalDestinado,
          motivo_declinio: r.motivo_declinio ?? null,
          declinada_at: r.declinada_at ?? null,
          consortium_card_id: r.consortium_card_id ?? null,
          checklist_incompleto: isChecklistIncompleto(r),
          documentos_faltando: !regsWithDocs.has(r.id),
        };
      });
    },
  });
}

export function usePendingRegistration(id: string | null) {
  return useQuery({
    queryKey: ['consorcio-pending-registration', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('consorcio_pending_registrations')
        .select(PENDING_REGISTRATION_DETAIL_SELECT)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as unknown as PendingRegistration;
    },
    enabled: !!id,
  });
}

export interface CreatePendingRegistrationInput {
  proposal_id: string;
  deal_id: string;
  tipo_pessoa: 'pf' | 'pj';
  vendedor_name: string;
  // Parcelas que a empresa pagará (capturado já no aceite)
  empresa_paga_parcelas?: 'sim' | 'nao';
  tipo_contrato?: 'normal' | 'intercalado' | 'intercalado_impar';
  parcelas_pagas_empresa?: number;
  valor_credito?: number;
  prazo_meses?: number;
  observacoes?: string;
  /** Tipo de produto vendido (select | parcelinha) — base do cálculo de comissão. */
  tipo_produto?: string;
  /** Origem do lead declarada na proposta (grava `name` do catálogo). */
  origem?: string;
  // Dados do plano (Termo de Adesão)
  credito_id?: string;
  produto_codigo?: string;
  condicao_pagamento?: string;
  parcela_1a_12a?: number;
  parcela_demais?: number;
  dia_vencimento?: number;
  inicio_segunda_parcela?: string;
  objetivo?: string;
  inclui_seguro?: boolean;
  // PF
  nome_completo?: string;
  rg?: string;
  cpf?: string;
  cpf_conjuge?: string;
  profissao?: string;
  telefone?: string;
  email?: string;
  endereco_completo?: string;
  endereco_cep?: string;
  renda?: number;
  patrimonio?: number;
  pix?: string;
  // PJ
  razao_social?: string;
  cnpj?: string;
  natureza_juridica?: string;
  inscricao_estadual?: string;
  data_fundacao?: string;
  telefone_comercial?: string;
  email_comercial?: string;
  endereco_comercial?: string;
  endereco_comercial_cep?: string;
  num_funcionarios?: number;
  faturamento_mensal?: number;
  socios?: Array<{ nome?: string; cpf: string; renda: number }>;
  // Documents
  documents?: Array<{ file: File; tipo: TipoDocumento }>;
  /** Carta da proposta que originou este cadastro (1 carta -> 1 cadastro). */
  carta_id?: string;
}

export function useCreatePendingRegistration() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreatePendingRegistrationInput) => {
      // Validar que o usuário está autenticado
      if (!user?.id) {
        throw new Error('Usuário não autenticado. Faça login novamente.');
      }

      const { documents, carta_id, ...registrationData } = input;

      // 0. Rede de segurança: uma proposta pode gerar N cadastros — um por carta.
      //    O que nunca pode acontecer é DOIS cadastros para a MESMA carta, nem mais
      //    cadastros do que cartas: duplicidade infla a etapa 4, quebra o
      //    "Destinada 1/N" e re-dispara e-mail/WhatsApp + webhook do Make.
      const [{ data: existentes, error: existErr }, { data: cartasProposta, error: cartasErr }] = await Promise.all([
        supabase
          .from('consorcio_pending_registrations')
          .select('id, status')
          .eq('proposal_id', input.proposal_id),
        supabase
          .from('consorcio_proposal_cartas')
          .select('id, pending_registration_id')
          .eq('proposal_id', input.proposal_id),
      ]);
      if (existErr) throw existErr;
      if (cartasErr) throw cartasErr;
      // 'excluida' é status legado e hoje inalcançável (o CHECK da coluna não o
      // aceita mais); a leitura fica só para linhas históricas.
      const ativos = (existentes || []).filter((r: any) => r.status !== 'excluida');
      const limiteCadastros = Math.max(1, (cartasProposta || []).length);
      if (ativos.length >= limiteCadastros) {
        throw new Error(
          limiteCadastros > 1
            ? `Esta proposta já possui ${ativos.length} de ${limiteCadastros} cadastros (um por carta). Abra o cadastro existente em vez de criar outro.`
            : 'Esta carta já possui cadastro em Cadastros Pendentes. Abra o cadastro existente em vez de criar outro.',
        );
      }
      if (input.carta_id) {
        const carta = (cartasProposta || []).find((c: any) => c.id === input.carta_id);
        if (carta?.pending_registration_id) {
          throw new Error('Esta carta já possui cadastro em Cadastros Pendentes.');
        }
      }


      // 1. Atualizar proposta para 'aceita' PRIMEIRO (operação segura)
      const { error: proposalError } = await supabase
        .from('consorcio_proposals')
        .update({
          status: 'aceita',
          // aceite_date (date) mantido: funil e relatórios dependem dele.
          aceite_date: new Date().toISOString().split('T')[0],
          aceite_at: new Date().toISOString(),
          aceite_by: user.id,
        } as any)
        .eq('id', input.proposal_id);

      if (proposalError) throw proposalError;

      // 2. Sanitizar: converter strings vazias em null para evitar erros de tipo no banco
      const dateColumns = ['data_contratacao', 'data_fundacao', 'aceite_date'];
      const sanitized = Object.fromEntries(
        Object.entries(registrationData)
          .filter(([_, value]) => value !== undefined)
          .map(([key, value]) => [
            key,
            value === '' ? null : (dateColumns.includes(key) && !value) ? null : value,
          ])
      );

      // 3. Criar registro pendente (se falhar, o botão "Cadastrar Cota" permite retentar)
      const { data: registration, error: regError } = await supabase
        .from('consorcio_pending_registrations')
        .insert({
          ...sanitized,
          aceite_date: new Date().toISOString().split('T')[0],
          created_by: user.id,
          status: 'aguardando_abertura',
        } as any)
        .select('id')
        .single();

      if (regError) {
        console.error('Erro ao criar registro pendente:', regError);
        throw new Error('Proposta aceita, mas erro ao criar cadastro pendente: ' + regError.message);
      }

      // 3a. Vincula a carta da proposta ao cadastro criado (rastreio 1:1).
      if (carta_id) {
        const { error: linkErr } = await supabase
          .from('consorcio_proposal_cartas')
          .update({ pending_registration_id: registration.id } as any)
          .eq('id', carta_id);
        if (linkErr) console.error('[cartas] Falha ao vincular carta ao cadastro:', linkErr);
      }

      // 3. Upload documents linked to pending_registration_id
      if (documents && documents.length > 0) {
        for (const doc of documents) {
          const fileExt = doc.file.name.split('.').pop();
          const fileName = `pending-${registration.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('consorcio-documents')
            .upload(fileName, doc.file);

          if (uploadError) {
            console.error('Upload error:', uploadError);
            continue;
          }

          const { data: urlData } = await supabase.storage
            .from('consorcio-documents')
            .createSignedUrl(fileName, 60 * 60 * 24 * 365);

          await supabase
            .from('consortium_documents')
            .insert({
              pending_registration_id: registration.id,
              tipo: doc.tipo,
              nome_arquivo: doc.file.name,
              storage_path: fileName,
              storage_url: urlData?.signedUrl || '',
              uploaded_by: user.id,
            } as any);
        }
      }

      // 4. Disparar automações do evento "consorcio_carta_cadastrada"
      //    (Email/WhatsApp configurados em Administração → Automações).
      try {
        await supabase.functions.invoke('automation-event-dispatcher', {
          body: { event: 'consorcio_carta_cadastrada', registration_id: registration.id },
        });
      } catch (dispatchErr) {
        console.error('[automation-dispatch] Falha:', dispatchErr);
      }

      // 5. Disparar webhook Make (`consorcio.carta.cadastrada`) já no aceite
      //    da proposta — sem depender do passo "Abrir cota" / consortium_card_id.
      //    Idempotente via `webhook_carta_cadastrada_enviado_em`.
      dispatchCartaCadastradaWebhook({
        cardId: null,
        registrationId: registration.id,
        proposalId: input.proposal_id,
      }).catch((err) => console.warn('[carta-cadastrada-webhook] Falha:', err));

      return registration;
    },
    onSuccess: () => {
      toast.success('Cadastro enviado para Cadastros Pendentes!');
      queryClient.invalidateQueries({ queryKey: ['consorcio-proposals'] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-pending-registrations'] });
    },
    onError: (e: any) => toast.error('Erro ao criar cadastro: ' + e.message),
  });
}

/** Excluir um cadastro pendente (limpa documentos vinculados antes). */
export function useDeletePendingRegistration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (registrationId: string) => {
      // 0. Guardar a proposta vinculada: sem devolvê-la para 'pendente', ela fica
      //    'aceita' sem cota e `documentos_pendentes` alarma para sempre.
      const { data: regRow } = await supabase
        .from('consorcio_pending_registrations')
        .select('id, proposal_id')
        .eq('id', registrationId)
        .maybeSingle();

      // 1. Remover docs vinculados ao pending
      const { data: docs } = await supabase
        .from('consortium_documents')
        .select('id, storage_path')
        .eq('pending_registration_id', registrationId);
      for (const d of docs || []) {
        if ((d as any).storage_path) {
          await supabase.storage.from('consorcio-documents').remove([(d as any).storage_path]);
        }
      }
      await supabase
        .from('consortium_documents')
        .delete()
        .eq('pending_registration_id', registrationId);

      const { error } = await supabase
        .from('consorcio_pending_registrations')
        .delete()
        .eq('id', registrationId);
      if (error) throw error;

      // 4. Devolver a proposta para 'pendente' (volta a ser trabalhável)
      if ((regRow as any)?.proposal_id) {
        await supabase
          .from('consorcio_proposals')
          .update({
            status: 'pendente',
            aceite_at: null,
            aceite_by: null,
            // aceite_date também precisa sair: senão a proposta volta a
            // 'pendente' carregando data de aceite antiga.
            aceite_date: null,
          } as any)
          .eq('id', (regRow as any).proposal_id);
      }
    },
    onSuccess: () => {
      toast.success('Cadastro pendente excluído — carta devolvida para "pendente"');
      queryClient.invalidateQueries({ queryKey: ['consorcio-pending-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-proposals'] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-proposal-has-pending'] });
    },
    onError: (e: any) => toast.error('Erro ao excluir: ' + e.message),
  });
}

// A fila de espera pela Embracon é única e vive na RESERVA da cota
// (`consortium_cards.tipo_registro = 'reserva'`, etapa 5). O status
// `cadastrada` do cadastro pendente foi removido junto com seus hooks.

/**
 * Declinar um cadastro pendente: parceiro desistiu da aquisição.
 * Move o cadastro para status='declinada' com motivo, e marca a proposta
 * vinculada como 'recusada' para abater o valor do realizado / meta de venda.
 */
export function useDeclinePendingRegistration() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (params: { registrationId: string; motivo: string }) => {
      const motivo = (params.motivo || '').trim();
      if (!motivo) throw new Error('Informe o motivo do declínio.');

      // 1. Buscar proposta vinculada (para abater da meta)
      const { data: reg } = await supabase
        .from('consorcio_pending_registrations')
        .select('id, proposal_id, deal_id')
        .eq('id', params.registrationId)
        .maybeSingle();

      // 2. Abater da meta: proposta vinculada → status='recusada' (mesmo efeito do Sem Sucesso)
      if ((reg as any)?.proposal_id) {
        await supabase
          .from('consorcio_proposals')
          .update({
            status: 'recusada',
            motivo_recusa: motivo,
            recusada_at: new Date().toISOString(),
            recusada_by: user?.id ?? null,
          } as any)
          .eq('id', (reg as any).proposal_id);
      }

      // 3. Atualizar cadastro pendente para declinada
      const { error } = await supabase
        .from('consorcio_pending_registrations')
        .update({
          status: 'declinada',
          motivo_declinio: motivo,
          declinada_at: new Date().toISOString(),
          declinada_by: user?.id || null,
        } as any)
        .eq('id', params.registrationId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Carta declinada — valor abatido da meta de venda.');
      queryClient.invalidateQueries({ queryKey: ['consorcio-pending-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-proposals'] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-bi-propostas'] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-realizadas'] });
    },
    onError: (e: any) => toast.error('Erro ao declinar carta: ' + e.message),
  });
}

/** Reverter declínio: devolve o cadastro para 'aguardando_abertura' e reativa a proposta. */
export function useUndeclinePendingRegistration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (registrationId: string) => {
      const { data: reg } = await supabase
        .from('consorcio_pending_registrations')
        .select('id, proposal_id')
        .eq('id', registrationId)
        .maybeSingle();
      if ((reg as any)?.proposal_id) {
        await supabase
          .from('consorcio_proposals')
          .update({
            status: 'aceita',
            motivo_recusa: null,
            recusada_at: null,
            recusada_by: null,
          } as any)
          .eq('id', (reg as any).proposal_id);
      }
      const { error } = await supabase
        .from('consorcio_pending_registrations')
        .update({
          status: 'aguardando_abertura',
          motivo_declinio: null,
          declinada_at: null,
          declinada_by: null,
        } as any)
        .eq('id', registrationId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Declínio revertido — cadastro voltou para pendentes.');
      queryClient.invalidateQueries({ queryKey: ['consorcio-pending-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-proposals'] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-bi-propostas'] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-realizadas'] });
    },
    onError: (e: any) => toast.error('Erro ao reverter: ' + e.message),
  });
}

/** Vincular um cadastro pendente a uma cota já existente (migra documentos). */
export function useLinkPendingToCard() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (params: { registrationId: string; cardId: string }) => {
      // 1. Migrar documentos do pending para o card
      await supabase
        .from('consortium_documents')
        .update({ card_id: params.cardId } as any)
        .eq('pending_registration_id', params.registrationId);

      // 2. Marcar pendente como vinculado
      const { data: linked, error } = await supabase
        .from('consorcio_pending_registrations')
        .update({
          status: 'vinculada',
          consortium_card_id: params.cardId,
          vinculada_at: new Date().toISOString(),
          vinculada_by: user?.id ?? null,
        } as any)
        .eq('id', params.registrationId)
        .select('proposal_id')
        .maybeSingle();
      if (error) throw error;

      // 3. Webhook do Make NÃO é disparado aqui (gatilho único no cadastro
      //    dos dados da cota em "Cartas Negociadas").
      void linked;
    },
    onSuccess: () => {
      toast.success('Cadastro vinculado à cota existente');
      queryClient.invalidateQueries({ queryKey: ['consorcio-pending-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['consortium-cards'] });
    },
    onError: (e: any) => toast.error('Erro ao vincular: ' + e.message),
  });
}

/** Criar manualmente um cadastro pendente (sem proposta/deal). */
export interface CreateManualPendingInput {
  tipo_pessoa: 'pf' | 'pj';
  nome_completo?: string;
  razao_social?: string;
  cpf?: string;
  cnpj?: string;
  telefone?: string;
  email?: string;
  vendedor_name: string; // usado como rótulo de origem/parceiro
  valor_credito?: number;
  prazo_meses?: number;
  empresa_paga_parcelas?: 'sim' | 'nao';
  tipo_contrato?: 'normal' | 'intercalado' | 'intercalado_impar';
  parcelas_pagas_empresa?: number;
  aceite_date?: string; // YYYY-MM-DD
  observacoes?: string;
  deal_id?: string | null;
  tipo_produto?: 'select' | 'parcelinha';
  vendedor_id?: string;
  vendedor_name_cota?: string;
}

export function useCreateManualPendingRegistration() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: CreateManualPendingInput) => {
      if (!user?.id) throw new Error('Usuário não autenticado.');
      const payload: any = {
        ...Object.fromEntries(
          Object.entries(input).filter(([_, v]) => v !== undefined && v !== ''),
        ),
        aceite_date: input.aceite_date || new Date().toISOString().split('T')[0],
        status: 'aguardando_abertura',
        created_by: user.id,
      };
      const { data, error } = await supabase
        .from('consorcio_pending_registrations')
        .insert(payload)
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Cadastro pendente criado!');
      queryClient.invalidateQueries({ queryKey: ['consorcio-pending-registrations'] });
    },
    onError: (e: any) => toast.error('Erro ao criar cadastro: ' + e.message),
  });
}

/** Atualizar campos editáveis de um cadastro pendente. */
export type UpdatePendingRegistrationPatch = Partial<{
  // cliente
  nome_completo: string | null;
  razao_social: string | null;
  cpf: string | null;
  cnpj: string | null;
  rg: string | null;
  cpf_conjuge: string | null;
  profissao: string | null;
  telefone: string | null;
  email: string | null;
  endereco_completo: string | null;
  endereco_cep: string | null;
  renda: number | null;
  patrimonio: number | null;
  pix: string | null;
  // cota
  valor_credito: number | null;
  prazo_meses: number | null;
  tipo_produto: string | null;
  empresa_paga_parcelas: string | null;
  tipo_contrato: string | null;
  parcelas_pagas_empresa: number | null;
  origem: string | null;
  origem_detalhe: string | null;
  vendedor_id: string | null;
  vendedor_name_cota: string | null;
  observacoes: string | null;
  aceite_date: string | null;
  // cota — campos que a edição precisa gravar (antes eram descartados em silêncio)
  categoria: string | null;
  grupo: string | null;
  cota: string | null;
  produto_codigo: string | null;
  inclui_seguro: boolean | null;
  data_contratacao: string | null;
  valor_comissao: number | null;
  e_transferencia: boolean | null;
  transferido_de: string | null;
  // plano / Termo de Adesão
  credito_id: string | null;
  condicao_pagamento: string | null;
  parcela_1a_12a: number | null;
  parcela_demais: number | null;
  dia_vencimento: number | null;
  inicio_segunda_parcela: string | null;
  objetivo: string | null;
}>;

export function useUpdatePendingRegistration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; patch: UpdatePendingRegistrationPatch }) => {
      const cleaned = Object.fromEntries(
        Object.entries(params.patch).filter(([, v]) => v !== undefined),
      );
      const { error } = await supabase
        .from('consorcio_pending_registrations')
        .update(cleaned as any)
        .eq('id', params.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success('Cadastro atualizado!');
      queryClient.invalidateQueries({ queryKey: ['consorcio-pending-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-pending-registration', vars.id] });
    },
    onError: (e: any) => toast.error('Erro ao atualizar: ' + e.message),
  });
}

export function useOpenCota() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      registrationId: string;
      registration: PendingRegistration;
      cotaData: {
        categoria: string;
        /** Reserva pode nascer sem grupo/cota (a Embracon devolve depois). */
        grupo: string | null;
        cota: string | null;
        valor_credito: number;
        prazo_meses: number;
        tipo_produto: string;
        produto_codigo?: string;
        condicao_pagamento?: string;
        inclui_seguro?: boolean;
        empresa_paga_parcelas: string;
        tipo_contrato?: string;
        parcelas_pagas_empresa?: number;
        /** Nulo = "A definir" (a Embracon informa depois da abertura). */
        dia_vencimento: number | null;
        inicio_segunda_parcela?: string;
        data_contratacao: string;
        /** 'reserva' = enviada à Embracon, aguardando confirmação. */
        tipo_registro?: 'reserva' | 'contratacao';
        data_reserva?: string | null;
        origem: string;
        origem_detalhe?: string;
        vendedor_id?: string;
        vendedor_name?: string;
        valor_comissao?: number;
        e_transferencia?: boolean;
        transferido_de?: string;
        observacoes?: string;
        parcela_1a_12a?: number;
        parcela_demais?: number;
      };
      clienteData?: {
        nome_completo?: string | null;
        cpf?: string | null;
        rg?: string | null;
        profissao?: string | null;
        telefone?: string | null;
        email?: string | null;
        endereco_completo?: string | null;
        endereco_cep?: string | null;
        renda?: number | null;
        patrimonio?: number | null;
        pix?: string | null;
      };
    }) => {
      const { registration, cotaData, registrationId, clienteData } = params;

      // Abertura como RESERVA: a cota foi enviada à Embracon e ainda não voltou
      // confirmada. Nesse caso a data base do cronograma é a data de reserva,
      // `data_contratacao` fica nula (é ela que faz a cota contar na etapa Cotas)
      // e as parcelas nascem com status 'previsto'.
      const isReserva = cotaData.tipo_registro === 'reserva';
      const baseDateStr = isReserva
        ? (cotaData.data_reserva || cotaData.data_contratacao)
        : cotaData.data_contratacao;

      // 0. Update client data on pending registration if provided
      if (clienteData) {
        // Zero é valor legítimo em renda/patrimônio (mesmo espírito do numOuNull()
        // usado na edição do cadastro pendente). Só descartamos string vazia e undefined.
        const NUMERICOS_COM_ZERO = ['renda', 'patrimonio'];
        const cleanClientData = Object.fromEntries(
          Object.entries(clienteData).filter(([k, v]) => {
            if (v === '' || v === undefined) return false;
            if (v === 0) return NUMERICOS_COM_ZERO.includes(k);
            return true;
          })
        );
        if (Object.keys(cleanClientData).length > 0) {
          const { error: clientUpdateError } = await supabase
            .from('consorcio_pending_registrations')
            .update(cleanClientData as any)
            .eq('id', registrationId);
          if (clientUpdateError) throw clientUpdateError;
        }
      }

      // 1. Build consortium card data from registration (client) + cota (gestor)
      const cardInput: CreateConsorcioCardInput = {
        tipo_pessoa: registration.tipo_pessoa,
        categoria: cotaData.categoria as any,
        grupo: cotaData.grupo,
        cota: cotaData.cota,
        valor_credito: cotaData.valor_credito,
        prazo_meses: cotaData.prazo_meses,
        tipo_produto: cotaData.tipo_produto as any,
        tipo_contrato: (cotaData.tipo_contrato || 'normal') as any,
        parcelas_pagas_empresa: cotaData.empresa_paga_parcelas === 'sim' ? (cotaData.parcelas_pagas_empresa || 0) : 0,
        tipo_registro: isReserva ? 'reserva' : 'contratacao',
        data_contratacao: isReserva ? null : cotaData.data_contratacao,
        // Contratação: se não houver data de reserva informada, deixamos a chave
        // UNDEFINED (o insert filtra undefined) em vez de mandar null explícito —
        // null anularia qualquer default/trigger da coluna no banco.
        data_reserva: isReserva
          ? (cotaData.data_reserva || cotaData.data_contratacao)
          : (cotaData.data_reserva || undefined),
        dia_vencimento: cotaData.dia_vencimento,
        inicio_segunda_parcela: (cotaData.inicio_segunda_parcela || 'automatico') as any,
        origem: cotaData.origem,
        origem_detalhe: cotaData.origem_detalhe,
        vendedor_id: cotaData.vendedor_id,
        vendedor_name: cotaData.vendedor_name,
        valor_comissao: cotaData.valor_comissao,
        e_transferencia: cotaData.e_transferencia,
        transferido_de: cotaData.transferido_de,
        observacoes: cotaData.observacoes,
        // Objetivo: vale o que está na tela de Abertura de Cota no submit; sem isso,
        // cai no que foi capturado no aceite.
        objetivo: (cotaData as any).objetivo || (registration as any).objetivo || undefined,
        produto_embracon: cotaData.produto_codigo,
        condicao_pagamento: cotaData.condicao_pagamento,
        inclui_seguro_vida: cotaData.inclui_seguro,
        parcela_1a_12a: cotaData.parcela_1a_12a,
        parcela_demais: cotaData.parcela_demais,
        // Client data from registration
        nome_completo: registration.nome_completo || undefined,
        rg: registration.rg || undefined,
        cpf: registration.cpf || undefined,
        cpf_conjuge: registration.cpf_conjuge || undefined,
        profissao: registration.profissao || undefined,
        telefone: registration.telefone || undefined,
        email: registration.email || undefined,
        endereco_cep: registration.endereco_cep || undefined,
        endereco_rua: registration.endereco_completo || undefined,
        renda: registration.renda || undefined,
        patrimonio: registration.patrimonio || undefined,
        pix: registration.pix || undefined,
        razao_social: registration.razao_social || undefined,
        cnpj: registration.cnpj || undefined,
        natureza_juridica: registration.natureza_juridica || undefined,
        inscricao_estadual: registration.inscricao_estadual || undefined,
        data_fundacao: registration.data_fundacao || undefined,
        endereco_comercial_rua: registration.endereco_comercial || undefined,
        endereco_comercial_cep: registration.endereco_comercial_cep || undefined,
        telefone_comercial: registration.telefone_comercial || undefined,
        email_comercial: registration.email_comercial || undefined,
        faturamento_mensal: registration.faturamento_mensal || undefined,
        num_funcionarios: registration.num_funcionarios || undefined,
        partners: registration.socios?.map(s => ({ nome: (s as any).nome || '', cpf: s.cpf, renda: s.renda })),
      };

      // Sanitize empty strings
      const { partners, inicio_segunda_parcela, ...cardData } = cardInput;
      const cleanedData = Object.fromEntries(
        Object.entries(cardData).filter(([_, v]) => v !== '' && v !== undefined)
      );

      // 2. Create consortium card
      const { data: card, error: cardError } = await supabase
        .from('consortium_cards')
        .insert(cleanedData as any)
        .select('id')
        .single();

      if (cardError) throw cardError;

      // 3. Create partners if PJ
      if (registration.tipo_pessoa === 'pj' && partners && partners.length > 0) {
        const partnersData = partners.map(p => ({
          card_id: card.id,
          nome: p.nome,
          cpf: p.cpf,
          renda: p.renda,
        }));
        await supabase.from('consortium_pj_partners').insert(partnersData);
      }

      // 4. Cronograma de parcelas.
      // O dia de vencimento é definido pela Embracon DEPOIS da abertura. Quando
      // ele ainda é "A definir" (nulo), não há data confiável: o cronograma não é
      // gerado agora e nasce quando o dia for informado (confirmação da Embracon
      // ou edição da cota) — ver gerarCronogramaSeFaltando().
      if (cotaData.dia_vencimento) {
        const parcelas = await montarParcelasCota({
          cardId: card.id,
          baseDate: String(baseDateStr),
          diaVencimento: Number(cotaData.dia_vencimento),
          prazoMeses: cotaData.prazo_meses,
          valorCredito: cotaData.valor_credito,
          tipoProduto: cotaData.tipo_produto,
          tipoContrato: cotaData.tipo_contrato || 'normal',
          parcelasEmpresa: cotaData.empresa_paga_parcelas === 'sim' ? (cotaData.parcelas_pagas_empresa || 0) : 0,
          inicioSegundaParcela: cotaData.inicio_segunda_parcela || 'automatico',
          isReserva,
        });
        await inserirParcelas(parcelas);
      }


      // 5. Migrate documents from pending_registration_id to card_id
      const { error: documentsUpdateError } = await supabase
        .from('consortium_documents')
        .update({ card_id: card.id } as any)
        .eq('pending_registration_id', registrationId);
      if (documentsUpdateError) throw documentsUpdateError;

      // 6. Update pending registration status
      const pendingUpdate = {
        status: 'cota_aberta',
        cota_aberta_at: new Date().toISOString(),
        cota_aberta_by: user?.id ?? null,
        consortium_card_id: card.id,
        categoria: cotaData.categoria,
        grupo: cotaData.grupo,
        cota: cotaData.cota,
        valor_credito: cotaData.valor_credito,
        prazo_meses: cotaData.prazo_meses,
        tipo_produto: cotaData.tipo_produto,
        produto_codigo: cotaData.produto_codigo || null,
        condicao_pagamento: cotaData.condicao_pagamento || null,
        inclui_seguro: cotaData.inclui_seguro ?? false,
        empresa_paga_parcelas: cotaData.empresa_paga_parcelas,
        tipo_contrato: cotaData.tipo_contrato || 'normal',
        parcelas_pagas_empresa: cotaData.empresa_paga_parcelas === 'sim' ? (cotaData.parcelas_pagas_empresa || 0) : 0,
        dia_vencimento: cotaData.dia_vencimento,
        inicio_segunda_parcela: cotaData.inicio_segunda_parcela || 'automatico',
        data_contratacao: isReserva ? null : cotaData.data_contratacao,
        origem: cotaData.origem,
        origem_detalhe: cotaData.origem_detalhe || null,
        vendedor_id: cotaData.vendedor_id || null,
        vendedor_name_cota: cotaData.vendedor_name || null,
        valor_comissao: cotaData.valor_comissao || 0,
        e_transferencia: cotaData.e_transferencia || false,
        transferido_de: cotaData.transferido_de || null,
        observacoes: cotaData.observacoes || null,
        // Objetivo escolhido na Abertura de Cota também volta para o cadastro
        // pendente — o Termo de Adesão é gerado a partir dele.
        objetivo: (cotaData as any).objetivo || (registration as any).objetivo || null,
      };
      const { error: pendingUpdateError } = await supabase
        .from('consorcio_pending_registrations')
        .update(pendingUpdate as any)
        .eq('id', registrationId)
        .select('id')
        .single();
      if (pendingUpdateError) throw pendingUpdateError;

      // 7. Update proposal with card id
      if (registration.proposal_id) {
        await supabase
          .from('consorcio_proposals')
          .update({ consortium_card_id: card.id })
          .eq('id', registration.proposal_id);
      }

      // 8. Webhook do Make NÃO é disparado aqui (gatilho único no cadastro
      //    dos dados da cota em "Cartas Negociadas").

      return card;
    },
    onSuccess: () => {
      toast.success('Cota aberta com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['consorcio-pending-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['consortium-cards'] });
      queryClient.invalidateQueries({ queryKey: ['consortium-summary'] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-proposals'] });
    },
    onError: (e: any) => toast.error('Erro ao abrir cota: ' + e.message),
  });
}
