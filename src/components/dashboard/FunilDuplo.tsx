import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter, Save } from "lucide-react";
import { FunilLista } from "./FunilLista";
import { useClintFunnelByLeadType } from "@/hooks/useClintFunnelByLeadType";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, startOfMonth, endOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getCustomWeekStart, getCustomWeekEnd, getCustomWeekNumber, formatCustomWeekRange } from "@/lib/dateHelpers";
import { useDashboardPreferences } from "@/hooks/useDashboardPreferences";

// Etapas que devem aparecer no funil (sem Novo Lead, que vai acima)
const DEFAULT_STAGES = [
  "a8365215-fd31-4bdc-bbe7-77100fa39e53", // Reunião 01 Agendada
  "9b8c7d6e-5f4a-3b2c-1a0b-9c8d7e6f5a4b", // No Show (placeholder - ajustar UUID real)
  "34995d75-933e-4d67-b7fc-19fcb8b81680", // Reunião 01 Realizada
  "062927f5-b7a3-496a-9d47-eb03b3d69b10", // Contrato Pago
  "r2-agendada-placeholder", // R2 Agendada
  "r2-realizada-placeholder", // R2 Realizada
  "3a2776e2-a536-4a2a-bb7b-a2f53c8941df", // Venda Realizada
];

interface FunilDuploProps {
  originId: string;
  weekStart?: Date;
  weekEnd?: Date;
  showCurrentState: boolean;
}

type PeriodType = "hoje" | "semana" | "mes";

