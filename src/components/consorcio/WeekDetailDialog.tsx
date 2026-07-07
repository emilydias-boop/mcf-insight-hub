import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trophy } from "lucide-react";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  weekIndex: number;
  start: Date;
  end: Date;
  metaSemana: number;
}

interface Row {
  id: string;
  valor: number;
  data: Date;
  dealName: string | null;
  closerId: string | null;
  closerName: string;
}

export function WeekDetailDialog({ open, onOpenChange, weekIndex, start, end, metaSemana }: Props) {
  const { data, isLoading } = useQuery({
    enabled: open,
    queryKey: ["consorcio-week-detail", start.toISOString(), end.toISOString()],
    queryFn: async () => {
      // Buscar propostas cobrindo o intervalo (usando created_at como janela ampla)
      const { data: proposals, error } = await supabase
        .from("consorcio_proposals")
        .select("id, deal_id, created_by, valor_credito, proposal_date, created_at")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString());
      if (error) throw error;
      const list = (proposals || []).filter((p) => {
        const raw = (p.proposal_date as string | null) || p.created_at;
        if (!raw) return false;
        const d = typeof raw === "string" && raw.length === 10 ? parseISO(raw) : new Date(raw);
        return !isNaN(d.getTime()) && isWithinInterval(d, { start, end });
      });
      if (list.length === 0) return { rows: [] as Row[] };

      // Closers ativos
      const { data: closers } = await supabase
        .from("closers")
        .select("id, name, email")
        .eq("is_active", true);
      const emailToCloser = new Map<string, { id: string; name: string }>();
      (closers || []).forEach((c) => {
        if (c.email) emailToCloser.set(c.email.toLowerCase(), { id: c.id, name: c.name });
      });

      // created_by → profile → closer
      const creatorIds = [...new Set(list.map((p) => p.created_by).filter(Boolean) as string[])];
      const profileToCloser = new Map<string, { id: string; name: string }>();
      if (creatorIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, email")
          .in("id", creatorIds);
        (profs || []).forEach((p) => {
          if (p.email) {
            const c = emailToCloser.get(p.email.toLowerCase());
            if (c) profileToCloser.set(p.id, c);
          }
        });
      }

      // deal owner fallback + nome do deal
      const dealIds = [...new Set(list.map((p) => p.deal_id).filter(Boolean) as string[])];
      const dealMap = new Map<string, { name: string | null; ownerEmail: string | null }>();
      if (dealIds.length > 0) {
        const { data: deals } = await supabase
          .from("crm_deals")
          .select("id, name, owner_id")
          .in("id", dealIds);
        (deals || []).forEach((d) => {
          dealMap.set(d.id, { name: d.name || null, ownerEmail: d.owner_id || null });
        });
      }

      const rows: Row[] = list.map((p) => {
        const raw = (p.proposal_date as string | null) || p.created_at;
        const d = typeof raw === "string" && raw.length === 10 ? parseISO(raw) : new Date(raw);
        let closerId: string | null = null;
        let closerName = "Sem closer";
        if (p.created_by && profileToCloser.has(p.created_by)) {
          const c = profileToCloser.get(p.created_by)!;
          closerId = c.id;
          closerName = c.name;
        } else if (p.deal_id && dealMap.has(p.deal_id)) {
          const oe = dealMap.get(p.deal_id)!.ownerEmail;
          if (oe) {
            const c = emailToCloser.get(oe.toLowerCase());
            if (c) {
              closerId = c.id;
              closerName = c.name;
            }
          }
        }
        return {
          id: p.id,
          valor: Number(p.valor_credito || 0),
          data: d,
          dealName: p.deal_id ? dealMap.get(p.deal_id)?.name ?? null : null,
          closerId,
          closerName,
        };
      });

      return { rows };
    },
  });

  const rows = data?.rows || [];
  const total = rows.reduce((a, r) => a + r.valor, 0);

  // Agrupar por closer
  const groups = new Map<string, { name: string; total: number; items: Row[] }>();
  rows.forEach((r) => {
    const key = r.closerId || "sem-closer";
    if (!groups.has(key)) groups.set(key, { name: r.closerName, total: 0, items: [] });
    const g = groups.get(key)!;
    g.total += r.valor;
    g.items.push(r);
  });
  const grouped = Array.from(groups.values()).sort((a, b) => b.total - a.total);

  const bateu = metaSemana > 0 && total >= metaSemana;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Semana {weekIndex} — Detalhamento
            {bateu && <Trophy className="h-4 w-4 text-success" />}
          </DialogTitle>
          <DialogDescription>
            {format(start, "dd 'de' MMM", { locale: ptBR })} → {format(end, "dd 'de' MMM", { locale: ptBR })}
            {" · "}
            Meta {fmtBRL(metaSemana)} · Realizado <span className="font-semibold text-foreground">{fmtBRL(total)}</span>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-3">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma proposta lançada nesta semana.
            </p>
          ) : (
            <div className="space-y-5">
              {grouped.map((g, idx) => (
                <div key={idx} className="border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between bg-muted/40 px-3 py-2">
                    <div className="text-sm font-semibold">{g.name}</div>
                    <div className="text-sm font-mono font-semibold">
                      {fmtBRL(g.total)}{" "}
                      <span className="text-xs text-muted-foreground font-normal">
                        ({g.items.length} {g.items.length === 1 ? "venda" : "vendas"})
                      </span>
                    </div>
                  </div>
                  <div className="divide-y">
                    {g.items
                      .sort((a, b) => a.data.getTime() - b.data.getTime())
                      .map((r) => (
                        <div key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">
                              {r.dealName || <span className="text-muted-foreground italic">Sem nome</span>}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(r.data, "dd/MM/yyyy", { locale: ptBR })}
                            </div>
                          </div>
                          <div className="font-mono font-semibold ml-4 whitespace-nowrap">
                            {r.valor > 0 ? fmtBRL(r.valor) : <span className="text-muted-foreground">—</span>}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}