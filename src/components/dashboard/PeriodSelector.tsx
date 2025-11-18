import { useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Download, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, addDays, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface PeriodSelectorProps {
  onApply: (filters: { periodo: { tipo: 'semana' | 'mes'; inicio: Date; fim: Date }; canal: string }) => void;
  onClear: () => void;
  onExport: () => void;
}

export function PeriodSelector({ onApply, onClear, onExport }: PeriodSelectorProps) {
  const [tipo, setTipo] = useState<'semana' | 'mes'>('mes');
  const [dataInicio, setDataInicio] = useState<Date>(startOfMonth(new Date()));
  const [dataFim, setDataFim] = useState<Date>(endOfMonth(new Date()));
  const [canal, setCanal] = useState('todos');

  const handleSemanaAtual = () => {
    const hoje = new Date();
    setDataInicio(startOfWeek(hoje, { locale: ptBR }));
    setDataFim(endOfWeek(hoje, { locale: ptBR }));
    setTipo('semana');
  };

  const handleSemanaAnterior = () => {
    setDataInicio(prev => subDays(prev, 7));
    setDataFim(prev => subDays(prev, 7));
    setTipo('semana');
  };

  const handleProximaSemana = () => {
    const novoInicio = addDays(dataInicio, 7);
    const novoFim = addDays(dataFim, 7);
    
    if (!isAfter(novoInicio, new Date())) {
      setDataInicio(novoInicio);
      setDataFim(novoFim);
      setTipo('semana');
    }
  };

  const handleMes = () => {
    const hoje = new Date();
    setDataInicio(startOfMonth(hoje));
    setDataFim(endOfMonth(hoje));
    setTipo('mes');
  };

  const handleAplicar = () => {
    onApply({
      periodo: { tipo, inicio: dataInicio, fim: dataFim },
      canal
    });
  };

  const handleLimpar = () => {
    const hoje = new Date();
    setDataInicio(startOfMonth(hoje));
    setDataFim(endOfMonth(hoje));
    setTipo('mes');
    setCanal('todos');
    onClear();
  };

  const proximaSemanaBloqueada = isAfter(addDays(dataInicio, 7), new Date());

  return (
    <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        {/* Navegação de Semanas */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSemanaAtual}
            className="h-9"
          >
            Semana Atual
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSemanaAnterior}
            className="h-9 w-9"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleProximaSemana}
            disabled={proximaSemanaBloqueada}
            className="h-9 w-9"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Separador */}
        <div className="h-6 w-px bg-border" />

        {/* Toggle Mês */}
        <Button
          variant={tipo === 'mes' ? 'default' : 'outline'}
          size="sm"
          onClick={handleMes}
          className={cn("h-9", tipo === 'mes' && "bg-success hover:bg-success/90")}
        >
          Mês
        </Button>

        {/* Separador */}
        <div className="h-6 w-px bg-border" />

        {/* Select de Canal */}
        <Select value={canal} onValueChange={setCanal}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Selecione o canal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os canais</SelectItem>
            <SelectItem value="a010">A010</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="contratos">Contratos</SelectItem>
          </SelectContent>
        </Select>

        {/* Separador */}
        <div className="h-6 w-px bg-border" />

        {/* Date Pickers */}
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 px-3">
                <Calendar className="h-4 w-4 mr-2" />
                {format(dataInicio, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={dataInicio}
                onSelect={(date) => date && setDataInicio(date)}
                initialFocus
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>

          <span className="text-muted-foreground">—</span>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 px-3">
                <Calendar className="h-4 w-4 mr-2" />
                {format(dataFim, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={dataFim}
                onSelect={(date) => date && setDataFim(date)}
                initialFocus
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Separador */}
        <div className="h-6 w-px bg-border" />

        {/* Botões de Ação */}
        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="default"
            size="sm"
            onClick={handleAplicar}
            className="h-9 bg-success hover:bg-success/90"
          >
            <Check className="h-4 w-4 mr-2" />
            Aplicar
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleLimpar}
            className="h-9"
          >
            <X className="h-4 w-4 mr-2" />
            Limpar
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            className="h-9"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>
    </div>
  );
}
