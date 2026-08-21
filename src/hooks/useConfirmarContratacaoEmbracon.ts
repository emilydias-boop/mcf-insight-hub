import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useConvertReservaToContratacao } from './useConsorcio';

/**
 * Etapa 5 do funil — confirmação do cadastro na Embracon.
 *
 * Converte a cota de RESERVA em CONTRATAÇÃO (a partir daí ela passa a contar na
 * etapa "Cotas", que filtra por `data_contratacao`), grava o número do contrato
 * na administradora e anexa o retorno dela como documento
 * `tipo = 'confirmacao_embracon'` vinculado ao `card_id`.
 *
 * Saída de exceção: sem comprovante, exigindo motivo escrito, que é registrado
 * com carimbo de data e usuário em `observacoes` (em linha própria, preservando
 * o que já estava lá). O motivo é gravado ANTES da conversão: se a conversão
 * falhar, sobra motivo sem contratação (recuperável na retentativa, que não
 * duplica a linha) em vez de contratação sem justificativa — este segundo caso
 * seria irrecuperável, porque a reconversão é bloqueada ("já está contratada").
 */
/** Marca fixa usada para detectar (e não duplicar) a linha de motivo. */
const MARCA_SEM_COMPROVANTE = 'Contratação confirmada SEM comprovante da Embracon';

export function useConfirmarContratacaoEmbracon() {
  const queryClient = useQueryClient();
  const convert = useConvertReservaToContratacao();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      cardId,
      dataContratacao,
      contratoEmbracon,
      grupo,
      cota,
      diaVencimento,
      file,
      motivoSemComprovante,
    }: {
      cardId: string;
      dataContratacao: string; // YYYY-MM-DD
      contratoEmbracon?: string | null;
      /** Grupo/cota devolvidos pela Embracon (reserva pode ter nascido sem eles). */
      grupo?: string | null;
      cota?: string | null;
      /** Dia de vencimento devolvido pela Embracon (obrigatório se a cota está "A definir"). */
      diaVencimento?: number | null;
      file?: File | null;
      /** Obrigatório quando a confirmação é feita sem comprovante. */
      motivoSemComprovante?: string | null;
    }) => {
      if (!file && !motivoSemComprovante?.trim()) {
        throw new Error('Anexe a confirmação da Embracon ou informe o motivo da confirmação sem comprovante.');
      }

      // 1. Documento (quando houver) — idempotente: se já existe um
      // 'confirmacao_embracon' para o card (tentativa anterior que falhou depois
      // do upload), não gera duplicata.
      if (file) {
        const { data: jaExiste, error: checkErr } = await supabase
          .from('consortium_documents')
          .select('id')
          .eq('card_id', cardId)
          .eq('tipo', 'confirmacao_embracon')
          .limit(1);
        if (checkErr) throw checkErr;
        if (jaExiste && jaExiste.length > 0) {
          // documento já anexado numa tentativa anterior — segue para a conversão
        } else {
        const ext = file.name.split('.').pop();
        const path = `${cardId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('consorcio-documents')
          .upload(path, file);
        if (upErr) throw upErr;
        const { data: urlData } = await supabase.storage
          .from('consorcio-documents')
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        const { error: docErr } = await supabase.from('consortium_documents').insert({
          card_id: cardId,
          tipo: 'confirmacao_embracon',
          nome_arquivo: file.name,
          storage_path: path,
          storage_url: urlData?.signedUrl || '',
          uploaded_by: user?.id,
        } as any);
        if (docErr) throw docErr;
        }
      }

      // 2. Contrato Embracon + grupo/cota — nunca apaga o que já existe
      const identificacao: Record<string, string> = {};
      if (contratoEmbracon?.trim()) identificacao.contrato_embracon = contratoEmbracon.trim();
      if (grupo?.trim()) identificacao.grupo = grupo.trim();
      if (cota?.trim()) identificacao.cota = cota.trim();
      if (Object.keys(identificacao).length > 0) {
        const { error } = await supabase
          .from('consortium_cards')
          .update(identificacao as any)
          .eq('id', cardId);
        if (error) throw error;
      }

      // 3. Motivo da exceção em observacoes (append, com carimbo) — ANTES da
      // conversão, e idempotente: se a marca já estiver lá (retentativa), não
      // grava de novo.
      if (!file && motivoSemComprovante?.trim()) {
        const { data: card, error: readErr } = await supabase
          .from('consortium_cards')
          .select('observacoes')
          .eq('id', cardId)
          .single();
        if (readErr) throw readErr;
        const atual = (card as any)?.observacoes?.trim();
        if (!atual?.includes(MARCA_SEM_COMPROVANTE)) {
          const quem =
            (user?.user_metadata as any)?.full_name || user?.email || 'usuário não identificado';
          const quando = new Date().toLocaleString('pt-BR');
          const linha = `[${quando}] ${MARCA_SEM_COMPROVANTE} por ${quem}. Motivo: ${motivoSemComprovante.trim()}`;
          const { error: obsErr } = await supabase
            .from('consortium_cards')
            .update({ observacoes: atual ? `${atual}\n${linha}` : linha } as any)
            .eq('id', cardId);
          if (obsErr) throw obsErr;
        }
      }

      // 4. Reserva -> contratação (datas das parcelas e status 'previsto' -> 'pendente')
      try {
        await convert.mutateAsync({ cardId, dataContratacao, diaVencimento });
      } catch (e: any) {
        // A própria mutation de conversão já mostrou o toast — não avisar de novo.
        throw Object.assign(e instanceof Error ? e : new Error(String(e)), { silent: true });
      }

      // 5. Propagar identificação para o cadastro pendente vinculado. A reserva
      // pode ter nascido sem grupo/cota; sem isso o cadastro fica com grupo,
      // cota e data_contratacao nulos para sempre ("Ver detalhes" e Termo de
      // Adesão mostrariam dados vazios).
      const propagar: Record<string, string> = { ...identificacao };
      propagar.data_contratacao = dataContratacao;
      const { error: regErr } = await supabase
        .from('consorcio_pending_registrations')
        .update(propagar as any)
        .eq('consortium_card_id', cardId);
      if (regErr) throw Object.assign(regErr, { silent: false });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['consorcio-reservas-aguardando'] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-cotas-reservadas'] });
      queryClient.invalidateQueries({ queryKey: ['cotas-confirmacao-embracon'] });
      queryClient.invalidateQueries({ queryKey: ['consortium-cards'] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-pending-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-documents', variables.cardId] });
    },
    // Sucesso é anunciado pelo `useConvertReservaToContratacao` (evita aviso duplo).
    // Aqui só avisamos falhas que ocorrem ANTES da conversão (upload/documento).
    onError: (e: any) => {
      if (!e?.silent) toast.error(e?.message || 'Erro ao confirmar contratação');
    },
  });
}
