import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, CheckCircle2, TrendingUp } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { usePostSaleFunnel, PostSaleStatus, PostSaleLead } from '@/hooks/usePostSaleFunnel';
import { LeadCarrinhoCompleto } from '@/hooks/useCarrinhoAnalysisReport';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface PostSaleFunnelPanelProps {
  leads: LeadCarrinhoCompleto[];
  periodLabel: string;
}

export function PostSaleFunnelPanel({ leads, periodLabel }: PostSaleFunnelPanelProps) {
  const { slices, getSubSlices, statusConfig } = usePostSaleFunnel(leads);
  const [selectedSlice, setSelectedSlice] = useState<PostSaleStatus | null>(null);
  const [selectedSubStatus, setSelectedSubStatus] = useState<string | null>(null);

  const subSlices = useMemo(() => {
    if (!selectedSlice) return [];
    return getSubSlices(selectedSlice);
  }, [selectedSlice, getSubSlices]);

  const detailLeads = useMemo((): PostSaleLead[] => {
    if (!selectedSlice) return [];
    const slice = slices.find(s => s.status === selectedSlice);
    if (!slice) return [];
    if (selectedSubStatus) {
      return slice.leads.filter(l => (l.subStatus || 'Sem detalhe') === selectedSubStatus);
    }
    return slice.leads;
  }, [selectedSlice, selectedSubStatus, slices]);

  const total = leads.length;
  const agendados = slices.filter(s => ['agendado', 'r2_realizada', 'no_show', 'desistiu_apos_r2', 'aprovado'].includes(s.status)).reduce((s, sl) => s + sl.count, 0);
  const aprovados = slices.find(s => s.status === 'aprovado')?.count || 0;

  const handlePieClick = (data: any) => {
    if (data?.status) {
      setSelectedSlice(data.status);
      setSelectedSubStatus(null);
    }
  };

  const handleBack = () => {
    if (selectedSubStatus) {
      setSelectedSubStatus(null);
    } else {
      setSelectedSlice(null);
    }
  };

  const pieData = slices.map(s => ({
    name: s.label,
    value: s.count,
    status: s.status,
    color: s.color,
  }));

  const subPieData = subSlices.map((s, i) => ({
    name: s.subStatus,
    value: s.count,
    color: `hsl(${(i * 40 + 180) % 360}, 60%, 50%)`,
  }));

  const renderCustomLabel = ({ name, value, percent }: any) => {
    if (percent < 0.05) return null;
    return `${value} (${(percent * 100).toFixed(0)}%)`;
  };

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold">{total}</p>
            <p className="text-xs text-muted-foreground">Contratos Pagos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <TrendingUp className="h-5 w-5 mx-auto mb-1 text-blue-500" />
            <p className="text-2xl font-bold text-blue-600">{total > 0 ? `${((agendados / total) * 100).toFixed(0)}%` : '0%'}</p>
            <p className="text-xs text-muted-foreground">Agendados+</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-green-500" />
            <p className="text-2xl font-bold text-green-600">{total > 0 ? `${((aprovados / total) * 100).toFixed(0)}%` : '0%'}</p>
            <p className="text-xs text-muted-foreground">Aprovados</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Main Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {!selectedSlice ? 'Distribuição Pós-Venda' : (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleBack}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  {statusConfig[selectedSlice].label}
                  {selectedSubStatus && ` → ${selectedSubStatus}`}
                </div>
              )}
            </CardTitle>
            <CardDescription>{periodLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            {total === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum contrato no período</div>
            ) : !selectedSlice ? (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={110}
                    dataKey="value"
                    label={renderCustomLabel}
                    onClick={handlePieClick}
                    className="cursor-pointer"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="hsl(var(--background))" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any, name: any) => [`${value} contratos`, name]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={subPieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={110}
                    dataKey="value"
                    label={renderCustomLabel}
                    onClick={(data: any) => data?.name && setSelectedSubStatus(data.name)}
                    className="cursor-pointer"
                  >
                    {subPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="hsl(var(--background))" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any, name: any) => [`${value} contratos`, name]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Summary table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {!selectedSlice ? 'Resumo por Status' : 'Detalhamento'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedSlice ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slices.map(s => (
                    <TableRow
                      key={s.status}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => { setSelectedSlice(s.status); setSelectedSubStatus(null); }}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                          <span className="font-medium text-sm">{s.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">{s.count}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{s.pct.toFixed(0)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sub-status</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subSlices.map(s => (
                    <TableRow
                      key={s.subStatus}
                      className={cn('cursor-pointer hover:bg-muted/50', selectedSubStatus === s.subStatus && 'bg-muted')}
                      onClick={() => setSelectedSubStatus(s.subStatus)}
                    >
                      <TableCell className="font-medium text-sm">{s.subStatus}</TableCell>
                      <TableCell className="text-right font-medium">{s.count}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{s.pct.toFixed(0)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail leads table */}
      {selectedSlice && detailLeads.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Leads — {statusConfig[selectedSlice].label}
              {selectedSubStatus && ` → ${selectedSubStatus}`}
              <Badge variant="secondary" className="ml-2">{detailLeads.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead>R2</TableHead>
                    <TableHead>Closer R2</TableHead>
                    <TableHead>Status R2</TableHead>
                    <TableHead>Parceria</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailLeads.slice(0, 100).map((l, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium max-w-[140px] truncate">{l.nome}</TableCell>
                      <TableCell className="text-xs">{l.telefone}</TableCell>
                      <TableCell className="text-xs">{format(new Date(l.dataContrato), 'dd/MM/yy')}</TableCell>
                      <TableCell>
                        {l.r2Realizada ? (
                          <Badge className="bg-green-100 text-green-800 text-[10px]">Realizada</Badge>
                        ) : l.r2Agendada ? (
                          <Badge className="bg-amber-100 text-amber-800 text-[10px]">Agendada</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{l.closerR2 || '—'}</TableCell>
                      <TableCell className="text-xs">{l.statusR2 || '—'}</TableCell>
                      <TableCell>
                        {l.comprouParceria ? (
                          <Badge className="bg-green-100 text-green-800 text-[10px]">Sim</Badge>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {detailLeads.length > 100 && (
                <p className="text-sm text-muted-foreground text-center mt-2">Mostrando 100 de {detailLeads.length}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
