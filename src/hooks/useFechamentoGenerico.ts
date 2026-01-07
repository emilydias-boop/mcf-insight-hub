import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  CargoCatalogo,
  ReguaMultiplicador,
  ReguaFaixa,
  MetaMes,
  MetaComponente,
  FechamentoMes,
  FechamentoPessoa,
} from '@/types/fechamento-generico';

// ============ CARGOS ============

export const useCargos = () => {
  return useQuery({
    queryKey: ['cargos-catalogo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cargos_catalogo')
        .select('*')
        .order('area')
        .order('nome_exibicao');

      if (error) throw error;
      return data as unknown as CargoCatalogo[];
    },
  });
};

export const useCargo = (id: string | null) => {
  return useQuery({
    queryKey: ['cargos-catalogo', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('cargos_catalogo')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as unknown as CargoCatalogo;
    },
    enabled: !!id,
  });
};

export const useCargoMutations = () => {
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: async (cargo: Omit<CargoCatalogo, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('cargos_catalogo')
        .insert(cargo as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargos-catalogo'] });
      toast.success('Cargo criado com sucesso');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...cargo }: Partial<CargoCatalogo> & { id: string }) => {
      const { data, error } = await supabase
        .from('cargos_catalogo')
        .update(cargo as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargos-catalogo'] });
      toast.success('Cargo atualizado');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cargos_catalogo').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargos-catalogo'] });
      toast.success('Cargo removido');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return { create, update, remove };
};

// ============ RÉGUAS ============

export const useReguas = () => {
  return useQuery({
    queryKey: ['reguas-multiplicador'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('regua_multiplicador')
        .select('*')
        .order('nome_regua');

      if (error) throw error;
      return data as unknown as ReguaMultiplicador[];
    },
  });
};

export const useReguaFaixas = (reguaId: string | null) => {
  return useQuery({
    queryKey: ['regua-faixas', reguaId],
    queryFn: async () => {
      if (!reguaId) return [];
      const { data, error } = await supabase
        .from('regua_faixas')
        .select('*')
        .eq('regua_id', reguaId)
        .order('ordem');

      if (error) throw error;
      return data as unknown as ReguaFaixa[];
    },
    enabled: !!reguaId,
  });
};

