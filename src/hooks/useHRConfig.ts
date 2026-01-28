import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

// Types
export interface Area {
  id: string;
  nome: string;
  codigo: string | null;
  ordem: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  // Computed
  cargo_count?: number;
}

export interface Departamento {
  id: string;
  nome: string;
  codigo: string | null;
  is_bu: boolean;
  ativo: boolean;
  ordem: number;
  created_at: string;
  updated_at: string;
  // Computed
  employee_count?: number;
}

export interface Squad {
  id: string;
  nome: string;
  departamento_id: string | null;
  ativo: boolean;
  ordem: number;
  created_at: string;
  updated_at: string;
  // Relations
  departamento?: Departamento;
  // Computed
  employee_count?: number;
}

export interface Cargo {
  id: string;
  nome_exibicao: string;
  cargo_base: string;
  area: string;
  nivel: number | null;
  fixo_valor: number;
  variavel_valor: number;
  ote_total: number;
  modelo_variavel: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  // Computed
  employee_count?: number;
}

// ============= DEPARTAMENTOS =============

export function useDepartamentos() {
  return useQuery({
    queryKey: ['departamentos'],
    queryFn: async (): Promise<Departamento[]> => {
      const { data, error } = await supabase
        .from('departamentos')
        .select('*')
        .order('ordem', { ascending: true });

      if (error) throw error;
      
      // Get employee count per departamento
      const { data: employees } = await supabase
        .from('employees')
        .select('departamento')
        .not('departamento', 'is', null);
      
      const countMap: Record<string, number> = {};
      employees?.forEach(e => {
        if (e.departamento) {
          countMap[e.departamento] = (countMap[e.departamento] || 0) + 1;
        }
      });
      
      return (data || []).map(d => ({
        ...d,
        employee_count: countMap[d.nome] || 0
      }));
    }
  });
}

export function useDepartamentoMutations() {
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: async (data: Partial<Departamento>) => {
      const { data: result, error } = await supabase
        .from('departamentos')
        .insert([data as any])
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departamentos'] });
      toast({ title: 'Departamento criado com sucesso' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar departamento', description: error.message, variant: 'destructive' });
    }
  });

  const update = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Departamento> }) => {
      const { data: result, error } = await supabase
        .from('departamentos')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departamentos'] });
      toast({ title: 'Departamento atualizado' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar departamento', description: error.message, variant: 'destructive' });
    }
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('departamentos')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departamentos'] });
      toast({ title: 'Departamento removido' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover departamento', description: error.message, variant: 'destructive' });
    }
  });

  return { create, update, remove };
}

// ============= SQUADS =============

export function useSquads(departamentoId?: string) {
  return useQuery({
    queryKey: ['squads', departamentoId],
    queryFn: async (): Promise<Squad[]> => {
      let query = supabase
        .from('squads')
        .select(`
          *,
          departamento:departamentos(*)
        `)
        .order('ordem', { ascending: true });

      if (departamentoId) {
        query = query.eq('departamento_id', departamentoId);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Get employee count per squad
      const { data: employees } = await supabase
        .from('employees')
        .select('squad')
        .not('squad', 'is', null);
      
      const countMap: Record<string, number> = {};
      employees?.forEach(e => {
        if (e.squad) {
          countMap[e.squad] = (countMap[e.squad] || 0) + 1;
        }
      });
      
      return (data || []).map(s => ({
        ...s,
        employee_count: countMap[s.nome] || 0
      }));
    }
  });
}

export function useSquadMutations() {
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: async (data: Partial<Squad>) => {
      const { data: result, error } = await supabase
        .from('squads')
        .insert([data as any])
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['squads'] });
      toast({ title: 'Squad criada com sucesso' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar squad', description: error.message, variant: 'destructive' });
    }
  });

  const update = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Squad> }) => {
      const { data: result, error } = await supabase
        .from('squads')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['squads'] });
      toast({ title: 'Squad atualizada' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar squad', description: error.message, variant: 'destructive' });
    }
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('squads')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['squads'] });
      toast({ title: 'Squad removida' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover squad', description: error.message, variant: 'destructive' });
    }
  });

  return { create, update, remove };
}

// ============= CARGOS =============

export function useCargosConfig() {
  return useQuery({
    queryKey: ['cargos-config'],
    queryFn: async (): Promise<Cargo[]> => {
      const { data, error } = await supabase
        .from('cargos_catalogo')
        .select('*')
        .order('area', { ascending: true })
        .order('nivel', { ascending: true });

      if (error) throw error;
      
      // Get employee count per cargo
      const { data: employees } = await supabase
        .from('employees')
        .select('cargo_catalogo_id')
        .not('cargo_catalogo_id', 'is', null);
      
      const countMap: Record<string, number> = {};
      employees?.forEach(e => {
        if (e.cargo_catalogo_id) {
          countMap[e.cargo_catalogo_id] = (countMap[e.cargo_catalogo_id] || 0) + 1;
        }
      });
      
      return (data || []).map(c => ({
        ...c,
        employee_count: countMap[c.id] || 0
      }));
    }
  });
}

export function useCargoMutations() {
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: async (data: Partial<Cargo>) => {
      const { data: result, error } = await supabase
        .from('cargos_catalogo')
        .insert([data as any])
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargos-config'] });
      queryClient.invalidateQueries({ queryKey: ['cargos'] });
      toast({ title: 'Cargo criado com sucesso' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar cargo', description: error.message, variant: 'destructive' });
    }
  });

  const update = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Cargo> }) => {
      const { data: result, error } = await supabase
        .from('cargos_catalogo')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargos-config'] });
      queryClient.invalidateQueries({ queryKey: ['cargos'] });
      toast({ title: 'Cargo atualizado' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar cargo', description: error.message, variant: 'destructive' });
    }
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      // Soft delete - just set ativo = false
      const { error } = await supabase
        .from('cargos_catalogo')
        .update({ ativo: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargos-config'] });
      queryClient.invalidateQueries({ queryKey: ['cargos'] });
      toast({ title: 'Cargo desativado' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao desativar cargo', description: error.message, variant: 'destructive' });
    }
  });

  return { create, update, remove };
}

// ============= ÁREAS =============

export function useAreas() {
  return useQuery({
    queryKey: ['areas-config'],
    queryFn: async (): Promise<Area[]> => {
      const { data, error } = await supabase
        .from('areas_catalogo')
        .select('*')
        .order('ordem', { ascending: true });

      if (error) throw error;
      
      // Get cargo count per area
      const { data: cargos } = await supabase
        .from('cargos_catalogo')
        .select('area')
        .eq('ativo', true);
      
      const countMap: Record<string, number> = {};
      cargos?.forEach(c => {
        if (c.area) {
          countMap[c.area] = (countMap[c.area] || 0) + 1;
        }
      });
      
      return (data || []).map(a => ({
        ...a,
        cargo_count: countMap[a.nome] || 0
      }));
    }
  });
}

export function useAreaMutations() {
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: async (data: Partial<Area>) => {
      const { data: result, error } = await supabase
        .from('areas_catalogo')
        .insert([data as any])
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['areas-config'] });
      toast({ title: 'Área criada com sucesso' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar área', description: error.message, variant: 'destructive' });
    }
  });

  const update = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Area> }) => {
      const { data: result, error } = await supabase
        .from('areas_catalogo')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['areas-config'] });
      toast({ title: 'Área atualizada' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar área', description: error.message, variant: 'destructive' });
    }
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('areas_catalogo')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['areas-config'] });
      toast({ title: 'Área removida' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover área', description: error.message, variant: 'destructive' });
    }
  });

  return { create, update, remove };
}
