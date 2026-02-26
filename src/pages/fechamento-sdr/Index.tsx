import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SdrStatusBadge } from "@/components/sdr-fechamento/SdrStatusBadge";
import { useSdrPayouts } from "@/hooks/useSdrFechamento";
import { formatCurrency } from "@/lib/formatters";
import { TeamGoalsSummary } from "@/components/fechamento/TeamGoalsSummary";
import { useActiveBU } from "@/hooks/useActiveBU";
import {
  Calculator,
  Download,
  Eye,
  RefreshCw,
  AlertTriangle,
  DollarSign,
  Wallet,
  CreditCard,
  UtensilsCrossed,
  Search,
  Users,
  Settings,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const FechamentoSDRList = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentMonth = format(new Date(), "yyyy-MM");
  const [selectedMonth, setSelectedMonth] = useState(searchParams.get('month') || currentMonth);
  const activeBU = useActiveBU();

  // Filter states
  const [roleFilter, setRoleFilter] = useState<"sdr" | "closer" | "all">("all");
  const [squadFilter, setSquadFilter] = useState<string>(activeBU || "all");
  const [searchTerm, setSearchTerm] = useState("");

  // Update squad filter when user's BU loads
  useEffect(() => {
    if (activeBU && squadFilter === "all") {
      setSquadFilter(activeBU);
    }
  }, [activeBU]);


  const { data: payouts, isLoading } = useSdrPayouts(selectedMonth, {
    roleType: roleFilter,
    squad: squadFilter,
    search: searchTerm,
  });
  // Mutation to call edge function for recalculation with correct iFood from calendar
  const recalculateViaEdge = useMutation({
    mutationFn: async (anoMes: string) => {
      const { data, error } = await supabase.functions.invoke("recalculate-sdr-payout", {
        body: { ano_mes: anoMes },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["sdr-payouts", selectedMonth] });
      toast.success(`Fechamentos recalculados: ${data.processed || 0} SDRs processados`);
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  // Fetch comp_plans for all SDRs to get OTE
  // Note: status uses SdrStatus type = 'PENDING' | 'APPROVED' | 'REJECTED'
  // We include PENDING and APPROVED plans, exclude REJECTED
  const { data: compPlans } = useQuery({
    queryKey: ["sdr-comp-plans", selectedMonth],
    queryFn: async () => {
      const [year, month] = selectedMonth.split("-").map(Number);
      const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;

      const { data, error } = await supabase
        .from("sdr_comp_plan")
        .select("*")
        .lte("vigencia_inicio", monthStart)
        .or(`vigencia_fim.is.null,vigencia_fim.gte.${monthStart}`)
        .neq("status", "REJECTED");

      if (error) throw error;
      return data;
    },
  });

  // Generate months from January 2025 to current month
  const generateMonthOptions = () => {
    const options = [];
    const startDate = new Date(2025, 0, 1); // January 2025
    const endDate = new Date();

    let current = endDate;
    while (current >= startDate) {
      options.push({
        value: format(current, "yyyy-MM"),
        label: format(current, "MMMM yyyy", { locale: ptBR }),
      });
      current = subMonths(current, 1);
    }
    return options;
  };

  const monthOptions = generateMonthOptions();

  const getCompPlanForSdr = (sdrId: string) => {
    return compPlans?.find((cp) => cp.sdr_id === sdrId);
  };

  // Calculate financial summary
  const financialSummary = payouts?.reduce(
    (acc, p) => ({
      totalFixo: acc.totalFixo + (p.valor_fixo || 0),
      totalVariavel: acc.totalVariavel + (p.valor_variavel_total || 0),
      totalConta: acc.totalConta + (p.total_conta || 0),
      totalIfood: acc.totalIfood + (p.total_ifood || 0),
    }),
    { totalFixo: 0, totalVariavel: 0, totalConta: 0, totalIfood: 0 },
  );

  const escapeCSV = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const getRoleLabel = (roleType: string | null | undefined) => {
    switch (roleType) {
      case "closer":
        return "Closer";
      case "sdr":
        return "SDR";
      default:
        return "SDR";
    }
  };

  const getSquadLabel = (squad: string | null | undefined) => {
    switch (squad) {
      case "incorporador":
        return "Incorporador";
      case "consorcio":
        return "Consórcio";
      case "credito":
        return "Crédito";
      case "projetos":
        return "Projetos";
      default:
        return squad || "-";
    }
  };

  // Extract BU from frozen departamento_vigente, fallback to employee.departamento or sdr.squad
  const getBuFromPayout = (payout: NonNullable<typeof payouts>[0]) => {
    const employee = (payout as any).employee;
    const sdrData = payout.sdr as any;
    const frozenDept = (payout as any).departamento_vigente;

    // Priority 1: Use frozen department from payout (departamento_vigente)
    if (frozenDept) {
      return {
        label: frozenDept.replace("BU - ", "").replace(" 50K", ""),
        isFromHR: true,
        hasWarning: false,
      };
    }

    // Priority 2: Use current HR department
    if (employee?.departamento) {
      return {
        label: employee.departamento.replace("BU - ", "").replace(" 50K", ""),
        isFromHR: true,
        hasWarning: false,
      };
    }

    // Priority 3: Fallback to sdr.squad (orphan)
    if (sdrData?.squad) {
      return {
        label: getSquadLabel(sdrData.squad),
        isFromHR: false,
        hasWarning: true, // Show warning for orphan SDRs
      };
    }

    return { label: "-", isFromHR: false, hasWarning: false };
  };

  const handleExportCSV = () => {
    if (!payouts || payouts.length === 0) return;

    const headers = [
      "Nome",
      "Cargo",
      "BU",
      "Nível",
      "OTE",
      "% Agendamento",
      "% Reuniões Realizadas",
      "% Tentativas",
      "% Organização",
      "Valor Fixo",
      "Valor Variável",
      "Valor Agendamento",
      "Valor Reuniões Realizadas",
      "Valor Tentativas",
      "Valor Organização",
      "Total Conta",
      "iFood Mensal",
      "iFood Ultrameta",
      "iFood Ultrameta Autorizado",
      "Total iFood",
      "Status",
    ];

    const rows = payouts.map((p) => {
      const compPlan = getCompPlanForSdr(p.sdr_id);
      const sdrData = p.sdr as any;
      const employee = (p as any).employee;

      // Use HR data as source of truth for export too
      const nivel = employee?.cargo_catalogo?.nivel || p.sdr?.nivel || 1;
      const ote = compPlan?.ote_total || employee?.cargo_catalogo?.ote_total || 4000;

      return [
        escapeCSV(p.sdr?.name || ""),
        escapeCSV(getRoleLabel(sdrData?.role_type)),
        escapeCSV(getSquadLabel(sdrData?.squad)),
        escapeCSV(nivel),
        escapeCSV(ote),
        escapeCSV((p.pct_reunioes_agendadas || 0).toFixed(1)),
        escapeCSV((p.pct_reunioes_realizadas || 0).toFixed(1)),
        escapeCSV((p.pct_tentativas || 0).toFixed(1)),
        escapeCSV((p.pct_organizacao || 0).toFixed(1)),
        escapeCSV(p.valor_fixo || 0),
        escapeCSV(p.valor_variavel_total || 0),
        escapeCSV(p.valor_reunioes_agendadas || 0),
        escapeCSV(p.valor_reunioes_realizadas || 0),
        escapeCSV(p.valor_tentativas || 0),
        escapeCSV(p.valor_organizacao || 0),
        escapeCSV(p.total_conta || 0),
        escapeCSV(p.ifood_mensal || 0),
        escapeCSV(p.ifood_ultrameta || 0),
        escapeCSV(p.ifood_ultrameta_autorizado ? "Sim" : "Não"),
        escapeCSV(p.total_ifood || 0),
        escapeCSV(p.status),
      ];
    });

    const csvContent = [headers.join(";"), ...rows.map((row) => row.join(";"))].join("\n");

    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `fechamento-sdr-${selectedMonth}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Fechamento Equipe</h1>
            <p className="text-muted-foreground">Gerencie o fechamento mensal dos SDRs e Closers</p>
          </div>

          <div className="flex items-center gap-3">
            <Select value={selectedMonth} onValueChange={(month) => {
              setSelectedMonth(month);
              setSearchParams({ month });
            }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() => recalculateViaEdge.mutate(selectedMonth)}
              disabled={recalculateViaEdge.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${recalculateViaEdge.isPending ? "animate-spin" : ""}`} />
              Recalcular Todos
            </Button>

            <Button variant="outline" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>

            <Button variant="outline" onClick={() => navigate("/fechamento-sdr/configuracoes")}>
              <Settings className="h-4 w-4 mr-2" />
              Configurações
            </Button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as "sdr" | "closer" | "all")}>
            <SelectTrigger className="w-[140px]">
              <Users className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Cargo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="sdr">SDR</SelectItem>
              <SelectItem value="closer">Closer</SelectItem>
            </SelectContent>
          </Select>

          <Select value={squadFilter} onValueChange={setSquadFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="BU" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas BUs</SelectItem>
              <SelectItem value="incorporador">Incorporador</SelectItem>
              <SelectItem value="consorcio">Consórcio</SelectItem>
              <SelectItem value="credito">Crédito</SelectItem>
              <SelectItem value="projetos">Projetos</SelectItem>
            </SelectContent>
          </Select>

          {(searchTerm || roleFilter !== "all" || squadFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setRoleFilter("all");
                setSquadFilter("all");
              }}
            >
              Limpar filtros
            </Button>
          )}

          {payouts && (
            <Badge variant="secondary" className="ml-auto">
              {payouts.length} resultado(s)
            </Badge>
          )}
        </div>
      </div>

      {/* Team Goals Summary */}
      {squadFilter !== 'all' && (
        <TeamGoalsSummary 
          anoMes={selectedMonth} 
          bu={squadFilter} 
        />
      )}

      {/* Financial Summary Cards */}
      {payouts && payouts.length > 0 && financialSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <DollarSign className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Fixo</p>
                  <p className="text-lg font-bold">{formatCurrency(financialSummary.totalFixo)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Wallet className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Variável</p>
                  <p className="text-lg font-bold">{formatCurrency(financialSummary.totalVariavel)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <CreditCard className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Conta</p>
                  <p className="text-lg font-bold">{formatCurrency(financialSummary.totalConta)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <UtensilsCrossed className="h-5 w-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total iFood</p>
                  <p className="text-lg font-bold">{formatCurrency(financialSummary.totalIfood)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Fechamentos de {monthOptions.find((o) => o.value === selectedMonth)?.label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !payouts || payouts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhum fechamento encontrado para este mês.</p>
              <Button
                className="mt-4"
                onClick={() => recalculateViaEdge.mutate(selectedMonth)}
                disabled={recalculateViaEdge.isPending}
              >
                <Calculator className="h-4 w-4 mr-2" />
                Gerar Fechamentos
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-center">Cargo</TableHead>
                  <TableHead className="text-center">BU</TableHead>
                  <TableHead className="text-center">Nível</TableHead>
                  <TableHead className="text-right">OTE</TableHead>
                  <TableHead className="text-right">Variável</TableHead>
                  <TableHead className="text-right">Total Conta</TableHead>
                  <TableHead className="text-right">iFood</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((payout) => {
                  const compPlan = getCompPlanForSdr(payout.sdr_id);
                  const employee = (payout as any).employee;

                  // Priority: 1) RH cargo_catalogo.nivel, 2) legacy sdr.nivel, 3) fallback 1
                  const nivel = employee?.cargo_catalogo?.nivel || payout.sdr?.nivel || 1;

                  // Priority: 1) compPlan vigente, 2) RH cargo_catalogo.ote_total, 3) fallback 4000
                  const ote = compPlan?.ote_total || employee?.cargo_catalogo?.ote_total || 4000;

                  const sdrData = payout.sdr as any;

                  return (
                    <TableRow key={payout.id}>
                      <TableCell className="font-medium">
                        {payout.sdr?.name || "SDR"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={sdrData?.role_type === "closer" ? "secondary" : "outline"}
                          className="font-normal"
                        >
                          {getRoleLabel(sdrData?.role_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          const buInfo = getBuFromPayout(payout);
                          return (
                            <div
                              className="flex items-center justify-center gap-1"
                              title={buInfo.hasWarning ? "SDR sem vínculo RH" : undefined}
                            >
                              <span
                                className={`text-sm ${buInfo.isFromHR ? "text-foreground" : "text-muted-foreground"}`}
                              >
                                {buInfo.label}
                              </span>
                              {buInfo.hasWarning && <AlertTriangle className="h-3 w-3 text-yellow-500" />}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-mono">
                          N{nivel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(ote)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(payout.valor_variavel_total || 0)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(payout.total_conta || 0)}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(payout.total_ifood || 0)}</TableCell>
                      <TableCell className="text-center">
                        <SdrStatusBadge status={payout.status} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/fechamento-sdr/${payout.id}?from=${selectedMonth}`)}>
                          <Eye className="h-4 w-4 mr-1" />
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FechamentoSDRList;