export const useReguaMutations = () => {
  const queryClient = useQueryClient();

  const createRegua = useMutation({
    mutationFn: async (regua: { nome_regua: string; ativo?: boolean }) => {
      const { data, error } = await supabase
        .from('regua_multiplicador')
        .insert(regua)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reguas-multiplicador'] });
      toast.success('Régua criada');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateRegua = useMutation({
    mutationFn: async ({ id, ...regua }: { id: string; nome_regua?: string; ativo?: boolean }) => {
      const { data, error } = await supabase
        .from('regua_multiplicador')
        .update(regua)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reguas-multiplicador'] });
      toast.success('Régua atualizada');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteRegua = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('regua_multiplicador').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reguas-multiplicador'] });
      toast.success('Régua removida');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createFaixa = useMutation({
    mutationFn: async (faixa: { regua_id: string; faixa_de: number; faixa_ate: number; multiplicador: number; ordem: number }) => {
      const { data, error } = await supabase
        .from('regua_faixas')
        .insert(faixa)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['regua-faixas', variables.regua_id] });
      toast.success('Faixa adicionada');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateFaixa = useMutation({
    mutationFn: async ({ id, ...faixa }: { id: string; faixa_de?: number; faixa_ate?: number; multiplicador?: number; ordem?: number }) => {
      const { data, error } = await supabase
        .from('regua_faixas')
        .update(faixa)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['regua-faixas', data.regua_id] });
      toast.success('Faixa atualizada');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteFaixa = useMutation({
    mutationFn: async ({ id, reguaId }: { id: string; reguaId: string }) => {
      const { error } = await supabase.from('regua_faixas').delete().eq('id', id);
      if (error) throw error;
      return reguaId;
    },
    onSuccess: (reguaId) => {
      queryClient.invalidateQueries({ queryKey: ['regua-faixas', reguaId] });
      toast.success('Faixa removida');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return { createRegua, updateRegua, deleteRegua, createFaixa, updateFaixa, deleteFaixa };
};

// ============ METAS ============

export const useMetasMes = (competencia?: string) => {
  return useQuery({
    queryKey: ['metas-mes', competencia],
    queryFn: async () => {
      let query = supabase.from('metas_mes').select('*');

      if (competencia) query = query.eq('competencia', competencia);

      const { data, error } = await query.order('competencia', { ascending: false });

      if (error) throw error;
      return data as unknown as MetaMes[];
    },
  });
};

export const useMetaComponentes = (metaMesId: string | null) => {
  return useQuery({
    queryKey: ['meta-componentes', metaMesId],
    queryFn: async () => {
      if (!metaMesId) return [];
      const { data, error } = await supabase
        .from('metas_componentes')
        .select('*')
        .eq('meta_mes_id', metaMesId)
        .order('ordem');

      if (error) throw error;
      return data as unknown as MetaComponente[];
    },
    enabled: !!metaMesId,
  });
};

export const useMetaMutations = () => {
  const queryClient = useQueryClient();

  const createMeta = useMutation({
    mutationFn: async (meta: { 
      competencia: string; 
      area: string; 
      cargo_base: string;
      nivel?: number;
      cargo_catalogo_id?: string;
      regua_id?: string;
      observacao?: string;
    }) => {
      const { data, error } = await supabase
        .from('metas_mes')
        .insert(meta)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metas-mes'] });
      toast.success('Meta criada');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMeta = useMutation({
    mutationFn: async ({ id, ...meta }: Partial<MetaMes> & { id: string }) => {
      const { data, error } = await supabase
        .from('metas_mes')
        .update(meta as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metas-mes'] });
      toast.success('Meta atualizada');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMeta = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('metas_mes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metas-mes'] });
      toast.success('Meta removida');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createComponente = useMutation({
    mutationFn: async (comp: { meta_mes_id: string; nome_componente: string; valor_base: number; ordem?: number }) => {
      const { data, error } = await supabase
        .from('metas_componentes')
        .insert(comp)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['meta-componentes', variables.meta_mes_id] });
      toast.success('Componente adicionado');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateComponente = useMutation({
    mutationFn: async ({ id, ...comp }: { id: string; nome_componente?: string; valor_base?: number; ordem?: number; ativo?: boolean }) => {
      const { data, error } = await supabase
        .from('metas_componentes')
        .update(comp)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['meta-componentes', data.meta_mes_id] });
      toast.success('Componente atualizado');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteComponente = useMutation({
    mutationFn: async ({ id, metaMesId }: { id: string; metaMesId: string }) => {
      const { error } = await supabase.from('metas_componentes').delete().eq('id', id);
      if (error) throw error;
      return metaMesId;
    },
    onSuccess: (metaMesId) => {
      queryClient.invalidateQueries({ queryKey: ['meta-componentes', metaMesId] });
      toast.success('Componente removido');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return { createMeta, updateMeta, deleteMeta, createComponente, updateComponente, deleteComponente };
};

// ============ FECHAMENTO ============

export const useFechamentosMes = (ano?: number) => {
  return useQuery({
    queryKey: ['fechamentos-mes', ano],
    queryFn: async () => {
      let query = supabase.from('fechamento_mes').select('*');

      if (ano) {
        query = query.like('competencia', `${ano}-%`);
      }

      const { data, error } = await query.order('competencia', { ascending: false });

      if (error) throw error;
      return data as unknown as FechamentoMes[];
    },
  });
};

export const useFechamentoPessoas = (fechamentoMesId: string | null) => {
  return useQuery({
    queryKey: ['fechamento-pessoas', fechamentoMesId],
    queryFn: async () => {
      if (!fechamentoMesId) return [];
      const { data, error } = await supabase
        .from('fechamento_pessoa')
        .select(`
          *,
          employee:employee_id(id, nome_completo, cargo),
          cargo:cargo_catalogo_id(id, nome_exibicao)
        `)
        .eq('fechamento_mes_id', fechamentoMesId)
        .order('created_at');

      if (error) throw error;
      return data as unknown as (FechamentoPessoa & { employee: { id: string; nome_completo: string; cargo: string }; cargo: { id: string; nome_exibicao: string } })[];
    },
    enabled: !!fechamentoMesId,
  });
};

export const useFechamentoMutations = () => {
  const queryClient = useQueryClient();

  const createFechamento = useMutation({
    mutationFn: async (fech: { competencia: string; status?: string; observacao_geral?: string }) => {
      const { data, error } = await supabase
        .from('fechamento_mes')
        .insert(fech)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fechamentos-mes'] });
      toast.success('Fechamento criado');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateFechamento = useMutation({
    mutationFn: async ({ id, ...fech }: Partial<FechamentoMes> & { id: string }) => {
      const { data, error } = await supabase
        .from('fechamento_mes')
        .update(fech as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fechamentos-mes'] });
      toast.success('Fechamento atualizado');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updatePessoa = useMutation({
    mutationFn: async ({ id, ...pessoa }: Partial<FechamentoPessoa> & { id: string }) => {
      const { data, error } = await supabase
        .from('fechamento_pessoa')
        .update(pessoa as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fechamento-pessoas', data.fechamento_mes_id] });
      toast.success('Pessoa atualizada');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return { createFechamento, updateFechamento, updatePessoa };
};

// Helper to get multiplier from régua
export const getMultiplierFromRegua = (faixas: ReguaFaixa[], pctAtingido: number): number => {
  const faixa = faixas.find(f => pctAtingido >= f.faixa_de && pctAtingido < f.faixa_ate);
  return faixa?.multiplicador ?? 1;
};

// ============ AUDITORIA ============

export const useAuditoriaFechamento = (filters: { 
  entidade?: string; 
  limit?: number;
} = {}) => {
  return useQuery({
    queryKey: ['auditoria-fechamento', filters],
    queryFn: async () => {
      let query = supabase
        .from('auditoria_fechamento')
        .select(`
          *,
          usuario:usuario_id(full_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(filters.limit || 100);

      if (filters.entidade) {
        query = query.eq('entidade', filters.entidade);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
};

// ============ COPY METAS ============

export const useCopyMetasFromMonth = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ fromCompetencia, toCompetencia }: { 
      fromCompetencia: string; 
      toCompetencia: string;
    }) => {
      // 1. Fetch source metas
      const { data: sourceMetas, error: metasError } = await supabase
        .from('metas_mes')
        .select('*')
        .eq('competencia', fromCompetencia);

      if (metasError) throw metasError;
      if (!sourceMetas || sourceMetas.length === 0) {
        throw new Error('Nenhuma meta encontrada no mês de origem');
      }

      // 2. For each meta, create new with new competencia
      for (const meta of sourceMetas) {
        // Fetch components for this meta
        const { data: sourceComps } = await supabase
          .from('metas_componentes')
          .select('*')
          .eq('meta_mes_id', meta.id);

        // Create new meta
        const { data: newMeta, error: newMetaError } = await supabase
          .from('metas_mes')
          .insert({
            competencia: toCompetencia,
            area: meta.area,
            cargo_base: meta.cargo_base,
            nivel: meta.nivel,
            cargo_catalogo_id: meta.cargo_catalogo_id,
            regua_id: meta.regua_id,
            ativo: meta.ativo,
            observacao: meta.observacao,
          })
          .select()
          .single();

        if (newMetaError) throw newMetaError;

        // Copy components
        if (sourceComps && sourceComps.length > 0) {
          const newComps = sourceComps.map(comp => ({
            meta_mes_id: newMeta.id,
            nome_componente: comp.nome_componente,
            valor_base: comp.valor_base,
            ordem: comp.ordem,
            ativo: comp.ativo,
          }));

          const { error: compError } = await supabase
            .from('metas_componentes')
            .insert(newComps);

          if (compError) throw compError;
        }
      }

      return { count: sourceMetas.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['metas-mes'] });
      toast.success(`${data.count} metas copiadas com sucesso`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
};

// ============ GENERATE FECHAMENTO ============

export const useGenerateFechamento = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (competencia: string) => {
      // 1. Create fechamento_mes record
      const { data: fechamento, error: fechError } = await supabase
        .from('fechamento_mes')
        .insert({ 
          competencia, 
          status: 'rascunho',
        })
        .select()
        .single();

      if (fechError) throw fechError;

      // 2. Fetch eligible employees (active with cargo_catalogo_id)
      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select(`
          id,
          nome_completo,
          cargo,
          cargo_catalogo_id,
          cargo_catalogo:cargo_catalogo_id(
            id,
            fixo_valor,
            variavel_valor,
            ote_total,
            modelo_variavel
          )
        `)
        .eq('status', 'ativo')
        .not('cargo_catalogo_id', 'is', null);

      if (empError) throw empError;

      // 3. Create fechamento_pessoa for each employee
      if (employees && employees.length > 0) {
        const pessoasToInsert = employees.map((emp: any) => ({
          fechamento_mes_id: fechamento.id,
          employee_id: emp.id,
          cargo_catalogo_id: emp.cargo_catalogo_id,
          fixo_valor: emp.cargo_catalogo?.fixo_valor || 0,
          variavel_bruto: emp.cargo_catalogo?.variavel_valor || 0,
          multiplicador_final: 1,
          variavel_final: emp.cargo_catalogo?.variavel_valor || 0,
          total_a_pagar: (emp.cargo_catalogo?.fixo_valor || 0) + (emp.cargo_catalogo?.variavel_valor || 0),
          status: 'em_revisao',
        }));

        const { error: pessoasError } = await supabase
          .from('fechamento_pessoa')
          .insert(pessoasToInsert);

        if (pessoasError) throw pessoasError;
      }

      // Update fechamento status
      await supabase
        .from('fechamento_mes')
        .update({ status: 'em_revisao' })
        .eq('id', fechamento.id);

      return { fechamentoId: fechamento.id, count: employees?.length || 0 };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fechamentos-mes'] });
      queryClient.invalidateQueries({ queryKey: ['fechamento-pessoas'] });
      toast.success(`Fechamento gerado com ${data.count} colaboradores`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
};

// ============ APPROVE PESSOA ============

export const useAproveFechamentoPessoa = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pessoaId: string) => {
      const { data, error } = await supabase
        .from('fechamento_pessoa')
        .update({ 
          status: 'aprovado',
          aprovado_em: new Date().toISOString(),
        })
        .eq('id', pessoaId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fechamento-pessoas', data.fechamento_mes_id] });
      toast.success('Fechamento aprovado');
    },
    onError: (error: Error) => toast.error(error.message),
  });
};
