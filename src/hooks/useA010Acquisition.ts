import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { A010LinkMapping } from "./useA010LinkMappings";

export interface A010ClassifiedTransaction {
  channel: string;
  offer: string;
  origin: string;
  net_value: number;
  sale_status: string | null;
  event_type: string;
  sale_date: string;
}

export interface A010AggregatedRow {
  channel: string;
  offer: string;
  origin: string;
  leads: number;
  sales: number;
  revenue: number;
  ticketMedio: number;
  conversionRate: number;
}

export interface A010KPIs {
  totalLeads: number;
  totalSales: number;
  totalRevenue: number;
  ticketMedio: number;
}

function classifyTransaction(
  tx: { utm_source: string | null; utm_campaign: string | null; utm_medium: string | null; source: string | null },
  mappings: A010LinkMapping[]
): { channel: string; offer: string; origin: string } {
  for (const m of mappings) {
    if (!m.is_active) continue;
    let matches = true;

    if (m.match_utm_source && (!tx.utm_source || !tx.utm_source.toLowerCase().includes(m.match_utm_source.toLowerCase()))) matches = false;
    if (m.match_utm_campaign && (!tx.utm_campaign || !tx.utm_campaign.toLowerCase().includes(m.match_utm_campaign.toLowerCase()))) matches = false;
    if (m.match_utm_medium && (!tx.utm_medium || !tx.utm_medium.toLowerCase().includes(m.match_utm_medium.toLowerCase()))) matches = false;
    if (m.match_source && tx.source !== m.match_source) matches = false;

    if (matches) return { channel: m.channel, offer: m.offer, origin: m.origin };
  }
  return { channel: "Não Classificado", offer: "Não Classificado", origin: "Não Classificado" };
}

export function useA010Acquisition(startDate?: Date, endDate?: Date) {
  const start = startDate || startOfMonth(new Date());
  const end = endDate || endOfMonth(new Date());
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");

  return useQuery({
    queryKey: ["a010-acquisition", startStr, endStr],
    queryFn: async () => {
      // Fetch mappings
      const { data: mappings } = await supabase
        .from("a010_link_mappings" as any)
        .select("*")
        .eq("is_active", true)
        .order("priority", { ascending: true });

      // Fetch A010 transactions
      const { data: transactions, error } = await supabase
        .from("hubla_transactions")
        .select("utm_source, utm_campaign, utm_medium, source, net_value, sale_status, event_type, sale_date")
        .eq("product_category", "a010")
        .gte("sale_date", startStr)
        .lte("sale_date", endStr);

      if (error) throw error;

      const typedMappings = (mappings || []) as unknown as A010LinkMapping[];
      const classified: A010ClassifiedTransaction[] = (transactions || []).map((tx) => {
        const dims = classifyTransaction(tx as any, typedMappings);
        return { ...dims, net_value: tx.net_value || 0, sale_status: tx.sale_status, event_type: tx.event_type, sale_date: tx.sale_date };
      });

      // KPIs - consider "paid" sale_status or "purchase" event_type as sales
      const isSaleFn = (t: A010ClassifiedTransaction) => t.sale_status === "paid" || t.sale_status === "completed" || t.event_type === "purchase";
      const totalLeads = classified.length;
      const sales = classified.filter(isSaleFn);
      const totalSales = sales.length;
      const totalRevenue = sales.reduce((s, t) => s + t.net_value, 0);
      const ticketMedio = totalSales > 0 ? totalRevenue / totalSales : 0;

      const kpis: A010KPIs = { totalLeads, totalSales, totalRevenue, ticketMedio };

      // Aggregate by channel+offer+origin
      const aggMap = new Map<string, A010AggregatedRow>();
      classified.forEach((t) => {
        const key = `${t.channel}||${t.offer}||${t.origin}`;
        const existing = aggMap.get(key);
        const isSale = isSaleFn(t);
        if (existing) {
          existing.leads += 1;
          if (isSale) {
            existing.sales += 1;
            existing.revenue += t.net_value;
          }
        } else {
          aggMap.set(key, {
            channel: t.channel,
            offer: t.offer,
            origin: t.origin,
            leads: 1,
            sales: isSale ? 1 : 0,
            revenue: isSale ? t.net_value : 0,
            ticketMedio: 0,
            conversionRate: 0,
          });
        }
      });

      const rows = Array.from(aggMap.values()).map((r) => ({
        ...r,
        ticketMedio: r.sales > 0 ? r.revenue / r.sales : 0,
        conversionRate: r.leads > 0 ? (r.sales / r.leads) * 100 : 0,
      })).sort((a, b) => b.revenue - a.revenue);

      // Generate insight
      let insight = "";
      if (rows.length > 0) {
        const bestConversion = [...rows].filter(r => r.sales > 0).sort((a, b) => b.conversionRate - a.conversionRate)[0];
        const bestRevenue = rows[0];
        if (bestConversion && bestRevenue) {
          if (bestConversion === bestRevenue) {
            insight = `Canal ${bestRevenue.channel} com oferta ${bestRevenue.offer} tem a maior taxa de conversão (${bestRevenue.conversionRate.toFixed(1)}%) e maior receita (R$${bestRevenue.revenue.toLocaleString("pt-BR")}). Considere escalar investimento.`;
          } else {
            insight = `Maior conversão: ${bestConversion.channel}/${bestConversion.offer} (${bestConversion.conversionRate.toFixed(1)}%). Maior receita: ${bestRevenue.channel}/${bestRevenue.offer} (R$${bestRevenue.revenue.toLocaleString("pt-BR")}). Avalie onde escalar.`;
          }
        }
      }

      return { kpis, rows, insight, classified };
    },
  });
}
