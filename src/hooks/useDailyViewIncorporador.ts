import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface DailyViewSdr {
  sdr_id: string;
  name: string;
  email: string;
  meta_diaria: number;
  agendamentos: number;
}

export interface DailyViewCloser {
  closer_id: string;
  name: string;
  email: string;
  meta_reunioes: number;
  reunioes_realizadas: number;
  meta_contratos: number;
  contratos_pagos: number;
}

export interface DailyViewResponse {
  reference_date: string;
  sdrs: DailyViewSdr[];
  closers: DailyViewCloser[];
}

export function useDailyViewIncorporador(date: Date, metaReunioes = 2, metaContratos = 1) {
  const dateStr = format(date, "yyyy-MM-dd");
  return useQuery({
    queryKey: ["daily-view-incorporador", dateStr, metaReunioes, metaContratos],
    queryFn: async (): Promise<DailyViewResponse> => {
      const { data, error } = await supabase.rpc("get_daily_view_incorporador" as any, {
        p_date: dateStr,
        p_closer_meta_reunioes: metaReunioes,
        p_closer_meta_contratos: metaContratos,
      });
      if (error) throw error;
      return (data as DailyViewResponse) || { reference_date: dateStr, sdrs: [], closers: [] };
    },
    staleTime: 60_000,
  });
}

export interface SdrCallDay {
  day: string;
  attempts: number;
  effective: number;
  qualified: number;
  total_seconds: number;
}

export function useSdrCallDailySummary(sdrUserId: string | null, start: Date | null, end: Date | null) {
  return useQuery({
    queryKey: ["sdr-call-daily", sdrUserId, start?.toISOString(), end?.toISOString()],
    queryFn: async (): Promise<SdrCallDay[]> => {
      if (!sdrUserId || !start || !end) return [];
      const { data, error } = await supabase.rpc("get_sdr_call_daily_summary" as any, {
        p_sdr_user_id: sdrUserId,
        p_start: format(start, "yyyy-MM-dd"),
        p_end: format(end, "yyyy-MM-dd"),
      });
      if (error) throw error;
      return (data as SdrCallDay[]) || [];
    },
    enabled: !!sdrUserId && !!start && !!end,
  });
}

export interface SdrBookingRow {
  attendee_id: string;
  deal_id: string | null;
  lead_name: string | null;
  lead_phone: string | null;
  closer_name: string | null;
  scheduled_at: string;
  status: string;
  tags: string[] | null;
}

export function useSdrDailyBookings(sdrEmail: string | null, date: Date | null) {
  return useQuery({
    queryKey: ["sdr-daily-bookings", sdrEmail, date?.toISOString()],
    queryFn: async (): Promise<SdrBookingRow[]> => {
      if (!sdrEmail || !date) return [];
      const { data, error } = await supabase.rpc("get_sdr_daily_bookings" as any, {
        p_sdr_email: sdrEmail,
        p_date: format(date, "yyyy-MM-dd"),
      });
      if (error) throw error;
      return (data as SdrBookingRow[]) || [];
    },
    enabled: !!sdrEmail && !!date,
  });
}

export interface CloserMeetingRow {
  attendee_id: string;
  deal_id: string | null;
  lead_name: string | null;
  scheduled_at: string;
  status: string;
  tags: string[] | null;
}

export function useCloserDailyMeetings(closerId: string | null, date: Date | null) {
  return useQuery({
    queryKey: ["closer-daily-meetings", closerId, date?.toISOString()],
    queryFn: async (): Promise<CloserMeetingRow[]> => {
      if (!closerId || !date) return [];
      const { data, error } = await supabase.rpc("get_closer_daily_meetings" as any, {
        p_closer_id: closerId,
        p_date: format(date, "yyyy-MM-dd"),
      });
      if (error) throw error;
      return (data as CloserMeetingRow[]) || [];
    },
    enabled: !!closerId && !!date,
  });
}

export interface CloserContractRow {
  attendee_id: string;
  deal_id: string | null;
  lead_name: string | null;
  product_name: string | null;
  value: number | null;
  contract_paid_at: string;
}

export function useCloserDailyContracts(closerId: string | null, date: Date | null) {
  return useQuery({
    queryKey: ["closer-daily-contracts", closerId, date?.toISOString()],
    queryFn: async (): Promise<CloserContractRow[]> => {
      if (!closerId || !date) return [];
      const { data, error } = await supabase.rpc("get_closer_daily_contracts" as any, {
        p_closer_id: closerId,
        p_date: format(date, "yyyy-MM-dd"),
      });
      if (error) throw error;
      return (data as CloserContractRow[]) || [];
    },
    enabled: !!closerId && !!date,
  });
}