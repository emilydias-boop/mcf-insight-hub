import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PlaybookRead, PlaybookDocWithRead, PlaybookRole } from "@/types/playbook";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export function usePlaybookReadsForDoc(docId: string | null) {
  return useQuery({
    queryKey: ["playbook-reads", "doc", docId],
    queryFn: async () => {
      if (!docId) return [];
      
      const { data, error } = await supabase
        .from("playbook_reads")
        .select("*")
        .eq("playbook_doc_id", docId);

      if (error) throw error;
      return data as unknown as PlaybookRead[];
    },
    enabled: !!docId,
  });
}

export function usePlaybookReadsForUser(userId: string | null) {
  return useQuery({
    queryKey: ["playbook-reads", "user", userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from("playbook_reads")
        .select("*")
        .eq("user_id", userId);

      if (error) throw error;
      return data as unknown as PlaybookRead[];
    },
    enabled: !!userId,
  });
}

// Hook para buscar visualizadores com perfis (estilo Notion "Viewed by")
export function usePlaybookViewers(docId: string | null, limit: number = 50) {
  return useQuery({
    queryKey: ["playbook-viewers", docId, limit],
    queryFn: async () => {
      if (!docId) return [];
      
      // Buscar reads do documento
      const { data: reads, error: readsError } = await supabase
        .from("playbook_reads")
        .select("id, user_id, ultima_acao_em, visualizacoes_qtd")
        .eq("playbook_doc_id", docId)
        .order("ultima_acao_em", { ascending: false })
        .limit(limit);

      if (readsError) throw readsError;
      if (!reads || reads.length === 0) return [];

      // Buscar profiles dos usuários
      const userIds = reads.map(r => r.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Combinar dados
      const profilesMap = new Map((profiles || []).map(p => [p.id, p]));
      
      return reads.map(read => ({
        ...read,
        profiles: profilesMap.get(read.user_id) || null,
      }));
    },
    enabled: !!docId,
  });
}

export function useMyPlaybook() {
  const { user, role } = useAuth();
  
  return useQuery({
    queryKey: ["my-playbook", user?.id, role],
    queryFn: async () => {
      if (!user?.id || !role) return [];
      
      // Mapear app_role para playbook_role
      const playbookRole = role as PlaybookRole;
      
      // Buscar documentos ativos do cargo via Notion
      const { data: notionResponse, error: notionError } = await supabase.functions.invoke(
        'notion-playbook-list',
        { body: { role: playbookRole, ativo: true } }
      );

      if (notionError) {
        console.error('Erro ao buscar playbook do Notion:', notionError);
        throw notionError;
      }

      const docs = notionResponse?.docs || [];
      
      if (docs.length === 0) {
        return [];
      }

      // Buscar leituras do usuário usando notion_page_id
      const notionPageIds = docs.map((d: any) => d.notion_page_id);
      const { data: reads, error: readsError } = await supabase
        .from("playbook_reads")
        .select("*")
        .eq("user_id", user.id)
        .in("notion_page_id", notionPageIds);

      if (readsError) {
        console.error('Erro ao buscar leituras:', readsError);
      }

      // Combinar dados usando notion_page_id como chave
      const readsMap = new Map((reads || []).map(r => [r.notion_page_id, r]));
      
      const docsWithReads: PlaybookDocWithRead[] = docs.map((doc: any) => {
        const read = readsMap.get(doc.notion_page_id);
        return {
          id: doc.notion_page_id, // Usar notion_page_id como id
          notion_page_id: doc.notion_page_id,
          notion_url: doc.notion_url,
          titulo: doc.titulo,
          descricao: doc.descricao || null,
          role: doc.role,
          categoria: doc.categoria,
          tipo_conteudo: doc.tipo_conteudo,
          obrigatorio: doc.obrigatorio,
          ativo: doc.ativo,
          versao: doc.versao,
          link_url: doc.link_url,
          storage_url: null,
          storage_path: null,
          conteudo_rico: null,
          data_publicacao: new Date().toISOString(),
          criado_por: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          read_status: read?.status || 'nao_lido',
          lido_em: read?.lido_em || null,
          confirmado_em: read?.confirmado_em || null,
        } as PlaybookDocWithRead;
      });

      return docsWithReads;
    },
    enabled: !!user?.id && !!role,
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (notionPageId: string) => {
      if (!user?.id) throw new Error("Usuário não autenticado");

      // Verificar se já existe registro usando notion_page_id
      const { data: existing } = await supabase
        .from("playbook_reads")
        .select("id, status, visualizacoes_qtd")
        .eq("notion_page_id", notionPageId)
        .eq("user_id", user.id)
        .maybeSingle();

      const now = new Date().toISOString();

      if (existing) {
        // Sempre incrementar visualizações e atualizar ultima_acao_em
        const currentCount = (existing.visualizacoes_qtd as number) || 1;
        const updates: any = {
          ultima_acao_em: now,
          visualizacoes_qtd: currentCount + 1,
        };

        // Se ainda não foi lido, marcar como lido
        if (existing.status === 'nao_lido') {
          updates.status = 'lido';
          updates.lido_em = now;
        }

        const { error } = await supabase
          .from("playbook_reads")
          .update(updates)
          .eq("id", existing.id);
        
        if (error) throw error;
        return existing;
      }

      // Criar novo registro com notion_page_id
      const { data, error } = await supabase
        .from("playbook_reads")
        .insert({
          playbook_doc_id: notionPageId, // Manter compatibilidade
          notion_page_id: notionPageId,
          user_id: user.id,
          status: 'lido',
          lido_em: now,
          ultima_acao_em: now,
          visualizacoes_qtd: 1,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-playbook"] });
      queryClient.invalidateQueries({ queryKey: ["playbook-reads"] });
      queryClient.invalidateQueries({ queryKey: ["playbook-viewers"] });
    },
  });
}

export function useConfirmReading() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (notionPageId: string) => {
      if (!user?.id) throw new Error("Usuário não autenticado");

      const now = new Date().toISOString();

      // Verificar se já existe registro usando notion_page_id
      const { data: existing } = await supabase
        .from("playbook_reads")
        .select("id, visualizacoes_qtd")
        .eq("notion_page_id", notionPageId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        const currentCount = (existing.visualizacoes_qtd as number) || 1;
        const { error } = await supabase
          .from("playbook_reads")
          .update({
            status: 'confirmado',
            confirmado_em: now,
            ultima_acao_em: now,
            visualizacoes_qtd: currentCount + 1,
          })
          .eq("id", existing.id);
        
        if (error) throw error;
        return existing;
      }

      // Criar novo registro já confirmado com notion_page_id
      const { data, error } = await supabase
        .from("playbook_reads")
        .insert({
          playbook_doc_id: notionPageId, // Manter compatibilidade
          notion_page_id: notionPageId,
          user_id: user.id,
          status: 'confirmado',
          lido_em: now,
          confirmado_em: now,
          ultima_acao_em: now,
          visualizacoes_qtd: 1,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-playbook"] });
      queryClient.invalidateQueries({ queryKey: ["playbook-reads"] });
      queryClient.invalidateQueries({ queryKey: ["playbook-viewers"] });
      toast.success("Leitura confirmada com sucesso");
    },
    onError: (error) => {
      console.error("Erro ao confirmar leitura:", error);
      toast.error("Erro ao confirmar leitura");
    },
  });
}

export function usePlaybookStatsForDoc(docId: string | null, role: PlaybookRole | null) {
  return useQuery({
    queryKey: ["playbook-stats", docId, role],
    queryFn: async () => {
      if (!docId || !role) return null;

      // Buscar todos os usuários com esse cargo (cast para app_role do banco)
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", role as any);

      if (rolesError) throw rolesError;

      const totalUsers = userRoles?.length || 0;
      const userIds = userRoles?.map(r => r.user_id) || [];

      if (totalUsers === 0) {
        return {
          total: 0,
          nao_lido: 0,
          lido: 0,
          confirmado: 0,
        };
      }

      // Buscar leituras deste documento
      const { data: reads, error: readsError } = await supabase
        .from("playbook_reads")
        .select("user_id, status")
        .eq("playbook_doc_id", docId)
        .in("user_id", userIds);

      if (readsError) throw readsError;

      const readsMap = new Map((reads || []).map(r => [r.user_id, r.status]));

      let nao_lido = 0;
      let lido = 0;
      let confirmado = 0;

      userIds.forEach(userId => {
        const status = readsMap.get(userId) || 'nao_lido';
        if (status === 'nao_lido') nao_lido++;
        else if (status === 'lido') lido++;
        else if (status === 'confirmado') confirmado++;
      });

      return {
        total: totalUsers,
        nao_lido,
        lido,
        confirmado,
      };
    },
    enabled: !!docId && !!role,
  });
}

export function usePlaybookUserProgress(userId: string | null, role: PlaybookRole | null) {
  return useQuery({
    queryKey: ["playbook-user-progress", userId, role],
    queryFn: async () => {
      if (!userId || !role) return null;

      // Buscar documentos obrigatórios do cargo
      const { data: docs, error: docsError } = await supabase
        .from("playbook_docs")
        .select("id")
        .eq("role", role)
        .eq("ativo", true)
        .eq("obrigatorio", true);

      if (docsError) throw docsError;

      const totalObrigatorios = docs?.length || 0;
      
      if (totalObrigatorios === 0) {
        return {
          total: 0,
          confirmados: 0,
        };
      }

      const docIds = docs?.map(d => d.id) || [];

      // Buscar leituras confirmadas do usuário
      const { data: reads, error: readsError } = await supabase
        .from("playbook_reads")
        .select("playbook_doc_id")
        .eq("user_id", userId)
        .eq("status", "confirmado")
        .in("playbook_doc_id", docIds);

      if (readsError) throw readsError;

      return {
        total: totalObrigatorios,
        confirmados: reads?.length || 0,
      };
    },
    enabled: !!userId && !!role,
  });
}
