import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { AppRole, PermissionLevel, ResourceType } from "@/types/user-management";

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
