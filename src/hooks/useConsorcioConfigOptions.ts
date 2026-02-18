import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ============ Types ============

export interface ConsorcioTipoOption {
  id: string;
  name: string;
  label: string;
  color: string;
  display_order: number;
  is_active: boolean;
}

export interface ConsorcioCategoriaOption {
  id: string;
  name: string;
  label: string;
  color: string;
  display_order: number;
  is_active: boolean;
}

export interface ConsorcioOrigemOption {
  id: string;
  name: string;
  label: string;
  display_order: number;
  is_active: boolean;
}

// ============ Tipo Produto Options ============

export function useConsorcioTipoOptions() {
  return useQuery({
    queryKey: ['consorcio-tipo-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consorcio_tipo_produto_options')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as ConsorcioTipoOption[];
    }
  });
}

export function useCreateConsorcioTipoOption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; label: string; color: string; display_order?: number }) => {
      const { data: result, error } = await supabase
        .from('consorcio_tipo_produto_options')
        .insert({
          name: data.name,
          label: data.label,
          color: data.color,
          display_order: data.display_order ?? 0
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consorcio-tipo-options'] });
      toast.success('Tipo criado com sucesso');
    },
    onError: () => {
      toast.error('Erro ao criar tipo');
    }
  });
}

export function useUpdateConsorcioTipoOption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<ConsorcioTipoOption> & { id: string }) => {
      const { error } = await supabase
        .from('consorcio_tipo_produto_options')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consorcio-tipo-options'] });
      toast.success('Tipo atualizado');
    },
    onError: () => {
      toast.error('Erro ao atualizar tipo');
    }
  });
}

export function useDeleteConsorcioTipoOption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('consorcio_tipo_produto_options')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consorcio-tipo-options'] });
      toast.success('Tipo removido');
    },
    onError: () => {
      toast.error('Erro ao remover tipo');
    }
  });
}

// ============ Categoria Options ============

export function useConsorcioCategoriaOptions() {
  return useQuery({
    queryKey: ['consorcio-categoria-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consorcio_categoria_options')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as ConsorcioCategoriaOption[];
    }
  });
}

export function useCreateConsorcioCategoriaOption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; label: string; color: string; display_order?: number }) => {
      const { data: result, error } = await supabase
        .from('consorcio_categoria_options')
        .insert({
          name: data.name,
          label: data.label,
          color: data.color,
          display_order: data.display_order ?? 0
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consorcio-categoria-options'] });
      toast.success('Categoria criada com sucesso');
    },
    onError: () => {
      toast.error('Erro ao criar categoria');
    }
  });
}

export function useUpdateConsorcioCategoriaOption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<ConsorcioCategoriaOption> & { id: string }) => {
      const { error } = await supabase
        .from('consorcio_categoria_options')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consorcio-categoria-options'] });
      toast.success('Categoria atualizada');
    },
    onError: () => {
      toast.error('Erro ao atualizar categoria');
    }
  });
}

export function useDeleteConsorcioCategoriaOption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('consorcio_categoria_options')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consorcio-categoria-options'] });
      toast.success('Categoria removida');
    },
    onError: () => {
      toast.error('Erro ao remover categoria');
    }
  });
}

// ============ Vendedor Options ============

export interface ConsorcioVendedorOption {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
}

export function useConsorcioVendedorOptions() {
  return useQuery({
    queryKey: ['consorcio-vendedor-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consorcio_vendedor_options')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as ConsorcioVendedorOption[];
    }
  });
}

export function useCreateConsorcioVendedorOption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; display_order?: number }) => {
      const { data: result, error } = await supabase
        .from('consorcio_vendedor_options')
        .insert({
          name: data.name,
          display_order: data.display_order ?? 0
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consorcio-vendedor-options'] });
      toast.success('Vendedor adicionado com sucesso');
    },
    onError: () => {
      toast.error('Erro ao adicionar vendedor');
    }
  });
}

export function useUpdateConsorcioVendedorOption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<ConsorcioVendedorOption> & { id: string }) => {
      const { error } = await supabase
        .from('consorcio_vendedor_options')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consorcio-vendedor-options'] });
      toast.success('Vendedor atualizado');
    },
    onError: () => {
      toast.error('Erro ao atualizar vendedor');
    }
  });
}

export function useDeleteConsorcioVendedorOption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('consorcio_vendedor_options')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consorcio-vendedor-options'] });
      toast.success('Vendedor removido');
    },
    onError: () => {
      toast.error('Erro ao remover vendedor');
    }
  });
}

// ============ Origem Options ============

export function useConsorcioOrigemOptions() {
  return useQuery({
    queryKey: ['consorcio-origem-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consorcio_origem_options')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as ConsorcioOrigemOption[];
    }
  });
}

export function useCreateConsorcioOrigemOption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; label: string; display_order?: number }) => {
      const { data: result, error } = await supabase
        .from('consorcio_origem_options')
        .insert({
          name: data.name,
          label: data.label,
          display_order: data.display_order ?? 0
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consorcio-origem-options'] });
      toast.success('Origem criada com sucesso');
    },
    onError: () => {
      toast.error('Erro ao criar origem');
    }
  });
}

export function useUpdateConsorcioOrigemOption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<ConsorcioOrigemOption> & { id: string }) => {
      const { error } = await supabase
        .from('consorcio_origem_options')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consorcio-origem-options'] });
      toast.success('Origem atualizada');
    },
    onError: () => {
      toast.error('Erro ao atualizar origem');
    }
  });
}

export function useDeleteConsorcioOrigemOption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('consorcio_origem_options')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consorcio-origem-options'] });
      toast.success('Origem removida');
    },
    onError: () => {
      toast.error('Erro ao remover origem');
    }
  });
}
