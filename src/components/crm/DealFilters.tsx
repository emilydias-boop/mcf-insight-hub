import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Search, X, Calendar as CalendarIcon, Clock, Radio, Phone, Activity, DollarSign } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import type { OwnerOption } from '@/hooks/useDealOwnerOptions';
import { TagFilterPopover } from './TagFilterPopover';

export type SalesChannelFilter = 'all' | 'a010' | 'bio' | 'live';
export type ActivityPriorityFilter = 'all' | 'high' | 'medium' | 'low';
export type OutsideFilter = 'all' | 'outside_only' | 'not_outside';

export interface DealFiltersState {
  search: string;
  dateRange: DateRange | undefined;
  owner: string | null;
  dealStatus: 'all' | 'open' | 'won' | 'lost';
  inactivityDays: number | null;
  salesChannel: SalesChannelFilter;
  attemptsRange: { min: number; max: number } | null;
  selectedTags: string[];
  activityPriority: ActivityPriorityFilter;
  outsideFilter: OutsideFilter;
}

interface DealFiltersProps {
  filters: DealFiltersState;
  onChange: (filters: DealFiltersState) => void;
  onClear: () => void;
  /** Lista de owners derivada dos deals (quando fornecida, substitui a query interna) */
  ownerOptions?: OwnerOption[];
  /** Tags únicas disponíveis para filtro */
  availableTags?: string[];
  /** Loading state para tags */
  isLoadingTags?: boolean;
}

