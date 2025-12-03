import { useState } from "react";
import { TVContent } from "@/components/tv/TVContent";
import { SaleCelebration } from "@/components/tv/SaleCelebration";
import { useTVSdrData } from "@/hooks/useTVSdrData";
import { useSalesCelebration } from "@/hooks/useSalesCelebration";
import { Button } from "@/components/ui/button";
import { RotateCcw, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, subDays, addDays, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function TVSdrFullscreen() {
  const [viewDate, setViewDate] = useState<Date>(new Date());
  const isViewingToday = isToday(viewDate);
  
  const { data, isLoading } = useTVSdrData(viewDate);
  const { currentCelebration, handleCelebrationComplete } = useSalesCelebration();

  const handleResetCelebrations = () => {
    localStorage.removeItem('celebrated_sales');
    window.location.reload();
  };

  const handlePreviousDay = () => {
    setViewDate(prev => subDays(prev, 1));
  };

  const handleNextDay = () => {
    if (!isViewingToday) {
      setViewDate(prev => addDays(prev, 1));
    }
  };

  const handleGoToToday = () => {
    setViewDate(new Date());
  };

  return (
    <div className="min-h-screen bg-background p-6 relative">
      <TVContent
        totalNovoLead={data?.totalNovoLead || { valor: 0, meta: 560 }}
        funnelDataA={data?.funnelDataA || []}
        funnelDataB={data?.funnelDataB || []}
        topSdrs={data?.topSdrs || []}
        allSdrs={data?.allSdrs || []}
        isLoading={isLoading}
        lastUpdate={new Date()}
      />

      {/* Celebração apenas para o dia atual */}
      {currentCelebration && isViewingToday && (
        <SaleCelebration
          leadName={currentCelebration.leadName}
          leadType={currentCelebration.leadType}
          sdrName={currentCelebration.sdrName}
          closerName={currentCelebration.closerName}
          productName={currentCelebration.productName}
          onComplete={handleCelebrationComplete}
        />
      )}

      {/* Controles de navegação de data */}
      <div className="fixed top-4 right-4 flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={handlePreviousDay}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Dia anterior</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex items-center gap-2 px-3 py-1 bg-muted rounded-md text-sm">
          <Calendar className="h-4 w-4" />
          <span className="font-medium">
            {isViewingToday 
              ? "Hoje" 
              : format(viewDate, "dd/MM", { locale: ptBR })}
          </span>
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={handleNextDay}
                disabled={isViewingToday}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Próximo dia</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {!isViewingToday && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  className="h-8"
                  onClick={handleGoToToday}
                >
                  Ir para Hoje
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Voltar para o dia atual</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Indicador visual quando não está vendo hoje */}
      {!isViewingToday && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-yellow-500/90 text-yellow-950 px-4 py-2 rounded-full text-sm font-medium">
          Visualizando: {format(viewDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </div>
      )}

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="fixed bottom-4 right-4 opacity-30 hover:opacity-100 transition-opacity h-8 w-8"
              onClick={handleResetCelebrations}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Resetar celebrações e reexibir vendas de hoje</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}