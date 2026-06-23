import { cn } from "@/lib/utils";
import { Target, TrendingUp, AlertTriangle, Flame, CheckCircle2 } from "lucide-react";
import type { GoalProgress, GoalStatus } from "@/hooks/useSdrGamificationProgress";

const STATUS_TONE: Record<
  GoalStatus,
  { ring: string; chip: string; text: string; icon: typeof Target; label: string }
> = {
  ahead: {
    ring: "stroke-emerald-500",
    chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    text: "text-emerald-600 dark:text-emerald-400",
    icon: CheckCircle2,
    label: "Adiantado",
  },
  ontrack: {
    ring: "stroke-sky-500",
    chip: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30",
    text: "text-sky-600 dark:text-sky-400",
    icon: TrendingUp,
    label: "No ritmo",
  },
  behind: {
    ring: "stroke-amber-500",
    chip: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    text: "text-amber-600 dark:text-amber-400",
    icon: Flame,
    label: "Atrasado",
  },
  critical: {
    ring: "stroke-destructive",
    chip: "bg-destructive/10 text-destructive border-destructive/30",
    text: "text-destructive",
    icon: AlertTriangle,
    label: "Crítico",
  },
};

interface GoalProgressCardProps {
  title: string;
  subtitle?: string;
  goal: GoalProgress;
}

export function GoalProgressCard({ title, subtitle, goal }: GoalProgressCardProps) {
  const tone = STATUS_TONE[goal.status];
  const Icon = tone.icon;

  const pct = goal.target > 0 ? Math.min(goal.realized / goal.target, 1.5) : 0;
  const radius = 38;
  const circ = 2 * Math.PI * radius;
  const dash = Math.min(pct, 1) * circ;

  return (
    <div className="rounded-xl border bg-card p-4 flex flex-col gap-3 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {title}
          </div>
          {subtitle && (
            <div className="text-[11px] text-muted-foreground/80 mt-0.5">{subtitle}</div>
          )}
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
            tone.chip,
          )}
        >
          <Icon className="h-3 w-3" />
          {tone.label}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative h-24 w-24 shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle
              cx="50"
              cy="50"
              r={radius}
              className="stroke-muted"
              strokeWidth="9"
              fill="none"
            />
            <circle
              cx="50"
              cy="50"
              r={radius}
              className={cn(tone.ring, "transition-all duration-700")}
              strokeWidth="9"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circ}`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-xl font-bold leading-none tabular-nums">
              {goal.realized}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              de {goal.target}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1 min-w-0 text-sm">
          <div className={cn("font-semibold tabular-nums", tone.text)}>
            {goal.balance >= 0 ? `+${goal.balance}` : goal.balance} vs esperado
          </div>
          <div className="text-xs text-muted-foreground">
            Esperado até agora: <span className="tabular-nums">{goal.expectedSoFar}</span>
          </div>
          {goal.businessDaysTotal > 1 && (
            <div className="text-xs text-muted-foreground">
              Dias úteis: <span className="tabular-nums">{goal.businessDaysElapsed}/{goal.businessDaysTotal}</span>
            </div>
          )}
        </div>
      </div>

      <p
        className={cn(
          "text-xs leading-snug rounded-md px-2.5 py-2",
          goal.status === "critical"
            ? "bg-destructive/10 text-destructive font-medium"
            : goal.status === "behind"
              ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
              : "bg-muted text-muted-foreground",
        )}
      >
        {goal.message}
      </p>
    </div>
  );
}