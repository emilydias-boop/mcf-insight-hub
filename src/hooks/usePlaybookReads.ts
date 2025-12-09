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

export function useMyPlaybook() {
  const { user, role } = useAuth();
  
  return useQuery({
    queryKey: ["my-playbook", user?.id, role],
    queryFn: async () => {
      if (!user?.id || !role) return [];
      
      // Mapear app_role para playbook_role
      const playbookRole = role as PlaybookRole;
      
      // Buscar documentos ativos do cargo
      const { data: docs, error: docsError } = await supabase
        .from("playbook_docs")
        .select("*")
        .eq("role", playbookRole)
        .eq("ativo", true)
        .order("categoria", { ascending: true })
        .order("titulo", { ascending: true });

      if (docsError) throw docsError;

      // Buscar leituras do usuário
      const { data: reads, error: readsError } = await supabase
        .from("playbook_reads")
        .select("*")
        .eq("user_id", user.id);

      if (readsError) throw readsError;

      // Combinar dados
      const readsMap = new Map((reads || []).map(r => [r.playbook_doc_id, r]));
      
      const docsWithReads: PlaybookDocWithRead[] = (docs || []).map(doc => {
        const read = readsMap.get(doc.id);
        return {
          ...doc,
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
    mutationFn: async (docId: string) => {
      if (!user?.id) throw new Error("Usuário não autenticado");

      // Verificar se já existe registro
      const { data: existing } = await supabase
        .from("playbook_reads")
        .select("id, status")
        .eq("playbook_doc_id", docId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        // Só atualizar se ainda não foi lido
        if (existing.status === 'nao_lido') {
          const { error } = await supabase
            .from("playbook_reads")
            .update({
              status: 'lido',
              lido_em: new Date().toISOString(),
              ultima_acao_em: new Date().toISOString(),
            })
            .eq("id", existing.id);
          
          if (error) throw error;
        }
        return existing;
      }

      // Criar novo registro
      const { data, error } = await supabase
        .from("playbook_reads")
        .insert({
          playbook_doc_id: docId,
          user_id: user.id,
          status: 'lido',
          lido_em: new Date().toISOString(),
          ultima_acao_em: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-playbook"] });
      queryClient.invalidateQueries({ queryKey: ["playbook-reads"] });
    },
  });
}

export function useConfirmReading() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (docId: string) => {
      if (!user?.id) throw new Error("Usuário não autenticado");

      // Verificar se já existe registro
      const { data: existing } = await supabase
        .from("playbook_reads")
        .select("id")
        .eq("playbook_doc_id", docId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("playbook_reads")
          .update({
            status: 'confirmado',
            confirmado_em: new Date().toISOString(),
            ultima_acao_em: new Date().toISOString(),
          })
          .eq("id", existing.id);
        
        if (error) throw error;
        return existing;
      }

      // Criar novo registro já confirmado
      const { data, error } = await supabase
        .from("playbook_reads")
        .insert({
          playbook_doc_id: docId,
          user_id: user.id,
          status: 'confirmado',
          lido_em: new Date().toISOString(),
          confirmado_em: new Date().toISOString(),
          ultima_acao_em: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-playbook"] });
      queryClient.invalidateQueries({ queryKey: ["playbook-reads"] });
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
