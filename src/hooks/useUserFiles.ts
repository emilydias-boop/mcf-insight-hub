import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { UserFile, UserFileType } from "@/types/user-management";

// Buscar arquivos de um usuário específico (modo gestor - vê todos)
export function useUserFiles(userId: string | null) {
  return useQuery({
    queryKey: ["user-files", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("user_files")
        .select("*")
        .eq("user_id", userId)
        .order("data_upload", { ascending: false });

      if (error) throw error;

      // Buscar nomes dos uploaders
      const uploaderIds = [...new Set(data.map((f) => f.uploaded_by))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", uploaderIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p.full_name || p.email]) || []);

      return data.map((file) => ({
        ...file,
        uploader_name: profileMap.get(file.uploaded_by) || "Desconhecido",
      })) as UserFile[];
    },
    enabled: !!userId,
  });
}

// Buscar arquivos do usuário logado (modo pessoal - só visíveis)
export function useMyFiles() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my-files", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("user_files")
        .select("*")
        .eq("user_id", user.id)
        .eq("visivel_para_usuario", true)
        .order("data_upload", { ascending: false });

      if (error) throw error;
      return data as UserFile[];
    },
    enabled: !!user?.id,
  });
}

// Upload de arquivo
interface UploadUserFileParams {
  userId: string;
  tipo: UserFileType;
  titulo: string;
  descricao?: string;
  file: File;
  visivelParaUsuario: boolean;
  categoriaCargo?: string;
}

export function useUploadUserFile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      userId,
      tipo,
      titulo,
      descricao,
      file,
      visivelParaUsuario,
      categoriaCargo,
    }: UploadUserFileParams) => {
      if (!user?.id) throw new Error("Usuário não autenticado");

      // Gerar caminho único para o arquivo
      const timestamp = Date.now();
      const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const storagePath = `${userId}/${timestamp}_${safeFileName}`;

      // 1. Upload do arquivo para o storage
      const { error: uploadError } = await supabase.storage
        .from("user-files")
        .upload(storagePath, file);

      if (uploadError) throw uploadError;

      // 2. Gerar URL pública (signed)
      const { data: urlData } = await supabase.storage
        .from("user-files")
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365); // 1 ano

      if (!urlData?.signedUrl) throw new Error("Erro ao gerar URL do arquivo");

      // 3. Inserir registro no banco
      const { data, error } = await supabase.from("user_files").insert({
        user_id: userId,
        tipo,
        titulo,
        descricao: descricao || null,
        storage_url: urlData.signedUrl,
        storage_path: storagePath,
        file_name: file.name,
        file_size: file.size,
        uploaded_by: user.id,
        visivel_para_usuario: visivelParaUsuario,
        categoria_cargo: categoriaCargo || null,
      }).select().single();

      if (error) {
        // Se falhar ao inserir, deletar o arquivo do storage
        await supabase.storage.from("user-files").remove([storagePath]);
        throw error;
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["user-files", variables.userId] });
      queryClient.invalidateQueries({ queryKey: ["my-files"] });
      toast({
        title: "Arquivo enviado",
        description: "O arquivo foi enviado com sucesso.",
      });
    },
    onError: (error) => {
      console.error("Erro ao enviar arquivo:", error);
      toast({
        title: "Erro ao enviar arquivo",
        description: "Ocorreu um erro ao enviar o arquivo. Tente novamente.",
        variant: "destructive",
      });
    },
  });
}

// Deletar arquivo
export function useDeleteUserFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ fileId, storagePath, userId }: { fileId: string; storagePath: string; userId: string }) => {
      // 1. Deletar do storage
      const { error: storageError } = await supabase.storage
        .from("user-files")
        .remove([storagePath]);

      if (storageError) {
        console.warn("Erro ao deletar do storage:", storageError);
        // Continuar mesmo se falhar no storage
      }

      // 2. Deletar do banco
      const { error } = await supabase
        .from("user_files")
        .delete()
        .eq("id", fileId);

      if (error) throw error;

      return { userId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["user-files", data.userId] });
      queryClient.invalidateQueries({ queryKey: ["my-files"] });
      toast({
        title: "Arquivo excluído",
        description: "O arquivo foi excluído com sucesso.",
      });
    },
    onError: (error) => {
      console.error("Erro ao excluir arquivo:", error);
      toast({
        title: "Erro ao excluir arquivo",
        description: "Ocorreu um erro ao excluir o arquivo. Tente novamente.",
        variant: "destructive",
      });
    },
  });
}

