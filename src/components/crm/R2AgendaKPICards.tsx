import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, CheckCircle2, AlertTriangle, DollarSign, RotateCcw, HelpCircle } from "lucide-react";
import { format } from "date-fns";
import type { R2MeetingRow } from "@/types/r2Agenda";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  meetings: R2MeetingRow[];
  rangeStart: Date;
  rangeEnd: Date;
}

const TARGET_CODES = ["A001", "A003", "A009"];

function normalizePhone(p?: string | null) {
  if (!p) return "";
  return p.replace(/\D/g, "").slice(-9);
}
function normalizeEmail(e?: string | null) {
  return (e || "").toLowerCase().trim();
}
function normalizeDoc(d?: string | null) {
  return (d || "").replace(/\D/g, "");
}
function normalizeName(n?: string | null) {
  return (n || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function useA00XSales(rangeStart: Date, rangeEnd: Date) {
  return useQuery({
    queryKey: [
      "r2-kpi-a00x-sales",
      format(rangeStart, "yyyy-MM-dd"),
      format(rangeEnd, "yyyy-MM-dd"),
    ],
    queryFn: async () => {
      const startStr = format(rangeStart, "yyyy-MM-dd");
      const endStr = format(rangeEnd, "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("hubla_transactions")
        .select(
          "customer_name, customer_email, customer_phone, customer_document, product_code, product_name, sale_date, source, sale_status"
        )
        .in("sale_status", ["paid", "completed"])
        .gte("sale_date", `${startStr}T00:00:00`)
        .lte("sale_date", `${endStr}T23:59:59`)
        .or(
          [
            "product_code.in.(A001,A003,A009)",
            "product_name.ilike.%A001%",
            "product_name.ilike.%A003%",
            "product_name.ilike.%A009%",
          ].join(",")
        );
      if (error) throw error;
      return (data || []).filter((r: any) => {
        const code = (r.product_code || "").toUpperCase();
        if (TARGET_CODES.includes(code)) return true;
        const name = (r.product_name || "").toUpperCase();
        return TARGET_CODES.some((c) => name.includes(c));
      });
    },
    staleTime: 60_000,
  });
}

export function R2AgendaKPICards({ meetings, rangeStart, rangeEnd }: Props) {
  const { data: sales = [], isLoading: salesLoading } = useA00XSales(
    rangeStart,
    rangeEnd
  );
  const [openDialog, setOpenDialog] = useState<null | "refunded" | "no_status">(
    null
  );

  const { kpis, refundedList, noStatusList } = useMemo(() => {
    const attendees = meetings.flatMap((m) =>
      (m.attendees || []).map((a) => ({ ...a, _slot: m }))
    );

    const active = attendees.filter(
      (a) => a.status !== "cancelled" && a.status !== "rescheduled"
    );

    const agendadas = active.length;
    const realizadas = active.filter(
      (a) =>
        a.status === "completed" ||
        a.status === "contract_paid" ||
        a.status === "refunded"
    ).length;
    const noShows = active.filter((a) => a.status === "no_show").length;
    const denomNS = realizadas + noShows;
    const noShowPct = denomNS > 0 ? (noShows / denomNS) * 100 : 0;

    const refundedList = active.filter((a: any) => a.status === "refunded");
    const noStatusList = active.filter(
      (a: any) => !a.r2_status_id
    );

    // Build lookup sets from sales
    const salesEmails = new Set<string>();
    const salesPhones = new Set<string>();
    const salesDocs = new Set<string>();
    const salesNames = new Set<string>();
    sales.forEach((s: any) => {
      const e = normalizeEmail(s.customer_email);
      if (e) salesEmails.add(e);
      const p = normalizePhone(s.customer_phone);
      if (p.length >= 8) salesPhones.add(p);
      const d = normalizeDoc(s.customer_document);
      if (d.length >= 11) salesDocs.add(d);
      const n = normalizeName(s.customer_name);
      if (n) salesNames.add(n);
    });

    let vendas = 0;
    const seen = new Set<string>();
    active.forEach((a: any) => {
      const email = normalizeEmail(a.email || a.deal?.contact?.email);
      const phone = normalizePhone(a.phone || a.deal?.contact?.phone);
      const name = normalizeName(
        a.name || a.deal?.contact?.name || a.deal?.name
      );
      // CPF may be stored in deal custom_fields
      const cf = (a.deal?.custom_fields as any) || {};
      const doc = normalizeDoc(cf.cpf || cf.CPF || cf.documento || cf.document);

      const key = email || phone || doc || name || Math.random().toString();
      if (seen.has(key)) return;

      const match =
        (email && salesEmails.has(email)) ||
        (phone.length >= 8 && salesPhones.has(phone)) ||
        (doc.length >= 11 && salesDocs.has(doc)) ||
        (name && salesNames.has(name));

      if (match) {
        seen.add(key);
        vendas++;
      }
    });

    return {
      kpis: { agendadas, realizadas, noShowPct, noShows, vendas },
      refundedList,
      noStatusList,
    };
  }, [meetings, sales]);

  const cards = [
    {
      label: "R2 Agendadas",
      value: kpis.agendadas,
      icon: Calendar,
      color: "text-purple-600",
      bg: "bg-purple-500/10",
    },
    {
      label: "R2 Realizadas",
      value: kpis.realizadas,
      icon: CheckCircle2,
      color: "text-green-600",
      bg: "bg-green-500/10",
    },
    {
      label: "% No-Show",
      value: `${kpis.noShowPct.toFixed(1)}%`,
      sub: `${kpis.noShows} no-show(s)`,
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-500/10",
    },
    {
      label: "Vendas (A001/A003/A009)",
      value: salesLoading ? "…" : kpis.vendas,
      sub: `${sales.length} venda(s) Hubla+MCF Pay`,
      icon: DollarSign,
      color: "text-emerald-600",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Reembolso",
      value: refundedList.length,
      sub: "Clique para ver leads",
      icon: RotateCcw,
      color: "text-orange-600",
      bg: "bg-orange-500/10",
      onClick: () => setOpenDialog("refunded"),
    },
    {
      label: "Sem Status",
      value: noStatusList.length,
      sub: "Clique para ver leads",
      icon: HelpCircle,
      color: "text-slate-600",
      bg: "bg-slate-500/10",
      onClick: () => setOpenDialog("no_status"),
    },
  ] as Array<{
    label: string;
    value: number | string;
    sub?: string;
    icon: any;
    color: string;
    bg: string;
    onClick?: () => void;
  }>;

  const dialogList =
    openDialog === "refunded"
      ? refundedList
      : openDialog === "no_status"
      ? noStatusList
      : [];
  const dialogTitle =
    openDialog === "refunded"
      ? `Reembolsos (${refundedList.length})`
      : `Sem Status R2 (${noStatusList.length})`;

  return (
    <>
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card
            key={c.label}
            className={c.onClick ? "cursor-pointer hover:shadow-md transition" : ""}
            onClick={c.onClick}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${c.bg}`}>
                <Icon className={`h-5 w-5 ${c.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">
                  {c.label}
                </p>
                <p className="text-2xl font-bold leading-tight">{c.value}</p>
                {c.sub && (
                  <p className="text-[10px] text-muted-foreground truncate">
                    {c.sub}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
    <Dialog open={openDialog !== null} onOpenChange={(o) => !o && setOpenDialog(null)}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        {dialogList.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Nenhum registro.</p>
        ) : (
          <div className="divide-y">
            {dialogList.map((a: any) => {
              const nome =
                a.name || a.deal?.contact?.name || a.deal?.name || "-";
              const email = a.email || a.deal?.contact?.email || "-";
              const phone = a.phone || a.deal?.contact?.phone || "-";
              const closer = a._slot?.closer?.name || "-";
              const when = a._slot?.scheduled_at
                ? format(new Date(a._slot.scheduled_at), "dd/MM HH:mm")
                : "-";
              return (
                <div key={a.id} className="py-2 text-sm">
                  <div className="font-medium">{nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {email} · {phone}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    R2: {when} · Closer: {closer}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}