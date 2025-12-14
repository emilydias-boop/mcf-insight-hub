import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PlaybookRole, PlaybookCategoria, PlaybookTipoConteudo } from "@/types/playbook";
import { toast } from "sonner";

// Tipo para playbook vindo do Notion
export interface NotionPlaybookDoc {
  notion_page_id: string;
  titulo: string;
  role: PlaybookRole;
  categoria: PlaybookCategoria;
  tipo_conteudo: PlaybookTipoConteudo;
  obrigatorio: boolean;
  ativo: boolean;
  link_url: string | null;
  versao: string;
  notion_url: string;
}

// Hook para listar playbooks do Notion
export function useNotionPlaybookDocs(role?: PlaybookRole | null, ativo?: boolean) {
  return useQuery({
    queryKey: ["notion-playbook-docs", role, ativo],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('notion-playbook-list', {
        body: { role, ativo }
      });

      if (error) {
        console.error('Erro ao buscar playbooks do Notion:', error);
        throw error;
      }

      return data.docs as NotionPlaybookDoc[];
    },
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
  });
}

// Hook para listar todos os playbooks do Notion (para admin)
export function useNotionPlaybookDocsAll() {
  return useQuery({
    queryKey: ["notion-playbook-docs-all"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('notion-playbook-list', {
        body: {}
      });

      if (error) {
        console.error('Erro ao buscar playbooks do Notion:', error);
        throw error;
      }

      return data.docs as NotionPlaybookDoc[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Input para criar playbook
interface CreateNotionPlaybookInput {
  titulo: string;
  role: PlaybookRole;
  categoria: PlaybookCategoria;
  tipo_conteudo: PlaybookTipoConteudo;
  obrigatorio: boolean;
  ativo: boolean;
  link_url?: string;
  versao: string;
  conteudo_rico?: string;
}

// Hook para criar playbook no Notion
export function useCreateNotionPlaybook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateNotionPlaybookInput) => {
      const { data, error } = await supabase.functions.invoke('notion-playbook-create', {
        body: input
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notion-playbook-docs"] });
      queryClient.invalidateQueries({ queryKey: ["notion-playbook-docs-all"] });
      toast.success("Documento criado com sucesso no Notion");
    },
    onError: (error) => {
      console.error("Erro ao criar documento no Notion:", error);
      toast.error("Erro ao criar documento no Notion");
    },
  });
}

// Input para atualizar playbook
interface UpdateNotionPlaybookInput {
  pageId: string;
  titulo?: string;
  role?: PlaybookRole;
  categoria?: PlaybookCategoria;
  tipo_conteudo?: PlaybookTipoConteudo;
  obrigatorio?: boolean;
  ativo?: boolean;
  link_url?: string;
  versao?: string;
}

// Hook para atualizar playbook no Notion
export function useUpdateNotionPlaybook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateNotionPlaybookInput) => {
      const { data, error } = await supabase.functions.invoke('notion-playbook-update', {
        body: input
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notion-playbook-docs"] });
      queryClient.invalidateQueries({ queryKey: ["notion-playbook-docs-all"] });
      toast.success("Documento atualizado no Notion");
    },
    onError: (error) => {
      console.error("Erro ao atualizar documento no Notion:", error);
      toast.error("Erro ao atualizar documento no Notion");
    },
  });
}

// Hook para toggle ativo
export function useToggleNotionPlaybookActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ pageId, ativo }: { pageId: string; ativo: boolean }) => {
      const { data, error } = await supabase.functions.invoke('notion-playbook-update', {
        body: { pageId, ativo }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["notion-playbook-docs"] });
      queryClient.invalidateQueries({ queryKey: ["notion-playbook-docs-all"] });
      toast.success(variables.ativo ? "Documento ativado" : "Documento desativado");
    },
    onError: (error) => {
      console.error("Erro ao alterar status:", error);
      toast.error("Erro ao alterar status do documento");
    },
  });
}

interface NotionFileInfo {
  name: string;
  url: string;
  type: 'pdf' | 'image' | 'other';
}

interface NotionPlaybookContentResponse {
  content: string;
  files: NotionFileInfo[];
}

// Hook para buscar conteúdo de uma página do Notion
export function useNotionPlaybookContent(pageId: string | null) {
  return useQuery({
    queryKey: ["notion-playbook-content", pageId],
    queryFn: async (): Promise<NotionPlaybookContentResponse | null> => {
      if (!pageId) return null;

      const { data, error } = await supabase.functions.invoke('notion-playbook-content', {
        body: { pageId }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return {
        content: data.content as string,
        files: (data.files || []) as NotionFileInfo[],
      };
    },
    enabled: !!pageId,
    staleTime: 5 * 60 * 1000,
  });
}

// Hook para atualizar conteúdo de uma página do Notion
export function useUpdateNotionPlaybookContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ pageId, content }: { pageId: string; content: string }) => {
      const { data, error } = await supabase.functions.invoke('notion-playbook-update-content', {
        body: { pageId, content }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["notion-playbook-content", variables.pageId] });
      toast.success("Conteúdo salvo no Notion");
    },
    onError: (error) => {
      console.error("Erro ao salvar conteúdo:", error);
      toast.error("Erro ao salvar conteúdo no Notion");
    },
  });
}
