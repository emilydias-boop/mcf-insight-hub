import { useState } from "react";
import { Megaphone, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

            {campaigns && (
              <Badge variant="secondary" className="h-9 px-4">
                {formatNumber(campaigns.length)} campanhas •{" "}
                {formatNumber(campaigns.reduce((s, c) => s + c.leads, 0))} leads
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ranking de Campanhas</CardTitle>
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
                    <TableHead>Conjunto / Adset</TableHead>
                    <TableHead>Fonte</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(campaigns || []).map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium max-w-[300px] truncate">
                        {c.utm_campaign || "Sem campanha"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {c.utm_medium || "—"}
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
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
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
