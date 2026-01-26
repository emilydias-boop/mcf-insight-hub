import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type TaskSpaceType = 'setor' | 'pasta' | 'lista';

export interface TaskSpace {
  id: string;
  name: string;
  type: TaskSpaceType;
  parent_id: string | null;
  icon: string | null;
  color: string | null;
  order_index: number;
  is_private: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  children?: TaskSpace[];
}

export interface CreateTaskSpaceInput {
  name: string;
  type: TaskSpaceType;
  parent_id?: string | null;
  icon?: string | null;
  color?: string | null;
  is_private?: boolean;
}

export interface UpdateTaskSpaceInput {
  id: string;
  name?: string;
  icon?: string | null;
  color?: string | null;
  is_private?: boolean;
  order_index?: number;
  parent_id?: string | null;
}

// Transforma lista flat em árvore hierárquica
export function buildTaskSpaceTree(spaces: TaskSpace[]): TaskSpace[] {
  const map = new Map<string, TaskSpace>();
  const roots: TaskSpace[] = [];

  // Primeiro, criar cópias com children vazio
  spaces.forEach(space => {
    map.set(space.id, { ...space, children: [] });
  });

  // Depois, organizar hierarquia
  spaces.forEach(space => {
    const node = map.get(space.id)!;
    if (space.parent_id && map.has(space.parent_id)) {
      const parent = map.get(space.parent_id)!;
      parent.children = parent.children || [];
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // Ordenar por order_index
  const sortByOrder = (items: TaskSpace[]) => {
    items.sort((a, b) => a.order_index - b.order_index);
    items.forEach(item => {
      if (item.children?.length) {
        sortByOrder(item.children);
      }
    });
  };
  sortByOrder(roots);

  return roots;
}

export function useTaskSpaces() {
  return useQuery({
    queryKey: ["task-spaces"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_spaces")
        .select("*")
        .order("order_index", { ascending: true });

      if (error) throw error;
      return data as TaskSpace[];
    },
  });
}

export function useTaskSpacesTree() {
  const { data: spaces, ...rest } = useTaskSpaces();
  
  return {
    ...rest,
    data: spaces ? buildTaskSpaceTree(spaces) : [],
    flatData: spaces || [],
  };
}

export function useCreateTaskSpace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTaskSpaceInput) => {
      // Get next order_index for the parent
      const { data: siblings } = await supabase
        .from("task_spaces")
        .select("order_index")
        .eq("parent_id", input.parent_id ?? null)
        .order("order_index", { ascending: false })
        .limit(1);

      const nextOrder = siblings?.[0]?.order_index != null 
        ? siblings[0].order_index + 1 
        : 0;

      const { data, error } = await supabase
        .from("task_spaces")
        .insert({
          name: input.name,
          type: input.type,
          parent_id: input.parent_id || null,
          icon: input.icon || null,
          color: input.color || null,
          is_private: input.is_private || false,
          order_index: nextOrder,
        })
        .select()
        .single();

      if (error) throw error;
      return data as TaskSpace;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-spaces"] });
      toast.success("Espaço criado com sucesso!");
    },
    onError: (error) => {
      console.error("Error creating task space:", error);
      toast.error("Erro ao criar espaço");
    },
  });
}

export function useUpdateTaskSpace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateTaskSpaceInput) => {
      const { id, ...updates } = input;
      const { data, error } = await supabase
        .from("task_spaces")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as TaskSpace;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-spaces"] });
      toast.success("Espaço atualizado!");
    },
    onError: (error) => {
      console.error("Error updating task space:", error);
      toast.error("Erro ao atualizar espaço");
    },
  });
}

export function useDeleteTaskSpace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("task_spaces")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-spaces"] });
      toast.success("Espaço excluído!");
    },
    onError: (error) => {
      console.error("Error deleting task space:", error);
      toast.error("Erro ao excluir espaço");
    },
  });
}
