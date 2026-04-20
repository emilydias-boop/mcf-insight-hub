import { useMemo, useState } from 'react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Filter, Info, RefreshCw, X } from 'lucide-react';
import { DateRange } from 'react-day-picker';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import {
  TagFilterPopover,
  type TagFilterRule,
  type TagOperator,
} from '@/components/crm/TagFilterPopover';
import { StageMovementsSummaryTable } from '@/components/crm/StageMovementsSummaryTable';
import { StageMovementsDetailTable } from '@/components/crm/StageMovementsDetailTable';
import { DealDetailsDrawer } from '@/components/crm/DealDetailsDrawer';

import { useStageMovements } from '@/hooks/useStageMovements';
import { useUniqueDealTags } from '@/hooks/useUniqueDealTags';
import { useActiveBU } from '@/hooks/useActiveBU';
import { useBUOriginIds } from '@/hooks/useBUPipelineMap';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function MovimentacoesEstagio() {
  const activeBU = useActiveBU();
  const { data: buOriginIds } = useBUOriginIds(activeBU);

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(subDays(new Date(), 30)),
    to: endOfDay(new Date()),
  });
  const [selectedOriginIds, setSelectedOriginIds] = useState<string[]>([]);
  const [tagFilters, setTagFilters] = useState<TagFilterRule[]>([]);
  const [tagOperator, setTagOperator] = useState<TagOperator>('and');
  const [selectedStageNameKey, setSelectedStageNameKey] = useState<string | null>(null);
  const [drawerDealId, setDrawerDealId] = useState<string | null>(null);

  // Origens disponíveis (filtradas pela BU ativa, se houver)
  const { data: origins = [] } = useQuery({
    queryKey: ['crm-origins-for-movements', buOriginIds],
    queryFn: async () => {
      let q = supabase
        .from('crm_origins')
        .select('id, name')
        .order('name');
      if (buOriginIds && buOriginIds.length > 0) {
        q = q.in('id', buOriginIds);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Tags disponíveis (escopo: origem selecionada ou BU)
  const tagsScopeOriginId =
    selectedOriginIds.length === 1 ? selectedOriginIds[0] : undefined;
  const { data: availableTags = [], isLoading: tagsLoading } = useUniqueDealTags({
    originId: tagsScopeOriginId,
  });

  // originIds para a query
  const queryOriginIds = useMemo(() => {
    if (selectedOriginIds.length > 0) return selectedOriginIds;
    if (buOriginIds && buOriginIds.length > 0) return buOriginIds;
    return null;
  }, [selectedOriginIds, buOriginIds]);

  const { data, isLoading, isFetching, refetch } = useStageMovements({
    originIds: queryOriginIds,
    startDate: dateRange?.from || subDays(new Date(), 30),
    endDate: dateRange?.to || new Date(),
    tagFilters,
    tagOperator,
    enabled: !!dateRange?.from && !!dateRange?.to,
  });

  const summary = data?.summary || [];
  const allRows = data?.rows || [];
  const detailRows = useMemo(
    () =>
      selectedStageNameKey
        ? allRows.filter((r) => r.toStageNameKey === selectedStageNameKey)
        : allRows,
    [allRows, selectedStageNameKey],
  );

  const handleClear = () => {
    setDateRange({
      from: startOfDay(subDays(new Date(), 30)),
      to: endOfDay(new Date()),
    });
    setSelectedOriginIds([]);
    setTagFilters([]);
    setTagOperator('and');
    setSelectedStageNameKey(null);
  };

  const dateLabel = dateRange?.from
    ? dateRange.to
      ? `${format(dateRange.from, 'dd/MM/yy', { locale: ptBR })} → ${format(
          dateRange.to,
          'dd/MM/yy',
          { locale: ptBR },
        )}`
      : format(dateRange.from, 'dd/MM/yy', { locale: ptBR })
    : 'Selecionar período';

  return (
    <TooltipProvider>
      <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-7xl">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Movimentações por Estágio
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Quais leads passaram por cada estágio no período — independente da
              data de criação.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw
              className={cn('h-4 w-4 mr-1', isFetching && 'animate-spin')}
            />
            Atualizar
          </Button>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-2">
              {/* Período */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateLabel}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                    locale={ptBR}
                    className={cn('p-3 pointer-events-auto')}
                  />
                </PopoverContent>
              </Popover>

              {/* Pipelines (multi-select) */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start font-normal">
                    <Filter className="mr-2 h-4 w-4" />
                    {selectedOriginIds.length === 0
                      ? 'Todas as pipelines'
                      : `${selectedOriginIds.length} pipeline${selectedOriginIds.length > 1 ? 's' : ''}`}
                    {selectedOriginIds.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {selectedOriginIds.length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <div className="p-2 border-b flex items-center justify-between">
                    <span className="text-xs font-medium">Selecione as pipelines</span>
                    {selectedOriginIds.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => setSelectedOriginIds([])}
                      >
                        Limpar
                      </Button>
                    )}
                  </div>
                  <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
                    {origins.map((o) => {
                      const checked = selectedOriginIds.includes(o.id);
                      return (
                        <label
                          key={o.id}
                          className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer text-sm"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              setSelectedOriginIds((prev) =>
                                v
                                  ? [...prev, o.id]
                                  : prev.filter((x) => x !== o.id),
                              );
                            }}
                          />
                          <span className="flex-1">{o.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Tags */}
              <TagFilterPopover
                availableTags={availableTags}
                tagFilters={tagFilters}
                tagOperator={tagOperator}
                onChangeFilters={(f, op) => {
                  setTagFilters(f);
                  setTagOperator(op);
                }}
                isLoading={tagsLoading}
              />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">
                    O filtro de tags considera as <strong>tags atuais</strong> do
                    lead, mesmo que tenham sido aplicadas após a movimentação.
                  </p>
                </TooltipContent>
              </Tooltip>

              <div className="ml-auto flex items-center gap-2">
                {(selectedStageNameKey ||
                  tagFilters.length > 0 ||
                  selectedOriginIds.length > 0) && (
                  <Button variant="ghost" size="sm" onClick={handleClear}>
                    <X className="h-4 w-4 mr-1" />
                    Limpar
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resumo por estágio */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Resumo por estágio
              {selectedStageNameKey && (
                <span className="text-xs font-normal text-muted-foreground ml-2">
                  (clique novamente para limpar)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StageMovementsSummaryTable
              rows={summary}
              selectedStageNameKey={selectedStageNameKey}
              onSelectStage={setSelectedStageNameKey}
              isLoading={isLoading}
              totalUniqueLeads={data?.totalUniqueLeads ?? 0}
            />
          </CardContent>
        </Card>

        {/* Detalhe */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Detalhe das movimentações
              {selectedStageNameKey && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  · filtrado por{' '}
                  {summary.find((s) => s.stageNameKey === selectedStageNameKey)?.stageName}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StageMovementsDetailTable
              rows={detailRows}
              onOpenDeal={setDrawerDealId}
              isLoading={isLoading}
            />
          </CardContent>
        </Card>

        <DealDetailsDrawer
          dealId={drawerDealId}
          open={!!drawerDealId}
          onOpenChange={(o) => !o && setDrawerDealId(null)}
        />
      </div>
    </TooltipProvider>
  );
}