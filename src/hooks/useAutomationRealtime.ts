import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Inscreve em mudanças de automation_logs/automation_queue e invalida
 * as queries do painel. Retorna o estado da conexão para indicador "live".
 */
export function useAutomationRealtime(queryKeys: string[]) {
  const qc = useQueryClient();
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel("automation-status-panel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "automation_logs" },
        () => queryKeys.forEach((k) => qc.invalidateQueries({ queryKey: [k] })),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "automation_queue" },
        () => queryKeys.forEach((k) => qc.invalidateQueries({ queryKey: [k] })),
      )
      .subscribe((status) => {
        setIsLive(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isLive };
}