import { useState } from "react";
import { Megaphone, DollarSign, Users, Target, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMarketingOverview } from "@/hooks/useMarketingMetrics";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function MarketingDashboard() {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const { data, isLoading } = useMarketingOverview(dateRange.from, dateRange.to);

  const kpis = [
    {
      title: "Gasto Total",
      value: data ? formatCurrency(data.totalSpend) : "-",
      icon: DollarSign,
      color: "text-red-500",
    },
    {
      title: "Total de Leads",
      value: data ? formatNumber(data.totalLeads) : "-",
      icon: Users,
      color: "text-blue-500",
    },
    {
      title: "CPL",
      value: data ? formatCurrency(data.cpl) : "-",
      icon: Target,
      color: "text-amber-500",
    },
    {
      title: "Receita Gerada",
      value: data ? formatCurrency(data.totalRevenue) : "-",
      icon: TrendingUp,
      color: "text-emerald-500",
    },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Megaphone className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Dashboard Marketing</h1>
            <p className="text-muted-foreground">Performance de anúncios e leads</p>
          </div>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              {format(dateRange.from, "dd/MM/yy", { locale: ptBR })} -{" "}
              {format(dateRange.to, "dd/MM/yy", { locale: ptBR })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
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

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardContent className="pt-6">
              {isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{kpi.title}</p>
                    <p className="text-2xl font-bold mt-1">{kpi.value}</p>
                  </div>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Spend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gasto Diário</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data?.dailySpend || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => format(new Date(v + "T12:00:00"), "dd/MM")}
                    className="text-xs"
                  />
                  <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} className="text-xs" />
                  <Tooltip
                    formatter={(v: number) => [formatCurrency(v), "Gasto"]}
                    labelFormatter={(l) => format(new Date(l + "T12:00:00"), "dd/MM/yyyy")}
                  />
                  <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Daily Leads */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leads por Dia</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data?.dailyLeads || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => format(new Date(v + "T12:00:00"), "dd/MM")}
                    className="text-xs"
                  />
                  <YAxis className="text-xs" />
                  <Tooltip
                    formatter={(v: number) => [v, "Leads"]}
                    labelFormatter={(l) => format(new Date(l + "T12:00:00"), "dd/MM/yyyy")}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
