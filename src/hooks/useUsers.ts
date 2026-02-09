import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UserSummary, UserDetails, UserTarget, UserFlag, UserObservation, UserPermission, UserIntegration, AccessStatus } from "@/types/user-management";

export const useUsers = () => {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_performance_summary")
        .select("*")
        .order("full_name");

      if (error) throw error;
      return data as UserSummary[];
    },
  });
};

export const useUserDetails = (userId: string | null) => {
  return useQuery({
    queryKey: ["user-details", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return null;

      // Get profile data (including new access fields)
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profileError) throw profileError;

      // Get roles (pode ter múltiplas)
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (roleError && roleError.code !== "PGRST116") throw roleError;

      // Determinar role principal por prioridade
      const ROLE_PRIORITY: Record<string, number> = {
        admin: 1, manager: 2, coordenador: 3, closer: 4,
        closer_sombra: 5, financeiro: 6, rh: 7, sdr: 8, viewer: 9,
      };

      const primaryRole = roleData?.length 
        ? roleData.sort((a, b) => 
            (ROLE_PRIORITY[a.role] || 99) - (ROLE_PRIORITY[b.role] || 99)
          )[0].role 
        : null;

      // Get employment data
      const { data: employment, error: employmentError } = await supabase
        .from("user_employment_data")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (employmentError && employmentError.code !== "PGRST116") throw employmentError;

      return {
        ...profile,
        role: primaryRole || null,
        access_status: (profile as any).access_status as AccessStatus || 'ativo',
        blocked_until: (profile as any).blocked_until || null,
        last_login_at: (profile as any).last_login_at || null,
        squad: (profile as any).squad || null,
        can_book_r2: (profile as any).can_book_r2 || false,
        employment: employment || null,
      } as UserDetails;
    },
  });
};

export const useUserTargets = (userId: string | null) => {
  return useQuery({
    queryKey: ["user-targets", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("user_targets")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as UserTarget[];
    },
  });
};

export const useUserFlags = (userId: string | null) => {
  return useQuery({
    queryKey: ["user-flags", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("user_flags")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as UserFlag[];
    },
  });
};

export const useUserObservations = (userId: string | null) => {
  return useQuery({
    queryKey: ["user-observations", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("user_observations")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as UserObservation[];
    },
  });
};

export const useUserPermissions = (userId: string | null) => {
  return useQuery({
    queryKey: ["user-permissions", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("user_permissions")
        .select("*")
        .eq("user_id", userId);

      if (error) throw error;
      return data as UserPermission[];
    },
  });
};

// ===== NOVA QUERY: Integrações do usuário =====
export const useUserIntegrations = (userId: string | null) => {
  return useQuery({
    queryKey: ["user-integrations", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from("user_integrations")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      return data as UserIntegration | null;
    },
  });
};