export const DealFilters = ({ 
  filters, 
  onChange, 
  onClear, 
  ownerOptions,
  availableTags = [],
  isLoadingTags = false,
}: DealFiltersProps) => {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isAttemptsPopoverOpen, setIsAttemptsPopoverOpen] = useState(false);
  const [localMinAttempts, setLocalMinAttempts] = useState('');
  const [localMaxAttempts, setLocalMaxAttempts] = useState('');
  
  // Handler para aplicar filtro de tentativas
  const handleApplyAttemptsFilter = () => {
    const min = localMinAttempts === '' ? 0 : parseInt(localMinAttempts, 10);
    const max = localMaxAttempts === '' ? 999 : parseInt(localMaxAttempts, 10);
    
    if (isNaN(min) || isNaN(max) || min > max) {
      return; // Validação básica
    }
    
    onChange({ ...filters, attemptsRange: { min, max } });
    setIsAttemptsPopoverOpen(false);
  };
  
  // Limpar filtro de tentativas
  const handleClearAttemptsFilter = () => {
    onChange({ ...filters, attemptsRange: null });
    setLocalMinAttempts('');
    setLocalMaxAttempts('');
    setIsAttemptsPopoverOpen(false);
  };
  
  // Buscar ativos e ex-funcionários (desativados) para filtro de responsável
  const { data: dealOwners } = useQuery({
    queryKey: ['deal-owners-all-with-inactive'],
    queryFn: async () => {
      // Ativos com roles específicos
      const { data: activeUsers } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          access_status,
          user_roles(role)
        `)
        .eq('access_status', 'ativo')
        .order('full_name');
      
      // Desativados (ex-funcionários)
      const { data: inactiveUsers } = await supabase
        .from('profiles')
        .select('id, full_name, email, access_status')
        .eq('access_status', 'desativado')
        .order('full_name');
      
      // Filtrar ativos que têm roles relevantes
      const filteredActive = (activeUsers || []).filter((u: any) => 
        u.user_roles?.some((r: any) => 
          ['sdr', 'closer', 'admin', 'manager', 'coordenador'].includes(r.role)
        )
      );
      
      return {
        active: filteredActive,
        inactive: inactiveUsers || [],
      };
    }
  });
  
  const activeFiltersCount = [
    filters.search,
    filters.dateRange?.from,
    filters.owner,
    filters.dealStatus !== 'all',
    filters.inactivityDays !== null,
    filters.salesChannel !== 'all',
    filters.attemptsRange !== null,
    filters.selectedTags.length > 0,
    filters.activityPriority !== 'all',
    filters.outsideFilter !== 'all',
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
      
      {/* Filtro de Responsável - usa ownerOptions se fornecido, senão fallback */}
      <Select
        value={filters.owner || 'all'}
        onValueChange={(value) => onChange({ ...filters, owner: value === 'all' ? null : value })}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Responsável" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os responsáveis</SelectItem>
          <SelectItem value="__no_owner__">Sem dono</SelectItem>
          
          {/* Se ownerOptions foi fornecido, usar ele */}
          {ownerOptions ? (
            <>
              {/* Ativos */}
              {ownerOptions.filter(o => !o.isInactive).map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label} {opt.roleLabel && `(${opt.roleLabel})`}
                </SelectItem>
              ))}
              {/* Ex-funcionários / Legados */}
              {ownerOptions.some(o => o.isInactive) && (
                <>
                  <SelectItem value="__separator__" disabled className="text-xs text-muted-foreground">
                    ── Ex-funcionários ──
                  </SelectItem>
                  {ownerOptions.filter(o => o.isInactive).map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="text-muted-foreground">
                        {opt.label} {opt.roleLabel && `(${opt.roleLabel})`}
                      </span>
                    </SelectItem>
                  ))}
                </>
              )}
            </>
          ) : (
            /* Fallback: query antiga (para reuso em outros lugares) */
            <>
              {dealOwners?.active && dealOwners.active.length > 0 && (
                <>
                  {dealOwners.active.map((user: any) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name || user.email?.split('@')[0]} ({user.user_roles?.[0]?.role?.toUpperCase() || 'SDR'})
                    </SelectItem>
                  ))}
                </>
              )}
              {dealOwners?.inactive && dealOwners.inactive.length > 0 && (
                <>
                  <SelectItem value="__separator__" disabled className="text-xs text-muted-foreground">
                    ── Ex-funcionários ──
                  </SelectItem>
                  {dealOwners.inactive.map((user: any) => (
                    <SelectItem key={user.id} value={user.id}>
                      <span className="text-muted-foreground">
                        {user.full_name || user.email?.split('@')[0]}
                      </span>
                    </SelectItem>
                  ))}
                </>
              )}
            </>
          )}
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
      
      {/* Filtro de Tentativas (Range) */}
      <Popover open={isAttemptsPopoverOpen} onOpenChange={setIsAttemptsPopoverOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant={filters.attemptsRange ? "default" : "outline"} 
            className="justify-start text-left font-normal"
          >
            <Phone className="mr-2 h-4 w-4" />
            {filters.attemptsRange 
              ? `${filters.attemptsRange.min} a ${filters.attemptsRange.max} tent.`
              : "Tentativas"
            }
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="start">
          <div className="space-y-3">
            <Label className="text-sm font-medium">Quantidade de tentativas</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                placeholder="Mín"
                value={localMinAttempts}
                onChange={(e) => setLocalMinAttempts(e.target.value)}
                className="w-20"
              />
              <span className="text-muted-foreground">a</span>
              <Input
                type="number"
                min={0}
                placeholder="Máx"
                value={localMaxAttempts}
                onChange={(e) => setLocalMaxAttempts(e.target.value)}
                className="w-20"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleApplyAttemptsFilter} className="flex-1">
                Aplicar
              </Button>
              {filters.attemptsRange && (
                <Button size="sm" variant="ghost" onClick={handleClearAttemptsFilter}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      
      {/* Filtro de Tags */}
      <TagFilterPopover
        availableTags={availableTags}
        selectedTags={filters.selectedTags}
        onChange={(tags) => onChange({ ...filters, selectedTags: tags })}
        isLoading={isLoadingTags}
      />
      
      {/* Filtro de Prioridade de Atividade */}
      <Select
        value={filters.activityPriority}
        onValueChange={(value) => onChange({ 
          ...filters, 
          activityPriority: value as ActivityPriorityFilter 
        })}
      >
        <SelectTrigger className="w-[160px]">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="Prioridade" />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Qualquer</SelectItem>
          <SelectItem value="high">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              Alta (0 ativ.)
            </span>
          </SelectItem>
          <SelectItem value="medium">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              Média (1-3 ativ.)
            </span>
          </SelectItem>
          <SelectItem value="low">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Baixa (4+ ativ.)
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
      
      {/* Filtro Outside */}
      <Select
        value={filters.outsideFilter}
        onValueChange={(value) => onChange({ 
          ...filters, 
          outsideFilter: value as OutsideFilter 
        })}
      >
        <SelectTrigger className="w-[160px]">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="Outside" />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="outside_only">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              Apenas Outside
            </span>
          </SelectItem>
          <SelectItem value="not_outside">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              Sem Outside
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
    </div>
  );
};
