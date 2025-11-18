import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, GitCompare } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getCustomWeekStart, getCustomWeekEnd, formatCustomWeekRange } from "@/lib/dateHelpers";
import { ComparisonTable } from "./ComparisonTable";
import { ComparisonChart } from "./ComparisonChart";
import { cn } from "@/lib/utils";

export function PeriodComparison() {
  const [open, setOpen] = useState(false);
  
  // Período A (referência)
  const [periodoA, setPeriodoA] = useState({
    label: 'Período A',
    inicio: getCustomWeekStart(new Date()),
    fim: getCustomWeekEnd(new Date()),
  });

  // Período B (comparação)
  const [periodoB, setPeriodoB] = useState({
    label: 'Período B',
    inicio: getCustomWeekStart(new Date()),
    fim: getCustomWeekEnd(new Date()),
  });

  const handleComparar = () => {
    // Aqui você pode adicionar lógica para buscar dados reais dos períodos
    console.log('Comparando períodos:', { periodoA, periodoB });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <GitCompare className="mr-2 h-4 w-4" />
          Comparar Períodos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Comparação de Períodos</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Seletores de Período */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Período A */}
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="text-lg">Período A (Referência)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "flex-1 justify-start text-left font-normal",
                          !periodoA.inicio && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {periodoA.inicio ? format(periodoA.inicio, "PPP", { locale: ptBR }) : "Início"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={periodoA.inicio}
                        onSelect={(date) => {
                          if (date) {
                            const inicio = getCustomWeekStart(date);
                            const fim = getCustomWeekEnd(date);
                            setPeriodoA({ label: 'Período A', inicio, fim });
                          }
                        }}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="text-sm text-muted-foreground">
                  Semana: {formatCustomWeekRange(periodoA.inicio)}
                </div>
              </CardContent>
            </Card>

            {/* Período B */}
            <Card className="bg-success/5 border-success/20">
              <CardHeader>
                <CardTitle className="text-lg">Período B (Comparação)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "flex-1 justify-start text-left font-normal",
                          !periodoB.inicio && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {periodoB.inicio ? format(periodoB.inicio, "PPP", { locale: ptBR }) : "Início"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={periodoB.inicio}
                        onSelect={(date) => {
                          if (date) {
                            const inicio = getCustomWeekStart(date);
                            const fim = getCustomWeekEnd(date);
                            setPeriodoB({ label: 'Período B', inicio, fim });
                          }
                        }}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="text-sm text-muted-foreground">
                  Semana: {formatCustomWeekRange(periodoB.inicio)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Button onClick={handleComparar} className="w-full" size="lg">
            <GitCompare className="mr-2 h-5 w-5" />
            Comparar Períodos
          </Button>

          {/* Tabela de Comparação */}
          <ComparisonTable periodoA={periodoA} periodoB={periodoB} />

          {/* Gráfico de Comparação */}
          <ComparisonChart periodoA={periodoA} periodoB={periodoB} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
