import { useState, useMemo } from "react";
import { Megaphone, Search, Users, DollarSign, Target, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCampaignBreakdown, useUtmSources } from "@/hooks/useMarketingMetrics";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { KPICard } from "@/components/ui/KPICard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const cleanUtmValue = (val: string | null | undefined) =>
  val?.replace(/\|[\d]+$/, "") || val;

interface DimensionRow {
  name: string;
  leads: number;
  revenue: number;
  ticketMedio: number;
  percentLeads: number;
}

function aggregateByDimension(
  campaigns: { utm_source: string | null; utm_campaign: string | null; utm_medium: string | null; utm_content: string | null; leads: number; revenue: number }[],
  dimension: "utm_source" | "utm_campaign" | "utm_medium" | "utm_content"
): DimensionRow[] {
  const map = new Map<string, { leads: number; revenue: number }>();
  let totalLeads = 0;

  campaigns.forEach((c) => {
    const raw = c[dimension];
    const name = cleanUtmValue(raw) || "Sem dados";
    const existing = map.get(name);
    totalLeads += c.leads;
    if (existing) {
      existing.leads += c.leads;
      existing.revenue += c.revenue;
    } else {
      map.set(name, { leads: c.leads, revenue: c.revenue });
    }
  });

  return Array.from(map.entries())
    .map(([name, { leads, revenue }]) => ({
      name,
      leads,
      revenue,
      ticketMedio: leads > 0 ? revenue / leads : 0,
      percentLeads: totalLeads > 0 ? (leads / totalLeads) * 100 : 0,
    }))
    .sort((a, b) => b.leads - a.leads);
}

function DimensionTable({ rows, isLoading }: { rows: DimensionRow[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">#</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead className="text-right">Leads</TableHead>
            <TableHead className="text-right">Receita</TableHead>
            <TableHead className="text-right">Ticket Médio</TableHead>
            <TableHead className="text-right">% Leads</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={r.name}>
              <TableCell className="text-muted-foreground font-medium">{i + 1}</TableCell>
              <TableCell className="font-medium max-w-[400px] truncate">{r.name}</TableCell>
              <TableCell className="text-right font-medium">{formatNumber(r.leads)}</TableCell>
              <TableCell className="text-right">{formatCurrency(r.revenue)}</TableCell>
              <TableCell className="text-right">{formatCurrency(r.ticketMedio)}</TableCell>
              <TableCell className="text-right">
                <Badge variant="secondary" className="text-xs">
                  {r.percentLeads.toFixed(1)}%
                </Badge>
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Nenhum dado encontrado no período
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export default function CampanhasDashboard() {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [sourceFilter, setSourceFilter] = useState<string>("");

  const { data: campaigns, isLoading } = useCampaignBreakdown(
    dateRange.from,
    dateRange.to,
    sourceFilter || undefined
  );
  const { data: sources } = useUtmSources(dateRange.from, dateRange.to);

  const totals = useMemo(() => {
    if (!campaigns) return { leads: 0, revenue: 0, ticket: 0, activeCampaigns: 0 };
    const leads = campaigns.reduce((s, c) => s + c.leads, 0);
    const revenue = campaigns.reduce((s, c) => s + c.revenue, 0);
    const activeCampaigns = new Set(campaigns.map((c) => c.utm_campaign).filter(Boolean)).size;
    return { leads, revenue, ticket: leads > 0 ? revenue / leads : 0, activeCampaigns };
  }, [campaigns]);

  const byChannel = useMemo(() => aggregateByDimension(campaigns || [], "utm_source"), [campaigns]);
  const byCampaign = useMemo(() => aggregateByDimension(campaigns || [], "utm_campaign"), [campaigns]);
  const byAdSet = useMemo(() => aggregateByDimension(campaigns || [], "utm_medium"), [campaigns]);
  const byAd = useMemo(() => aggregateByDimension(campaigns || [], "utm_content"), [campaigns]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Megaphone className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Campanhas</h1>
          <p className="text-muted-foreground">
            Análise por campanha, adset e fonte
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <label className="text-sm font-medium">Período</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    {format(dateRange.from, "dd/MM/yy", { locale: ptBR })} -{" "}
                    {format(dateRange.to, "dd/MM/yy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range) => {
                      if (range?.from && range?.to) {
                        setDateRange({ from: range.from, to: range.to });
                      }
                    }}
                    locale={ptBR}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Fonte</label>
              <Select value={sourceFilter || "all"} onValueChange={(val) => setSourceFilter(val === "all" ? "" : val)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {(sources || []).map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Total de Leads" value={formatNumber(totals.leads)} icon={Users} variant="neutral" compact />
        <KPICard title="Receita Total" value={formatCurrency(totals.revenue)} icon={DollarSign} variant="success" compact />
        <KPICard title="Ticket Médio" value={formatCurrency(totals.ticket)} icon={Target} variant="neutral" compact />
        <KPICard title="Campanhas Ativas" value={formatNumber(totals.activeCampaigns)} icon={BarChart3} variant="neutral" compact />
      </div>

      {/* Tabs por dimensão */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rankings por Dimensão</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="channel">
            <TabsList className="mb-4">
              <TabsTrigger value="channel">Por Canal</TabsTrigger>
              <TabsTrigger value="campaign">Por Campanha</TabsTrigger>
              <TabsTrigger value="adset">Por Bloco do Anúncio</TabsTrigger>
              <TabsTrigger value="ad">Por Anúncio</TabsTrigger>
            </TabsList>
            <TabsContent value="channel">
              <DimensionTable rows={byChannel} isLoading={isLoading} />
            </TabsContent>
            <TabsContent value="campaign">
              <DimensionTable rows={byCampaign} isLoading={isLoading} />
            </TabsContent>
            <TabsContent value="adset">
              <DimensionTable rows={byAdSet} isLoading={isLoading} />
            </TabsContent>
            <TabsContent value="ad">
              <DimensionTable rows={byAd} isLoading={isLoading} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Tabela detalhada */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ranking Detalhado</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Bloco do Anúncio</TableHead>
                    <TableHead>Anúncio</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(campaigns || []).map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium max-w-[300px] truncate">
                        {cleanUtmValue(c.utm_campaign) || "Sem campanha"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {cleanUtmValue(c.utm_medium) || "—"}
                      </TableCell>
                      <TableCell className="max-w-[250px] truncate">
                        {cleanUtmValue(c.utm_content) || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {c.utm_source || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatNumber(c.leads)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(c.revenue)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!campaigns || campaigns.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        Nenhuma campanha encontrada no período
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
