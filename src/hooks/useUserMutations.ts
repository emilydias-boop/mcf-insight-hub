import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { AppRole, PermissionLevel, ResourceType, AccessStatus } from "@/types/user-management";
import { normalizeEmail } from "@/lib/corporateEmail";
import { extractFunctionErrorMessage } from "@/lib/functionError";


// ===== MUTATION: Criar novo usuário via Edge Function =====
// ===== MUTATION: Excluir usuário via Edge Function =====
export const useDeleteUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { data: result, error } = await supabase.functions.invoke("delete-user", {
        body: { user_id: userId },
      });

      if (error) {
        throw new Error(error.message || "Erro ao excluir usuário");
      }

      if (result?.error) {
        throw new Error(result.error);
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Usuário excluído com sucesso" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir usuário",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

// ===== MUTATION: Criar novo usuário via Edge Function =====
export interface CreateUserResult {
  success: boolean;
  user_id: string;
  email: string;
  message?: string;
  /** Este fluxo não envia e-mail: o acesso é o link copiável. */
  email_sent?: boolean;
  access_link?: string | null;
  access_link_error?: string | null;
}

export const useCreateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      email: string;
      full_name: string;
      role: string;
      squad?: string | null;
      cargo_id?: string;
      allow_external_domain?: boolean;
    }) => {
      const { data: result, error } = await supabase.functions.invoke("create-user", {
        // Normalização final antes de enviar
        body: { ...data, email: normalizeEmail(data.email) },
      });

      if (error) {
        // Lê o corpo da resposta para não perder a mensagem real da função
        throw new Error(await extractFunctionErrorMessage(error, "Erro ao criar usuário"));
      }

      if (result?.error) {
        throw new Error(result.error);
      }

      return result as CreateUserResult;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      if (result?.access_link) {
        // Nenhum e-mail é enviado: a mensagem tem que dizer exatamente isso
        toast({
          title: "Usuário criado — copie o link de acesso",
          description:
            "Nenhum e-mail foi enviado. Copie o link de definição de senha antes de fechar a janela e envie ao colaborador.",
        });
      } else {
        // Nunca reportar sucesso quando o acesso não foi entregue
        toast({
          title: "Usuário criado, mas o link de acesso NÃO foi gerado",
          description: `${result?.access_link_error || "Falha ao gerar o link."} Use "Gerar link de acesso" na ficha do usuário.`,
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro ao criar usuário", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });
};

// ===== Gerar link de acesso (definição de senha) para usuário existente =====
// O link é sensível: só volta na resposta imediata, não é persistido nem logado.
export const useGenerateAccessLink = () => {
  return useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      const { data: result, error } = await supabase.functions.invoke("admin-send-reset", {
        body: { email: normalizeEmail(email) },
      });

      if (error) {
        throw new Error(await extractFunctionErrorMessage(error, "Erro ao gerar link de acesso"));
      }
      if (result?.error) throw new Error(result.error);
      if (!result?.reset_link) throw new Error("Link não foi retornado");

      return result as { success: boolean; reset_link: string };
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao gerar link de acesso",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};


export const useUpdateUserRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      // Delete existing role first to avoid constraint conflicts
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      // Insert new role
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["user-details", variables.userId] });
      toast({ title: "Role atualizado com sucesso", description: "O usuário precisa fazer logout e login novamente para a mudança ter efeito." });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar role", variant: "destructive" });
    },
  });
};

// ===== MUTATION: Adicionar UM role (mantém os outros) =====
export const useAddUserRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role });

      // 23505 = unique violation (role já existe) — ignorar
      if (error && (error as any).code !== "23505") throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["user-details", variables.userId] });
      toast({
        title: "Cargo adicionado",
        description: "O usuário precisa fazer logout e login novamente para a mudança ter efeito.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao adicionar cargo", description: error.message, variant: "destructive" });
    },
  });
};

// ===== MUTATION: Remover UM role específico =====
export const useRemoveUserRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      // Validar: não permitir remover o último role
      const { data: existing, error: fetchError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (fetchError) throw fetchError;

      if (!existing || existing.length <= 1) {
        throw new Error("O usuário precisa ter ao menos um cargo.");
      }

      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["user-details", variables.userId] });
      toast({
        title: "Cargo removido",
        description: "O usuário precisa fazer logout e login novamente para a mudança ter efeito.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao remover cargo", description: error.message, variant: "destructive" });
    },
  });
};

