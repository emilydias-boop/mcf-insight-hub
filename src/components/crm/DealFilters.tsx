import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Search, X, Calendar as CalendarIcon, CheckSquare, Clock, Radio } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';

export type SalesChannelFilter = 'all' | 'a010' | 'bio' | 'live';

export interface DealFiltersState {
  search: string;
  dateRange: DateRange | undefined;
  owner: string | null;
  dealStatus: 'all' | 'open' | 'won' | 'lost';
  inactivityDays: number | null;
  salesChannel: SalesChannelFilter;
}

interface DealFiltersProps {
  filters: DealFiltersState;
  onChange: (filters: DealFiltersState) => void;
  onClear: () => void;
  selectionMode?: boolean;
  onToggleSelectionMode?: () => void;
}

export const DealFilters = ({ 
  filters, 
  onChange, 
  onClear, 
  selectionMode = false,
  onToggleSelectionMode 
}: DealFiltersProps) => {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  
  // Buscar apenas SDRs e Closers do Supabase local
  const { data: dealOwners } = useQuery({
    queryKey: ['deal-owners-sdr-closer'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          user_roles!inner(role)
        `)
        .in('user_roles.role', ['sdr', 'closer', 'admin', 'manager', 'coordenador'])
        .order('full_name');
      return data || [];
    }
  });
  
  const activeFiltersCount = [
    filters.search,
    filters.dateRange?.from,
    filters.owner,
    filters.dealStatus !== 'all',
    filters.inactivityDays !== null,
    filters.salesChannel !== 'all',
  ].filter(Boolean).length;
  
  return (
    <div className="flex flex-wrap gap-2 items-center p-4 bg-muted/20 border-b">
      {/* Campo de busca expandido */}
      <div className="relative flex-1 min-w-[280px]">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, email ou telefone..."
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="pl-8"
        />
      </div>
      
      {/* Filtro de Status */}
      <Select
        value={filters.dealStatus}
        onValueChange={(value) => onChange({ 
          ...filters, 
          dealStatus: value as 'all' | 'open' | 'won' | 'lost' 
        })}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="open">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Abertos
            </span>
          </SelectItem>
          <SelectItem value="won">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Ganhos
            </span>
          </SelectItem>
          <SelectItem value="lost">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              Perdidos
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
      
      {/* Filtro de Responsável (SDRs e Closers) */}
      <Select
        value={filters.owner || 'all'}
        onValueChange={(value) => onChange({ ...filters, owner: value === 'all' ? null : value })}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Responsável" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os responsáveis</SelectItem>
          {dealOwners?.map((user: any) => (
            <SelectItem key={user.id} value={user.email}>
              {user.full_name} ({user.user_roles?.[0]?.role?.toUpperCase()})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {/* Filtro de Inatividade */}
      <Select
        value={filters.inactivityDays?.toString() || 'all'}
        onValueChange={(value) => onChange({ 
          ...filters, 
          inactivityDays: value === 'all' ? null : parseInt(value) 
        })}
      >
        <SelectTrigger className="w-[160px]">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="Sem atividade" />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Qualquer</SelectItem>
          <SelectItem value="1">+ de 1 dia</SelectItem>
          <SelectItem value="3">+ de 3 dias</SelectItem>
          <SelectItem value="7">+ de 7 dias</SelectItem>
          <SelectItem value="15">+ de 15 dias</SelectItem>
          <SelectItem value="30">+ de 30 dias</SelectItem>
        </SelectContent>
      </Select>
      
      {/* Filtro de Canal de Entrada */}
      <Select
        value={filters.salesChannel}
        onValueChange={(value) => onChange({ 
          ...filters, 
          salesChannel: value as SalesChannelFilter 
        })}
      >
        <SelectTrigger className="w-[130px]">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="Canal" />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="a010">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              A010
            </span>
          </SelectItem>
          <SelectItem value="bio">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              BIO
            </span>
          </SelectItem>
          <SelectItem value="live">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              LIVE
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
      
      {/* Filtro de Data */}
      <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="justify-start text-left font-normal">
            <CalendarIcon className="mr-2 h-4 w-4" />
            {filters.dateRange?.from ? (
              filters.dateRange.to ? (
                <>
                  {format(filters.dateRange.from, "dd/MM/yy", { locale: ptBR })} -{" "}
                  {format(filters.dateRange.to, "dd/MM/yy", { locale: ptBR })}
                </>
              ) : (
                format(filters.dateRange.from, "dd/MM/yy", { locale: ptBR })
              )
            ) : (
              "Data de criação"
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={filters.dateRange?.from}
            selected={filters.dateRange}
            onSelect={(range) => onChange({ ...filters, dateRange: range })}
            numberOfMonths={2}
            locale={ptBR}
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
      
      {activeFiltersCount > 0 && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="h-4 w-4 mr-1" />
          Limpar ({activeFiltersCount})
        </Button>
      )}
      
      {/* Botão de Modo Seleção */}
      {onToggleSelectionMode && (
        <Button 
          variant={selectionMode ? "default" : "outline"} 
          size="sm" 
          onClick={onToggleSelectionMode}
          className="ml-auto"
        >
          <CheckSquare className="h-4 w-4 mr-1" />
          {selectionMode ? "Sair do modo" : "Modo Seleção"}
        </Button>
      )}
    </div>
  );
};
