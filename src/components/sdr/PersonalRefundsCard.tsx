import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { RotateCcw, AlertTriangle } from "lucide-react";
import { useRefundDetailsInPeriod, type RefundDetails } from "@/hooks/useRefundDetailsInPeriod";
import { RefundDetailsDialog } from "./RefundDetailsDialog";

interface Props {
  startDate: Date;
  endDate: Date;
  /** Filtrar por email do SDR (booked_by) */
  sdrEmail?: string;
  /** Filtrar por nome do Closer (case-insensitive) */
  closerName?: string;
}

const fmtCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function PersonalRefundsCard({ startDate, endDate, sdrEmail, closerName }: Props) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useRefundDetailsInPeriod(startDate, endDate);

  const filtered = useMemo<RefundDetails>(() => {
    const items = (data?.items || []).filter((r) => {
      if (sdrEmail && (r.sdr_email || "").toLowerCase() !== sdrEmail.toLowerCase()) return false;
      if (closerName && (r.closer_name || "").toLowerCase() !== closerName.toLowerCase()) return false;
      return true;
    });
    // Órfãos só aparecem no card da equipe/liderança — não são atribuídos a ninguém.
    return { items, orphans: [] };
  }, [data, sdrEmail, closerName]);

  const count = filtered.items.length;
  const total = filtered.items.reduce((s, r) => s + (r.amount || 0), 0);

  return (
    <>
      <Card
        className="cursor-pointer hover:border-primary/40 transition-colors"
        onClick={() => count > 0 && setOpen(true)}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <RotateCcw className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Reembolsos A000</span>
            </div>
            {count > 0 && <AlertTriangle className="h-4 w-4 text-amber-500" />}
          </div>
          <div className="text-2xl font-bold">{isLoading ? "…" : count}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {isLoading ? "carregando" : fmtCurrency(total)}
          </div>
          {count > 0 && (
            <div className="text-[10px] text-primary mt-2">Clique para ver detalhes</div>
          )}
        </CardContent>
      </Card>

      <RefundDetailsDialog
        open={open}
        onOpenChange={setOpen}
        data={filtered}
        isLoading={isLoading}
        startDate={startDate}
        endDate={endDate}
      />
    </>
  );
}