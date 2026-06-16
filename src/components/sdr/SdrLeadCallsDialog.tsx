import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Phone } from "lucide-react";
import { useSdrCallsByLead, exportLeadBreakdownToCsv } from "@/hooks/useSdrCallsByLead";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sdrUserId: string | null;
  sdrName: string;
  startDate: Date;
  endDate: Date;
  squad?: string;
}

function fmtDate(d: string | null) {
  if (!d) return '-';
  try { return format(new Date(d), 'dd/MM/yy HH:mm', { locale: ptBR }); } catch { return '-'; }
}

function fmtDur(s: number) {
  if (!s) return '0s';
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m${r.toString().padStart(2, '0')}s` : `${r}s`;
}

export function SdrLeadCallsDialog({ open, onOpenChange, sdrUserId, sdrName, startDate, endDate, squad }: Props) {
  const { data: rows, isLoading } = useSdrCallsByLead(sdrUserId, startDate, endDate, squad, open);

  const totals = (rows || []).reduce(
    (acc, r) => {
      acc.attempts += r.totalAttempts;
      acc.notAnswered += r.notAnswered;
      acc.ringDrop += r.ringDrop;
      acc.voicemail += r.voicemail;
      acc.effective += r.effective;
      acc.qualified += r.qualified;
      return acc;
    },
    { attempts: 0, notAnswered: 0, ringDrop: 0, voicemail: 0, effective: 0, qualified: 0 },
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Ligações por lead — {sdrName}
          </DialogTitle>
          <DialogDescription>
            {fmtDate(startDate.toISOString())} → {fmtDate(endDate.toISOString())} •{' '}
            {rows ? `${rows.length} leads únicos / ${totals.attempts} tentativas` : '...'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-end gap-2 pb-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!rows || rows.length === 0}
            onClick={() => rows && exportLeadBreakdownToCsv(rows, sdrName, startDate, endDate)}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : !rows || rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma ligação no período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead className="text-center">Tentativas</TableHead>
                  <TableHead className="text-center">Não atend.</TableHead>
                  <TableHead className="text-center">Ring drop</TableHead>
                  <TableHead className="text-center">C. postal</TableHead>
                  <TableHead className="text-center">Efetivas</TableHead>
                  <TableHead className="text-center">Qualific.</TableHead>
                  <TableHead className="text-center">Tempo total</TableHead>
                  <TableHead className="text-center">Última</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, idx) => (
                  <TableRow key={`${r.phoneNormalized || 'np'}-${idx}`}>
                    <TableCell className="font-medium max-w-[220px] truncate">
                      {r.leadName || <span className="text-muted-foreground italic">(sem nome)</span>}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.phone}</TableCell>
                    <TableCell className="text-center font-semibold">{r.totalAttempts}</TableCell>
                    <TableCell className="text-center text-muted-foreground">{r.notAnswered}</TableCell>
                    <TableCell className="text-center text-amber-600">{r.ringDrop}</TableCell>
                    <TableCell className="text-center text-amber-700">{r.voicemail}</TableCell>
                    <TableCell className="text-center text-blue-600">{r.effective}</TableCell>
                    <TableCell className="text-center text-green-600 font-semibold">{r.qualified}</TableCell>
                    <TableCell className="text-center text-xs">{fmtDur(r.totalDurationSeconds)}</TableCell>
                    <TableCell className="text-center text-xs">{fmtDate(r.lastCallAt)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell colSpan={2}>Total ({rows.length} leads)</TableCell>
                  <TableCell className="text-center">{totals.attempts}</TableCell>
                  <TableCell className="text-center text-muted-foreground">{totals.notAnswered}</TableCell>
                  <TableCell className="text-center text-amber-600">{totals.ringDrop}</TableCell>
                  <TableCell className="text-center text-amber-700">{totals.voicemail}</TableCell>
                  <TableCell className="text-center text-blue-600">{totals.effective}</TableCell>
                  <TableCell className="text-center text-green-600">{totals.qualified}</TableCell>
                  <TableCell />
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}