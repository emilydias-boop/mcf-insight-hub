import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Loader2, Wrench, Users, BarChart3, Calendar } from "lucide-react";
import { formatDistanceToNow, format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useFailedWebhooksSummary, useReprocessFailedWebhooks, type ReprocessResult } from "@/hooks/useFailedWebhooks";
import { useFixReprocessedActivities, useRepairOrphanDealOwners, type FixActivitiesResult, type RepairOrphanResult } from "@/hooks/useFixReprocessedActivities";
import { useSyncAllSdrKpis } from "@/hooks/useSyncAllSdrKpis";
import { useKpiComparison } from "@/hooks/useKpiComparison";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function FailedWebhooksMonitor() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastResult, setLastResult] = useState<ReprocessResult | null>(null);
  const [lastFixResult, setLastFixResult] = useState<FixActivitiesResult | null>(null);
  const [lastRepairResult, setLastRepairResult] = useState<RepairOrphanResult | null>(null);
  const currentMonth = format(new Date(), 'yyyy-MM');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  
  // Generate last 3 months for selector
  const monthOptions = [0, 1, 2].map(i => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy', { locale: ptBR })
    };
  });
  
  const { data: summary, isLoading, refetch } = useFailedWebhooksSummary(90);
  const { data: kpiComparison, isLoading: isLoadingComparison } = useKpiComparison(selectedMonth);
  const reprocessMutation = useReprocessFailedWebhooks();
  const fixActivitiesMutation = useFixReprocessedActivities();
  const repairOrphanMutation = useRepairOrphanDealOwners();
  const syncAllKpisMutation = useSyncAllSdrKpis();
  const { toast } = useToast();

  const handleSyncAllKpis = () => {
    syncAllKpisMutation.mutate(selectedMonth, {
      onSuccess: (data) => {
        toast({
          title: `KPIs sincronizados`,
          description: `${data.success}/${data.total} SDRs atualizados`,
        });
      },
      onError: (error) => {
        toast({
          title: "Erro na sincronização",
          description: error.message,
          variant: "destructive",
        });
      }
    });
  };

  const handleReprocessAll = () => {
    reprocessMutation.mutate({ all: true, daysBack: 90 }, {
      onSuccess: (data) => {
        setLastResult(data);
        toast({
          title: `Reprocessamento concluído`,
          description: `${data.processed} processados, ${data.errors} erros de ${data.total} webhooks`,
        });
        refetch();
      },
      onError: (error) => {
        toast({
          title: "Erro no reprocessamento",
          description: error.message,
          variant: "destructive",
        });
      }
    });
  };

  const handleReprocessMonth = () => {
    reprocessMutation.mutate({ yearMonth: selectedMonth }, {
      onSuccess: (data) => {
        setLastResult(data);
        toast({
          title: `Reprocessamento de ${monthOptions.find(m => m.value === selectedMonth)?.label} concluído`,
          description: `${data.processed} processados, ${data.errors} erros de ${data.total} webhooks`,
        });
        refetch();
      },
      onError: (error) => {
        toast({
          title: "Erro no reprocessamento",
          description: error.message,
          variant: "destructive",
        });
      }
    });
  };

  const handleFixActivities = () => {
    fixActivitiesMutation.mutate({ dryRun: false }, {
      onSuccess: (data) => {
        setLastFixResult(data);
        toast({
          title: `Correção concluída`,
          description: `${data.fixed} atividades corrigidas, ${data.skipped} puladas`,
        });
      },
      onError: (error) => {
        toast({
          title: "Erro na correção",
          description: error.message,
          variant: "destructive",
        });
      }
    });
  };

  const handleRepairOrphans = () => {
    repairOrphanMutation.mutate({ dryRun: false }, {
      onSuccess: (data) => {
        setLastRepairResult(data);
        toast({
          title: `Reparação concluída`,
          description: `${data.deals_fixed} deals e ${data.activities_fixed} atividades reparadas`,
        });
        refetch();
      },
      onError: (error) => {
        toast({
          title: "Erro na reparação",
          description: error.message,
          variant: "destructive",
        });
      }
    });
  };

  if (isLoading) {
    return (
      <Card className="border-destructive/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Webhooks Falhados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!summary || summary.total === 0) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-green-600">
            <RefreshCw className="h-4 w-4" />
            Webhooks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nenhum webhook falhado nos últimos 30 dias ✓
          </p>
        </CardContent>
      </Card>
    );
  }

  // Get top 5 SDRs with most failures
  const topSdrs = Object.entries(summary.bySdr)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Get top 3 error types
  const topErrors = Object.entries(summary.byError)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <Card className="border-destructive/30">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Webhooks Falhados
              <Badge variant="destructive" className="ml-2">
                {summary.total}
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    disabled={reprocessMutation.isPending}
                    className="gap-1"
                  >
                    {reprocessMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    Reprocessar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reprocessar webhooks falhados?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso irá tentar reprocessar até 50 webhooks que falharam nos últimos 30 dias.
                      <br /><br />
                      <strong>{summary.total} webhooks</strong> serão reprocessados.
                      <br /><br />
                      Deals e atividades serão criados automaticamente se não existirem.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleReprocessAll}>
                      Confirmar Reprocessamento
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
          <CardDescription>
            Webhooks que falharam nos últimos 90 dias
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0">
          {/* Month selector and reprocess by month */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[180px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Selecionar mês" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              size="sm" 
              variant="default"
              className="bg-orange-600 hover:bg-orange-700 gap-1"
              onClick={handleReprocessMonth}
              disabled={reprocessMutation.isPending}
            >
              {reprocessMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Reprocessar Mês
            </Button>
          </div>

          {/* Summary row - always visible */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-2 border rounded-lg text-center">
              <p className="text-xs text-muted-foreground">Stage Changed</p>
              <p className="text-lg font-bold text-destructive">
                {summary.byType['deal.stage_changed'] || 0}
              </p>
            </div>
            <div className="p-2 border rounded-lg text-center">
              <p className="text-xs text-muted-foreground">Deal Created</p>
              <p className="text-lg font-bold text-destructive">
                {summary.byType['deal.created'] || 0}
              </p>
            </div>
            <div className="p-2 border rounded-lg text-center">
              <p className="text-xs text-muted-foreground">Outros</p>
              <p className="text-lg font-bold text-destructive">
                {summary.total - (summary.byType['deal.stage_changed'] || 0) - (summary.byType['deal.created'] || 0)}
              </p>
            </div>
          </div>

          <CollapsibleContent className="mt-4 space-y-4">
            {/* KPI Comparison Section */}
            {kpiComparison && kpiComparison.total_diferenca !== 0 && (
              <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Métricas Desatualizadas
                    <Badge variant="destructive">
                      {kpiComparison.total_diferenca > 0 ? '+' : ''}{kpiComparison.total_diferenca}
                    </Badge>
                  </h4>
                  <Button 
                    size="sm" 
                    variant="default"
                    className="bg-yellow-600 hover:bg-yellow-700 gap-1"
                    onClick={handleSyncAllKpis}
                    disabled={syncAllKpisMutation.isPending}
                  >
                    {syncAllKpisMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    Resincronizar Todos os KPIs
                  </Button>
                </div>
                
                <div className="max-h-48 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">SDR</TableHead>
                        <TableHead className="text-xs text-center">KPI Atual</TableHead>
                        <TableHead className="text-xs text-center">Atividades</TableHead>
                        <TableHead className="text-xs text-center">Diferença</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {kpiComparison.items
                        .filter(item => item.diferenca !== 0)
                        .map((item) => (
                          <TableRow key={item.sdr_id}>
                            <TableCell className="text-xs py-1">{item.sdr_name}</TableCell>
                            <TableCell className="text-xs text-center py-1">{item.kpi_atual}</TableCell>
                            <TableCell className="text-xs text-center py-1">{item.atividades_reais}</TableCell>
                            <TableCell className="text-xs text-center py-1">
                              <span className={item.diferenca > 0 ? 'text-green-600' : 'text-red-600'}>
                                {item.diferenca > 0 ? '+' : ''}{item.diferenca}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell className="text-xs py-1">TOTAL</TableCell>
                        <TableCell className="text-xs text-center py-1">{kpiComparison.total_kpi}</TableCell>
                        <TableCell className="text-xs text-center py-1">{kpiComparison.total_atividades}</TableCell>
                        <TableCell className="text-xs text-center py-1">
                          <span className={kpiComparison.total_diferenca > 0 ? 'text-green-600' : 'text-red-600'}>
                            {kpiComparison.total_diferenca > 0 ? '+' : ''}{kpiComparison.total_diferenca}
                          </span>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Sync result */}
            {syncAllKpisMutation.isSuccess && (
              <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                <h4 className="text-sm font-medium mb-2 text-green-700">✓ Sincronização concluída</h4>
                <p className="text-xs text-muted-foreground">
                  {syncAllKpisMutation.data?.success}/{syncAllKpisMutation.data?.total} SDRs atualizados
                </p>
              </div>
            )}

            {/* Fix orphan activities buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button 
                size="sm" 
                variant="secondary" 
                disabled={fixActivitiesMutation.isPending}
                onClick={handleFixActivities}
                className="gap-1"
              >
                {fixActivitiesMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Wrench className="h-3 w-3" />
                )}
                Corrigir Atividades Órfãs
              </Button>
              <Button 
                size="sm" 
                variant="secondary" 
                disabled={repairOrphanMutation.isPending}
                onClick={handleRepairOrphans}
                className="gap-1"
              >
                {repairOrphanMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Users className="h-3 w-3" />
                )}
                Reparar Deals Órfãos
              </Button>
              <span className="text-xs text-muted-foreground">
                Busca owner nos webhooks originais
              </span>
            </div>

            {/* Last repair result */}
            {lastRepairResult && (
              <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/30">
                <h4 className="text-sm font-medium mb-2">Última reparação de órfãos</h4>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="text-center">
                    <p className="text-muted-foreground text-xs">Deals</p>
                    <p className="font-semibold text-purple-600">{lastRepairResult.deals_fixed}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground text-xs">Atividades</p>
                    <p className="font-semibold text-purple-600">{lastRepairResult.activities_fixed}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground text-xs">Não encontrados</p>
                    <p className="font-semibold text-muted-foreground">{lastRepairResult.not_found}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Last fix result */}
            {lastFixResult && (
              <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                <h4 className="text-sm font-medium mb-2">Última correção</h4>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="text-center">
                    <p className="text-muted-foreground text-xs">Corrigidas</p>
                    <p className="font-semibold text-blue-600">{lastFixResult.fixed}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground text-xs">Puladas</p>
                    <p className="font-semibold">{lastFixResult.skipped}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground text-xs">Erros</p>
                    <p className="font-semibold text-destructive">{lastFixResult.errors}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Last reprocess result */}
            {lastResult && (
              <div className="p-3 bg-muted rounded-lg border">
                <h4 className="text-sm font-medium mb-2">Último reprocessamento</h4>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="text-center">
                    <p className="text-muted-foreground text-xs">Total</p>
                    <p className="font-semibold">{lastResult.total}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground text-xs">Sucesso</p>
                    <p className="font-semibold text-green-600">{lastResult.processed}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground text-xs">Erros</p>
                    <p className="font-semibold text-destructive">{lastResult.errors}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Top SDRs with failures */}
            {topSdrs.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Por SDR (top 5)</h4>
                <div className="space-y-1">
                  {topSdrs.map(([email, count]) => (
                    <div key={email} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                      <span className="truncate max-w-[200px]">{email}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top errors */}
            {topErrors.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Erros mais comuns</h4>
                <div className="space-y-1">
                  {topErrors.map(([error, count]) => (
                    <div key={error} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                      <span className="truncate max-w-[200px] text-muted-foreground">{error}</span>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Oldest failure */}
            {summary.oldestDate && (
              <p className="text-xs text-muted-foreground">
                Webhook mais antigo: {formatDistanceToNow(new Date(summary.oldestDate), { 
                  addSuffix: true, 
                  locale: ptBR 
                })}
              </p>
            )}
          </CollapsibleContent>
        </CardContent>
      </Collapsible>
    </Card>
  );
}
