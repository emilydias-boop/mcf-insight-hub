import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Mail,
  MessageCircle,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAutomationRealtime } from "@/hooks/useAutomationRealtime";
import { cn } from "@/lib/utils";

const KEYS = {
  pending: "automation-status-pending",
  done: "automation-status-done-today",
  failed: "automation-status-failed-24h",
  recent: "automation-status-recent",
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
        .select("id, error_message, recipient, channel, created_at", {
          count: "exact",
        })
        .eq("status", "failed")
        .gte("created_at", hoursAgoISO(24))
        .order("created_at", { ascending: false })
        .limit(5);
      return { count: count || 0, latest: data || [] };
    },
  });
}

function useRecentActivity() {
  return useQuery({
    queryKey: [KEYS.recent],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("automation_logs")
        .select(
          "id, status, channel, recipient, error_message, created_at, contact:crm_contacts(name)",
        )
        .order("created_at", { ascending: false })
        .limit(8);
      return data || [];
    },
  });
}

function StatusIcon({ status }: { status: string }) {
  if (status === "failed")
    return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
  if (status === "pending")
    return <Loader2 className="h-4 w-4 text-orange-500 animate-spin shrink-0" />;
  return <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />;
}

function ChannelIcon({ channel }: { channel: string }) {
  return channel === "email" ? (
    <Mail className="h-3.5 w-3.5" />
  ) : (
    <MessageCircle className="h-3.5 w-3.5" />
  );
}

export function AutomationStatusPanel() {
  const { isLive } = useAutomationRealtime(Object.values(KEYS));
  const pending = usePending();
  const done = useDoneToday();
  const failed = useFailed24h();
  const recent = useRecentActivity();

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
    <div className="space-y-4">
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
                  isLive
                    ? "bg-green-500 animate-pulse"
                    : "bg-muted-foreground/40",
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
                  <CardTitle className="text-sm font-medium">
                    Com erro
                  </CardTitle>
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
                  <p className="text-xs text-muted-foreground mt-1">
                    últimas 24h
                  </p>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent className="max-w-md whitespace-pre-line">
              {failedTooltip}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            Últimas atividades
            <Badge variant="outline" className="font-normal">
              auto-atualiza
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recent.isLoading ? (
            <div className="text-sm text-muted-foreground py-4">
              Carregando…
            </div>
          ) : !recent.data || recent.data.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4">
              Nenhuma atividade recente.
            </div>
          ) : (
            <ul className="divide-y">
              {recent.data.map((l: any) => (
                <li
                  key={l.id}
                  className="flex items-center gap-3 py-2 text-sm"
                >
                  <StatusIcon status={l.status} />
                  <span className="text-muted-foreground tabular-nums w-20 shrink-0">
                    {formatDistanceToNow(new Date(l.created_at), {
                      locale: ptBR,
                      addSuffix: false,
                    })}
                  </span>
                  <span className="flex items-center gap-1.5 w-24 shrink-0 text-muted-foreground">
                    <ChannelIcon channel={l.channel} />
                    {l.channel === "email" ? "Email" : "WhatsApp"}
                  </span>
                  <span className="flex-1 truncate">
                    {l.contact?.name || l.recipient || "—"}
                  </span>
                  <Badge
                    variant={
                      l.status === "failed"
                        ? "destructive"
                        : l.status === "pending"
                          ? "outline"
                          : "secondary"
                    }
                    className="capitalize"
                  >
                    {l.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}