import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Target, X } from "lucide-react";
import { useSdrGamificationProgress } from "@/hooks/useSdrGamificationProgress";
import { GoalProgressCard } from "./GoalProgressCard";
import { Skeleton } from "@/components/ui/skeleton";

interface SdrGamificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
}

function buildHeadline(statusCount: { ahead: number; behind: number; critical: number }) {
  if (statusCount.critical > 0) return "Hora de virar o jogo!";
  if (statusCount.behind > 0) return "Dá pra recuperar — foco no próximo agendamento.";
  if (statusCount.ahead >= 2) return "Você está voando, mantenha o ritmo!";
  return "No ritmo certo. Bora seguir!";
}

export function SdrGamificationDialog({ open, onOpenChange }: SdrGamificationDialogProps) {
  const { data, isLoading, hasMeta } = useSdrGamificationProgress(open);

  const statusCount = data
    ? {
        ahead: [data.today, data.week, data.month].filter((g) => g.status === "ahead").length,
        behind: [data.today, data.week, data.month].filter((g) => g.status === "behind").length,
        critical: [data.today, data.week, data.month].filter((g) => g.status === "critical").length,
      }
    : { ahead: 0, behind: 0, critical: 0 };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden border-0 shadow-2xl">
        <div className="relative bg-gradient-to-br from-primary/10 via-background to-background p-6">
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-4 mb-6">
            <div className="h-14 w-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold shadow-sm">
              {data ? getInitials(data.sdrName) : <Target className="h-6 w-6" />}
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight">
                Bora, {data?.sdrName?.split(" ")[0] || "SDR"}!
              </DialogTitle>
              <DialogDescription className="text-sm mt-0.5">
                {data ? buildHeadline(statusCount) : "Carregando seu placar..."}
              </DialogDescription>
              {data && (
                <div className="mt-1.5 text-[11px] text-muted-foreground/80 uppercase tracking-wide">
                  Meta diária: {data.metaDiaria} agendamentos · BU {data.squad}
                </div>
              )}
            </div>
          </div>

          {!hasMeta && !isLoading ? (
            <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
              Você ainda não tem uma meta diária configurada. Fale com seu líder para liberar a gamificação.
            </div>
          ) : isLoading || !data ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Skeleton className="h-56 rounded-xl" />
              <Skeleton className="h-56 rounded-xl" />
              <Skeleton className="h-56 rounded-xl" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <GoalProgressCard title="Hoje" subtitle="Meta diária" goal={data.today} />
              <GoalProgressCard
                title="Semana"
                subtitle={`${data.week.businessDaysElapsed} de ${data.week.businessDaysTotal} dias úteis`}
                goal={data.week}
              />
              <GoalProgressCard
                title="Mês"
                subtitle={`${data.month.businessDaysElapsed} de ${data.month.businessDaysTotal} dias úteis`}
                goal={data.month}
              />
            </div>
          )}

          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Dica: este painel reaparece a cada hora para manter você na linha de chegada.
            </p>
            <Button size="sm" onClick={() => onOpenChange(false)}>
              Bora trabalhar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}