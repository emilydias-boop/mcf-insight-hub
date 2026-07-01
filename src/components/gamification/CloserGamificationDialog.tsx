import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Target, X, CalendarCheck, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { GoalProgressCard } from "./GoalProgressCard";
import { useCloserGamificationRuntime } from "@/hooks/useCloserGamificationRuntime";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  closerId: string | null;
  closerName: string;
  closerEmail: string;
  metaReunioesDia: number;
  metaContratosDia: number;
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(n => n[0]?.toUpperCase()).join("");
}

export function CloserGamificationDialog({
  open, onOpenChange, closerId, closerName, closerEmail, metaReunioesDia, metaContratosDia,
}: Props) {
  const { data, isLoading } = useCloserGamificationRuntime(
    closerId, closerName, closerEmail, open, metaReunioesDia, metaContratosDia,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-screen h-screen max-w-none m-0 rounded-none border-0 shadow-none p-0 overflow-auto flex flex-col"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="relative bg-gradient-to-br from-primary/10 via-background to-background p-8 md:p-12 min-h-screen">
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => onOpenChange(false)}
            className="absolute right-6 top-6 rounded-full p-2 text-muted-foreground hover:bg-muted transition-colors z-10"
          >
            <X className="h-6 w-6" />
          </button>

          <div className="flex items-center gap-6 mb-8">
            <div className="h-20 w-20 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold shadow-lg">
              {closerName ? initials(closerName) : <Target className="h-8 w-8" />}
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-3xl md:text-4xl font-bold tracking-tight">
                Gamificação · {closerName || closerEmail}
              </DialogTitle>
              <DialogDescription className="text-base md:text-lg mt-1">
                Runtime Closer · Hoje · Semana · Mês — {closerEmail}
              </DialogDescription>
              <div className="mt-2 text-sm text-muted-foreground/80 uppercase tracking-wide">
                Meta diária: {metaReunioesDia} reuniões · {metaContratosDia} contratos
              </div>
            </div>
          </div>

          {isLoading || !data ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
            </div>
          ) : (
            <div className="space-y-8">
              <section>
                <h3 className="flex items-center gap-2 text-lg font-semibold mb-3">
                  <CalendarCheck className="h-5 w-5 text-primary" /> Reuniões realizadas
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <GoalProgressCard title="Hoje" subtitle="Meta diária" goal={data.reunioes.today} />
                  <GoalProgressCard title="Semana" subtitle={`${data.reunioes.week.businessDaysElapsed}/${data.reunioes.week.businessDaysTotal} dias úteis`} goal={data.reunioes.week} />
                  <GoalProgressCard title="Mês" subtitle={`${data.reunioes.month.businessDaysElapsed}/${data.reunioes.month.businessDaysTotal} dias úteis`} goal={data.reunioes.month} />
                </div>
              </section>
              <section>
                <h3 className="flex items-center gap-2 text-lg font-semibold mb-3">
                  <DollarSign className="h-5 w-5 text-primary" /> Contratos pagos
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <GoalProgressCard title="Hoje" subtitle="Meta diária" goal={data.contratos.today} />
                  <GoalProgressCard title="Semana" subtitle={`${data.contratos.week.businessDaysElapsed}/${data.contratos.week.businessDaysTotal} dias úteis`} goal={data.contratos.week} />
                  <GoalProgressCard title="Mês" subtitle={`${data.contratos.month.businessDaysElapsed}/${data.contratos.month.businessDaysTotal} dias úteis`} goal={data.contratos.month} />
                </div>
              </section>
            </div>
          )}

          <div className="flex items-center justify-between mt-10 pt-6 border-t">
            <p className="text-sm text-muted-foreground">Visão administrativa em runtime — dados ao vivo.</p>
            <Button size="lg" onClick={() => onOpenChange(false)}>Fechar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}