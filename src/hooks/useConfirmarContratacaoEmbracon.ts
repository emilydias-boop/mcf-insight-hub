import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
 * o que já estava lá).
 */
export function useConfirmarContratacaoEmbracon() {
  const queryClient = useQueryClient();
  const convert = useConvertReservaToContratacao();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      cardId,
      dataContratacao,
      contratoEmbracon,
      file,
      motivoSemComprovante,
    }: {
      cardId: string;
      dataContratacao: string; // YYYY-MM-DD
      contratoEmbracon?: string | null;
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

      // 2. Contrato Embracon — nunca apaga o que já existe
      if (contratoEmbracon?.trim()) {
        const { error } = await supabase
          .from('consortium_cards')
          .update({ contrato_embracon: contratoEmbracon.trim() } as any)
          .eq('id', cardId);
        if (error) throw error;
      }

      // 3. Reserva -> contratação (datas das parcelas e status 'previsto' -> 'pendente')
      await convert.mutateAsync({ cardId, dataContratacao });

      // 4. Motivo da exceção em observacoes (append, com carimbo) — SÓ depois da
      // conversão dar certo, senão uma falha deixaria linhas duplicadas a cada
      // nova tentativa.
      if (!file && motivoSemComprovante?.trim()) {
        const { data: card, error: readErr } = await supabase
          .from('consortium_cards')
          .select('observacoes')
          .eq('id', cardId)
          .single();
        if (readErr) throw readErr;
        const quem =
          (user?.user_metadata as any)?.full_name || user?.email || 'usuário não identificado';
        const quando = new Date().toLocaleString('pt-BR');
        const linha = `[${quando}] Contratação confirmada SEM comprovante da Embracon por ${quem}. Motivo: ${motivoSemComprovante.trim()}`;
        const atual = (card as any)?.observacoes?.trim();
        const { error: obsErr } = await supabase
          .from('consortium_cards')
          .update({ observacoes: atual ? `${atual}\n${linha}` : linha } as any)
          .eq('id', cardId);
        if (obsErr) throw obsErr;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['consorcio-reservas-aguardando'] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-cotas-reservadas'] });
      queryClient.invalidateQueries({ queryKey: ['cotas-confirmacao-embracon'] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-documents', variables.cardId] });
    },
    // Toast de sucesso/erro fica com o `useConvertReservaToContratacao` (evita aviso duplo).
  });
}
