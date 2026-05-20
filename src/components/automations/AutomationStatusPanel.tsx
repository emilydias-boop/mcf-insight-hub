import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Clock, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAutomationRealtime } from "@/hooks/useAutomationRealtime";
import { cn } from "@/lib/utils";

const KEYS = {
  pending: "automation-status-pending",
  done: "automation-status-done-today",
  failed: "automation-status-failed-24h",
};

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function hoursAgoISO(h: number) {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

function usePending() {
  return useQuery({
    queryKey: [KEYS.pending],
    refetchInterval: 15_000,
    queryFn: async () => {
      const [{ count: queueCount }, { count: logCount }] = await Promise.all([
        supabase
          .from("automation_queue")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("automation_logs")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
      ]);
      return (queueCount || 0) + (logCount || 0);
    },
  });
}

function useDoneToday() {
  return useQuery({
    queryKey: [KEYS.done],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { count } = await supabase
        .from("automation_logs")
        .select("id", { count: "exact", head: true })
        .in("status", ["sent", "delivered", "read"])
        .gte("created_at", startOfTodayISO());
      return count || 0;
    },
  });
}

function useFailed24h() {
  return useQuery({
    queryKey: [KEYS.failed],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, count } = await supabase
        .from("automation_logs")
        .select("id, error_message, recipient", { count: "exact" })
        .eq("status", "failed")
        .gte("created_at", hoursAgoISO(24))
        .order("created_at", { ascending: false })
        .limit(5);
      return { count: count || 0, latest: data || [] };
    },
  });
}

export function AutomationStatusPanel() {
  const { isLive } = useAutomationRealtime(Object.values(KEYS));
  const pending = usePending();
  const done = useDoneToday();
  const failed = useFailed24h();

  const failedTooltip =
    failed.data?.latest && failed.data.latest.length > 0
      ? failed.data.latest
          .map(
            (l: any) =>
              `• ${l.recipient ?? "—"}: ${l.error_message ?? "sem detalhe"}`,
          )
          .join("\n")
      : "Sem falhas nas últimas 24h";

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="border-orange-500/30">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
          <Clock className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{pending.data ?? 0}</div>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={cn(
                "inline-flex h-2 w-2 rounded-full",
                isLive ? "bg-green-500 animate-pulse" : "bg-muted-foreground/40",
              )}
            />
            <span className="text-xs text-muted-foreground">
              {isLive ? "Live" : "Polling 15s"} · na fila
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-green-500/30">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Concluídos</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{done.data ?? 0}</div>
          <p className="text-xs text-muted-foreground mt-1">
            hoje (sent + delivered + read)
          </p>
        </CardContent>
      </Card>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Card
              className={cn(
                "cursor-help",
                (failed.data?.count || 0) > 0
                  ? "border-destructive/40"
                  : "border-border",
              )}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Com erro</CardTitle>
                <XCircle
                  className={cn(
                    "h-4 w-4",
                    (failed.data?.count || 0) > 0
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}
                />
              </CardHeader>
              <CardContent>
                <div
                  className={cn(
                    "text-3xl font-bold",
                    (failed.data?.count || 0) > 0 && "text-destructive",
                  )}
                >
                  {failed.data?.count ?? 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">últimas 24h</p>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent className="max-w-md whitespace-pre-line">
            {failedTooltip}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}