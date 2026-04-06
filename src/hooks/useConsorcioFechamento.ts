import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import {
  ConsorcioCloserPayout,
  ConsorcioPayoutStatus,
  ConsorcioVendaHolding,
  ConsorcioKpiFormData,
  AjusteConsorcio,
  calcularPayoutConsorcio,
  OTE_PADRAO_CONSORCIO,
  PESOS_PADRAO_CONSORCIO,
  PesosConsorcio,
} from '@/types/consorcio-fechamento';

// ID do cargo "Closer Consórcio" em cargos_catalogo
const CARGO_CLOSER_CONSORCIO_ID = '6258e185-0001-40a6-bcd8-d9eb8a5c2720';

// Buscar pesos dinâmicos das métricas ativas do mês
async function buscarPesosMetricas(anoMes: string): Promise<PesosConsorcio> {
  const { data: metricas } = await supabase
    .from('fechamento_metricas_mes')
    .select('nome_metrica, peso_percentual')
    .eq('ano_mes', anoMes)
    .eq('cargo_catalogo_id', CARGO_CLOSER_CONSORCIO_ID)
    .eq('ativo', true);
  
  if (!metricas || metricas.length === 0) {
    // Fallback: pesos padrão 90/0/10
    return { ...PESOS_PADRAO_CONSORCIO };
  }
  
  const pesos: PesosConsorcio = { comissao_consorcio: 0, comissao_holding: 0, organizacao: 0 };
  
  for (const m of metricas) {
    const pesoDecimal = (m.peso_percentual || 0) / 100;
    const nome = m.nome_metrica?.toLowerCase() || '';
    if (nome.includes('comissao_consorcio') || nome.includes('comissão') || nome.includes('venda_consorcio')) {
      pesos.comissao_consorcio += pesoDecimal;
    } else if (nome.includes('holding')) {
      pesos.comissao_holding += pesoDecimal;
    } else if (nome.includes('organizacao') || nome.includes('organização')) {
      pesos.organizacao += pesoDecimal;
    }
  }
  
  return pesos;
}

// Cargos excluídos do fechamento
const CARGOS_EXCLUIDOS_LIST = ['Supervisor', 'Closer R2', 'Coordenador', 'ADMIN'];

// Lista closers ativos do consórcio (filtrando coordenadores/supervisores)
export function useConsorcioClosers() {
  return useQuery({
    queryKey: ['consorcio-closers'],
    queryFn: async () => {
      const { data: closers, error } = await supabase
        .from('closers')
        .select('id, name, email, color, is_active, employee_id')
        .eq('bu', 'consorcio')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      if (!closers || closers.length === 0) return [];
      
      // Buscar cargos dos employees para filtrar
      const emails = closers.map(c => c.email.toLowerCase());
      const { data: employees } = await supabase
        .from('employees')
        .select('email_pessoal, cargo')
        .in('email_pessoal', emails);
      
      const cargoByEmail = new Map((employees || []).map(e => [e.email_pessoal?.toLowerCase(), e.cargo]));
      
      // Filtrar closers cujo cargo está na lista de exclusão
      return closers.filter(c => {
        const cargo = cargoByEmail.get(c.email.toLowerCase());
        return !cargo || !CARGOS_EXCLUIDOS_LIST.includes(cargo);
      });
    },
  });
}

// Lista payouts de um mês
export function useConsorcioPayouts(anoMes: string) {
  return useQuery({
    queryKey: ['consorcio-payouts', anoMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consorcio_closer_payout')
        .select(`
          *,
          closer:closer_id (
            id,
            name,
            email,
            color,
            is_active,
            employee_id
          )
        `)
        .eq('ano_mes', anoMes)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Parse ajustes_json
      return (data || []).map(row => ({
        ...row,
        ajustes_json: Array.isArray(row.ajustes_json) 
          ? (row.ajustes_json as unknown as AjusteConsorcio[])
          : [],
      })) as ConsorcioCloserPayout[];
    },
    enabled: !!anoMes,
  });
}

