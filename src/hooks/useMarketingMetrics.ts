import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, format } from "date-fns";

export interface MarketingOverview {
  totalSpend: number;
  totalLeads: number;
  cpl: number;
  totalRevenue: number;
  dailySpend: { date: string; amount: number }[];
  dailyLeads: { date: string; count: number }[];
}

export interface CampaignRow {
  utm_campaign: string | null;
  utm_medium: string | null;
  utm_source: string | null;
  utm_content: string | null;
  leads: number;
  revenue: number;
}

export function useMarketingOverview(startDate?: Date, endDate?: Date) {
  const start = startDate || startOfMonth(new Date());
  const end = endDate || endOfMonth(new Date());
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");

  return useQuery({
    queryKey: ["marketing-overview", startStr, endStr],
    queryFn: async (): Promise<MarketingOverview> => {
      // Fetch daily costs
      const { data: costs, error: costsError } = await supabase
        .from("daily_costs")
        .select("date, amount")
        .gte("date", startStr)
        .lte("date", endStr)
        .order("date");

      if (costsError) throw costsError;

      // Fetch hubla transactions with UTM
      const { data: transactions, error: txError } = await supabase
        .from("hubla_transactions")
        .select("sale_date, net_value, utm_source")
        .not("utm_source", "is", null)
        .gte("sale_date", startStr)
        .lte("sale_date", endStr);

      if (txError) throw txError;

      const totalSpend = (costs || []).reduce((sum, c) => sum + (c.amount || 0), 0);
      const totalLeads = (transactions || []).length;
      const totalRevenue = (transactions || []).reduce((sum, t) => sum + (t.net_value || 0), 0);
      const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;

      // Aggregate daily spend
      const spendMap = new Map<string, number>();
      (costs || []).forEach((c) => {
        const d = c.date;
        spendMap.set(d, (spendMap.get(d) || 0) + c.amount);
      });
      const dailySpend = Array.from(spendMap.entries())
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Aggregate daily leads
      const leadsMap = new Map<string, number>();
      (transactions || []).forEach((t) => {
        const d = typeof t.sale_date === "string" ? t.sale_date.slice(0, 10) : t.sale_date;
        leadsMap.set(d, (leadsMap.get(d) || 0) + 1);
      });
      const dailyLeads = Array.from(leadsMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return { totalSpend, totalLeads, cpl, totalRevenue, dailySpend, dailyLeads };
    },
  });
}

export function useCampaignBreakdown(startDate?: Date, endDate?: Date, sourceFilter?: string) {
  const start = startDate || startOfMonth(new Date());
  const end = endDate || endOfMonth(new Date());
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");

  return useQuery({
    queryKey: ["campaign-breakdown", startStr, endStr, sourceFilter],
    queryFn: async (): Promise<CampaignRow[]> => {
      let query = supabase
        .from("hubla_transactions")
        .select("utm_campaign, utm_medium, utm_source, utm_content, net_value")
        .not("utm_source", "is", null)
        .gte("sale_date", startStr)
        .lte("sale_date", endStr);

      if (sourceFilter) {
        query = query.eq("utm_source", sourceFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Group by campaign + medium + content
      const grouped = new Map<string, CampaignRow>();
      (data || []).forEach((t) => {
        const key = `${t.utm_campaign || "Sem campanha"}||${t.utm_medium || "Sem conjunto"}||${t.utm_source || ""}||${t.utm_content || ""}`;
        const existing = grouped.get(key);
        if (existing) {
          existing.leads += 1;
          existing.revenue += t.net_value || 0;
        } else {
          grouped.set(key, {
            utm_campaign: t.utm_campaign,
            utm_medium: t.utm_medium,
            utm_source: t.utm_source,
            utm_content: t.utm_content,
            leads: 1,
            revenue: t.net_value || 0,
          });
        }
      });

      return Array.from(grouped.values()).sort((a, b) => b.leads - a.leads);
    },
  });
}

export function useUtmSources(startDate?: Date, endDate?: Date) {
  const start = startDate || startOfMonth(new Date());
  const end = endDate || endOfMonth(new Date());
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");

  return useQuery({
    queryKey: ["utm-sources", startStr, endStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hubla_transactions")
        .select("utm_source")
        .not("utm_source", "is", null)
        .gte("sale_date", startStr)
        .lte("sale_date", endStr);

      if (error) throw error;

      const sources = new Set<string>();
      (data || []).forEach((t) => {
        if (t.utm_source) sources.add(t.utm_source);
      });

      return Array.from(sources).sort();
    },
  });
}
