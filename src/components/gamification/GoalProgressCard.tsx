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
  const radius = 48;
  const circ = 2 * Math.PI * radius;
  const dash = Math.min(pct, 1) * circ;

  return (
    <div className="rounded-2xl border bg-card p-6 md:p-8 flex flex-col gap-5 min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm md:text-base font-medium uppercase tracking-wide text-muted-foreground">
            {title}
          </div>
          {subtitle && (
            <div className="text-xs md:text-sm text-muted-foreground/80 mt-1">{subtitle}</div>
          )}
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs md:text-sm font-semibold",
            tone.chip,
          )}
        >
          <Icon className="h-4 w-4" />
          {tone.label}
        </span>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative h-32 w-32 md:h-40 md:w-40 shrink-0">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
            <circle
              cx="60"
              cy="60"
              r={radius}
              className="stroke-muted"
              strokeWidth="10"
              fill="none"
            />
            <circle
              cx="60"
              cy="60"
              r={radius}
              className={cn(tone.ring, "transition-all duration-700")}
              strokeWidth="10"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circ}`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-3xl md:text-4xl font-bold leading-none tabular-nums">
              {goal.realized}
            </div>
            <div className="text-xs md:text-sm text-muted-foreground mt-1">
              de {goal.target}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 min-w-0 text-base md:text-lg">
          <div className={cn("font-semibold tabular-nums", tone.text)}>
            {goal.balance >= 0 ? `+${goal.balance}` : goal.balance} vs esperado
          </div>
          <div className="text-sm md:text-base text-muted-foreground">
            Esperado até agora: <span className="tabular-nums">{goal.expectedSoFar}</span>
          </div>
          {goal.businessDaysTotal > 1 && (
            <div className="text-sm md:text-base text-muted-foreground">
              Dias úteis: <span className="tabular-nums">{goal.businessDaysElapsed}/{goal.businessDaysTotal}</span>
            </div>
          )}
        </div>
      </div>

      <p
        className={cn(
          "text-sm md:text-base leading-relaxed rounded-lg px-4 py-3",
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