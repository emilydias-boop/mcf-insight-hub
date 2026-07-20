import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { RefundDetails } from "@/hooks/useRefundDetailsInPeriod";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  data: RefundDetails | undefined;
  isLoading?: boolean;
  startDate: Date;
  endDate: Date;
}

const fmtCurrency = (v: number | null | undefined) =>
  typeof v === 'number' ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

const fmtDate = (iso: string) => {
  try { return format(new Date(iso), "dd/MM 'às' HH:mm", { locale: ptBR }); }
  catch { return iso; }
};

export function RefundDetailsDialog({ open, onOpenChange, data, isLoading, startDate, endDate }: Props) {
  const items = data?.items || [];
  const orphans = data?.orphans || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Reembolsos — A000 Contrato</DialogTitle>
          <DialogDescription>
            Período: {format(startDate, 'dd/MM/yyyy')} até {format(endDate, 'dd/MM/yyyy')} · {items.length} atribuídos · {orphans.length} órfãos
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-2">
          {/* Atribuídos */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold mb-2">Reembolsos atribuídos ({items.length})</h3>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum reembolso no período.</p>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-2 py-1.5">Data</th>
                      <th className="text-left px-2 py-1.5">Cliente</th>
                      <th className="text-left px-2 py-1.5">SDR</th>
                      <th className="text-left px-2 py-1.5">Closer</th>
                      <th className="text-left px-2 py-1.5">Origem</th>
                      <th className="text-right px-2 py-1.5">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((r, i) => (
                      <tr key={`${r.deal_id}-${i}`} className="border-t hover:bg-muted/30">
                        <td className="px-2 py-1.5 whitespace-nowrap">{fmtDate(r.refund_at)}</td>
                        <td className="px-2 py-1.5">
                          <div className="font-medium">{r.customer_name || '—'}</div>
                          {r.customer_email && (
                            <div className="text-[10px] text-muted-foreground">{r.customer_email}</div>
                          )}
                        </td>
                        <td className="px-2 py-1.5">{r.sdr_name || <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-2 py-1.5">{r.closer_name || <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-2 py-1.5">
                          <Badge variant={r.source === 'hubla' ? 'default' : 'secondary'} className="text-[10px]">
                            {r.source === 'hubla' ? 'Hubla' : 'MCF Pay'}
                          </Badge>
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono">{fmtCurrency(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Órfãos */}
          {orphans.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-semibold">Reembolsos órfãos — precisam verificação ({orphans.length})</h3>
              </div>
              <p className="text-[11px] text-muted-foreground mb-2">
                Estes reembolsos entraram no gateway mas não foram vinculados a nenhum lead/deal — não estão sendo contabilizados nas métricas por SDR/Closer.
              </p>
              <div className="rounded-md border overflow-hidden border-amber-200 bg-amber-50/40 dark:bg-amber-950/10">
                <table className="w-full text-xs">
                  <thead className="bg-amber-100/50 dark:bg-amber-900/20">
                    <tr>
                      <th className="text-left px-2 py-1.5">Data</th>
                      <th className="text-left px-2 py-1.5">Cliente</th>
                      <th className="text-left px-2 py-1.5">Contato</th>
                      <th className="text-left px-2 py-1.5">Origem</th>
                      <th className="text-left px-2 py-1.5">Motivo</th>
                      <th className="text-right px-2 py-1.5">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orphans.map((o, i) => (
                      <tr key={`orph-${i}`} className="border-t border-amber-200/60">
                        <td className="px-2 py-1.5 whitespace-nowrap">{fmtDate(o.refund_at)}</td>
                        <td className="px-2 py-1.5 font-medium">{o.customer_name || '—'}</td>
                        <td className="px-2 py-1.5">
                          {o.customer_email && <div className="text-[10px]">{o.customer_email}</div>}
                          {o.customer_phone && <div className="text-[10px] text-muted-foreground">{o.customer_phone}</div>}
                          {!o.customer_email && !o.customer_phone && <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-2 py-1.5">
                          <Badge variant="outline" className="text-[10px]">
                            {o.source === 'hubla' ? 'Hubla' : 'MCF Pay'}
                          </Badge>
                        </td>
                        <td className="px-2 py-1.5 text-[10px] text-muted-foreground">{o.reason}</td>
                        <td className="px-2 py-1.5 text-right font-mono">{fmtCurrency(o.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}