// Detalhe de um payout
export function useConsorcioPayoutDetail(payoutId: string) {
  return useQuery({
    queryKey: ['consorcio-payout', payoutId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consorcio_closer_payout')
        .select(`
          *,
          closer:closer_id (
            id,
            name,
            email,
            color,
            is_active,
            employee_id
          )
        `)
        .eq('id', payoutId)
        .single();
      
      if (error) throw error;
      
      return {
        ...data,
        ajustes_json: Array.isArray(data.ajustes_json) 
          ? (data.ajustes_json as unknown as AjusteConsorcio[])
          : [],
      } as ConsorcioCloserPayout;
    },
    enabled: !!payoutId,
  });
}

// Buscar vendas holding de um closer/mês
export function useConsorcioVendasHolding(closerId: string, anoMes: string) {
  return useQuery({
    queryKey: ['consorcio-vendas-holding', closerId, anoMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consorcio_venda_holding')
        .select('*')
        .eq('closer_id', closerId)
        .eq('ano_mes', anoMes)
        .order('data_venda', { ascending: false });
      
      if (error) throw error;
      return data as ConsorcioVendaHolding[];
    },
    enabled: !!closerId && !!anoMes,
  });
}

// Buscar comissões de consórcio do mês (de consortium_cards)
async function buscarComissaoConsorcioMes(closerId: string, anoMes: string): Promise<number> {
  // Converter anoMes para range de datas
  const [ano, mes] = anoMes.split('-').map(Number);
  const dataInicio = new Date(ano, mes - 1, 1);
  const dataFim = endOfMonth(dataInicio);
  
  const inicioStr = format(dataInicio, 'yyyy-MM-dd');
  const fimStr = format(dataFim, 'yyyy-MM-dd');
  
  // Buscar cards do vendedor no período
  const { data: cards, error } = await supabase
    .from('consortium_cards')
    .select('id, valor_comissao')
    .eq('vendedor_id', closerId)
    .gte('data_contratacao', inicioStr)
    .lte('data_contratacao', fimStr);
  
  if (error) {
    console.error('Erro ao buscar comissões:', error);
    return 0;
  }
  
  return (cards || []).reduce((sum, card) => sum + (card.valor_comissao || 0), 0);
}

// Buscar comissões de holding do mês
async function buscarComissaoHoldingMes(closerId: string, anoMes: string): Promise<number> {
  const { data, error } = await supabase
    .from('consorcio_venda_holding')
    .select('valor_comissao')
    .eq('closer_id', closerId)
    .eq('ano_mes', anoMes);
  
  if (error) {
    console.error('Erro ao buscar vendas holding:', error);
    return 0;
  }
  
  return (data || []).reduce((sum, v) => sum + (v.valor_comissao || 0), 0);
}




