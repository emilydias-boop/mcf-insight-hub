import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TipoDocumento } from '@/types/consorcio';

export interface ConsorcioDocument {
  id: string;
  card_id: string;
  tipo: TipoDocumento;
  nome_arquivo: string;
  storage_path?: string;
  storage_url?: string;
  uploaded_at: string;
  uploaded_by?: string;
}

export function useConsorcioDocuments(cardId: string | null) {
  return useQuery({
    queryKey: ['consorcio-documents', cardId],
    queryFn: async () => {
      if (!cardId) return [];
      
      const { data, error } = await supabase
        .from('consortium_documents')
        .select('*')
        .eq('card_id', cardId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      return data as ConsorcioDocument[];
    },
    enabled: !!cardId,
  });
}

export function useUploadConsorcioDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      cardId,
      file,
      tipo,
    }: {
      cardId: string;
      file: File;
      tipo: TipoDocumento;
    }) => {
      // Generate unique file path
      const fileExt = file.name.split('.').pop();
      const fileName = `${cardId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('consorcio-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('consorcio-documents')
        .getPublicUrl(fileName);

      // Get user
      const { data: { user } } = await supabase.auth.getUser();

      // Insert document record
      const { data, error } = await supabase
        .from('consortium_documents')
        .insert({
          card_id: cardId,
          tipo,
          nome_arquivo: file.name,
          storage_path: fileName,
          storage_url: urlData.publicUrl,
          uploaded_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['consorcio-documents', variables.cardId] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-card-details', variables.cardId] });
      toast.success('Documento enviado com sucesso');
    },
    onError: (error) => {
      console.error('Error uploading document:', error);
      toast.error('Erro ao enviar documento');
    },
  });
}

export function useDeleteConsorcioDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ documentId, storagePath, cardId }: { documentId: string; storagePath?: string; cardId: string }) => {
      // Delete from storage if path exists
      if (storagePath) {
        await supabase.storage
          .from('consorcio-documents')
          .remove([storagePath]);
      }

      // Delete record from database
      const { error } = await supabase
        .from('consortium_documents')
        .delete()
        .eq('id', documentId);

      if (error) throw error;
      return { cardId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['consorcio-documents', data.cardId] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-card-details', data.cardId] });
      toast.success('Documento removido');
    },
    onError: (error) => {
      console.error('Error deleting document:', error);
      toast.error('Erro ao remover documento');
    },
  });
}

// Batch upload for form submission
export function useBatchUploadDocuments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      cardId,
      documents,
    }: {
      cardId: string;
      documents: Array<{ file: File; tipo: TipoDocumento }>;
    }) => {
      const results = [];
      
      for (const doc of documents) {
        // Generate unique file path
        const fileExt = doc.file.name.split('.').pop();
        const fileName = `${cardId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('consorcio-documents')
          .upload(fileName, doc.file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        // Get signed URL (bucket is private)
        const { data: urlData } = await supabase.storage
          .from('consorcio-documents')
          .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year

        // Get user
        const { data: { user } } = await supabase.auth.getUser();

        // Insert document record
        const { data, error } = await supabase
          .from('consortium_documents')
          .insert({
            card_id: cardId,
            tipo: doc.tipo,
            nome_arquivo: doc.file.name,
            storage_path: fileName,
            storage_url: urlData?.signedUrl || '',
            uploaded_by: user?.id,
          })
          .select()
          .single();

        if (!error && data) {
          results.push(data);
        }
      }

      return results;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['consorcio-documents', variables.cardId] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-card-details', variables.cardId] });
    },
    onError: (error) => {
      console.error('Error uploading documents:', error);
      toast.error('Erro ao enviar documentos');
    },
  });
}

// ==========================================================================
// Variants for documents attached to a pending registration (Cadastros Pendentes)
// These write pending_registration_id instead of card_id. When the cota is
// created via useOpenCota, the migration step relinks them to the new card_id.
// ==========================================================================

export function usePendingRegistrationDocuments(pendingRegistrationId: string | null) {
  return useQuery({
    queryKey: ['pending-reg-documents', pendingRegistrationId],
    queryFn: async () => {
      if (!pendingRegistrationId) return [];
      const { data, error } = await supabase
        .from('consortium_documents')
        .select('*')
        .eq('pending_registration_id', pendingRegistrationId)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ConsorcioDocument[];
    },
    enabled: !!pendingRegistrationId,
  });
}

export function useBatchUploadPendingDocuments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      pendingRegistrationId,
      documents,
    }: {
      pendingRegistrationId: string;
      documents: Array<{ file: File; tipo: TipoDocumento }>;
    }) => {
      const results = [];

      for (const doc of documents) {
        const fileExt = doc.file.name.split('.').pop();
        const fileName = `pending/${pendingRegistrationId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

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

        const { data: { user } } = await supabase.auth.getUser();

        const { data, error } = await supabase
          .from('consortium_documents')
          .insert({
            pending_registration_id: pendingRegistrationId,
            tipo: doc.tipo,
            nome_arquivo: doc.file.name,
            storage_path: fileName,
            storage_url: urlData?.signedUrl || '',
            uploaded_by: user?.id,
          })
          .select()
          .single();

        if (!error && data) results.push(data);
      }

      return results;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pending-reg-documents', variables.pendingRegistrationId] });
      queryClient.invalidateQueries({ queryKey: ['pending-registrations'] });
    },
    onError: (error) => {
      console.error('Error uploading pending documents:', error);
      toast.error('Erro ao enviar documentos');
    },
  });
}

export function useDeletePendingDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      documentId,
      storagePath,
      pendingRegistrationId,
    }: {
      documentId: string;
      storagePath?: string;
      pendingRegistrationId: string;
    }) => {
      if (storagePath) {
        await supabase.storage.from('consorcio-documents').remove([storagePath]);
      }
      const { error } = await supabase
        .from('consortium_documents')
        .delete()
        .eq('id', documentId);
      if (error) throw error;
      return { pendingRegistrationId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pending-reg-documents', data.pendingRegistrationId] });
      queryClient.invalidateQueries({ queryKey: ['pending-registrations'] });
      toast.success('Documento removido');
    },
    onError: (error) => {
      console.error('Error deleting pending document:', error);
      toast.error('Erro ao remover documento');
    },
  });
}
