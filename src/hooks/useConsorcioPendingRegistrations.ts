import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { CreateConsorcioCardInput, TipoDocumento } from '@/types/consorcio';
import { calcularComissao } from '@/lib/commissionCalculator';
import { getProdutoComissaoContext } from '@/lib/produtoComissaoLookup';
import { calcularProximoDiaUtil } from '@/lib/businessDays';
import { getParcelasEmpresa, type ParcelaEmpresa } from '@/lib/consorcioParcelasEmpresa';
import { formatOrigemLabel } from '@/lib/consorcioOrigemLabel';
import { buildConsorcioBoasVindasEmail } from '@/lib/consorcioBoasVindasEmail';

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
  socios: Array<{ cpf: string; renda: number }>;
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
  created_at,
  vendedor_name,
  aceite_date,
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
  tipo_pessoa: 'pf' | 'pj';
  nome_completo: string | null;
  razao_social: string | null;
  cpf: string | null;
  cnpj: string | null;
  telefone: string | null;
  telefone_comercial: string | null;
  email: string | null;
  email_comercial: string | null;
  socios: Array<{ cpf: string; renda: number }> | null;
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
}

export function usePendingRegistrations(statuses: string[] = ['aguardando_abertura']) {
  return useQuery({
    queryKey: ['consorcio-pending-registrations', statuses.slice().sort().join(',')],
    queryFn: async (): Promise<EnrichedPendingRegistration[]> => {
      const { data, error } = await supabase
        .from('consorcio_pending_registrations')
        .select(PENDING_REGISTRATION_LIST_SELECT)
        .in('status', statuses)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const rows = (data || []) as any[];

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
        const { data: cards } = await supabase
          .from('consortium_cards')
          .select('cpf, cnpj')
          .or(
            [
              cpfs.length ? `cpf.in.(${cpfs.map((c) => `"${c}"`).join(',')})` : '',
              cnpjs.length ? `cnpj.in.(${cnpjs.map((c) => `"${c}"`).join(',')})` : '',
            ]
              .filter(Boolean)
              .join(','),
          );
        (cards || []).forEach((c: any) => {
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
          r.vendedor_name,
        ),
          closer_name: closerName,
          sdr_name: sdrName,
          parcelas_empresa: parcelas,
          valor_total_empresa: parcelas.reduce((s, p) => s + p.valor, 0),
          cotas_existentes_count: docKey ? cotasCountByDoc.get(docKey) || 0 : 0,
          parte_atual: parteAtual || 1,
          total_destinado: totalDestinado,
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
  socios?: Array<{ cpf: string; renda: number }>;
  // Documents
  documents?: Array<{ file: File; tipo: TipoDocumento }>;
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

      const { documents, ...registrationData } = input;

      // 1. Atualizar proposta para 'aceita' PRIMEIRO (operação segura)
      const { error: proposalError } = await supabase
        .from('consorcio_proposals')
        .update({ status: 'aceita', aceite_date: new Date().toISOString().split('T')[0] })
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

      // 4. Enviar email de boas-vindas (idempotente) — não bloqueia sucesso do cadastro
      try {
        const emailDestino = (input.tipo_pessoa === 'pj' ? input.email_comercial : input.email) || null;
        const nomeCliente = (input.tipo_pessoa === 'pj' ? input.razao_social : input.nome_completo) || 'Cliente';
        if (emailDestino) {
          const { data: current } = await supabase
            .from('consorcio_pending_registrations')
            .select('boas_vindas_enviado_em')
            .eq('id', registration.id)
            .single();
          if (!(current as any)?.boas_vindas_enviado_em) {
            const { subject, htmlContent } = buildConsorcioBoasVindasEmail({ nomeCliente });
            const { error: mailError } = await supabase.functions.invoke('brevo-send', {
              body: {
                to: emailDestino,
                name: nomeCliente,
                subject,
                htmlContent,
                tags: ['consorcio_boas_vindas', 'pending_registration'],
                dealId: input.deal_id,
              },
            });
            if (mailError) {
              console.error('[boas-vindas] Falha ao enviar email:', mailError);
            } else {
              await supabase
                .from('consorcio_pending_registrations')
                .update({ boas_vindas_enviado_em: new Date().toISOString() } as any)
                .eq('id', registration.id);
            }
          }
        }
      } catch (mailErr) {
        console.error('[boas-vindas] Exceção ao enviar email:', mailErr);
      }

      return registration;
    },
    onSuccess: () => {
      toast.success('Cadastro enviado para Controle Consórcio!');
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
    },
    onSuccess: () => {
      toast.success('Cadastro pendente excluído');
      queryClient.invalidateQueries({ queryKey: ['consorcio-pending-registrations'] });
    },
    onError: (e: any) => toast.error('Erro ao excluir: ' + e.message),
  });
}

/** Marcar cadastro pendente como "Cadastrada" (move para aba Cadastradas). */
export function useMarkPendingAsCadastrada() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (registrationId: string) => {
      const { error } = await supabase
        .from('consorcio_pending_registrations')
        .update({ status: 'cadastrada' } as any)
        .eq('id', registrationId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Cadastro movido para "Cadastradas"');
      queryClient.invalidateQueries({ queryKey: ['consorcio-pending-registrations'] });
    },
    onError: (e: any) => toast.error('Erro ao marcar como cadastrada: ' + e.message),
  });
}

