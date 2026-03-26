import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface RhTicket {
  id: string;
  employee_id: string;
  tipo: 'ocorrencia' | 'solicitacao' | 'sugestao';
  assunto: string;
  descricao: string;
  status: 'encaminhado' | 'em_avaliacao' | 'finalizado';
  resposta_rh: string | null;
  respondido_por: string | null;
  anexo_url: string | null;
  anexo_storage_path: string | null;
  data_abertura: string;
  data_atualizacao: string;
  data_encerramento: string | null;
  created_at: string;
  updated_at: string;
}

export const TICKET_STATUS_LABELS: Record<RhTicket['status'], { label: string; color: string }> = {
  encaminhado: { label: 'Encaminhado', color: 'bg-yellow-500' },
  em_avaliacao: { label: 'Em avaliação', color: 'bg-blue-500' },
  finalizado: { label: 'Finalizado', color: 'bg-green-500' },
};

export const TICKET_TIPO_LABELS: Record<RhTicket['tipo'], { label: string; color: string }> = {
  ocorrencia: { label: 'Ocorrência', color: 'bg-red-500' },
  solicitacao: { label: 'Solicitação', color: 'bg-blue-500' },
  sugestao: { label: 'Sugestão', color: 'bg-purple-500' },
};

export function useMyTickets(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['my-rh-tickets', employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await supabase
        .from('rh_tickets')
        .select('*')
        .eq('employee_id', employeeId)
        .order('data_abertura', { ascending: false });
      if (error) throw error;
      return data as RhTicket[];
    },
    enabled: !!employeeId,
  });
}

interface CreateTicketData {
  employee_id: string;
  tipo: RhTicket['tipo'];
  assunto: string;
  descricao: string;
  file?: File;
}

export function useCreateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ employee_id, tipo, assunto, descricao, file }: CreateTicketData) => {
      let anexo_url: string | null = null;
      let anexo_storage_path: string | null = null;

      if (file) {
        const ext = file.name.split('.').pop();
        const path = `rh-tickets/${employee_id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('user-files')
          .upload(path, file);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('user-files')
          .getPublicUrl(path);
        anexo_url = urlData.publicUrl;
        anexo_storage_path = path;
      }

      const { data, error } = await supabase
        .from('rh_tickets')
        .insert({
          employee_id,
          tipo,
          assunto,
          descricao,
          anexo_url,
          anexo_storage_path,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['my-rh-tickets', variables.employee_id] });
      toast.success('Solicitação enviada com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao enviar solicitação: ' + error.message);
    },
  });
}