export function FunilDuplo({ originId, weekStart, weekEnd, showCurrentState }: FunilDuploProps) {
  const { preferences, updatePreferences, isUpdating } = useDashboardPreferences();
  const [selectedStages, setSelectedStages] = useState<string[]>(DEFAULT_STAGES);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("semana");
  const queryClient = useQueryClient();

  // Carregar etapas salvas das preferências
  useEffect(() => {
    if (preferences?.funnel_stages?.length) {
      setSelectedStages(preferences.funnel_stages);
    }
  }, [preferences]);

  // Calcular datas baseado no período selecionado
  const { periodStart, periodEnd } = useMemo(() => {
    const referenceDate = weekStart || new Date();

    switch (selectedPeriod) {
      case "hoje":
        return {
          periodStart: startOfDay(new Date()),
          periodEnd: endOfDay(new Date()),
        };
      case "semana":
        return {
          periodStart: getCustomWeekStart(referenceDate),
          periodEnd: getCustomWeekEnd(referenceDate),
        };
      case "mes":
        return {
          periodStart: startOfMonth(referenceDate),
          periodEnd: endOfMonth(referenceDate),
        };
      default:
        return {
          periodStart: startOfDay(new Date()),
          periodEnd: endOfDay(new Date()),
        };
    }
  }, [selectedPeriod, weekStart]);

  // Função para extrair base_id (remove -offer-N e newsale- prefixos)
  const getBaseId = (hublaId: string): string => {
    return hublaId
      .replace(/^newsale-/, '')
      .replace(/-offer-\d+$/, '');
  };

   // ===== NOVO LEAD = Vendas A010 de Hubla (deduplicação por hubla_id) =====
  const { data: novoLeadCount = 0 } = useQuery({
    queryKey: ['a010-novo-lead', selectedPeriod, periodStart.toISOString(), periodEnd.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from('hubla_transactions')
        .select('hubla_id, customer_name, product_name, product_category')
        .eq('sale_status', 'completed')
        .gte('sale_date', periodStart.toISOString())
        .lte('sale_date', periodEnd.toISOString());

      if (!data) return 0;

      // Contar vendas A010 (deduplicação por hubla_id para chegar em 180)
      const seenIds = new Set<string>();
      const a010Sales = data.filter(tx => {
        const productName = (tx.product_name || '').toUpperCase();
        const isA010 = tx.product_category === 'a010' || productName.includes('A010');
        const hasValidName = tx.customer_name && tx.customer_name.trim() !== '';
        
        if (!isA010 || !hasValidName) return false;
        
        // Deduplicar por hubla_id exato
        if (seenIds.has(tx.hubla_id)) return false;
        seenIds.add(tx.hubla_id);
        
        return true;
      });

      return a010Sales.length;
    },
    refetchInterval: 30000,
  });

  // Realtime listener para hubla_transactions
  useEffect(() => {
    const channel = supabase
      .channel('funil-hubla-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hubla_transactions' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['a010-novo-lead'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { data: etapasLeadA = [], isLoading: isLoadingA } = useClintFunnelByLeadType(
    originId,
    "A",
    periodStart,
    periodEnd,
    false,
    selectedPeriod,
  );

  const { data: etapasLeadB = [], isLoading: isLoadingB } = useClintFunnelByLeadType(
    originId,
    "B",
    periodStart,
    periodEnd,
    false,
    selectedPeriod,
  );

  const isLoading = isLoadingA || isLoadingB;

  // Filtrar etapas (todas exceto placeholders inexistentes)
  const etapasLeadASemNovoLead = etapasLeadA.filter(e => e.stage_id !== "cf4a369c-c4a6-4299-933d-5ae3dcc39d4b");
  const etapasLeadBSemNovoLead = etapasLeadB.filter(e => e.stage_id !== "cf4a369c-c4a6-4299-933d-5ae3dcc39d4b");

  // Combinar todas as etapas únicas para o filtro
  const allStages = Array.from(
    new Set([
      ...etapasLeadASemNovoLead.map((e) => e.stage_id || e.etapa), 
      ...etapasLeadBSemNovoLead.map((e) => e.stage_id || e.etapa)
    ]),
  );

  // Mapear nomes das etapas
  const stageNames: Record<string, string> = {};
  [...etapasLeadASemNovoLead, ...etapasLeadBSemNovoLead].forEach((etapa) => {
    if (etapa.stage_id) {
      stageNames[etapa.stage_id] = etapa.etapa;
    }
  });

  // Calcular labels para o dropdown
  const getWeekLabel = () => {
    const referenceDate = weekStart || new Date();
    const weekNum = getCustomWeekNumber(referenceDate);
    const weekNumber = weekNum.split("-W")[1];
    const range = formatCustomWeekRange(referenceDate);
    return `Semana ${weekNumber} (${range})`;
  };

  const getMonthLabel = () => {
    const referenceDate = weekStart || new Date();
    return format(referenceDate, "MMMM yyyy", { locale: ptBR });
  };

  const handleToggleStage = (stageId: string) => {
    setSelectedStages((prev) => (prev.includes(stageId) ? prev.filter((id) => id !== stageId) : [...prev, stageId]));
  };

  const handleSaveStages = () => {
    updatePreferences({ funnel_stages: selectedStages } as any);
  };

  const visibleCount = selectedStages.length;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-foreground">Funil Pipeline Inside Sales</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={selectedPeriod} onValueChange={(value) => setSelectedPeriod(value as PeriodType)}>
              <SelectTrigger className="w-auto h-8 min-w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hoje">Hoje ({format(new Date(), "dd/MM/yyyy", { locale: ptBR })})</SelectItem>
                <SelectItem value="semana">{getWeekLabel()}</SelectItem>
                <SelectItem value="mes">{getMonthLabel()}</SelectItem>
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3">
                  <Filter className="h-4 w-4" />
                  Filtrar Etapas ({visibleCount}/{allStages.length})
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm">Selecionar Etapas</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {allStages.map((stageId) => (
                      <div key={stageId} className="flex items-center space-x-2">
                        <Checkbox
                          id={stageId}
                          checked={selectedStages.includes(stageId)}
                          onCheckedChange={() => handleToggleStage(stageId)}
                        />
                        <label
                          htmlFor={stageId}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {stageNames[stageId] || stageId}
                        </label>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 border-t">
                    <Button 
                      size="sm" 
                      onClick={handleSaveStages}
                      disabled={isUpdating}
                      className="w-full"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {isUpdating ? "Salvando..." : "Salvar Preferências"}
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Linha do Novo Lead (Vendas A010) acima da divisão */}
        <div className="mb-4 p-3 bg-muted/50 rounded-lg border border-border">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Novo Lead (Vendas A010)</span>
            <span className="text-lg font-bold text-foreground">{novoLeadCount}</span>
          </div>
        </div>

        {/* Divisão Lead A | Lead B com divisor central */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          <div className="pr-4 md:border-r border-border">
            <FunilLista
              titulo="Leads A"
              etapas={etapasLeadASemNovoLead}
              selectedStages={selectedStages}
              isLoading={isLoading}
              hideFilter
            />
          </div>
          <div className="pl-4 pt-4 md:pt-0">
            <FunilLista
              titulo="Leads B"
              etapas={etapasLeadBSemNovoLead}
              selectedStages={selectedStages}
              isLoading={isLoading}
              hideFilter
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}