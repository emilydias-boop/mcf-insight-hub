import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";

export type LeadTemperature = "quente" | "morno" | "frio" | null;

export const TEMPERATURE_META: Record<
  Exclude<LeadTemperature, null>,
  { label: string; dot: string; ring: string; text: string; bg: string }
> = {
  quente: {
    label: "Quente",
    dot: "bg-red-500",
    ring: "ring-red-500",
    text: "text-red-500",
    bg: "bg-red-500/15 border-red-500/40",
  },
  morno: {
    label: "Morno",
    dot: "bg-orange-500",
    ring: "ring-orange-500",
    text: "text-orange-500",
    bg: "bg-orange-500/15 border-orange-500/40",
  },
  frio: {
    label: "Frio",
    dot: "bg-blue-500",
    ring: "ring-blue-500",
    text: "text-blue-500",
    bg: "bg-blue-500/15 border-blue-500/40",
  },
};

const ORDER: Exclude<LeadTemperature, null>[] = ["quente", "morno", "frio"];

interface Props {
  dealId: string;
  value: LeadTemperature;
  onChanged?: (next: LeadTemperature) => void;
  size?: "sm" | "md";
  showLabel?: boolean;
}

export function LeadTemperatureSelector({
  dealId,
  value,
  onChanged,
  size = "md",
  showLabel = true,
}: Props) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState<LeadTemperature | "_">("_");

  const setTemp = async (next: LeadTemperature) => {
    if (!dealId || dealId.startsWith("manual-")) return;
    setSaving(next);
    const { error } = await supabase
      .from("crm_deals")
      .update({ lead_temperature: next })
      .eq("id", dealId);
    setSaving("_");
    if (error) {
      toast.error("Erro ao classificar lead: " + error.message);
      return;
    }
    toast.success(next ? `Lead marcado como ${TEMPERATURE_META[next].label}` : "Classificação removida");
    onChanged?.(next);
    qc.invalidateQueries({ queryKey: ["crm-deal", dealId] });
    qc.invalidateQueries({ queryKey: ["crm-deals"] });
  };

  const dotSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  const btnSize = size === "sm" ? "h-6 w-6" : "h-7 w-7";

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-2">
        {showLabel && (
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Temperatura
          </span>
        )}
        <div className="flex items-center gap-1">
          {ORDER.map((t) => {
            const meta = TEMPERATURE_META[t];
            const active = value === t;
            const isSaving = saving === t;
            return (
              <Tooltip key={t}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTemp(active ? null : t);
                    }}
                    disabled={saving !== "_"}
                    className={cn(
                      "rounded-full flex items-center justify-center border transition-all",
                      btnSize,
                      active
                        ? `${meta.bg} ring-2 ${meta.ring}`
                        : "border-border bg-muted/30 hover:bg-muted",
                      saving !== "_" && "opacity-60 cursor-wait",
                    )}
                    aria-label={meta.label}
                  >
                    {isSaving ? (
                      <Loader2 className={cn("animate-spin", dotSize)} />
                    ) : (
                      <span className={cn("rounded-full", dotSize, meta.dot)} />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {active ? `Remover (${meta.label})` : `Marcar como ${meta.label}`}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}

/** Bolinha colorida pequena para usar em cards/listas. */
export function LeadTemperatureDot({
  value,
  className,
}: {
  value: LeadTemperature;
  className?: string;
}) {
  if (!value) return null;
  const meta = TEMPERATURE_META[value];
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-block h-2.5 w-2.5 rounded-full ring-2 ring-background",
              meta.dot,
              className,
            )}
            aria-label={`Lead ${meta.label}`}
          />
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Lead {meta.label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}