export const useUpdateUserEmployment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: any }) => {
      // Derive is_active from status
      const is_active = data.status === 'ativo' || data.status === 'ferias';
      
      const { error } = await supabase
        .from("user_employment_data")
        .upsert(
          { user_id: userId, ...data, is_active }, 
          { onConflict: "user_id" }
        );

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["user-details", variables.userId] });
      toast({ title: "Dados de emprego atualizados" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar dados", variant: "destructive" });
    },
  });
};

// ===== NOVA MUTATION: Atualizar dados de acesso do usuário =====
export const useUpdateUserAccess = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      userId, 
      data 
    }: { 
      userId: string; 
      data: {
        full_name?: string;
        email?: string;
        access_status?: AccessStatus;
        blocked_until?: string | null;
        squad?: string[] | null;
      }
    }) => {
      const { error } = await supabase
        .from("profiles")
        .update(data)
        .eq("id", userId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["user-details", variables.userId] });
      toast({ title: "Dados do usuário atualizados" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar dados", variant: "destructive" });
    },
  });
};

// ===== Definir senha temporária (admin) =====
export const useSetTempPassword = () => {
  return useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password?: string }) => {
      const { data: result, error } = await supabase.functions.invoke("admin-set-temp-password", {
        body: { user_id: userId, password },
      });

      if (error) throw new Error(error.message || "Erro ao definir senha");
      if (result?.error) throw new Error(result.error);
      if (!result?.temp_password) throw new Error("Senha não foi retornada");

      return result as { success: boolean; temp_password: string };
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao definir senha",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    },
  });
};

// ===== NOVA MUTATION: Atualizar integrações do usuário =====
export const useUpdateUserIntegrations = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      userId, 
      data 
    }: { 
      userId: string; 
      data: {
        clint_user_id?: string | null;
        twilio_agent_id?: string | null;
        other_integrations?: Record<string, any>;
      }
    }) => {
      const { error } = await supabase
        .from("user_integrations")
        .upsert(
          { user_id: userId, ...data },
          { onConflict: "user_id" }
        );

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["user-integrations", variables.userId] });
      toast({ title: "Integrações atualizadas" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar integrações", variant: "destructive" });
    },
  });
};

export const useCreateUserTarget = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("user_targets").insert(data);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["user-targets", variables.user_id] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Meta criada com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao criar meta", variant: "destructive" });
    },
  });
};

export const useUpdateUserTarget = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, userId, data }: { id: string; userId: string; data: any }) => {
      const { error } = await supabase.from("user_targets").update(data).eq("id", id);
      if (error) throw error;
      return userId;
    },
    onSuccess: (userId) => {
      queryClient.invalidateQueries({ queryKey: ["user-targets", userId] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Meta atualizada com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar meta", variant: "destructive" });
    },
  });
};

export const useCreateUserFlag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("user_flags").insert(data);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["user-flags", variables.user_id] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Flag criada com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao criar flag", variant: "destructive" });
    },
  });
};

export const useResolveUserFlag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, userId, notes }: { id: string; userId: string; notes: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("user_flags")
        .update({
          is_resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
          resolution_notes: notes,
        })
        .eq("id", id);

      if (error) throw error;
      return userId;
    },
    onSuccess: (userId) => {
      queryClient.invalidateQueries({ queryKey: ["user-flags", userId] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Flag resolvida com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao resolver flag", variant: "destructive" });
    },
  });
};

export const useCreateUserObservation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("user_observations").insert(data);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["user-observations", variables.user_id] });
      toast({ title: "Observação criada com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao criar observação", variant: "destructive" });
    },
  });
};

export const useUpdateUserPermissions = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      userId, 
      permissions 
    }: { 
      userId: string; 
      permissions: Array<{ resource: ResourceType; permission_level: PermissionLevel }> 
    }) => {
      // Delete existing permissions
      await supabase.from("user_permissions").delete().eq("user_id", userId);

      // Insert new permissions (only non-none)
      const permissionsToInsert = permissions
        .filter(p => p.permission_level !== 'none')
        .map(p => ({ user_id: userId, ...p }));

      if (permissionsToInsert.length > 0) {
        const { error } = await supabase.from("user_permissions").insert(permissionsToInsert);
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["user-permissions", variables.userId] });
      toast({ title: "Permissões atualizadas com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar permissões", variant: "destructive" });
    },
  });
};
