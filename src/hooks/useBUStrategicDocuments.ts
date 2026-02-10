import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { BusinessUnit } from "@/hooks/useMyBU";

export interface StrategicDocument {
  id: string;
  bu: string;
  mes: number;
  ano: number;
  semana: number;
  nome_arquivo: string;
  storage_path: string;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  uploaded_by_role: string | null;
  created_at: string;
}

interface UploadParams {
  file: File;
  bu: BusinessUnit;
  mes: number;
  ano: number;
  semana: number;
}

export function useBUStrategicDocuments(bu: BusinessUnit | null, ano: number, mes: number | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const documentsQuery = useQuery({
    queryKey: ["bu-strategic-documents", bu, ano, mes],
    queryFn: async () => {
      if (!bu) return [];
      let query = supabase
        .from("bu_strategic_documents" as any)
        .select("*")
        .eq("bu", bu)
        .eq("ano", ano)
        .order("semana", { ascending: true })
        .order("created_at", { ascending: false });

      if (mes) {
        query = query.eq("mes", mes);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as StrategicDocument[];
    },
    enabled: !!bu && !!user,
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, bu, mes, ano, semana }: UploadParams) => {
      if (!user) throw new Error("Usuário não autenticado");

      // Validate PDF
      if (file.type !== "application/pdf") {
        throw new Error("Apenas arquivos PDF são permitidos");
      }
      if (file.size > 20 * 1024 * 1024) {
        throw new Error("Arquivo deve ter no máximo 20MB");
      }

      // Get user profile for name and role
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .single();

      const storagePath = `${bu}/${ano}/${mes}/semana-${semana}/${Date.now()}_${file.name}`;

      // Upload to storage
      const { error: storageError } = await supabase.storage
        .from("bu-strategic-documents")
        .upload(storagePath, file);

      if (storageError) throw storageError;

      // Create DB record
      const { error: dbError } = await supabase
        .from("bu_strategic_documents" as any)
        .insert({
          bu,
          mes,
          ano,
          semana,
          nome_arquivo: file.name,
          storage_path: storagePath,
          uploaded_by: user.id,
          uploaded_by_name: profile?.full_name || user.email,
          uploaded_by_role: profile?.role || "N/A",
        });

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      toast.success("Documento enviado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["bu-strategic-documents"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao enviar documento");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (doc: StrategicDocument) => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("bu-strategic-documents")
        .remove([doc.storage_path]);

      if (storageError) console.warn("Storage delete error:", storageError);

      // Delete DB record
      const { error: dbError } = await supabase
        .from("bu_strategic_documents" as any)
        .delete()
        .eq("id", doc.id);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      toast.success("Documento removido!");
      queryClient.invalidateQueries({ queryKey: ["bu-strategic-documents"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao remover documento");
    },
  });

  const getSignedUrl = async (storagePath: string) => {
    const { data, error } = await supabase.storage
      .from("bu-strategic-documents")
      .createSignedUrl(storagePath, 3600);

    if (error) throw error;
    return data.signedUrl;
  };

  return {
    documents: documentsQuery.data || [],
    isLoading: documentsQuery.isLoading,
    upload: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    deleteDoc: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    getSignedUrl,
  };
}
