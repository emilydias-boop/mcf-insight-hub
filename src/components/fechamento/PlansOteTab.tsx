import { useState, useMemo } from 'react';
import { format, addMonths, subMonths, lastDayOfMonth, subDays, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Users, Target, RefreshCw, Edit, Star, AlertTriangle, Link2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEmployeesWithCargo } from '@/hooks/useEmployees';
import { useFechamentoMetricas } from '@/hooks/useFechamentoMetricas';
import { formatCurrency } from '@/lib/formatters';
import { EditIndividualPlanDialog } from './EditIndividualPlanDialog';
import { LinkSdrDialog } from './LinkSdrDialog';
import { toast } from 'sonner';

// Mapeamento de BU para departamento
const BU_MAPPING: Record<string, string> = {
  'incorporador': 'BU - Incorporador 50K',
  'consorcio': 'BU - Consórcio',
  'credito': 'BU - Crédito',
};

// Lista de departamentos válidos (todas as BUs)
const VALID_DEPARTMENTS = Object.values(BU_MAPPING);

// Squads disponíveis
const SQUADS = [
  { value: '__all__', label: 'Todas' },
  { value: 'incorporador', label: 'Incorporador' },
  { value: 'consorcio', label: 'Consórcio' },
  { value: 'credito', label: 'Crédito' },
];

interface EmployeeWithPlan {
  id: string;
  nome_completo: string;
  departamento: string | null;
  cargo_catalogo_id: string | null;
  sdr_id: string | null;
  role_type?: string | null;
  cargo_catalogo: {
    id: string;
    nome_exibicao: string;
    nivel: number | null;
    ote_total: number;
    fixo_valor: number;
    variavel_valor: number;
  } | null;
  comp_plan: {
    id: string;
    ote_total: number;
    fixo_valor: number;
    variavel_total: number;
    meta_diaria?: number;
    meta_reunioes_agendadas?: number;
    dias_uteis?: number;
    valor_meta_rpg: number;
    valor_docs_reuniao: number;
    valor_tentativas: number;
    valor_organizacao: number;
    meta_comissao_consorcio?: number | null;
    meta_comissao_holding?: number | null;
  } | null;
  sdr_meta_diaria?: number;
}

interface PlansOteTabProps {
  defaultBU?: string;
  lockBU?: boolean;
}

