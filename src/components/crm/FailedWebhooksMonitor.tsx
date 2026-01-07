import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { useFailedWebhooksSummary, useReprocessFailedWebhooks } from "@/hooks/useFailedWebhooks";
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

export function FailedWebhooksMonitor() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data: summary, isLoading } = useFailedWebhooksSummary(30);
  const reprocessMutation = useReprocessFailedWebhooks();

  const handleReprocessAll = () => {
    reprocessMutation.mutate({ all: true, daysBack: 30 });
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
            Webhooks que falharam nos últimos 30 dias
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0">
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
