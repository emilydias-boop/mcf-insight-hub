import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ConsorcioBoleto {
  id: string;
  card_id: string | null;
  installment_id: string | null;
  nome_extraido: string | null;
  grupo_extraido: string | null;
  cota_extraida: string | null;
  valor_extraido: number | null;
  vencimento_extraido: string | null;
  linha_digitavel: string | null;
  codigo_barras: string | null;
  storage_path: string;
  match_confidence: string;
  status: string;
  sent_at: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export function useBoletosByInstallments(installmentIds: string[]) {
  return useQuery({
    queryKey: ['consorcio-boletos', installmentIds],
    queryFn: async () => {
      if (!installmentIds.length) return [];
      const { data, error } = await supabase
        .from('consorcio_boletos')
        .select('*')
        .in('installment_id', installmentIds);
      if (error) throw error;
      return (data || []) as ConsorcioBoleto[];
    },
    enabled: installmentIds.length > 0,
  });
}

export function useBoletosByCard(cardId: string | null) {
  return useQuery({
    queryKey: ['consorcio-boletos-card', cardId],
    queryFn: async () => {
      if (!cardId) return [];
      const { data, error } = await supabase
        .from('consorcio_boletos')
        .select('*')
        .eq('card_id', cardId)
        .order('vencimento_extraido', { ascending: true });
      if (error) throw error;
      return (data || []) as ConsorcioBoleto[];
    },
    enabled: !!cardId,
  });
}

export function useUploadBoleto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const path = `${Date.now()}_${file.name}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('consorcio-boletos')
        .upload(path, file, { contentType: 'application/pdf' });

      if (uploadError) throw uploadError;

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Call parse-boleto edge function
      const { data, error } = await supabase.functions.invoke('parse-boleto', {
        body: { storagePath: path, uploadedBy: user?.id },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao processar boleto');

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consorcio-boletos'] });
    },
  });
}

export function useSendBoletoWhatsApp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ boletoId, mode }: { boletoId: string; mode: 'twilio' | 'wame' }) => {
      const { data, error } = await supabase.functions.invoke('send-boleto-whatsapp', {
        body: { boletoId, mode },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao enviar');

      return data;
    },
    onSuccess: (data, variables) => {
      if (variables.mode === 'wame' && data.wameUrl) {
        window.open(data.wameUrl, '_blank');
      }
      toast.success('Boleto enviado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['consorcio-boletos'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao enviar boleto');
    },
  });
}

export function useBoletoSignedUrl(storagePath: string | null) {
  return useQuery({
    queryKey: ['boleto-url', storagePath],
    queryFn: async () => {
      if (!storagePath) return null;
      const { data } = await supabase.storage
        .from('consorcio-boletos')
        .createSignedUrl(storagePath, 3600);
      return data?.signedUrl || null;
    },
    enabled: !!storagePath,
    staleTime: 30 * 60 * 1000, // 30 min
  });
}
