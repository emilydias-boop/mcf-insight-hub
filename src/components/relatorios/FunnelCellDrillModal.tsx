import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, ExternalLink, Search } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/formatters';
import type { FunnelDetailItem, FunnelMetricKey } from '@/hooks/useChannelFunnelReport';
import { FUNNEL_METRICS_CONFIG } from './funnelMetricsConfig';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metric: FunnelMetricKey | null;
  channel: string | null;       // 'A010' | 'ANAMNESE' | 'OUTROS' | 'TOTAL'
  channelLabel: string | null;  // texto exibido
  items: FunnelDetailItem[];
  totalDisplay: string;         // "94 deals" ou "R$ 133.792,78"
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  try { return format(new Date(iso), 'dd/MM/yyyy HH:mm'); } catch { return iso; }
}

function exportCsv(items: FunnelDetailItem[], filename: string, isVendaShape: boolean) {
  const header = isVendaShape
    ? ['Email', 'Telefone', 'Produto', 'Bruto', 'Líquido', 'Data', 'Canal']
    : ['Nome', 'Email', 'Telefone', 'Status', 'Data', 'Canal'];
  const rows = items.map(it => isVendaShape
    ? [it.email || '', it.phone || '', it.product || '', String(it.bruto ?? ''), String(it.liquido ?? ''), it.date || '', it.channel]
    : [it.name || '', it.email || '', it.phone || '', it.status || '', it.date || '', it.channel]
  );
  const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function FunnelCellDrillModal({ open, onOpenChange, metric, channel, channelLabel, items, totalDisplay }: Props) {
  const [search, setSearch] = useState('');
  const config = metric ? FUNNEL_METRICS_CONFIG[metric] : null;
  const isVenda = !!config?.isVendaShape;

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(it =>
      (it.name || '').toLowerCase().includes(q) ||
      (it.email || '').toLowerCase().includes(q) ||
      (it.phone || '').toLowerCase().includes(q) ||
      (it.product || '').toLowerCase().includes(q) ||
      (it.status || '').toLowerCase().includes(q)
    );
  }, [items, search]);

  if (!config || !metric) return null;

  const filename = `funil-${metric}-${channel || 'total'}-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {config.label}
            <Badge variant="outline">{channelLabel || 'Total'}</Badge>
            <span className="text-muted-foreground font-normal text-sm">— {totalDisplay}</span>
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            {config.rule}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome, email, telefone, produto, status…"
              className="pl-8"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => exportCsv(filtered, filename, isVenda)}>
            <Download className="h-4 w-4 mr-1" />
            Exportar CSV
          </Button>
        </div>

        <div className="overflow-auto border rounded-md flex-1 mt-2">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {search ? 'Nenhum item corresponde à busca.' : 'Nenhum item compõe esta contagem.'}
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  {isVenda ? (
                    <>
                      <TableHead>Email</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Bruto</TableHead>
                      <TableHead className="text-right">Líquido</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Canal</TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Canal</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((it, i) => (
                  <TableRow key={`${it.id}-${i}`}>
                    {isVenda ? (
                      <>
                        <TableCell className="font-mono text-xs">{it.email || '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{it.phone || '—'}</TableCell>
                        <TableCell className="text-xs">{it.product || '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">{it.bruto != null ? formatCurrency(it.bruto) : '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">{it.liquido != null ? formatCurrency(it.liquido) : '—'}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{formatDate(it.date)}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{it.channel}</Badge></TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="text-sm">{it.name || '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{it.email || '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{it.phone || '—'}</TableCell>
                        <TableCell className="text-xs">{it.status || '—'}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{formatDate(it.date)}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{it.channel}</Badge></TableCell>
                        <TableCell>
                          {it.dealId && (
                            <a
                              href={`/crm/leads/${it.dealId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground"
                              title="Abrir no CRM"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="text-xs text-muted-foreground mt-2">
          Mostrando {filtered.length} de {items.length} itens
        </div>
      </DialogContent>
    </Dialog>
  );
}