// Buscar OTE do comp plan individual para o mês
async function buscarCompPlanVigente(sdrId: string, anoMes: string) {
  const [ano, mes] = anoMes.split('-').map(Number);
  const mesStr = `${ano}-${String(mes).padStart(2, '0')}-01`;
  
  // Buscar plano vigente para o mês (vigencia_inicio <= mesStr AND (vigencia_fim IS NULL OR vigencia_fim >= mesStr))
  const { data } = await supabase
    .from('sdr_comp_plan')
    .select('ote_total, fixo_valor, variavel_total, meta_comissao_consorcio, meta_comissao_holding')
    .eq('sdr_id', sdrId)
    .lte('vigencia_inicio', mesStr)
    .or(`vigencia_fim.is.null,vigencia_fim.gte.${mesStr}`)
    .order('vigencia_inicio', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  return data;
}

// Gerar/Recalcular payouts do mês
export function useRecalculateConsorcioPayouts() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (anoMes: string) => {
      // 0. Buscar pesos dinâmicos das métricas ativas
      const pesos = await buscarPesosMetricas(anoMes);
      
      // 1. Buscar closers ativos do consórcio
      const { data: closers, error: closersError } = await supabase
        .from('closers')
        .select('id, name, email, employee_id')
        .eq('bu', 'consorcio')
        .eq('is_active', true);
      
      if (closersError) throw closersError;
      if (!closers || closers.length === 0) {
        throw new Error('Nenhum closer ativo encontrado para consórcio');
      }
      
      // 2. Buscar SDRs correspondentes (match por email)
      const emails = closers.map(c => c.email.toLowerCase());
      const { data: sdrs } = await supabase
        .from('sdr')
        .select('id, email, name')
        .in('email', emails);
      
      const sdrByEmail = new Map((sdrs || []).map(s => [s.email.toLowerCase(), s]));
      
      // 3. Buscar employees para verificar cargo (match por email)
      const { data: employees } = await supabase
        .from('employees')
        .select('id, email_pessoal, cargo')
        .in('email_pessoal', emails);
      
      const cargoByEmail = new Map((employees || []).map(e => [e.email_pessoal?.toLowerCase(), e.cargo]));
      
      const results = [];
      
      for (const closer of closers) {
        const closerEmail = closer.email.toLowerCase();
        
        // 4. Filtrar por cargo - excluir supervisores, closer R2, coordenadores
        const cargo = cargoByEmail.get(closerEmail);
        if (cargo && CARGOS_EXCLUIDOS_LIST.includes(cargo)) {
          results.push({ closer: closer.name, status: 'skipped', reason: `cargo: ${cargo}` });
          continue;
        }
        
        // 5. Buscar KPIs automáticos
        const comissao_consorcio = await buscarComissaoConsorcioMes(closer.id, anoMes);
        const comissao_holding = await buscarComissaoHoldingMes(closer.id, anoMes);
        
        // 6. Verificar se já existe payout
        const { data: existing } = await supabase
          .from('consorcio_closer_payout')
          .select('id, status, score_organizacao, meta_comissao_consorcio, meta_comissao_holding')
          .eq('closer_id', closer.id)
          .eq('ano_mes', anoMes)
          .maybeSingle();
        
        // Se já existe e está LOCKED, não atualizar
        if (existing?.status === 'LOCKED') {
          results.push({ closer: closer.name, status: 'skipped', reason: 'locked' });
          continue;
        }
        
        // Buscar meta individual do comp plan, fallback para existente, depois padrão
        const sdr = sdrByEmail.get(closerEmail);
        let meta_comissao_consorcio = existing?.meta_comissao_consorcio || 2000;
        let meta_comissao_holding = existing?.meta_comissao_holding || 500;
        const score_organizacao = existing?.score_organizacao || 100;
        
        // 7. Buscar OTE individual e metas do comp plan
        let ote_total = OTE_PADRAO_CONSORCIO.ote_total;
        let fixo_valor = ote_total * OTE_PADRAO_CONSORCIO.fixo_pct;
        let variavel_total = ote_total * OTE_PADRAO_CONSORCIO.variavel_pct;
        
        if (sdr) {
          const compPlan = await buscarCompPlanVigente(sdr.id, anoMes);
          if (compPlan) {
            ote_total = compPlan.ote_total;
            fixo_valor = compPlan.fixo_valor;
            variavel_total = compPlan.variavel_total;
            // Usar metas do comp plan se configuradas
            if (compPlan.meta_comissao_consorcio) {
              meta_comissao_consorcio = compPlan.meta_comissao_consorcio;
            }
            if (compPlan.meta_comissao_holding) {
              meta_comissao_holding = compPlan.meta_comissao_holding;
            }
          }
        }
        
        // 8. Calcular valores com pesos dinâmicos
        const calc = calcularPayoutConsorcio(
          variavel_total,
          comissao_consorcio,
          comissao_holding,
          score_organizacao,
          meta_comissao_consorcio,
          meta_comissao_holding,
          100,
          pesos
        );
        
        const total_conta = fixo_valor + calc.valor_variavel_final;
        
        const payoutData = {
          closer_id: closer.id,
          ano_mes: anoMes,
          ote_total,
          fixo_valor,
          variavel_total,
          comissao_consorcio,
          comissao_holding,
          score_organizacao,
          meta_comissao_consorcio,
          meta_comissao_holding,
          ...calc,
          total_conta,
          status: 'DRAFT' as const,
          updated_at: new Date().toISOString(),
        };
        
        if (existing) {
          // Atualizar existente
          const { error } = await supabase
            .from('consorcio_closer_payout')
            .update(payoutData)
            .eq('id', existing.id);
          
          if (error) throw error;
          results.push({ closer: closer.name, status: 'updated' });
        } else {
          // Criar novo
          const { error } = await supabase
            .from('consorcio_closer_payout')
            .insert(payoutData);
          
          if (error) throw error;
          results.push({ closer: closer.name, status: 'created' });
        }
      }
      
      return results;
    },
    onSuccess: (results, anoMes) => {
      queryClient.invalidateQueries({ queryKey: ['consorcio-payouts', anoMes] });
      const created = results.filter(r => r.status === 'created').length;
      const updated = results.filter(r => r.status === 'updated').length;
      toast.success(`Fechamentos processados: ${created} criados, ${updated} atualizados`);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao processar fechamentos: ${error.message}`);
    },
  });
}

// Atualizar KPIs de um payout
export function useUpdateConsorcioPayoutKpi() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      payoutId, 
      data 
    }: { 
      payoutId: string; 
      data: ConsorcioKpiFormData;
    }) => {
      // Buscar payout atual
      const { data: payout, error: fetchError } = await supabase
        .from('consorcio_closer_payout')
        .select('*')
        .eq('id', payoutId)
        .single();
      
      if (fetchError) throw fetchError;
      if (payout.status === 'LOCKED') {
        throw new Error('Não é possível editar um fechamento travado');
      }
      
      // Buscar pesos dinâmicos das métricas ativas
      const pesos = await buscarPesosMetricas(payout.ano_mes);
      
      // Recalcular com novos KPIs e pesos dinâmicos
      const calc = calcularPayoutConsorcio(
        payout.variavel_total,
        data.comissao_consorcio,
        data.comissao_holding,
        data.score_organizacao,
        data.meta_comissao_consorcio || payout.meta_comissao_consorcio || 2000,
        data.meta_comissao_holding || payout.meta_comissao_holding || 500,
        100,
        pesos
      );
      
      const total_conta = payout.fixo_valor + calc.valor_variavel_final + (payout.bonus_extra || 0);
      
      const { error } = await supabase
        .from('consorcio_closer_payout')
        .update({
          comissao_consorcio: data.comissao_consorcio,
          comissao_holding: data.comissao_holding,
          score_organizacao: data.score_organizacao,
          meta_comissao_consorcio: data.meta_comissao_consorcio,
          meta_comissao_holding: data.meta_comissao_holding,
          ...calc,
          total_conta,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payoutId);
      
      if (error) throw error;
      return payoutId;
    },
    onSuccess: (payoutId) => {
      queryClient.invalidateQueries({ queryKey: ['consorcio-payout', payoutId] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-payouts'] });
      toast.success('KPIs atualizados com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar KPIs: ${error.message}`);
    },
  });
}

