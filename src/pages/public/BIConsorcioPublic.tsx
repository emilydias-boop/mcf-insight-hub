import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  startOfMonth, endOfMonth, endOfWeek, eachWeekOfInterval,
  eachDayOfInterval, isWithinInterval, parseISO, max, min, format,
} from "date-fns";
import { BITVMode } from "@/components/consorcio/BITVMode";
import { isDiaUtil, CONSORCIO_WEEK_STARTS_ON } from "@/lib/businessDays";

export default function BIConsorcioPublic({ tokenOverride, onClose }: { tokenOverride?: string; onClose?: () => void } = {}) {
  const [sp] = useSearchParams();
  const token = tokenOverride ?? (sp.get("k") || "");

  const { data, isLoading, error } = useQuery({
    queryKey: ["bi-public-consorcio", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_bi_public_consorcio", { _token: token });
      if (error) throw error;
      return data as any;
    },
    enabled: !!token,
    refetchInterval: 30000,
  });

  const invalid = !token || (data && data.error);

  const view = useMemo(() => {
    if (!data || data.error) return null;
    const monthStart = parseISO(data.month_ref);
    const monthEnd = endOfMonth(monthStart);
    const today = new Date();
    const meta = Number(data.meta || 0);

    const todos = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const diasPadrao = todos.filter(isDiaUtil).map(d => format(d, "yyyy-MM-dd"));
    const override: string[] | null = Array.isArray(data.dias_uteis_override) ? data.dias_uteis_override : null;
    const diasISO = override ?? diasPadrao;
    const diasSet = new Set(diasISO);
    const diasUteis = diasISO.length;
    const metaDia = diasUteis > 0 ? meta / diasUteis : 0;

    const rawSem = eachWeekOfInterval({ start: monthStart, end: monthEnd }, { weekStartsOn: CONSORCIO_WEEK_STARTS_ON as 1 });
    const semanas = rawSem.map((wStart, i) => {
      const wEnd = endOfWeek(wStart, { weekStartsOn: CONSORCIO_WEEK_STARTS_ON as 1 });
      const start = max([wStart, monthStart]);
      const end = min([wEnd, monthEnd]);
      const d = eachDayOfInterval({ start, end }).filter(x => diasSet.has(format(x, "yyyy-MM-dd"))).length;
      return { index: i + 1, start, end, diasUteis: d, metaSemana: d * metaDia };
    });

    const todayStr = format(today, "yyyy-MM-dd");
    let realizado = 0, realizadoHoje = 0;
    const bySem = semanas.map(() => 0);
    for (const row of (data.daily || []) as Array<{ d: string; v: string }>) {
      const v = Number(row.v || 0);
      const d = parseISO(row.d);
      realizado += v;
      if (row.d === todayStr) realizadoHoje += v;
      const idx = semanas.findIndex(s => isWithinInterval(d, { start: s.start, end: s.end }));
      if (idx >= 0) bySem[idx] += v;
    }
    const semanaAtualIdx = semanas.findIndex(s => isWithinInterval(today, { start: s.start, end: s.end }));
    return {
      meta, realizado, realizadoHoje, metaDia, diasUteis, monthStart,
      semanas: semanas.map((s, i) => ({
        index: s.index, metaSemana: s.metaSemana, realizado: bySem[i] || 0,
        isCurrent: i === semanaAtualIdx, diasUteis: s.diasUteis, start: s.start, end: s.end,
      })),
    };
  }, [data]);

  if (!token) {
    return <PublicMsg title="Chave ausente" msg="Adicione ?k=SUA_CHAVE no final da URL." />;
  }
  if (isLoading) return <PublicMsg title="Carregando…" msg="Buscando dados ao vivo" />;
  if (invalid || error) return <PublicMsg title="Acesso negado" msg="Chave inválida ou desativada." />;
  if (!view) return null;

  return (
    <BITVMode
      meta={view.meta}
      realizado={view.realizado}
      realizadoHoje={view.realizadoHoje}
      metaDia={view.metaDia}
      diasUteis={view.diasUteis}
      monthStart={view.monthStart}
      semanas={view.semanas}
      onClose={onClose ?? (() => { /* rota pública: sem fechar */ })}
    />
  );
}

function PublicMsg({ title, msg }: { title: string; msg: string }) {
  return (
    <div className="fixed inset-0 bg-[#050505] text-white flex flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="text-4xl font-black text-[#bfff00]">{title}</div>
      <div className="text-white/70">{msg}</div>
    </div>
  );
}