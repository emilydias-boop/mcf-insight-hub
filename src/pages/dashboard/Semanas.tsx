import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Calendar, 
  Check, 
  X, 
  Clock, 
  RefreshCw, 
  Eye,
  ChevronDown,
  Filter,
  ArrowLeft
} from "lucide-react";
import { PendingMetricsAlert } from "@/components/dashboard/PendingMetricsAlert";
import { MetricsApprovalDialog } from "@/components/dashboard/MetricsApprovalDialog";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useWeeklyMetricsList } from "@/hooks/useWeeklyMetricsList";
import { usePendingMetrics } from "@/hooks/usePendingMetrics";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { WeeklyMetricsDetailDrawer } from "@/components/dashboard/WeeklyMetricsDetailDrawer";

export default function Semanas() {
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  
  const { data: weeks, isLoading, refetch } = useWeeklyMetricsList({ 
    limit: 52, 
    status: statusFilter 
  });
  
  const { recalculateWeek, isRecalculating, canManageMetrics } = usePendingMetrics();

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'approved':
        return <Badge variant="default" className="bg-green-600"><Check className="h-3 w-3 mr-1" /> Aprovada</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><X className="h-3 w-3 mr-1" /> Rejeitada</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="bg-amber-500/20 text-amber-600"><Clock className="h-3 w-3 mr-1" /> Pendente</Badge>;
      default:
        return <Badge variant="outline">—</Badge>;
    }
  };

  const formatWeekLabel = (startDate: string, endDate: string, weekLabel?: string) => {
    if (weekLabel) return weekLabel;
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    return `${format(start, "dd/MM", { locale: ptBR })} - ${format(end, "dd/MM/yyyy", { locale: ptBR })}`;
  };

  const handleRecalculate = (week: typeof weeks[0]) => {
    if (!canManageMetrics) return;
    recalculateWeek({
      metricId: week.id,
      startDate: week.start_date,
      endDate: week.end_date,
    });
  };

  const selectedWeekData = weeks?.find(w => w.id === selectedWeek);

  if (!canManageMetrics) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">
              Você não tem permissão para acessar esta página.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Alertas de métricas pendentes */}
      <PendingMetricsAlert onReviewClick={() => setApprovalDialogOpen(true)} />
      <MetricsApprovalDialog 
        open={approvalDialogOpen} 
        onOpenChange={setApprovalDialogOpen} 
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calendar className="h-6 w-6 text-primary" />
              Histórico de Semanas
            </h1>
            <p className="text-muted-foreground">
              Gerencie e audite as métricas semanais do dashboard
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="approved">Aprovadas</SelectItem>
              <SelectItem value="rejected">Rejeitadas</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{weeks?.length || 0}</div>
            <p className="text-sm text-muted-foreground">Total de semanas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-amber-500">
              {weeks?.filter(w => w.approval_status === 'pending').length || 0}
            </div>
            <p className="text-sm text-muted-foreground">Pendentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-500">
              {weeks?.filter(w => w.approval_status === 'approved').length || 0}
            </div>
            <p className="text-sm text-muted-foreground">Aprovadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-500">
              {weeks?.filter(w => w.approval_status === 'rejected').length || 0}
            </div>
            <p className="text-sm text-muted-foreground">Rejeitadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Semanas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Semana</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Faturamento</TableHead>
                  <TableHead className="text-right">Incorporador 50k</TableHead>
                  <TableHead className="text-right">Ads</TableHead>
                  <TableHead className="text-right">Lucro</TableHead>
                  <TableHead className="text-right">ROI</TableHead>
                  <TableHead className="text-right">ROAS</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {weeks?.map((week) => (
                  <TableRow key={week.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      {formatWeekLabel(week.start_date, week.end_date, week.week_label)}
                    </TableCell>
                    <TableCell>{getStatusBadge(week.approval_status)}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(week.faturamento_total || week.total_revenue || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(week.incorporador_50k || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(week.ads_cost || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={(week.operating_profit || 0) >= 0 ? 'text-green-500' : 'text-red-500'}>
                        {formatCurrency(week.operating_profit || 0)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPercent((week.roi || 0) / 100)}
                    </TableCell>
                    <TableCell className="text-right">
                      {(week.roas || 0).toFixed(2)}x
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedWeek(week.id)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleRecalculate(week)}
                            disabled={isRecalculating}
                          >
                            <RefreshCw className={`h-4 w-4 mr-2 ${isRecalculating ? 'animate-spin' : ''}`} />
                            Recalcular
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                
                {weeks?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Nenhuma semana encontrada com os filtros selecionados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Drawer */}
      <WeeklyMetricsDetailDrawer
        open={!!selectedWeek}
        onOpenChange={(open) => !open && setSelectedWeek(null)}
        weekData={selectedWeekData || null}
        onRecalculate={() => selectedWeekData && handleRecalculate(selectedWeekData)}
        isRecalculating={isRecalculating}
      />
    </div>
  );
}
