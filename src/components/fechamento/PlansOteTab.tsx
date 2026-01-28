import { useState, useMemo } from 'react';
import { format, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
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
import { ChevronLeft, ChevronRight, Users, Target, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEmployeesWithCargo } from '@/hooks/useEmployees';
import { useFechamentoMetricas } from '@/hooks/useFechamentoMetricas';
import { formatCurrency } from '@/lib/formatters';

// Mapeamento de BU para departamento
const BU_MAPPING: Record<string, string> = {
  'incorporador': 'BU - Incorporador 50K',
  'consorcio': 'BU - Consórcio',
  'credito': 'BU - Crédito',
};

// Squads disponíveis
const SQUADS = [
  { value: '__all__', label: 'Todas' },
  { value: 'incorporador', label: 'Incorporador' },
  { value: 'consorcio', label: 'Consórcio' },
  { value: 'credito', label: 'Crédito' },
];

export const PlansOteTab = () => {
  // Estados de filtros
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedCargoId, setSelectedCargoId] = useState<string>('__all__');
  const [selectedBU, setSelectedBU] = useState<string>('__all__');

  const anoMes = format(selectedDate, 'yyyy-MM');

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

  // Query para colaboradores com cargo
  const { data: employees, isLoading: employeesLoading } = useEmployeesWithCargo();

  // Query para métricas ativas do mês/cargo selecionado
  const { data: metricasAtivas, isLoading: metricasLoading } = useFechamentoMetricas(
    anoMes,
    selectedCargoId === '__all__' ? undefined : selectedCargoId,
    selectedBU === '__all__' ? undefined : selectedBU
  );

  // Filtrar colaboradores
  const filteredEmployees = useMemo(() => {
    if (!employees) return [];
    
    return employees.filter(emp => {
      // Filtro por cargo
      if (selectedCargoId !== '__all__' && emp.cargo_catalogo_id !== selectedCargoId) {
        return false;
      }
      
      // Filtro por BU/Departamento - só incluir quem CORRESPONDE ao departamento esperado
      if (selectedBU !== '__all__') {
        const expectedDept = BU_MAPPING[selectedBU];
        // Excluir se: não existe mapeamento OU departamento é null OU departamento é diferente
        if (!expectedDept || emp.departamento !== expectedDept) {
          return false;
        }
      }
      
      return true;
    });
  }, [employees, selectedCargoId, selectedBU]);

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

  const isLoading = cargosLoading || employeesLoading || metricasLoading;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Planos OTE por Colaborador
          </CardTitle>
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

          {/* Filtro de BU/Squad */}
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
        ) : filteredEmployees.length === 0 ? (
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((emp) => {
                const cargo = emp.cargo_catalogo as any;
                return (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">{emp.nome_completo}</TableCell>
                    <TableCell>
                      {cargo?.nome_exibicao || emp.cargo || '-'}
                      {cargo?.nivel && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          N{cargo.nivel}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {cargo?.ote_total ? formatCurrency(cargo.ote_total) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {cargo?.fixo_valor ? formatCurrency(cargo.fixo_valor) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {cargo?.variavel_valor ? formatCurrency(cargo.variavel_valor) : '-'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* Resumo */}
        {filteredEmployees.length > 0 && (
          <div className="flex items-center justify-between pt-4 border-t text-sm text-muted-foreground">
            <span>{filteredEmployees.length} colaborador(es) encontrado(s)</span>
            <span>
              Vigência: {format(selectedDate, 'MMMM yyyy', { locale: ptBR })}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