export const PlansOteTab = ({ defaultBU, lockBU = false }: PlansOteTabProps) => {
  // Estados de filtros
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedCargoId, setSelectedCargoId] = useState<string>('__all__');
  const [selectedBU, setSelectedBU] = useState<string>(defaultBU || '__all__');
  
  // Estado do dialog de edição
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    employee: EmployeeWithPlan | null;
  }>({ open: false, employee: null });
  
  // Estado do dialog de sincronização
  const [syncDialog, setSyncDialog] = useState(false);
  
  // Estado do dialog de vinculação SDR
  const [linkDialog, setLinkDialog] = useState<{
    open: boolean;
    employee: { id: string; nome_completo: string; departamento: string | null; email_pessoal?: string | null } | null;
  }>({ open: false, employee: null });

  const anoMes = format(selectedDate, 'yyyy-MM');
  const queryClient = useQueryClient();

  // Query para cargos do catálogo
  const { data: cargos, isLoading: cargosLoading } = useQuery({
    queryKey: ['cargos-catalogo-ativos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cargos_catalogo')
        .select('*')
        .eq('ativo', true)
        .order('area')
        .order('nome_exibicao');
      if (error) throw error;
      return data;
    },
  });

  // Query para colaboradores com cargo e sdr_id
  const { data: employees, isLoading: employeesLoading } = useEmployeesWithCargo();

  // Query para buscar todos os sdr_comp_plan vigentes
  const { data: compPlans, isLoading: plansLoading } = useQuery({
    queryKey: ['sdr-comp-plans', anoMes],
    queryFn: async () => {
      const monthStart = `${anoMes}-01`;
      const { data, error } = await supabase
        .from('sdr_comp_plan')
        .select('*')
        .lte('vigencia_inicio', monthStart)
        .or(`vigencia_fim.is.null,vigencia_fim.gte.${monthStart}`)
        .order('vigencia_inicio', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Query para buscar sdr (para meta_diaria)
  const { data: sdrs } = useQuery({
    queryKey: ['sdrs-meta-diaria'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sdr')
        .select('id, meta_diaria, role_type')
        .eq('active', true);
      if (error) throw error;
      return data;
    },
  });

  // Query para métricas ativas do mês/cargo selecionado
  const { data: metricasAtivas, isLoading: metricasLoading } = useFechamentoMetricas(
    anoMes,
    selectedCargoId === '__all__' ? undefined : selectedCargoId,
    selectedBU === '__all__' ? undefined : selectedBU
  );

  // Mutation para salvar/atualizar comp_plan
  const saveCompPlan = useMutation({
    mutationFn: async ({ sdrId, values }: { sdrId: string; values: any }) => {
      const monthStart = `${anoMes}-01`;
      
      // Verificar se já existe um plano vigente para este mês
      const { data: existing } = await supabase
        .from('sdr_comp_plan')
        .select('id, vigencia_inicio')
        .eq('sdr_id', sdrId)
        .lte('vigencia_inicio', monthStart)
        .or(`vigencia_fim.is.null,vigencia_fim.gte.${monthStart}`)
        .order('vigencia_inicio', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      // Find the employee to get cargo_catalogo_id
      const emp = employeesWithPlans.find(e => e.sdr_id === sdrId);
      
      const planData: Record<string, any> = {
        sdr_id: sdrId,
        vigencia_inicio: monthStart,
        cargo_catalogo_id: emp?.cargo_catalogo_id || null,
        ote_total: values.ote_total,
        fixo_valor: values.fixo_valor,
        variavel_total: values.variavel_total,
        valor_meta_rpg: values.valor_meta_rpg,
        valor_docs_reuniao: values.valor_docs_reuniao,
        valor_tentativas: values.valor_tentativas,
        valor_organizacao: values.valor_organizacao,
        meta_reunioes_agendadas: values.meta_diaria * 19,
        meta_reunioes_realizadas: Math.round(values.meta_diaria * 19 * 0.7),
        meta_tentativas: 84 * 19,
        meta_organizacao: 100,
        dias_uteis: 19,
        meta_no_show_pct: 30,
        ifood_mensal: 0,
        ifood_ultrameta: 0,
        status: 'PENDING',
        updated_at: new Date().toISOString(),
        meta_comissao_consorcio: values.meta_comissao_consorcio || null,
        meta_comissao_holding: values.meta_comissao_holding || null,
      };
      
      if (existing) {
        const existingStart = existing.vigencia_inicio.substring(0, 7); // yyyy-MM
        
        if (existingStart === anoMes) {
          // O plano existente é DO PRÓPRIO MÊS → atualizar normalmente
          const { error } = await supabase
            .from('sdr_comp_plan')
            .update(planData)
            .eq('id', existing.id);
          if (error) throw error;
        } else {
          // O plano existente é de um mês ANTERIOR → fechar o antigo e criar novo
          // Calcular último dia do mês anterior ao selecionado
          const selectedMonthDate = parse(monthStart, 'yyyy-MM-dd', new Date());
          const lastDayPrevMonth = format(subDays(selectedMonthDate, 1), 'yyyy-MM-dd');
          
          // Fechar o plano antigo
          const { error: closeError } = await supabase
            .from('sdr_comp_plan')
            .update({ vigencia_fim: lastDayPrevMonth, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
          if (closeError) throw closeError;
          
          // Criar novo plano para o mês selecionado
          const { error: insertError } = await supabase
            .from('sdr_comp_plan')
            .insert(planData);
          if (insertError) throw insertError;
        }
      } else {
        // Nenhum plano existente → inserir novo
        const { error } = await supabase
          .from('sdr_comp_plan')
          .insert(planData);
        if (error) throw error;
      }
      
      // Atualizar meta_diaria no sdr
      await supabase
        .from('sdr')
        .update({ meta_diaria: values.meta_diaria })
        .eq('id', sdrId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sdr-comp-plans'] });
      queryClient.invalidateQueries({ queryKey: ['sdrs-meta-diaria'] });
      toast.success('Plano individual salvo com sucesso');
      setEditDialog({ open: false, employee: null });
    },
    onError: (error: any) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    },
  });

  // Combinar employees com comp_plans
  const employeesWithPlans = useMemo<EmployeeWithPlan[]>(() => {
    if (!employees) return [];
    
    return employees
      .filter(emp => {
        // OBRIGATÓRIO: Deve ter cargo do catálogo vinculado
        if (!emp.cargo_catalogo_id) return false;
        
        // OBRIGATÓRIO: Deve pertencer a uma BU válida
        if (!emp.departamento || !VALID_DEPARTMENTS.includes(emp.departamento)) return false;
        
        // Filtro específico por cargo
        if (selectedCargoId !== '__all__' && emp.cargo_catalogo_id !== selectedCargoId) return false;
        
        // Filtro específico por BU
        if (selectedBU !== '__all__') {
          const expectedDept = BU_MAPPING[selectedBU];
          if (emp.departamento !== expectedDept) return false;
        }
        
        return true;
      })
      .map(emp => {
        const cargo = emp.cargo_catalogo as EmployeeWithPlan['cargo_catalogo'];
        const sdrId = emp.sdr_id as string | null;
        
        // Buscar comp_plan do sdr_id (já ordenado por vigencia_inicio DESC, pegar o primeiro)
        const plan = sdrId && compPlans
          ? compPlans.find(p => p.sdr_id === sdrId)
          : null;
        
        // Buscar meta_diaria do sdr
        const sdrRecord = sdrId && sdrs
          ? sdrs.find(s => s.id === sdrId)
          : null;
        
        return {
          id: emp.id,
          nome_completo: emp.nome_completo,
          departamento: emp.departamento,
          cargo_catalogo_id: emp.cargo_catalogo_id,
          sdr_id: sdrId,
          role_type: sdrRecord?.role_type || null,
          cargo_catalogo: cargo,
          comp_plan: plan ? {
            id: plan.id,
            ote_total: plan.ote_total,
            fixo_valor: plan.fixo_valor,
            variavel_total: plan.variavel_total,
            valor_meta_rpg: plan.valor_meta_rpg,
            valor_docs_reuniao: plan.valor_docs_reuniao,
            valor_tentativas: plan.valor_tentativas,
            valor_organizacao: plan.valor_organizacao,
            meta_comissao_consorcio: (plan as any).meta_comissao_consorcio || null,
            meta_comissao_holding: (plan as any).meta_comissao_holding || null,
          } : null,
          sdr_meta_diaria: sdrRecord?.meta_diaria || 10,
        };
      });
  }, [employees, compPlans, sdrs, selectedCargoId, selectedBU]);

  // Calcular divergências entre planos e catálogo
  const divergencias = useMemo(() => {
    return employeesWithPlans.filter(emp => {
      if (!emp.comp_plan || !emp.cargo_catalogo) return false;
      
      return (
        emp.comp_plan.ote_total !== emp.cargo_catalogo.ote_total ||
        emp.comp_plan.fixo_valor !== emp.cargo_catalogo.fixo_valor ||
        emp.comp_plan.variavel_total !== emp.cargo_catalogo.variavel_valor
      );
    });
  }, [employeesWithPlans]);

  // Mutation para sincronizar planos com catálogo
  const syncWithCatalog = useMutation({
    mutationFn: async (empIds: string[]) => {
      const monthStart = `${anoMes}-01`;
      
      for (const emp of employeesWithPlans.filter(e => empIds.includes(e.id))) {
        if (!emp.sdr_id || !emp.cargo_catalogo || !emp.comp_plan) continue;
        
        // Buscar o plano vigente com sua vigencia_inicio
        const { data: existing } = await supabase
          .from('sdr_comp_plan')
          .select('id, vigencia_inicio')
          .eq('sdr_id', emp.sdr_id)
          .lte('vigencia_inicio', monthStart)
          .or(`vigencia_fim.is.null,vigencia_fim.gte.${monthStart}`)
          .order('vigencia_inicio', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (!existing) continue;
        
        const existingStart = existing.vigencia_inicio.substring(0, 7);
        const updateValues = {
          ote_total: emp.cargo_catalogo.ote_total,
          fixo_valor: emp.cargo_catalogo.fixo_valor,
          variavel_total: emp.cargo_catalogo.variavel_valor,
          updated_at: new Date().toISOString(),
        };
        
        if (existingStart === anoMes) {
          // Plano é do próprio mês → atualizar normalmente
          const { error } = await supabase
            .from('sdr_comp_plan')
            .update(updateValues)
            .eq('id', existing.id);
          if (error) throw error;
        } else {
          // Plano é de mês anterior → fechar e criar novo
          const selectedMonthDate = parse(monthStart, 'yyyy-MM-dd', new Date());
          const lastDayPrevMonth = format(subDays(selectedMonthDate, 1), 'yyyy-MM-dd');
          
          // Fechar plano antigo
          const { error: closeError } = await supabase
            .from('sdr_comp_plan')
            .update({ vigencia_fim: lastDayPrevMonth, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
          if (closeError) throw closeError;
          
          // Criar novo plano com valores do catálogo, copiando demais campos do antigo
          const { data: oldPlan } = await supabase
            .from('sdr_comp_plan')
            .select('*')
            .eq('id', existing.id)
            .single();
          
          if (oldPlan) {
            const { id, created_at, vigencia_inicio, vigencia_fim, ...rest } = oldPlan;
            const { error: insertError } = await supabase
              .from('sdr_comp_plan')
              .insert({
                ...rest,
                ...updateValues,
                cargo_catalogo_id: emp.cargo_catalogo_id || rest.cargo_catalogo_id || null,
                vigencia_inicio: monthStart,
                vigencia_fim: null,
                status: 'PENDING',
              });
            if (insertError) throw insertError;
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sdr-comp-plans'] });
      toast.success('Planos sincronizados com o catálogo');
      setSyncDialog(false);
    },
    onError: (error: any) => {
      toast.error(`Erro ao sincronizar: ${error.message}`);
    },
  });

  // Agrupar cargos por área
  const cargosByArea = useMemo(() => {
    if (!cargos) return {};
    return cargos.reduce((acc, cargo) => {
      if (!acc[cargo.area]) acc[cargo.area] = [];
      acc[cargo.area].push(cargo);
      return acc;
    }, {} as Record<string, typeof cargos>);
  }, [cargos]);

  // Navegação de mês
  const goToPreviousMonth = () => setSelectedDate(prev => subMonths(prev, 1));
  const goToNextMonth = () => setSelectedDate(prev => addMonths(prev, 1));

  // Métricas ativas filtradas
  const activeMetrics = useMemo(() => {
    if (!metricasAtivas) return [];
    return metricasAtivas.filter(m => m.ativo);
  }, [metricasAtivas]);

  const isLoading = cargosLoading || employeesLoading || metricasLoading || plansLoading;

  // Helpers para exibição
  const getDisplayValues = (emp: EmployeeWithPlan) => {
    const hasPlan = !!emp.comp_plan;
    const cargo = emp.cargo_catalogo;
    
    return {
      ote: hasPlan ? emp.comp_plan!.ote_total : (cargo?.ote_total || 0),
      fixo: hasPlan ? emp.comp_plan!.fixo_valor : (cargo?.fixo_valor || 0),
      variavel: hasPlan ? emp.comp_plan!.variavel_total : (cargo?.variavel_valor || 0),
      metaDiaria: hasPlan && emp.comp_plan!.meta_reunioes_agendadas && emp.comp_plan!.dias_uteis
        ? Math.round(emp.comp_plan!.meta_reunioes_agendadas / emp.comp_plan!.dias_uteis)
        : emp.sdr_meta_diaria || 10,
      isPersonalized: hasPlan,
    };
  };

  const handleEditClick = (emp: EmployeeWithPlan) => {
    setEditDialog({ open: true, employee: emp });
  };

  const handleSavePlan = (values: any) => {
    if (!editDialog.employee?.sdr_id) {
      toast.error('Colaborador sem vínculo SDR');
      return;
    }
    saveCompPlan.mutate({
      sdrId: editDialog.employee.sdr_id,
      values,
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Planos OTE por Colaborador
            </CardTitle>
            
            {/* Botão de divergências */}
            {divergencias.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSyncDialog(true)}
                className="text-yellow-600 border-yellow-600 hover:bg-yellow-50"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                {divergencias.length} divergência(s)
              </Button>
            )}
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Navegação de mês */}
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
              <Button variant="ghost" size="icon" onClick={goToPreviousMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[120px] text-center">
                {format(selectedDate, 'MMMM yyyy', { locale: ptBR })}
              </span>
              <Button variant="ghost" size="icon" onClick={goToNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Filtro de Cargo */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Cargo:</span>
              <Select value={selectedCargoId} onValueChange={setSelectedCargoId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Todos os cargos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os cargos</SelectItem>
                  {Object.entries(cargosByArea).map(([area, cargosArea]) => (
                    <div key={area}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                        {area}
                      </div>
                      {cargosArea.map(cargo => (
                        <SelectItem key={cargo.id} value={cargo.id}>
                          {cargo.nome_exibicao}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro de BU/Squad - oculto se lockBU=true */}
            {!lockBU && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">BU:</span>
                <Select value={selectedBU} onValueChange={setSelectedBU}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    {SQUADS.map(squad => (
                      <SelectItem key={squad.value} value={squad.value}>
                        {squad.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Painel de Métricas Ativas */}
          {activeMetrics.length > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm font-medium mb-3">
                <Target className="h-4 w-4 text-primary" />
                Métricas Ativas para {format(selectedDate, 'MMMM yyyy', { locale: ptBR })}:
              </div>
              <div className="flex flex-wrap gap-2">
                {activeMetrics.map(m => (
                  <Badge key={m.id} variant="secondary" className="font-normal">
                    {m.label_exibicao} ({m.peso_percentual}%)
                  </Badge>
                ))}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Total de peso: {activeMetrics.reduce((sum, m) => sum + (m.peso_percentual || 0), 0)}%
              </div>
            </div>
          )}

          {activeMetrics.length === 0 && !metricasLoading && (
            <div className="bg-muted/50 border border-border rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhuma métrica ativa configurada para este mês/cargo/BU.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Configure as métricas na aba "Métricas Ativas".
              </p>
            </div>
          )}

          {/* Tabela de Colaboradores */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : employeesWithPlans.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum colaborador encontrado para os filtros selecionados.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead className="text-right">OTE Total</TableHead>
                  <TableHead className="text-right">Fixo</TableHead>
                  <TableHead className="text-right">Variável</TableHead>
                  <TableHead className="text-center">Meta</TableHead>
                  <TableHead className="text-center w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employeesWithPlans.map((emp) => {
                  const values = getDisplayValues(emp);
                  const cargo = emp.cargo_catalogo;
                  
                  return (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {emp.nome_completo}
                          {values.isPersonalized && (
                            <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                          )}
                        </div>
                        {!emp.sdr_id && (
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-[10px] text-yellow-500 hover:text-yellow-600"
                            onClick={() => setLinkDialog({ open: true, employee: { id: emp.id, nome_completo: emp.nome_completo, departamento: emp.departamento } })}
                          >
                            <Link2 className="h-3 w-3 mr-0.5" />
                            Vincular SDR
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        {cargo?.nome_exibicao || '-'}
                        {cargo?.nivel && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            N{cargo.nivel}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {values.ote > 0 ? formatCurrency(values.ote) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {values.fixo > 0 ? formatCurrency(values.fixo) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {values.variavel > 0 ? formatCurrency(values.variavel) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{values.metaDiaria}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditClick(emp)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* Resumo */}
          {employeesWithPlans.length > 0 && (
            <div className="flex items-center justify-between pt-4 border-t text-sm text-muted-foreground">
              <span>
                {employeesWithPlans.length} colaborador(es) • 
                {employeesWithPlans.filter(e => e.comp_plan).length} com plano personalizado
              </span>
              <span>
                Vigência: {format(selectedDate, 'MMMM yyyy', { locale: ptBR })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Edição */}
      {editDialog.employee && (
        <EditIndividualPlanDialog
          open={editDialog.open}
          onOpenChange={(open) => setEditDialog(prev => ({ ...prev, open }))}
          employeeName={editDialog.employee.nome_completo}
          employeeId={editDialog.employee.id}
          sdrId={editDialog.employee.sdr_id}
          cargoName={editDialog.employee.cargo_catalogo?.nome_exibicao || '-'}
          cargoId={editDialog.employee.cargo_catalogo_id}
          squad={editDialog.employee.departamento}
          anoMes={format(selectedDate, 'yyyy-MM')}
          currentValues={{
            ote_total: getDisplayValues(editDialog.employee).ote,
            fixo_valor: getDisplayValues(editDialog.employee).fixo,
            variavel_total: getDisplayValues(editDialog.employee).variavel,
            meta_diaria: editDialog.employee.sdr_meta_diaria || 10,
            valor_meta_rpg: editDialog.employee.comp_plan?.valor_meta_rpg || 0,
            valor_docs_reuniao: editDialog.employee.comp_plan?.valor_docs_reuniao || 0,
            valor_tentativas: editDialog.employee.comp_plan?.valor_tentativas || 0,
            valor_organizacao: editDialog.employee.comp_plan?.valor_organizacao || 0,
          }}
          catalogValues={editDialog.employee.cargo_catalogo ? {
            ote_total: editDialog.employee.cargo_catalogo.ote_total,
            fixo_valor: editDialog.employee.cargo_catalogo.fixo_valor,
            variavel_total: editDialog.employee.cargo_catalogo.variavel_valor,
            meta_diaria: 10,
            valor_meta_rpg: 0,
            valor_docs_reuniao: 0,
            valor_tentativas: 0,
            valor_organizacao: 0,
          } : undefined}
          isPersonalized={!!editDialog.employee.comp_plan}
          onSave={handleSavePlan}
          isSaving={saveCompPlan.isPending}
        />
      )}

      {/* Dialog de Sincronização com Catálogo */}
      <Dialog open={syncDialog} onOpenChange={setSyncDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Sincronizar Planos com Catálogo
            </DialogTitle>
            <DialogDescription>
              Os seguintes colaboradores possuem valores diferentes entre o plano individual e o catálogo de cargos do RH.
            </DialogDescription>
          </DialogHeader>

          {/* Alerta para meses passados */}
          {(() => {
            const now = new Date();
            const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const isPastMonth = anoMes < currentMonth;
            if (!isPastMonth) return null;
            return (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
                <div className="flex items-center gap-2 font-semibold mb-1">
                  <AlertTriangle className="h-4 w-4" />
                  Atenção: mês passado ({format(selectedDate, 'MMMM yyyy', { locale: ptBR })})
                </div>
                <p>
                  A sincronização usará os valores <strong>atuais</strong> do catálogo de cargos. 
                  Se houve promoções desde então, os valores gravados serão do nível atual e não do nível da época. 
                  Use apenas se tiver certeza de que os níveis não mudaram.
                </p>
              </div>
            );
          })()}
          
          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead className="text-right">Plano Atual</TableHead>
                  <TableHead className="text-right">Catálogo RH</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {divergencias.map(emp => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">{emp.nome_completo}</TableCell>
                    <TableCell>{emp.cargo_catalogo?.nome_exibicao || '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="text-sm">
                        <div>OTE: {formatCurrency(emp.comp_plan!.ote_total)}</div>
                        <div className="text-muted-foreground text-xs">
                          Fixo: {formatCurrency(emp.comp_plan!.fixo_valor)} | Var: {formatCurrency(emp.comp_plan!.variavel_total)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="text-sm text-green-600">
                        <div>OTE: {formatCurrency(emp.cargo_catalogo!.ote_total)}</div>
                        <div className="text-xs">
                          Fixo: {formatCurrency(emp.cargo_catalogo!.fixo_valor)} | Var: {formatCurrency(emp.cargo_catalogo!.variavel_valor)}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSyncDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => syncWithCatalog.mutate(divergencias.map(d => d.id))}
              disabled={syncWithCatalog.isPending}
            >
              {syncWithCatalog.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>Sincronizar Todos ({divergencias.length})</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Dialog de Vinculação SDR */}
      <LinkSdrDialog
        open={linkDialog.open}
        onOpenChange={(open) => setLinkDialog(prev => ({ ...prev, open }))}
        employee={linkDialog.employee}
      />
    </>
  );
};
