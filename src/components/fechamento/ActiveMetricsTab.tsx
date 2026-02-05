import { useState, useMemo } from 'react';
import { format, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  useFechamentoMetricas, 
  useBulkUpsertMetricas,
  useCopyMetricasFromPreviousMonth,
  getMetricasDisponiveis 
} from '@/hooks/useFechamentoMetricas';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, ChevronRight, Copy, Save, RefreshCw, Target, Percent } from 'lucide-react';
import { toast } from 'sonner';

interface MetricaLocal {
  nome_metrica: string;
  label_exibicao: string;
  fonte_dados: string;
  ativo: boolean;
  peso_percentual: number;
  meta_valor: number | null;
  meta_percentual: number | null; // % das Realizadas (para métricas como Contratos)
}

interface ActiveMetricsTabProps {
  defaultBU?: string;
  lockBU?: boolean;
}

export const ActiveMetricsTab = ({ defaultBU, lockBU = false }: ActiveMetricsTabProps) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedCargoId, setSelectedCargoId] = useState<string>('__all__');
  const [selectedSquad, setSelectedSquad] = useState<string>(defaultBU || '__all__');
  const [localMetrics, setLocalMetrics] = useState<MetricaLocal[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const anoMes = format(selectedDate, 'yyyy-MM');
  
  // Buscar cargos do catálogo
  const { data: cargos } = useQuery({
    queryKey: ['cargos-catalogo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cargos_catalogo')
        .select('id, nome_exibicao, area, cargo_base')
        .eq('ativo', true)
        .order('area')
        .order('nome_exibicao');
      if (error) throw error;
      return data;
    },
  });

  // Buscar métricas salvas
  const { data: savedMetrics, isLoading } = useFechamentoMetricas(
    anoMes, 
    selectedCargoId === '__all__' ? undefined : selectedCargoId, 
    selectedSquad === '__all__' ? undefined : selectedSquad
  );

  // Mutations
  const bulkUpsert = useBulkUpsertMetricas();
  const copyFromPrevious = useCopyMetricasFromPreviousMonth();

  // Inicializar métricas locais quando mudar seleção
  useMemo(() => {
    const disponiveis = getMetricasDisponiveis();
    const novasMetricas: MetricaLocal[] = disponiveis.map(m => {
      const saved = savedMetrics?.find(s => s.nome_metrica === m.nome);
      return {
        nome_metrica: m.nome,
        label_exibicao: saved?.label_exibicao || m.label,
        fonte_dados: m.fonte,
        ativo: saved?.ativo ?? false,
        peso_percentual: saved?.peso_percentual ?? 25,
        meta_valor: saved?.meta_valor ?? null,
        meta_percentual: saved?.meta_percentual ?? null,
      };
    });
    setLocalMetrics(novasMetricas);
    setHasChanges(false);
  }, [savedMetrics, anoMes, selectedCargoId]);

  // Calcular total de pesos
  const totalPeso = useMemo(() => {
    return localMetrics
      .filter(m => m.ativo)
      .reduce((sum, m) => sum + (m.peso_percentual || 0), 0);
  }, [localMetrics]);

  const handleToggleMetrica = (nome: string) => {
    setLocalMetrics(prev => prev.map(m => 
      m.nome_metrica === nome ? { ...m, ativo: !m.ativo } : m
    ));
    setHasChanges(true);
  };

  const handleChangePeso = (nome: string, peso: number) => {
    setLocalMetrics(prev => prev.map(m => 
      m.nome_metrica === nome ? { ...m, peso_percentual: peso } : m
    ));
    setHasChanges(true);
  };

  const handleChangeMeta = (nome: string, meta: number | null) => {
    setLocalMetrics(prev => prev.map(m => 
      m.nome_metrica === nome ? { ...m, meta_valor: meta } : m
    ));
    setHasChanges(true);
  };

  const handleChangeMetaPercentual = (nome: string, pct: number | null) => {
    setLocalMetrics(prev => prev.map(m => 
      m.nome_metrica === nome ? { ...m, meta_percentual: pct } : m
    ));
    setHasChanges(true);
  };

  // Métricas que suportam meta percentual (% das Realizadas)
  const supportsPercentualMeta = (nome: string) => {
    return ['contratos', 'vendas_parceria'].includes(nome);
  };

  const handleSave = async () => {
    const cargoId = selectedCargoId === '__all__' ? null : selectedCargoId;
    const squad = selectedSquad === '__all__' ? null : selectedSquad;
    
    const activeMetrics = localMetrics.filter(m => m.ativo);
    
    if (activeMetrics.length === 0) {
      toast.warning('Selecione pelo menos uma métrica');
      return;
    }

    if (Math.abs(totalPeso - 100) > 0.01) {
      toast.warning(`O total de pesos deve ser 100%. Atual: ${totalPeso.toFixed(0)}%`);
      return;
    }

    // Build metrics with delete config on first item
    const metricasToSave = activeMetrics.map((m, index) => ({
      ano_mes: anoMes,
      cargo_catalogo_id: cargoId,
      squad: squad,
      nome_metrica: m.nome_metrica,
      label_exibicao: m.label_exibicao,
      peso_percentual: m.peso_percentual,
      meta_valor: m.meta_valor,
      meta_percentual: m.meta_percentual,
      fonte_dados: m.fonte_dados,
      ativo: true,
      // Include delete config only on first item to trigger delete+insert
      ...(index === 0 ? {
        _deleteConfig: { anoMes, cargoId, squad }
      } : {})
    }));

    await bulkUpsert.mutateAsync(metricasToSave);
    setHasChanges(false);
  };

  const handleCopyFromPrevious = async () => {
    const prevMonth = format(subMonths(selectedDate, 1), 'yyyy-MM');
    await copyFromPrevious.mutateAsync({
      fromAnoMes: prevMonth,
      toAnoMes: anoMes,
      cargoId: selectedCargoId || undefined,
      squad: selectedSquad || undefined,
    });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setSelectedDate(prev => 
      direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1)
    );
  };

  // Agrupar cargos por área
  const cargosByArea = useMemo(() => {
    if (!cargos) return {};
    return cargos.reduce((acc, cargo) => {
      if (!acc[cargo.area]) acc[cargo.area] = [];
      acc[cargo.area].push(cargo);
      return acc;
    }, {} as Record<string, typeof cargos>);
  }, [cargos]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Métricas Ativas</CardTitle>
              <CardDescription>
                Configure quais métricas serão consideradas no cálculo de OTE para cada cargo/mês
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleCopyFromPrevious}
              disabled={copyFromPrevious.isPending}
            >
              {copyFromPrevious.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              Copiar do mês anterior
            </Button>
            <Button 
              size="sm"
              onClick={handleSave}
              disabled={bulkUpsert.isPending || !hasChanges}
            >
              {bulkUpsert.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Navegação de mês */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigateMonth('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[140px] text-center font-medium">
              {format(selectedDate, 'MMMM yyyy', { locale: ptBR })}
            </div>
            <Button variant="outline" size="icon" onClick={() => navigateMonth('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Seleção de Cargo */}
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Cargo:</Label>
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

          {/* Squad/BU - oculto se lockBU=true */}
          {!lockBU && (
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">BU:</Label>
              <Select value={selectedSquad} onValueChange={setSelectedSquad}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  <SelectItem value="incorporador">Incorporador</SelectItem>
                  <SelectItem value="consorcio">Consórcio</SelectItem>
                  <SelectItem value="credito">Crédito</SelectItem>
                  <SelectItem value="projetos">Projetos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Indicador de peso total */}
          <div className="ml-auto">
            <Badge 
              variant={Math.abs(totalPeso - 100) < 0.01 ? 'default' : 'destructive'}
              className="text-sm"
            >
              <Percent className="h-3 w-3 mr-1" />
              Total: {totalPeso.toFixed(0)}%
            </Badge>
          </div>
        </div>

        {/* Lista de Métricas */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-3">
            {localMetrics.map((metrica) => (
              <div 
                key={metrica.nome_metrica}
                className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                  metrica.ativo 
                    ? 'bg-primary/5 border-primary/20' 
                    : 'bg-muted/30 border-border'
                }`}
              >
                <Switch
                  checked={metrica.ativo}
                  onCheckedChange={() => handleToggleMetrica(metrica.nome_metrica)}
                />
                
                <div className="flex-1 min-w-[150px]">
                  <div className="font-medium">{metrica.label_exibicao}</div>
                  <div className="text-xs text-muted-foreground">
                    Fonte: {metrica.fonte_dados}
                  </div>
                </div>

                {metrica.ativo && (
                  <>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-muted-foreground">Peso:</Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={5}
                          className="w-[80px] h-8"
                          value={metrica.peso_percentual}
                          onChange={(e) => handleChangePeso(metrica.nome_metrica, Number(e.target.value))}
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-muted-foreground">Meta:</Label>
                      {supportsPercentualMeta(metrica.nome_metrica) ? (
                        // Para métricas com meta percentual (Contratos, Vendas Parceria)
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            className="w-[80px] h-8"
                            placeholder="% Realiz."
                            value={metrica.meta_percentual ?? ''}
                            onChange={(e) => handleChangeMetaPercentual(
                              metrica.nome_metrica, 
                              e.target.value ? Number(e.target.value) : null
                            )}
                          />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">% das Realiz.</span>
                        </div>
                      ) : (
                        // Para outras métricas, meta valor tradicional
                        <Input
                          type="number"
                          min={0}
                          className="w-[100px] h-8"
                          placeholder="Opcional"
                          value={metrica.meta_valor ?? ''}
                          onChange={(e) => handleChangeMeta(
                            metrica.nome_metrica, 
                            e.target.value ? Number(e.target.value) : null
                          )}
                        />
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Nota explicativa */}
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3 border">
          <strong>Como funciona:</strong> Ative as métricas que serão consideradas no cálculo de OTE 
          para este mês/cargo. O peso percentual determina quanto cada métrica contribui para o variável 
          total (deve somar 100%). A meta é opcional e pode ser usada para referência.
        </div>
      </CardContent>
    </Card>
  );
};