// Atualizar status do payout
export function useUpdateConsorcioPayoutStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      payoutId, 
      status 
    }: { 
      payoutId: string; 
      status: ConsorcioPayoutStatus;
    }) => {
      const updateData: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      };
      
      if (status === 'APPROVED') {
        const { data: { user } } = await supabase.auth.getUser();
        updateData.aprovado_por = user?.id;
        updateData.aprovado_em = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from('consorcio_closer_payout')
        .update(updateData)
        .eq('id', payoutId);
      
      if (error) throw error;
      return payoutId;
    },
    onSuccess: (payoutId) => {
      queryClient.invalidateQueries({ queryKey: ['consorcio-payout', payoutId] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-payouts'] });
      toast.success('Status atualizado');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar status: ${error.message}`);
    },
  });
}

// Adicionar ajuste manual
export function useAddConsorcioAjuste() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      payoutId, 
      ajuste 
    }: { 
      payoutId: string; 
      ajuste: Omit<AjusteConsorcio, 'data'>;
    }) => {
      // Buscar payout atual
      const { data: payout, error: fetchError } = await supabase
        .from('consorcio_closer_payout')
        .select('*')
        .eq('id', payoutId)
        .single();
      
      if (fetchError) throw fetchError;
      if (payout.status === 'LOCKED') {
        throw new Error('Não é possível adicionar ajuste em um fechamento travado');
      }
      
      const ajustes = Array.isArray(payout.ajustes_json) 
        ? (payout.ajustes_json as unknown as AjusteConsorcio[]) 
        : [];
      const novoAjuste: AjusteConsorcio = {
        ...ajuste,
        data: new Date().toISOString(),
      };
      
      // Recalcular total com ajustes
      const valorAjuste = ajuste.tipo === 'bonus' ? ajuste.valor : -ajuste.valor;
      const novoTotal = (payout.total_conta || 0) + valorAjuste;
      
      const novosAjustes = [...ajustes, novoAjuste];
      
      const { error } = await supabase
        .from('consorcio_closer_payout')
        .update({
          ajustes_json: JSON.parse(JSON.stringify(novosAjustes)),
          bonus_extra: (payout.bonus_extra || 0) + valorAjuste,
          total_conta: novoTotal,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payoutId);
      
      if (error) throw error;
      return payoutId;
    },
    onSuccess: (payoutId) => {
      queryClient.invalidateQueries({ queryKey: ['consorcio-payout', payoutId] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-payouts'] });
      toast.success('Ajuste adicionado');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao adicionar ajuste: ${error.message}`);
    },
  });
}

