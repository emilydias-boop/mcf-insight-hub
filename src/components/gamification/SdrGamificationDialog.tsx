import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Target, X } from "lucide-react";
import { useSdrGamificationProgress } from "@/hooks/useSdrGamificationProgress";
import { GoalProgressCard } from "./GoalProgressCard";
import { Skeleton } from "@/components/ui/skeleton";

interface SdrGamificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  impersonateEmail?: string;
  impersonateName?: string;
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

export function SdrGamificationDialog({ open, onOpenChange, impersonateEmail, impersonateName }: SdrGamificationDialogProps) {
  const { data, isLoading, hasMeta } = useSdrGamificationProgress(open, impersonateEmail);
  const isImpersonating = !!impersonateEmail;

  const statusCount = data
    ? {
        ahead: [data.today, data.week, data.month].filter((g) => g.status === "ahead").length,
        behind: [data.today, data.week, data.month].filter((g) => g.status === "behind").length,
        critical: [data.today, data.week, data.month].filter((g) => g.status === "critical").length,
      }
    : { ahead: 0, behind: 0, critical: 0 };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-screen h-screen max-w-none m-0 rounded-none border-0 shadow-none p-0 overflow-auto flex flex-col justify-center"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="relative bg-gradient-to-br from-primary/10 via-background to-background p-8 md:p-12 lg:p-16 min-h-screen flex flex-col justify-center">
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => onOpenChange(false)}
            className="absolute right-6 top-6 rounded-full p-2 text-muted-foreground hover:bg-muted transition-colors z-10"
          >
            <X className="h-6 w-6" />
          </button>

          <div className="flex items-center gap-6 mb-10">
            <div className="h-20 w-20 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold shadow-lg">
              {data ? getInitials(data.sdrName) : <Target className="h-8 w-8" />}
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-3xl md:text-4xl font-bold tracking-tight">
                {isImpersonating
                  ? `Gamificação · ${data?.sdrName || impersonateName || impersonateEmail}`
                  : `Bora, ${data?.sdrName?.split(" ")[0] || "SDR"}!`}
              </DialogTitle>
              <DialogDescription className="text-base md:text-lg mt-1">
                {isImpersonating
                  ? `Runtime · Hoje · Semana · Mês${data ? ` — ${data.sdrEmail}` : ""}`
                  : data ? buildHeadline(statusCount) : "Carregando seu placar..."}
              </DialogDescription>
              {data && (
                <div className="mt-2 text-sm text-muted-foreground/80 uppercase tracking-wide">
                  Meta diária: {data.metaDiaria} agendamentos · BU {data.squad}
                </div>
              )}
            </div>
          </div>

          {!hasMeta && !isLoading ? (
            <div className="rounded-xl border bg-card p-8 text-center text-base text-muted-foreground">
              Você ainda não tem uma meta diária configurada. Fale com seu líder para liberar a gamificação.
            </div>
          ) : isLoading || !data ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Skeleton className="h-72 rounded-xl" />
              <Skeleton className="h-72 rounded-xl" />
              <Skeleton className="h-72 rounded-xl" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

          <div className="flex items-center justify-between mt-10 pt-6 border-t">
            <p className="text-sm text-muted-foreground">
              {isImpersonating
                ? "Visão administrativa em runtime — dados ao vivo."
                : "Dica: este painel reaparece a cada hora para manter você na linha de chegada."}
            </p>
            <Button size="lg" onClick={() => onOpenChange(false)}>
              {isImpersonating ? "Fechar" : "Bora trabalhar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}