import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UserSummary, UserDetails, UserTarget, UserFlag, UserObservation, UserPermission } from "@/types/user-management";

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

      // Get profile data
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profileError) throw profileError;

      // Get role
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (roleError && roleError.code !== "PGRST116") throw roleError;

      // Get employment data
      const { data: employment, error: employmentError } = await supabase
        .from("user_employment_data")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (employmentError && employmentError.code !== "PGRST116") throw employmentError;

      return {
        ...profile,
        role: roleData?.role || null,
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