// Remover ajuste manual
export function useRemoveConsorcioAjuste() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ payoutId, index }: { payoutId: string; index: number }) => {
      const { data: payout, error: fetchError } = await supabase
        .from('consorcio_closer_payout')
        .select('*')
        .eq('id', payoutId)
        .single();
      
      if (fetchError) throw fetchError;
      if (payout.status === 'LOCKED') {
        throw new Error('Não é possível remover ajuste de um fechamento travado');
      }
      
      const ajustes = Array.isArray(payout.ajustes_json) 
        ? (payout.ajustes_json as unknown as AjusteConsorcio[]) 
        : [];
      
      if (index < 0 || index >= ajustes.length) {
        throw new Error('Índice de ajuste inválido');
      }
      
      const ajusteRemovido = ajustes[index];
      const valorAjuste = ajusteRemovido.tipo === 'bonus' ? ajusteRemovido.valor : -ajusteRemovido.valor;
      
      const novosAjustes = ajustes.filter((_, i) => i !== index);
      
      const { error } = await supabase
        .from('consorcio_closer_payout')
        .update({
          ajustes_json: JSON.parse(JSON.stringify(novosAjustes)),
          bonus_extra: (payout.bonus_extra || 0) - valorAjuste,
          total_conta: (payout.total_conta || 0) - valorAjuste,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payoutId);
      
      if (error) throw error;
      return payoutId;
    },
    onSuccess: (payoutId) => {
      queryClient.invalidateQueries({ queryKey: ['consorcio-payout', payoutId] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-payouts'] });
      toast.success('Ajuste removido');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover ajuste: ${error.message}`);
    },
  });
}

// Adicionar venda holding
export function useAddVendaHolding() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (venda: Omit<ConsorcioVendaHolding, 'id' | 'created_at' | 'created_by'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('consorcio_venda_holding')
        .insert({
          ...venda,
          created_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['consorcio-vendas-holding', variables.closer_id, variables.ano_mes] 
      });
      toast.success('Venda holding adicionada');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao adicionar venda: ${error.message}`);
    },
  });
}
