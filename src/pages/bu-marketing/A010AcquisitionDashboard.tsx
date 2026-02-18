import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useA010Acquisition } from "@/hooks/useA010Acquisition";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Users, ShoppingCart, DollarSign, TrendingUp, Lightbulb, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function A010AcquisitionDashboard() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const startDate = startOfMonth(new Date(month + "-01"));
  const endDate = endOfMonth(startDate);

  const { data, isLoading } = useA010Acquisition(startDate, endDate);

  const [filterChannel, setFilterChannel] = useState<string>("all");
  const [filterOffer, setFilterOffer] = useState<string>("all");
  const [filterOrigin, setFilterOrigin] = useState<string>("all");

  const channels = useMemo(() => [...new Set(data?.rows.map((r) => r.channel) || [])], [data]);
  const offers = useMemo(() => [...new Set(data?.rows.filter(r => filterChannel === "all" || r.channel === filterChannel).map((r) => r.offer) || [])], [data, filterChannel]);
  const origins = useMemo(() => [...new Set(data?.rows.filter(r => (filterChannel === "all" || r.channel === filterChannel) && (filterOffer === "all" || r.offer === filterOffer)).map((r) => r.origin) || [])], [data, filterChannel, filterOffer]);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    return data.rows.filter((r) => {
      if (filterChannel !== "all" && r.channel !== filterChannel) return false;
      if (filterOffer !== "all" && r.offer !== filterOffer) return false;
      if (filterOrigin !== "all" && r.origin !== filterOrigin) return false;
      return true;
    });
  }, [data, filterChannel, filterOffer, filterOrigin]);

  // Rankings
  const rankByDimension = (dim: "channel" | "offer" | "origin") => {
    if (!data) return [];
    const map = new Map<string, { leads: number; sales: number; revenue: number }>();
    data.rows.forEach((r) => {
      const key = r[dim];
      const existing = map.get(key);
      if (existing) {
        existing.leads += r.leads;
        existing.sales += r.sales;
        existing.revenue += r.revenue;
      } else {
        map.set(key, { leads: r.leads, sales: r.sales, revenue: r.revenue });
      }
    });
    return Array.from(map.entries())
      .map(([name, vals]) => ({ name, ...vals, ticketMedio: vals.sales > 0 ? vals.revenue / vals.sales : 0, conversionRate: vals.leads > 0 ? (vals.sales / vals.leads) * 100 : 0 }))
      .sort((a, b) => b.revenue - a.revenue);
  };

  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy", { locale: ptBR }) };
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/bu-marketing")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Aquisição A010</h1>
          <p className="text-muted-foreground text-sm">Análise de performance por canal, oferta e origem</p>
        </div>
        <div className="ml-auto">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {monthOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { title: "Total de Leads", value: data?.kpis.totalLeads ?? 0, icon: Users, fmt: (v: number) => v.toString() },
          { title: "Total de Vendas", value: data?.kpis.totalSales ?? 0, icon: ShoppingCart, fmt: (v: number) => v.toString() },
          { title: "Receita Total", value: data?.kpis.totalRevenue ?? 0, icon: DollarSign, fmt: formatCurrency },
          { title: "Ticket Médio", value: data?.kpis.ticketMedio ?? 0, icon: TrendingUp, fmt: formatCurrency },
        ].map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "..." : kpi.fmt(kpi.value)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Insight */}
      {data?.insight && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-start gap-3 pt-4">
            <Lightbulb className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <p className="text-sm">{data.insight}</p>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={filterChannel} onValueChange={(v) => { setFilterChannel(v); setFilterOffer("all"); setFilterOrigin("all"); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Canal" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Canais</SelectItem>
            {channels.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterOffer} onValueChange={(v) => { setFilterOffer(v); setFilterOrigin("all"); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Oferta" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Ofertas</SelectItem>
            {offers.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterOrigin} onValueChange={setFilterOrigin}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Origem" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Origens</SelectItem>
            {origins.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Main Table */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Visão Cruzada</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Canal</TableHead>
                <TableHead>Oferta</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Vendas</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Ticket Médio</TableHead>
                <TableHead className="text-right">% Conversão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filteredRows.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum dado encontrado</TableCell></TableRow>
              ) : (
                filteredRows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.channel}</TableCell>
                    <TableCell>{r.offer}</TableCell>
                    <TableCell>{r.origin}</TableCell>
                    <TableCell className="text-right">{r.leads}</TableCell>
                    <TableCell className="text-right">{r.sales}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.revenue)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.ticketMedio)}</TableCell>
                    <TableCell className="text-right">{r.conversionRate.toFixed(1)}%</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Rankings */}
      <Tabs defaultValue="channel">
        <TabsList>
          <TabsTrigger value="channel">Por Canal</TabsTrigger>
          <TabsTrigger value="offer">Por Oferta</TabsTrigger>
          <TabsTrigger value="origin">Por Origem</TabsTrigger>
        </TabsList>
        {(["channel", "offer", "origin"] as const).map((dim) => (
          <TabsContent key={dim} value={dim}>
            <Card>
              <CardContent className="pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{dim === "channel" ? "Canal" : dim === "offer" ? "Oferta" : "Origem"}</TableHead>
                      <TableHead className="text-right">Leads</TableHead>
                      <TableHead className="text-right">Vendas</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                      <TableHead className="text-right">Ticket Médio</TableHead>
                      <TableHead className="text-right">% Conversão</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankByDimension(dim).map((r) => (
                      <TableRow key={r.name}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-right">{r.leads}</TableCell>
                        <TableCell className="text-right">{r.sales}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.revenue)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.ticketMedio)}</TableCell>
                        <TableCell className="text-right">{r.conversionRate.toFixed(1)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
