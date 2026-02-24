import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { CreateConsorcioCardInput, TipoDocumento } from '@/types/consorcio';
import { calcularComissao } from '@/lib/commissionCalculator';
import { calcularProximoDiaUtil } from '@/lib/businessDays';

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

export function usePendingRegistrations() {
  return useQuery({
    queryKey: ['consorcio-pending-registrations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consorcio_pending_registrations')
        .select('*, deal:crm_deals!deal_id(contact:crm_contacts!contact_id(name, email, phone), owner_id)')
        .eq('status', 'aguardando_abertura')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fallback: preencher nome/telefone/email do contato quando vazios
      return (data || []).map((r: any) => ({
        ...r,
        nome_completo: r.nome_completo || r.deal?.contact?.name || null,
        telefone: r.telefone || r.deal?.contact?.phone || null,
        email: r.email || r.deal?.contact?.email || null,
        vendedor_name: r.vendedor_name || r.deal?.owner_id || null,
        deal: undefined,
      })) as unknown as PendingRegistration[];
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
        .select('*')
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
      const sanitized = Object.fromEntries(
        Object.entries(registrationData).map(([key, value]) => [
          key,
          value === '' ? null : value,
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
        .select()
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
          await supabase
            .from('consorcio_pending_registrations')
            .update(cleanClientData as any)
            .eq('id', registrationId);
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
        // Client data from registration
        nome_completo: registration.nome_completo || undefined,
        rg: registration.rg || undefined,
        cpf: registration.cpf || undefined,
        cpf_conjuge: registration.cpf_conjuge || undefined,
        profissao: registration.profissao || undefined,
        telefone: registration.telefone || undefined,
        email: registration.email || undefined,
        endereco_cep: registration.endereco_cep || undefined,
        renda: registration.renda || undefined,
        patrimonio: registration.patrimonio || undefined,
        pix: registration.pix || undefined,
        razao_social: registration.razao_social || undefined,
        cnpj: registration.cnpj || undefined,
        natureza_juridica: registration.natureza_juridica || undefined,
        inscricao_estadual: registration.inscricao_estadual || undefined,
        data_fundacao: registration.data_fundacao || undefined,
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
        .select()
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
        const valorComissao = calcularComissao(cotaData.valor_credito, cotaData.tipo_produto as any, i);

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

      await supabase.from('consortium_installments').insert(installments);

      // 5. Migrate documents from pending_registration_id to card_id
      await supabase
        .from('consortium_documents')
        .update({ card_id: card.id } as any)
        .eq('pending_registration_id', registrationId);

      // 6. Update pending registration status
      await supabase
        .from('consorcio_pending_registrations')
        .update({
          status: 'cota_aberta',
          consortium_card_id: card.id,
          ...cotaData,
        } as any)
        .eq('id', registrationId);

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