/** Reverter "Cadastrada" para "Aguardando abertura". */
export function useUnmarkPendingCadastrada() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (registrationId: string) => {
      const { error } = await supabase
        .from('consorcio_pending_registrations')
        .update({ status: 'aguardando_abertura' } as any)
        .eq('id', registrationId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Cadastro devolvido para pendentes');
      queryClient.invalidateQueries({ queryKey: ['consorcio-pending-registrations'] });
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

/** Vincular um cadastro pendente a uma cota já existente (migra documentos). */
export function useLinkPendingToCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { registrationId: string; cardId: string }) => {
      // 1. Migrar documentos do pending para o card
      await supabase
        .from('consortium_documents')
        .update({ card_id: params.cardId } as any)
        .eq('pending_registration_id', params.registrationId);

      // 2. Marcar pendente como vinculado
      const { error } = await supabase
        .from('consorcio_pending_registrations')
        .update({
          status: 'vinculada',
          consortium_card_id: params.cardId,
        } as any)
        .eq('id', params.registrationId);
      if (error) throw error;
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

  return useMutation({
    mutationFn: async (params: {
      registrationId: string;
      registration: PendingRegistration;
      cotaData: {
        categoria: string;
        grupo: string;
        cota: string;
        valor_credito: number;
        prazo_meses: number;
        tipo_produto: string;
        produto_codigo?: string;
        condicao_pagamento?: string;
        inclui_seguro?: boolean;
        empresa_paga_parcelas: string;
        tipo_contrato?: string;
        parcelas_pagas_empresa?: number;
        dia_vencimento: number;
        inicio_segunda_parcela?: string;
        data_contratacao: string;
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

      // 0. Update client data on pending registration if provided
      if (clienteData) {
        const cleanClientData = Object.fromEntries(
          Object.entries(clienteData).filter(([_, v]) => v !== '' && v !== undefined && v !== 0)
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
        data_contratacao: cotaData.data_contratacao,
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
        partners: registration.socios?.map(s => ({ nome: '', cpf: s.cpf, renda: s.renda })),
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

      // 4. Generate installments
      const [year, month, day] = cotaData.data_contratacao.split('-').map(Number);
      const dataContratacao = new Date(year, month - 1, day);
      const inicioSegunda = cotaData.inicio_segunda_parcela || 'automatico';
      let offsetSegundaParcela: number;
      if (inicioSegunda === 'proximo_mes') {
        offsetSegundaParcela = 1;
      } else if (inicioSegunda === 'pular_mes') {
        offsetSegundaParcela = 2;
      } else {
        offsetSegundaParcela = dataContratacao.getDate() > 16 ? 2 : 1;
      }

      const installments: any[] = [];
      const tipoContrato = cotaData.tipo_contrato || 'normal';
      const parcelasEmpresa = cotaData.empresa_paga_parcelas === 'sim' ? (cotaData.parcelas_pagas_empresa || 0) : 0;

      const ctxComissao = await getProdutoComissaoContext(cotaData.valor_credito, cotaData.tipo_produto as any);
      for (let i = 1; i <= cotaData.prazo_meses; i++) {
        let dataVencimento: Date;
        if (i === 1) {
          dataVencimento = dataContratacao;
        } else {
          const monthOffset = offsetSegundaParcela + (i - 2);
          const mesAlvo = dataContratacao.getMonth() + monthOffset;
          const anoAlvo = dataContratacao.getFullYear() + Math.floor(mesAlvo / 12);
          const mesNormalizado = ((mesAlvo % 12) + 12) % 12;
          const ultimoDia = new Date(anoAlvo, mesNormalizado + 1, 0).getDate();
          const diaAjustado = Math.min(cotaData.dia_vencimento, ultimoDia);
          dataVencimento = calcularProximoDiaUtil(new Date(anoAlvo, mesNormalizado, diaAjustado));
        }
        const valorComissao = calcularComissao(cotaData.valor_credito, cotaData.tipo_produto as any, i, ctxComissao);

        let tipo: 'cliente' | 'empresa';
        if (tipoContrato === 'intercalado') {
          const ehPar = i % 2 === 0;
          tipo = (ehPar && (i / 2) <= parcelasEmpresa) ? 'empresa' : 'cliente';
        } else if (tipoContrato === 'intercalado_impar') {
          const ehImpar = i % 2 === 1;
          tipo = (ehImpar && Math.ceil(i / 2) <= parcelasEmpresa) ? 'empresa' : 'cliente';
        } else {
          tipo = i <= parcelasEmpresa ? 'empresa' : 'cliente';
        }

        installments.push({
          card_id: card.id,
          numero_parcela: i,
          tipo,
          valor_parcela: cotaData.valor_credito / cotaData.prazo_meses,
          valor_comissao: valorComissao,
          data_vencimento: dataVencimento.toISOString().split('T')[0],
          status: 'pendente',
        });
      }

      const CHUNK_SIZE = 8;
      for (let i = 0; i < installments.length; i += CHUNK_SIZE) {
        const { error: installmentsError } = await supabase
          .from('consortium_installments')
          .insert(installments.slice(i, i + CHUNK_SIZE));

        if (installmentsError) throw installmentsError;
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
        data_contratacao: cotaData.data_contratacao,
        origem: cotaData.origem,
        origem_detalhe: cotaData.origem_detalhe || null,
        vendedor_id: cotaData.vendedor_id || null,
        vendedor_name_cota: cotaData.vendedor_name || null,
        valor_comissao: cotaData.valor_comissao || 0,
        e_transferencia: cotaData.e_transferencia || false,
        transferido_de: cotaData.transferido_de || null,
        observacoes: cotaData.observacoes || null,
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
