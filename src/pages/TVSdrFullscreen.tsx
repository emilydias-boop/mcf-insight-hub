import { useState, useEffect } from "react";
import { TVContent } from "@/components/tv/TVContent";
import { SaleCelebration } from "@/components/tv/SaleCelebration";
import { useTVSdrData } from "@/hooks/useTVSdrData";
import { useSalesCelebration } from "@/hooks/useSalesCelebration";
import { Button } from "@/components/ui/button";
import { RotateCcw, Calendar, ChevronLeft, ChevronRight, RefreshCw, PartyPopper } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, subDays, addDays, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";

export default function TVSdrFullscreen() {
  const [viewDate, setViewDate] = useState<Date>(new Date());
  const [celebrationsPaused, setCelebrationsPaused] = useState(false);
  const isViewingToday = isToday(viewDate);
  const queryClient = useQueryClient();
  
  const { data, isLoading, lastUpdate, isFetching } = useTVSdrData(viewDate);
  const { currentCelebration, handleCelebrationComplete } = useSalesCelebration();
  const [displayTime, setDisplayTime] = useState<string>("");

  // Atualizar display do horário a cada segundo
  useEffect(() => {
    const updateDisplayTime = () => {
      if (lastUpdate) {
        setDisplayTime(format(lastUpdate, "HH:mm:ss"));
      }
    };
    updateDisplayTime();
    const interval = setInterval(updateDisplayTime, 1000);
    return () => clearInterval(interval);
  }, [lastUpdate]);

  const handleResetCelebrations = () => {
    localStorage.removeItem('celebrated_sales');
    window.location.reload();
  };

  const handleForceRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["tv-sdr-data"] });
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
        funnelData={data?.funnelData || []}
        topSdrs={data?.topSdrs || []}
        allSdrs={data?.allSdrs || []}
        isLoading={isLoading}
        lastUpdate={new Date()}
      />

      {/* Celebração apenas para o dia atual e se não estiver pausado */}
      {currentCelebration && isViewingToday && !celebrationsPaused && (
        <SaleCelebration
          leadName={currentCelebration.leadName}
          leadType={currentCelebration.leadType}
          sdrName={currentCelebration.sdrName}
          closerName={currentCelebration.closerName}
          productName={currentCelebration.productName}
          onComplete={handleCelebrationComplete}
          onDismiss={handleCelebrationComplete}
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

      {/* Indicador de última atualização */}
      <div className="fixed bottom-4 left-4 flex items-center gap-2 text-xs text-muted-foreground opacity-50 hover:opacity-100 transition-opacity">
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/80 ${isFetching ? 'animate-pulse' : ''}`}>
          <RefreshCw className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
          <span>Atualizado: {displayTime}</span>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleForceRefresh}
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Forçar atualização</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Controles inferiores direitos */}
      <div className="fixed bottom-4 right-4 flex items-center gap-2 opacity-30 hover:opacity-100 transition-opacity">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={celebrationsPaused ? "default" : "ghost"}
                size="icon"
                className={`h-8 w-8 ${celebrationsPaused ? 'opacity-100' : ''}`}
                onClick={() => setCelebrationsPaused(!celebrationsPaused)}
              >
                <PartyPopper className={`h-4 w-4 ${celebrationsPaused ? 'opacity-50' : ''}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{celebrationsPaused ? "Ativar celebrações" : "Pausar celebrações"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
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
    </div>
  );
}