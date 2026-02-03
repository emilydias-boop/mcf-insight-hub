import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { AppRole, PermissionLevel, ResourceType, AccessStatus } from "@/types/user-management";

// ===== MUTATION: Criar novo usuário via Edge Function =====
export const useCreateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      email: string;
      full_name: string;
      role: string;
      squad?: string | null;
    }) => {
      const { data: result, error } = await supabase.functions.invoke("create-user", {
        body: data,
      });

      if (error) {
        throw new Error(error.message || "Erro ao criar usuário");
      }

      if (result?.error) {
        throw new Error(result.error);
      }

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ 
        title: "Usuário criado com sucesso",
        description: result?.reset_link_sent 
          ? "Um email foi enviado para o usuário definir sua senha."
          : "O usuário pode usar 'Esqueci a senha' para definir sua senha.",
      });
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
      toast({ title: "Role atualizado com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar role", variant: "destructive" });
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

// ===== NOVA MUTATION: Enviar link de reset de senha =====
export const useSendPasswordReset = () => {
  return useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?mode=reset`,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Link de reset enviado", description: "O usuário receberá um email para redefinir a senha." });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao enviar link", description: error.message, variant: "destructive" });
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
