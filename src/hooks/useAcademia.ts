import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  adb, USER_TASK_SELECT, erroAcademia,
  type APerfil, type AUserTask, type AUserTrack, type AMilestone, type AFrente, type AProduto, type ABadge,
} from "@/lib/academia";

export function useAcademiaIsAdmin() {
  const { allRoles, role } = useAuth() as { allRoles?: string[]; role?: string | null };
  const roles = allRoles?.length ? allRoles : role ? [role] : [];
  return roles.includes("admin") || roles.includes("rh");
}

export function useMeuPerfilAcademia() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["academia", "perfil", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await adb.from("academia_perfis").select("*").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data as APerfil | null;
    },
  });
}

export function useTrilhaDoUsuario(userId: string | undefined, gerar = false) {
  return useQuery({
    queryKey: ["academia", "trilha", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (gerar) {
        const { error } = await adb.rpc("academia_gerar_trilha");
        if (error) throw error;
      }
      const [tr, ut, ms] = await Promise.all([
        adb.from("academia_user_tracks").select("*").eq("user_id", userId),
        adb.from("academia_user_tasks").select(USER_TASK_SELECT).eq("user_id", userId),
        adb.from("academia_milestones").select("*").eq("user_id", userId),
      ]);
      if (tr.error) throw tr.error; if (ut.error) throw ut.error; if (ms.error) throw ms.error;
      return {
        tracks: (tr.data ?? []) as AUserTrack[],
        tarefas: (ut.data ?? []) as AUserTask[],
        marcos: (ms.data ?? []) as AMilestone[],
      };
    },
  });
}

export function useCatalogo() {
  return useQuery({
    queryKey: ["academia", "catalogo"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [f, p, b] = await Promise.all([
        adb.from("academia_frentes").select("*").order("ordem"),
        adb.from("academia_produtos").select("*"),
        adb.from("academia_badges").select("*").order("ordem"),
      ]);
      if (f.error) throw f.error; if (p.error) throw p.error; if (b.error) throw b.error;
      return { frentes: f.data as AFrente[], produtos: p.data as AProduto[], badges: b.data as ABadge[] };
    },
  });
}

export function useMeusBadges(userId?: string) {
  return useQuery({
    queryKey: ["academia", "user-badges", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await adb.from("academia_user_badges").select("*").eq("user_id", userId);
      if (error) throw error;
      return data as { badge_id: string; conquistado_em: string }[];
    },
  });
}

export function useNomes(ids: (string | null | undefined)[]) {
  const lista = [...new Set(ids.filter(Boolean) as string[])].sort();
  return useQuery({
    queryKey: ["academia", "nomes", lista.join(",")],
    enabled: lista.length > 0,
    queryFn: async () => {
      const { data, error } = await adb.rpc("academia_nomes", { _ids: lista });
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((r: { id: string; full_name: string }) => [r.id, r.full_name])) as Record<string, string>;
    },
  });
}

export function useAcademiaRpc(fn: string, sucesso?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: Record<string, unknown>) => {
      const { data, error } = await adb.rpc(fn, args);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["academia"] });
      if (sucesso) toast.success(sucesso);
    },
    onError: (e) => toast.error(erroAcademia(e)),
  });
}
