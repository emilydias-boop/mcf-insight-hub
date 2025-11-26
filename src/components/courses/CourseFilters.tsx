import { useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Download, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfMonth, endOfMonth, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getCustomWeekStart, getCustomWeekEnd, addCustomWeeks } from "@/lib/dateHelpers";
import { cn } from "@/lib/utils";

interface CourseFiltersProps {
  onApply: (filters: { periodo: { tipo: 'semana' | 'mes'; inicio: Date; fim: Date }; curso: string }) => void;
  onClear: () => void;
  onExport: () => void;
}

export function CourseFilters({ onApply, onClear, onExport }: CourseFiltersProps) {
  const [tipo, setTipo] = useState<'semana' | 'mes'>('semana');
  const [dataInicio, setDataInicio] = useState<Date>(getCustomWeekStart(new Date()));
  const [dataFim, setDataFim] = useState<Date>(getCustomWeekEnd(new Date()));
  const [curso, setCurso] = useState('all');

  const handleSemanaAtual = () => {
    const hoje = new Date();
    setDataInicio(getCustomWeekStart(hoje));
    setDataFim(getCustomWeekEnd(hoje));
    setTipo('semana');
  };

  const handleSemanaAnterior = () => {
    const novaInicio = addCustomWeeks(dataInicio, -1);
    const novaFim = addCustomWeeks(dataFim, -1);
    setDataInicio(novaInicio);
    setDataFim(novaFim);
    setTipo('semana');
  };

  const handleProximaSemana = () => {
    const novoInicio = addCustomWeeks(dataInicio, 1);
    const novoFim = addCustomWeeks(dataFim, 1);
    
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
      curso
    });
  };

  const handleLimpar = () => {
    const hoje = new Date();
    setDataInicio(getCustomWeekStart(hoje));
    setDataFim(getCustomWeekEnd(hoje));
    setTipo('semana');
    setCurso('all');
    onClear();
  };

  const proximaSemanaBloqueada = isAfter(addCustomWeeks(dataInicio, 1), new Date());

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

        {/* Select de Curso */}
        <Select value={curso} onValueChange={setCurso}>
          <SelectTrigger className="w-[200px] h-9">
            <SelectValue placeholder="Selecione o curso" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Cursos</SelectItem>
            <SelectItem value="a010">A010 - Consultoria</SelectItem>
            <SelectItem value="construir_para_alugar">Construir Para Alugar</SelectItem>
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
                className={cn("p-3 pointer-events-auto")}
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
                className={cn("p-3 pointer-events-auto")}
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
