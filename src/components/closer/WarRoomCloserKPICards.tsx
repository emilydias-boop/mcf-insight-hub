import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const warRoomCloserKPIQueryKey = (closerId: string, pFrom: string, pTo: string) =>
  ["war-room-closer-kpis", closerId, pFrom, pTo] as const;

interface Props {
  closerId: string;
  startDate: Date;
  endDate: Date;
}

/** KPIs do closer War Room (solar) — mesma régua do Painel Comercial War Room. */
export function WarRoomCloserKPICards({ closerId, startDate, endDate }: Props) {
  const pFrom = format(startDate, "yyyy-MM-dd");
  const pTo = format(endDate, "yyyy-MM-dd");
  const { data: warRoomRow, isLoading } = useQuery({
    queryKey: warRoomCloserKPIQueryKey(closerId, pFrom, pTo),
    enabled: !!closerId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("painel_comercial_solar", { p_from: pFrom, p_to: pTo });
      if (error) throw error;
      const row = (data?.closers || []).find((c: any) => c.closer_id === closerId);
      return {
        agendadas: Number(row?.agendadas || 0),
        realizadas: Number(row?.realizadas || 0),
        no_show: Number(row?.no_show || 0),
        pendentes: Number(row?.pendentes || 0),
        vendas: Number(row?.vendas || 0),
      };
    },
  });

  const m = warRoomRow || { agendadas: 0, realizadas: 0, no_show: 0, pendentes: 0, vendas: 0 };
  const pct = (a: number, b: number) => (b > 0 ? ((a / b) * 100).toFixed(1) : "0.0") + "%";
  const regua = "Mesma régua do Painel Comercial War Room.";
  const cards = [
    { t: "R1 Agendadas", v: m.agendadas, h: `R1 agendadas no período. ${regua}` },
    { t: "R1 Realizadas", v: m.realizadas, h: `R1 realizadas no período. ${regua}` },
    { t: "No-show", v: m.no_show, sub: `Taxa ${pct(m.no_show, m.agendadas)}`, h: `No-show ÷ agendadas. ${regua}` },
    { t: "Pendentes", v: m.pendentes, sub: "Sem desfecho", h: `Reuniões sem desfecho registrado. ${regua}` },
    { t: "Vendas realizadas", v: m.vendas, h: `Negócios que entraram em "Venda realizada" no período. ${regua}` },
    { t: "Conversão", v: pct(m.vendas, m.realizadas), sub: "Vendas ÷ realizadas", h: `Vendas realizadas ÷ R1 realizadas. ${regua}` },
  ];

  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Tooltip key={c.t}>
            <TooltipTrigger asChild>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{c.t}</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold">{c.v}</div>
                      {c.sub && <p className="text-xs text-muted-foreground">{c.sub}</p>}
                    </>
                  )}
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">{c.h}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
