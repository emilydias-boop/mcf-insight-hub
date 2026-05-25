import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CreditCard, FileText, FileUp, FileX, Pencil, Plus, RefreshCw,
  CircleDollarSign, CalendarClock, Wallet, Trash2, ShieldCheck,
} from "lucide-react";
import { useConsortiumCardHistory, type CardActivityLog, type CardActivityCategory } from "@/hooks/useConsortiumCardHistory";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props { cardId: string }

const CATEGORIES: { value: CardActivityCategory | "all"; label: string }[] = [
  { value: "all", label: "Tudo" },
  { value: "parcela", label: "Parcelas" },
  { value: "boleto", label: "Boletos" },
  { value: "documento", label: "Documentos" },
  { value: "carta", label: "Carta" },
];

function iconFor(event: CardActivityLog["event_type"]) {
  switch (event) {
    case "installment_paid": return <CircleDollarSign className="h-4 w-4" />;
    case "installment_reverted": return <RefreshCw className="h-4 w-4" />;
    case "installment_value_changed": return <Wallet className="h-4 w-4" />;
    case "installment_due_changed": return <CalendarClock className="h-4 w-4" />;
    case "installment_form_changed": return <CreditCard className="h-4 w-4" />;
    case "installment_created": return <Plus className="h-4 w-4" />;
    case "installment_deleted": return <Trash2 className="h-4 w-4" />;
    case "installment_recalculated": return <RefreshCw className="h-4 w-4" />;
    case "boleto_uploaded":
    case "boleto_replaced": return <FileUp className="h-4 w-4" />;
    case "boleto_deleted": return <FileX className="h-4 w-4" />;
    case "boleto_sent": return <ShieldCheck className="h-4 w-4" />;
    case "document_uploaded": return <FileUp className="h-4 w-4" />;
    case "document_deleted": return <FileX className="h-4 w-4" />;
    case "card_created": return <Plus className="h-4 w-4" />;
    case "card_field_changed": return <Pencil className="h-4 w-4" />;
    case "card_status_changed": return <RefreshCw className="h-4 w-4" />;
    case "card_deleted": return <Trash2 className="h-4 w-4" />;
    default: return <FileText className="h-4 w-4" />;
  }
}

function categoryStyle(cat: CardActivityCategory): { dot: string; badge: string } {
  switch (cat) {
    case "parcela": return { dot: "bg-emerald-500", badge: "border-emerald-500/30 text-emerald-600 dark:text-emerald-400" };
    case "boleto": return { dot: "bg-blue-500", badge: "border-blue-500/30 text-blue-600 dark:text-blue-400" };
    case "documento": return { dot: "bg-amber-500", badge: "border-amber-500/30 text-amber-600 dark:text-amber-400" };
    case "carta": return { dot: "bg-purple-500", badge: "border-purple-500/30 text-purple-600 dark:text-purple-400" };
    default: return { dot: "bg-muted-foreground", badge: "border-muted text-muted-foreground" };
  }
}

export function CardActivityHistoryTab({ cardId }: Props) {
  const { data, isLoading } = useConsortiumCardHistory(cardId);
  const [category, setCategory] = useState<CardActivityCategory | "all">("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let rows = data || [];
    if (category !== "all") rows = rows.filter(r => r.event_category === category);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(r =>
        r.description.toLowerCase().includes(q) ||
        (r.actor_name || "").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [data, category, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, CardActivityLog[]>();
    for (const r of filtered) {
      const k = format(new Date(r.created_at), "yyyy-MM-dd");
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1">
            {CATEGORIES.map(c => (
              <Button
                key={c.value}
                size="sm"
                variant={category === c.value ? "default" : "outline"}
                onClick={() => setCategory(c.value)}
              >
                {c.label}
              </Button>
            ))}
          </div>
          <Input
            placeholder="Buscar por descrição ou responsável…"
            className="sm:max-w-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-10">
            Nenhum evento registrado{category !== "all" ? " para este filtro" : ""}.
          </div>
        ) : (
          <ScrollArea className="h-[520px] pr-3">
            <div className="space-y-6">
              {grouped.map(([day, rows]) => (
                <div key={day}>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    {format(new Date(day + "T12:00:00"), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </div>
                  <div className="border-l border-border ml-2 pl-4 space-y-3">
                    {rows.map((ev) => {
                      const st = categoryStyle(ev.event_category);
                      return (
                        <div key={ev.id} className="relative">
                          <span className={`absolute -left-[22px] top-2 h-2.5 w-2.5 rounded-full ${st.dot}`} />
                          <div className="rounded-md border bg-card p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2 min-w-0">
                                <div className="mt-0.5 text-muted-foreground">{iconFor(ev.event_type)}</div>
                                <div className="min-w-0">
                                  <div className="text-sm font-medium leading-snug break-words">
                                    {ev.description}
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <Badge variant="outline" className={st.badge}>
                                      {ev.event_category}
                                    </Badge>
                                    <span>{format(new Date(ev.created_at), "HH:mm", { locale: ptBR })}</span>
                                    <span>•</span>
                                    <span>por {ev.actor_name || "Sistema"}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}