import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, ShieldOff, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMeetingStatus } from "@/utils/formatMeetingStatus";

interface LateAttempt {
  id: string;
  attendee_id: string | null;
  slot_id: string | null;
  meeting_scheduled_at: string | null;
  ano_mes: string | null;
  old_status: string | null;
  new_status: string | null;
  days_after_meeting: number | null;
  was_blocked: boolean;
  block_reason: string | null;
  attempted_by_email: string | null;
  attempted_by_role: string | null;
  attendee_name: string | null;
  closer_name: string | null;
  created_at: string;
}

export default function LateStatusAttemptsPage() {
  const [tab, setTab] = useState<"all" | "blocked" | "allowed">("all");
  const [monthFilter, setMonthFilter] = useState("");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["late-status-attempts", tab, monthFilter],
    queryFn: async (): Promise<LateAttempt[]> => {
      let q = supabase
        .from("late_status_change_attempts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (tab === "blocked") q = q.eq("was_blocked", true);
      if (tab === "allowed") q = q.eq("was_blocked", false);
      if (monthFilter) q = q.eq("ano_mes", monthFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as LateAttempt[];
    },
    staleTime: 15_000,
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <AlertTriangle className="h-6 w-6" /> Tentativas de Alteração Tardia
        </h1>
        <p className="text-muted-foreground">
          Toda alteração de status de reunião feita em dia diferente do dia da reunião é registrada
          aqui — tanto as <strong>permitidas</strong> (mês aberto ou usuário privilegiado) quanto as
          <strong> bloqueadas</strong> (mês fechado).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Mostra as 500 alterações tardias mais recentes.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="month">Mês da reunião (YYYY-MM)</Label>
              <Input
                id="month"
                placeholder="ex: 2026-03"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="blocked">
            <ShieldOff className="h-4 w-4 mr-1" /> Bloqueadas
          </TabsTrigger>
          <TabsTrigger value="allowed">
            <ShieldCheck className="h-4 w-4 mr-1" /> Permitidas
          </TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <p className="p-4 text-muted-foreground">Carregando...</p>
              ) : !rows?.length ? (
                <p className="p-4 text-muted-foreground">Nenhuma tentativa registrada.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr className="text-left">
                        <th className="p-3">Quando</th>
                        <th className="p-3">Reunião</th>
                        <th className="p-3">Lead</th>
                        <th className="p-3">Closer</th>
                        <th className="p-3">Mudança</th>
                        <th className="p-3">Dias depois</th>
                        <th className="p-3">Por</th>
                        <th className="p-3">Resultado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id} className="border-t">
                          <td className="p-3 whitespace-nowrap">
                            {format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {r.meeting_scheduled_at
                              ? format(new Date(r.meeting_scheduled_at), "dd/MM/yyyy", { locale: ptBR })
                              : "—"}
                          </td>
                          <td className="p-3">{r.attendee_name || "—"}</td>
                          <td className="p-3">{r.closer_name || "—"}</td>
                          <td className="p-3 whitespace-nowrap">
                            <span className="text-muted-foreground">
                              {formatMeetingStatus(r.old_status)}
                            </span>
                            {" → "}
                            <strong>{formatMeetingStatus(r.new_status)}</strong>
                          </td>
                          <td className="p-3">{r.days_after_meeting ?? "—"}</td>
                          <td className="p-3">
                            <div>{r.attempted_by_email || "—"}</div>
                            {r.attempted_by_role && (
                              <div className="text-xs text-muted-foreground">{r.attempted_by_role}</div>
                            )}
                          </td>
                          <td className="p-3">
                            {r.was_blocked ? (
                              <Badge variant="destructive">Bloqueada</Badge>
                            ) : (
                              <Badge variant="secondary">Permitida</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}