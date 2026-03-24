import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerCustom } from '@/components/ui/DatePickerCustom';
import { useWebhookEndpoints } from '@/hooks/useWebhookEndpoints';
import { useWebhookIntakeAnalytics, WebhookLeadDetail } from '@/hooks/useWebhookIntakeAnalytics';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { FileText, Search, Users, UserCheck, TrendingUp, UserX, Download } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function WebhookIntakeAnalytics() {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');

  const { data: endpoints } = useWebhookEndpoints();
  const { data: analytics, isLoading } = useWebhookIntakeAnalytics(
    selectedSlug,
    dateRange?.from,
    dateRange?.to
  );

  const selectedEndpoint = endpoints?.find(e => e.slug === selectedSlug);

  const filteredLeads = useMemo(() => {
    if (!analytics?.leads) return [];
    let filtered = analytics.leads;

    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(l =>
        l.contact_name.toLowerCase().includes(s) ||
        l.contact_email.toLowerCase().includes(s) ||
        l.contact_phone.includes(s)
      );
    }
    if (stageFilter !== 'all') {
      filtered = filtered.filter(l => l.stage_name === stageFilter);
    }
    if (ownerFilter !== 'all') {
      filtered = filtered.filter(l => l.owner_name === ownerFilter);
    }
    return filtered;
  }, [analytics?.leads, search, stageFilter, ownerFilter]);

  const handleExportPDF = () => {
    if (!analytics || !selectedEndpoint) return;

    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const now = new Date();
    const dateStr = `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR')}`;
    let y = 20;

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório de Webhook - Análise de Leads', pageWidth / 2, y, { align: 'center' });
    y += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Gerado em: ${dateStr}`, pageWidth / 2, y, { align: 'center' });
    y += 15;

    // Section 1: Executive Summary
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Resumo Executivo', 14, y);
    y += 8;

    autoTable(doc, {
      startY: y,
      head: [['Parâmetro', 'Valor']],
      body: [
        ['Endpoint', selectedEndpoint.name],
        ['Slug', selectedEndpoint.slug],
        ['Período', dateRange?.from && dateRange?.to
          ? `${formatDate(dateRange.from)} a ${formatDate(dateRange.to)}`
          : 'Todo o período'],
        ['Total de Leads', String(analytics.kpis.total)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
      margin: { left: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 12;

    // Section 2: KPIs
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('2. Indicadores-Chave', 14, y);
    y += 8;

    const advancedRate = analytics.kpis.total > 0
      ? ((analytics.kpis.advanced / analytics.kpis.total) * 100).toFixed(1)
      : '0.0';

    autoTable(doc, {
      startY: y,
      head: [['Métrica', 'Valor', '% do Total']],
      body: [
        ['Total Recebidos', String(analytics.kpis.total), '100%'],
        ['Com Dono Atribuído', String(analytics.kpis.withOwner),
          `${analytics.kpis.total > 0 ? ((analytics.kpis.withOwner / analytics.kpis.total) * 100).toFixed(1) : 0}%`],
        ['Sem Dono', String(analytics.kpis.withoutOwner),
          `${analytics.kpis.total > 0 ? ((analytics.kpis.withoutOwner / analytics.kpis.total) * 100).toFixed(1) : 0}%`],
        ['Avançaram no Funil', String(analytics.kpis.advanced), `${advancedRate}%`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
      margin: { left: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 12;

    // Section 3: Stage Breakdown
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('3. Distribuição por Estágio', 14, y);
    y += 8;

    const stageRows = Object.values(analytics.kpis.byStage)
      .sort((a, b) => b.count - a.count)
      .map(s => [
        s.stageName,
        String(s.count),
        `${analytics.kpis.total > 0 ? ((s.count / analytics.kpis.total) * 100).toFixed(1) : 0}%`,
      ]);

    autoTable(doc, {
      startY: y,
      head: [['Estágio', 'Quantidade', '% do Total']],
      body: stageRows,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
      margin: { left: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 12;

    // Section 4: Lead List
    if (y > 160) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('4. Lista Completa de Leads', 14, y);
    y += 8;

    const leadRows = filteredLeads.map((l, i) => [
      String(i + 1),
      l.contact_name,
      l.contact_phone,
      l.contact_email,
      l.stage_name,
      l.owner_name,
      formatDate(l.created_at),
    ]);

    autoTable(doc, {
      startY: y,
      head: [['#', 'Nome', 'Telefone', 'Email', 'Estágio', 'Dono', 'Data Entrada']],
      body: leadRows,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      margin: { left: 14 },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 40 },
        2: { cellWidth: 35 },
        3: { cellWidth: 50 },
        4: { cellWidth: 40 },
        5: { cellWidth: 35 },
        6: { cellWidth: 25 },
      },
    });

    // Footer on all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Página ${i} de ${totalPages} | MCF Insight Hub`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    const filename = `webhook-${selectedEndpoint.slug}-${now.toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Análise de Leads por Webhook
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="min-w-[250px]">
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Endpoint</label>
              <Select
                value={selectedSlug || ''}
                onValueChange={(v) => setSelectedSlug(v || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um endpoint" />
                </SelectTrigger>
                <SelectContent>
                  {endpoints?.map(ep => (
                    <SelectItem key={ep.id} value={ep.slug}>
                      {ep.name} ({ep.leads_received} leads)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[280px]">
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Período</label>
              <DatePickerCustom
                mode="range"
                selected={dateRange}
                onSelect={(d) => setDateRange(d as DateRange)}
                placeholder="Todo o período"
              />
            </div>

            {analytics && analytics.kpis.total > 0 && (
              <Button onClick={handleExportPDF} variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Exportar PDF
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      {selectedSlug && analytics && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Users className="h-4 w-4" />
                  Total Recebidos
                </div>
                <p className="text-3xl font-bold mt-1">{analytics.kpis.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <UserCheck className="h-4 w-4" />
                  Com Dono
                </div>
                <p className="text-3xl font-bold mt-1">{analytics.kpis.withOwner}</p>
                <p className="text-xs text-muted-foreground">
                  {analytics.kpis.total > 0
                    ? `${((analytics.kpis.withOwner / analytics.kpis.total) * 100).toFixed(0)}%`
                    : '0%'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <UserX className="h-4 w-4" />
                  Sem Dono
                </div>
                <p className="text-3xl font-bold mt-1">{analytics.kpis.withoutOwner}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <TrendingUp className="h-4 w-4" />
                  Avançaram
                </div>
                <p className="text-3xl font-bold mt-1">{analytics.kpis.advanced}</p>
                <p className="text-xs text-muted-foreground">
                  {analytics.kpis.total > 0
                    ? `${((analytics.kpis.advanced / analytics.kpis.total) * 100).toFixed(0)}% do total`
                    : '0%'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Stage Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Distribuição por Estágio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.values(analytics.kpis.byStage)
                  .sort((a, b) => b.count - a.count)
                  .map(s => (
                    <Badge key={s.stageName} variant="secondary" className="text-sm py-1 px-3">
                      {s.stageName}: {s.count}
                    </Badge>
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* Filters + Table */}
          <Card>
            <CardHeader>
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar nome, email ou telefone..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={stageFilter} onValueChange={setStageFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Estágio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os estágios</SelectItem>
                    {analytics.stages.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Dono" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os donos</SelectItem>
                    {analytics.owners.map(o => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">
                  {filteredLeads.length} de {analytics.kpis.total}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-muted-foreground text-center py-8">Carregando...</p>
              ) : filteredLeads.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum lead encontrado</p>
              ) : (
                <div className="max-h-[500px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Estágio</TableHead>
                        <TableHead>Dono</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Entrada</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLeads.map(lead => (
                        <TableRow key={lead.deal_id}>
                          <TableCell className="font-medium">{lead.contact_name}</TableCell>
                          <TableCell className="text-sm">{lead.contact_phone}</TableCell>
                          <TableCell className="text-sm">{lead.contact_email}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {lead.stage_name}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{lead.owner_name}</TableCell>
                          <TableCell className="text-sm">{formatCurrency(lead.value)}</TableCell>
                          <TableCell className="text-sm">{formatDate(lead.created_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!selectedSlug && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Selecione um endpoint acima para visualizar a análise de leads
          </CardContent>
        </Card>
      )}
    </div>
  );
}
