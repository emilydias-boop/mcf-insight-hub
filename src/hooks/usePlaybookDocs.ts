import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PlaybookDoc, PlaybookRole, PlaybookCategoria, PlaybookTipoConteudo } from "@/types/playbook";
import { toast } from "sonner";

export function usePlaybookDocsByRole(role: PlaybookRole | null) {
  return useQuery({
    queryKey: ["playbook-docs", role],
    queryFn: async () => {
      if (!role) return [];
      
      const { data, error } = await supabase
        .from("playbook_docs")
        .select("*")
        .eq("role", role)
        .order("categoria", { ascending: true })
        .order("titulo", { ascending: true });

      if (error) throw error;
      return data as unknown as PlaybookDoc[];
    },
    enabled: !!role,
  });
}

export function usePlaybookDocsAll() {
  return useQuery({
    queryKey: ["playbook-docs-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playbook_docs")
        .select("*")
        .order("role", { ascending: true })
        .order("categoria", { ascending: true })
        .order("titulo", { ascending: true });

      if (error) throw error;
      return data as unknown as PlaybookDoc[];
    },
  });
}

export function usePlaybookDocById(docId: string | null) {
  return useQuery({
    queryKey: ["playbook-doc", docId],
    queryFn: async () => {
      if (!docId) return null;
      
      const { data, error } = await supabase
        .from("playbook_docs")
        .select("*")
        .eq("id", docId)
        .single();

      if (error) throw error;
      return data as unknown as PlaybookDoc;
    },
    enabled: !!docId,
  });
}

interface CreatePlaybookDocInput {
  role: PlaybookRole;
  titulo: string;
  descricao?: string;
  tipo_conteudo: PlaybookTipoConteudo;
  storage_url?: string;
  storage_path?: string;
  link_url?: string;
  conteudo_rico?: string;
  obrigatorio: boolean;
  categoria: PlaybookCategoria;
  versao: string;
  ativo: boolean;
}

export function useCreatePlaybookDoc() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePlaybookDocInput) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("playbook_docs")
        .insert({
          ...input,
          criado_por: userData.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playbook-docs"] });
      queryClient.invalidateQueries({ queryKey: ["playbook-docs-all"] });
      toast.success("Documento criado com sucesso");
    },
    onError: (error) => {
      console.error("Erro ao criar documento:", error);
      toast.error("Erro ao criar documento");
    },
  });
}

export function useUpdatePlaybookDoc() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<CreatePlaybookDocInput> & { id: string }) => {
      const { data, error } = await supabase
        .from("playbook_docs")
        .update(input)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playbook-docs"] });
      queryClient.invalidateQueries({ queryKey: ["playbook-docs-all"] });
      queryClient.invalidateQueries({ queryKey: ["playbook-doc"] });
      toast.success("Documento atualizado com sucesso");
    },
    onError: (error) => {
      console.error("Erro ao atualizar documento:", error);
      toast.error("Erro ao atualizar documento");
    },
  });
}

export function useTogglePlaybookDocActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { data, error } = await supabase
        .from("playbook_docs")
        .update({ ativo })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["playbook-docs"] });
      queryClient.invalidateQueries({ queryKey: ["playbook-docs-all"] });
      toast.success(variables.ativo ? "Documento ativado" : "Documento desativado");
    },
    onError: (error) => {
      console.error("Erro ao alterar status:", error);
      toast.error("Erro ao alterar status do documento");
    },
  });
}

export function useDeletePlaybookDoc() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("playbook_docs")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playbook-docs"] });
      queryClient.invalidateQueries({ queryKey: ["playbook-docs-all"] });
      toast.success("Documento excluído com sucesso");
    },
    onError: (error) => {
      console.error("Erro ao excluir documento:", error);
      toast.error("Erro ao excluir documento");
    },
  });
}

export async function uploadPlaybookFile(file: File, role: string): Promise<{ url: string; path: string }> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${role}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('playbook-files')
    .upload(fileName, file);

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from('playbook-files')
    .getPublicUrl(fileName);

  return {
    url: urlData.publicUrl,
    path: fileName,
  };
}