// Atualizar visibilidade do arquivo
export function useUpdateUserFileVisibility() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ fileId, visible, userId }: { fileId: string; visible: boolean; userId: string }) => {
      const { error } = await supabase
        .from("user_files")
        .update({ visivel_para_usuario: visible })
        .eq("id", fileId);

      if (error) throw error;
      return { userId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["user-files", data.userId] });
      queryClient.invalidateQueries({ queryKey: ["my-files"] });
      toast({
        title: "Visibilidade atualizada",
        description: "A visibilidade do arquivo foi atualizada.",
      });
    },
    onError: (error) => {
      console.error("Erro ao atualizar visibilidade:", error);
      toast({
        title: "Erro ao atualizar",
        description: "Ocorreu um erro ao atualizar a visibilidade.",
        variant: "destructive",
      });
    },
  });
}

// Atualizar metadados e/ou substituir arquivo
interface UpdateUserFileParams {
  fileId: string;
  userId: string;
  tipo: UserFileType;
  titulo: string;
  descricao?: string;
  visivelParaUsuario: boolean;
  newFile?: File; // Se presente, substitui o arquivo
  oldStoragePath: string;
}

export function useUpdateUserFile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      fileId,
      userId,
      tipo,
      titulo,
      descricao,
      visivelParaUsuario,
      newFile,
      oldStoragePath,
    }: UpdateUserFileParams) => {
      if (!user?.id) throw new Error("Usuário não autenticado");

      let newStoragePath = oldStoragePath;
      let newStorageUrl: string | undefined;
      let newFileName: string | undefined;
      let newFileSize: number | undefined;

      // Se há novo arquivo, fazer upload
      if (newFile) {
        const timestamp = Date.now();
        const safeFileName = newFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        newStoragePath = `${userId}/${timestamp}_${safeFileName}`;

        // Upload do novo arquivo
        const { error: uploadError } = await supabase.storage
          .from("user-files")
          .upload(newStoragePath, newFile);

        if (uploadError) throw uploadError;

        // Gerar URL assinada
        const { data: urlData } = await supabase.storage
          .from("user-files")
          .createSignedUrl(newStoragePath, 60 * 60 * 24 * 365);

        if (!urlData?.signedUrl) throw new Error("Erro ao gerar URL do arquivo");

        newStorageUrl = urlData.signedUrl;
        newFileName = newFile.name;
        newFileSize = newFile.size;
      }

      // Atualizar registro no banco
      const updateData: Record<string, unknown> = {
        tipo,
        titulo,
        descricao: descricao || null,
        visivel_para_usuario: visivelParaUsuario,
      };

      if (newFile && newStorageUrl && newFileName) {
        updateData.storage_url = newStorageUrl;
        updateData.storage_path = newStoragePath;
        updateData.file_name = newFileName;
        updateData.file_size = newFileSize;
      }

      const { error } = await supabase
        .from("user_files")
        .update(updateData)
        .eq("id", fileId);

      if (error) {
        // Se falhou ao atualizar e havia upload novo, deletar arquivo novo
        if (newFile && newStoragePath !== oldStoragePath) {
          await supabase.storage.from("user-files").remove([newStoragePath]);
        }
        throw error;
      }

      // Se substituiu arquivo, deletar o antigo
      if (newFile && newStoragePath !== oldStoragePath) {
        await supabase.storage.from("user-files").remove([oldStoragePath]);
      }

      return { userId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["user-files", data.userId] });
      queryClient.invalidateQueries({ queryKey: ["my-files"] });
      toast({
        title: "Arquivo atualizado",
        description: "As alterações foram salvas com sucesso.",
      });
    },
    onError: (error) => {
      console.error("Erro ao atualizar arquivo:", error);
      toast({
        title: "Erro ao atualizar",
        description: "Ocorreu um erro ao atualizar o arquivo. Tente novamente.",
        variant: "destructive",
      });
    },
  });
}

// Gerar nova URL assinada para download
export async function getSignedDownloadUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("user-files")
    .createSignedUrl(storagePath, 60 * 60); // 1 hora

  if (error) {
    console.error("Erro ao gerar URL:", error);
    return null;
  }

  // Se a URL já é completa, retorna como está
  if (data.signedUrl.startsWith('http')) {
    return data.signedUrl;
  }
  
  // Caso contrário, constrói a URL completa
  return `https://rehcfgqvigfcekiipqkc.supabase.co/storage/v1${data.signedUrl}`;
}