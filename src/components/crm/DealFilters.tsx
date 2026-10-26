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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Calendar } from '@/components/ui/calendar';
import { Search, X, Calendar as CalendarIcon, Clock, Radio, Phone, Activity, DollarSign, User, CalendarDays, HelpCircle, Ban, LifeBuoy, SlidersHorizontal } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import type { OwnerOption } from '@/hooks/useDealOwnerOptions';
import { TagFilterPopover } from './TagFilterPopover';
import { useCloserFilterOptions } from '@/hooks/useCloserFilterOptions';
import { ProductFilterPopover } from './ProductFilterPopover';
import type { ProductFilterRule, ProductOperator } from '@/hooks/useProductFilterData';
import { TEMPERATURE_META, type LeadTemperature } from './LeadTemperatureSelector';
import { useLossReasons } from '@/hooks/useLossReasons';
import { SEM_MOTIVO_FILTER_VALUE } from '@/lib/lossReasons';

export type SalesChannelFilter = 'all' | 'a010' | 'bio' | 'live';
export type ActivityPriorityFilter = 'all' | 'high' | 'medium' | 'low';
export type OutsideFilter = 'all' | 'outside_only' | 'outside_worked' | 'outside_not_worked' | 'not_outside';
export type TemperatureFilter = 'all' | 'none' | 'quente' | 'morno' | 'frio';

import type { TagFilterRule, TagOperator } from './TagFilterPopover';

export interface DealFiltersState {
  search: string;
  dateRange: DateRange | undefined;
  owner: string | null;
  /** Email do closer (R1 ou R2) selecionado — filtro independente do owner */
  closerEmail: string | null;
  dealStatus: 'all' | 'open' | 'won' | 'lost';
  inactivityDays: number | null;
  salesChannel: SalesChannelFilter;
  canalEntrada?: string;
  attemptsRange: { min: number; max: number } | null;
  selectedTags: string[];
  tagFilters: TagFilterRule[];
  tagOperator: TagOperator;
  productFilters: ProductFilterRule[];
  productOperator: ProductOperator;
  activityPriority: ActivityPriorityFilter;
  outsideFilter: OutsideFilter;
  temperature: TemperatureFilter;
  /** Motivos de "Sem Interesse" selecionados (labels; SEM_MOTIVO_FILTER_VALUE = sem motivo). Opcional para não quebrar quem monta o estado em outros lugares. */
  lossReasons?: string[];
  /** Selo Resgate (crm_deals.resgate_em), à parte do A/B/C. Opcional para não quebrar quem monta o estado em outros lugares. */
  resgate?: 'all' | 'only' | 'none';
  /** Situação do projeto vinda da Admissão (custom_fields.admissao.projeto_status). */
  projeto?: ProjetoFiltro;
}

export type ProjetoFiltro = 'all' | 'sem_projeto' | 'aprovado' | 'nenhum' | 'sem_info';

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
  /** Produtos disponíveis para filtro */
  availableProducts?: string[];
  /** Loading state para produtos */
  isLoadingProducts?: boolean;
  /** BU ativa para restringir a lista de closers */
  activeBU?: string | null;
  canaisEntrada?: { codigo: string; rotulo: string; cor: string; total: number }[];
}

export const DealFilters = ({ 
  filters, 
  onChange, 
  onClear, 
  ownerOptions,
  availableTags = [],
  isLoadingTags = false,
  availableProducts = [],
  isLoadingProducts = false,
  activeBU,
  canaisEntrada = [],
}: DealFiltersProps) => {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isAttemptsPopoverOpen, setIsAttemptsPopoverOpen] = useState(false);
  const [isLossReasonPopoverOpen, setIsLossReasonPopoverOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { all: lossReasonOptions } = useLossReasons();

  // Alterna um motivo no filtro de "Sem Interesse" (multi-seleção)
  const toggleLossReason = (value: string) => {
    const current = filters.lossReasons ?? [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange({ ...filters, lossReasons: next });
  };
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
  
  // Buscar apenas usuários ATIVOS para o filtro de responsável
  const { data: dealOwners } = useQuery({
    queryKey: ['deal-owners-active-only'],
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
      
      // Filtrar ativos que têm roles relevantes
      const filteredActive = (activeUsers || []).filter((u: any) => 
        u.user_roles?.some((r: any) => 
          ['sdr', 'closer', 'admin', 'manager', 'coordenador'].includes(r.role)
        )
      );
      
      return {
        active: filteredActive,
      };
    }
  });
  
  const { data: closerFilterOptions } = useCloserFilterOptions(activeBU);

  const activeFiltersCount = [
    filters.search,
    filters.dateRange?.from,
    filters.owner,
    filters.closerEmail,
    filters.dealStatus !== 'all',
    filters.inactivityDays !== null,
    (filters.canalEntrada ?? 'all') !== 'all',
    filters.attemptsRange !== null,
    filters.tagFilters.length > 0,
    filters.productFilters.length > 0,
    filters.activityPriority !== 'all',
    filters.outsideFilter !== 'all',
    filters.temperature !== 'all',
    (filters.lossReasons?.length ?? 0) > 0,
    (filters.resgate ?? 'all') !== 'all',
    (filters.projeto ?? 'all') !== 'all',
  ].filter(Boolean).length;
  
  const drawerFiltersCount = [
    filters.dealStatus !== 'all',
    filters.activityPriority !== 'all',
    filters.outsideFilter !== 'all',
    (filters.lossReasons?.length ?? 0) > 0,
    (filters.resgate ?? 'all') !== 'all',
    (filters.projeto ?? 'all') !== 'all',
    filters.tagFilters.length > 0,
    filters.productFilters.length > 0,
    !!filters.dateRange?.from,
    filters.attemptsRange !== null,
    !!filters.closerEmail,
  ].filter(Boolean).length;

  const triggerCls = (active: boolean) =>
    `h-9 w-auto min-w-[150px] gap-2 text-sm ${active ? 'border-primary' : ''}`;
  const fieldName = (name: string) => (
    <span className="shrink-0 text-muted-foreground">{name}</span>
  );

  return (
    <div className="flex flex-wrap gap-2 items-center px-4 py-3 border-b">
      {/* Busca */}
      <div className="relative flex-1 min-w-[260px]">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, email ou telefone..."
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="pl-8 h-9 text-sm"
        />
      </div>

      {/* Responsável */}
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Select
                value={filters.owner || 'all'}
                onValueChange={(value) => onChange({ ...filters, owner: value === 'all' ? null : value })}
              >
                <SelectTrigger className={triggerCls(!!filters.owner)}>
                  <div className="flex items-center gap-2 overflow-hidden">
                    {fieldName('Responsável')}
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="__no_owner__">Sem dono</SelectItem>
                  {ownerOptions ? (
                    ownerOptions.filter(o => !o.isInactive).map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label} {opt.roleLabel && `(${opt.roleLabel})`}
                      </SelectItem>
                    ))
                  ) : (
                    (dealOwners?.active || []).map((user: any) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name || user.email?.split('@')[0]} ({user.user_roles?.[0]?.role?.toUpperCase() || 'SDR'})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p>Filtro pelo <strong>dono do negócio</strong> (owner_profile_id).</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Canal de entrada */}
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Select
                value={filters.canalEntrada || 'all'}
                onValueChange={(value) => onChange({ ...filters, canalEntrada: value })}
              >
                <SelectTrigger className={triggerCls((filters.canalEntrada ?? 'all') !== 'all')}>
                  <div className="flex items-center gap-2 overflow-hidden">
                    {fieldName('Canal')}
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {canaisEntrada.map((canal) => (
                    <SelectItem key={canal.codigo} value={canal.codigo}>
                      {canal.rotulo} ({canal.total.toLocaleString('pt-BR')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p>Por onde o lead entrou no CRM. Não muda depois: quem entrou pela Anamnese e comprou o A010 continua Anamnese (a compra do A010 está no filtro Produtos).</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Sem contato */}
      <Select
        value={filters.inactivityDays?.toString() || 'all'}
        onValueChange={(value) => onChange({
          ...filters,
          inactivityDays: value === 'all' ? null : parseInt(value)
        })}
      >
        <SelectTrigger className={triggerCls(filters.inactivityDays !== null)}>
          <div className="flex items-center gap-2 overflow-hidden">
            {fieldName('Sem contato')}
            <SelectValue />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Qualquer</SelectItem>
          <SelectItem value="1">há 1+ dia</SelectItem>
          <SelectItem value="3">há 3+ dias</SelectItem>
          <SelectItem value="7">há 7+ dias</SelectItem>
          <SelectItem value="15">há 15+ dias</SelectItem>
          <SelectItem value="30">há 30+ dias</SelectItem>
        </SelectContent>
      </Select>

      {/* Temperatura */}
      <Select
        value={filters.temperature}
        onValueChange={(value) => onChange({ ...filters, temperature: value as TemperatureFilter })}
      >
        <SelectTrigger className={triggerCls(filters.temperature !== 'all')}>
          <div className="flex items-center gap-2 overflow-hidden">
            {fieldName('Temperatura')}
            {filters.temperature !== 'all' && filters.temperature !== 'none' && (
              <span className={`w-2 h-2 shrink-0 rounded-full ${TEMPERATURE_META[filters.temperature as Exclude<LeadTemperature, null>].dot}`} />
            )}
            <SelectValue />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          <SelectItem value="quente">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              Quente
            </span>
          </SelectItem>
          <SelectItem value="morno">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              Morno
            </span>
          </SelectItem>
          <SelectItem value="frio">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Frio
            </span>
          </SelectItem>
          <SelectItem value="none">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full border border-muted-foreground" />
              Sem classificação
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      {/* Mais filtros */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            className={`h-9 text-sm ${drawerFiltersCount > 0 ? 'border-primary' : ''}`}
          >
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Mais filtros{drawerFiltersCount > 0 ? ` (${drawerFiltersCount})` : ''}
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="flex w-[380px] flex-col gap-0 p-0 sm:max-w-[380px]">
          <SheetHeader className="border-b px-5 py-4 text-left">
            <SheetTitle>Mais filtros</SheetTitle>
            <SheetDescription>
              Filtros de uso eventual. Os ativos aparecem como chips acima do kanban.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
            {/* Situação do negócio */}
            <section className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Situação do negócio</h4>

              <div className="space-y-1.5">
                <Label className="text-sm">Status</Label>
                <Select
                  value={filters.dealStatus}
                  onValueChange={(value) => onChange({ ...filters, dealStatus: value as 'all' | 'open' | 'won' | 'lost' })}
                >
                  <SelectTrigger className={`h-9 w-full text-sm ${filters.dealStatus !== 'all' ? 'border-primary' : ''}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="open">
                      <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500" />Abertos</span>
                    </SelectItem>
                    <SelectItem value="won">
                      <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500" />Ganhos</span>
                    </SelectItem>
                    <SelectItem value="lost">
                      <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500" />Perdidos</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Prioridade de atividade</Label>
                <Select
                  value={filters.activityPriority}
                  onValueChange={(value) => onChange({ ...filters, activityPriority: value as ActivityPriorityFilter })}
                >
                  <SelectTrigger className={`h-9 w-full text-sm ${filters.activityPriority !== 'all' ? 'border-primary' : ''}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Qualquer</SelectItem>
                    <SelectItem value="high">
                      <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500" />Alta (0 ativ.)</span>
                    </SelectItem>
                    <SelectItem value="medium">
                      <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-500" />Média (1-3 ativ.)</span>
                    </SelectItem>
                    <SelectItem value="low">
                      <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500" />Baixa (4+ ativ.)</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Outside</Label>
                <Select
                  value={filters.outsideFilter}
                  onValueChange={(value) => onChange({ ...filters, outsideFilter: value as OutsideFilter })}
                >
                  <SelectTrigger className={`h-9 w-full text-sm ${filters.outsideFilter !== 'all' ? 'border-primary' : ''}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="outside_only">
                      <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-500" />Todos Outside</span>
                    </SelectItem>
                    <SelectItem value="outside_not_worked">
                      <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500" />Outside Não Trabalhados</span>
                    </SelectItem>
                    <SelectItem value="outside_worked">
                      <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500" />Outside Trabalhados</span>
                    </SelectItem>
                    <SelectItem value="not_outside">
                      <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-gray-400" />Sem Outside</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Motivo de sem interesse</Label>
                  {(filters.lossReasons?.length ?? 0) > 0 && (
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => onChange({ ...filters, lossReasons: [] })}>
                      Limpar
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Mostra só negócios na etapa Sem Interesse com o motivo escolhido.
                </p>
                <div className={`max-h-56 space-y-2 overflow-y-auto rounded-md border p-2 ${(filters.lossReasons?.length ?? 0) > 0 ? 'border-primary' : ''}`}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={(filters.lossReasons ?? []).includes(SEM_MOTIVO_FILTER_VALUE)}
                      onCheckedChange={() => toggleLossReason(SEM_MOTIVO_FILTER_VALUE)}
                    />
                    <span>Sem motivo registrado</span>
                  </label>
                  {lossReasonOptions.map((reason) => (
                    <label key={reason.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={(filters.lossReasons ?? []).includes(reason.label)}
                        onCheckedChange={() => toggleLossReason(reason.label)}
                      />
                      <span>
                        {reason.label}
                        {!reason.is_active && <span className="text-muted-foreground"> (antigo)</span>}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Resgate</Label>
                <Select
                  value={filters.resgate ?? 'all'}
                  onValueChange={(value) => onChange({ ...filters, resgate: value as 'all' | 'only' | 'none' })}
                >
                  <SelectTrigger className={`h-9 w-full text-sm ${(filters.resgate ?? 'all') !== 'all' ? 'border-primary' : ''}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="only">Só Resgate</SelectItem>
                    <SelectItem value="none">Sem Resgate</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Projeto</Label>
                <Select
                  value={filters.projeto ?? 'all'}
                  onValueChange={(value) => onChange({ ...filters, projeto: value as ProjetoFiltro })}
                >
                  <SelectTrigger className={`h-9 w-full text-sm ${(filters.projeto ?? 'all') !== 'all' ? 'border-primary' : ''}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="sem_projeto">Sem projeto</SelectItem>
                    <SelectItem value="aprovado">Projeto aprovado</SelectItem>
                    <SelectItem value="nenhum">Sem interesse</SelectItem>
                    <SelectItem value="sem_info">Sem informação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </section>

            {/* Origem e produto */}
            <section className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Origem e produto</h4>

              <div className="space-y-1.5">
                <Label className="text-sm">Tags</Label>
                <div className="[&>button]:h-9 [&>button]:w-full [&>button]:justify-start">
                  <TagFilterPopover
                    availableTags={availableTags}
                    tagFilters={filters.tagFilters}
                    tagOperator={filters.tagOperator}
                    onChangeFilters={(tagFilters, tagOperator) => onChange({ ...filters, tagFilters, tagOperator })}
                    isLoading={isLoadingTags}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Produtos</Label>
                <div className="[&>button]:h-9 [&>button]:w-full [&>button]:justify-start">
                  <ProductFilterPopover
                    availableProducts={availableProducts}
                    productFilters={filters.productFilters}
                    productOperator={filters.productOperator}
                    onChangeFilters={(productFilters, productOperator) => onChange({ ...filters, productFilters, productOperator })}
                    isLoading={isLoadingProducts}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Data de criação</Label>
                <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={`h-9 w-full justify-start text-left text-sm font-normal ${filters.dateRange?.from ? 'border-primary' : ''}`}
                    >
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
                        <span className="text-muted-foreground">Qualquer</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
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
              </div>
            </section>

            {/* Atividade */}
            <section className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Atividade</h4>
              <div className="space-y-1.5">
                <Label className="text-sm">Tentativas</Label>
                <Popover open={isAttemptsPopoverOpen} onOpenChange={setIsAttemptsPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={`h-9 w-full justify-start text-left text-sm font-normal ${filters.attemptsRange ? 'border-primary' : ''}`}
                    >
                      <Phone className="mr-2 h-4 w-4" />
                      {filters.attemptsRange
                        ? `${filters.attemptsRange.min} a ${filters.attemptsRange.max} tent.`
                        : <span className="text-muted-foreground">Qualquer</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64" align="start">
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Quantidade de tentativas</Label>
                      <div className="flex items-center gap-2">
                        <Input type="number" min={0} placeholder="Mín" value={localMinAttempts} onChange={(e) => setLocalMinAttempts(e.target.value)} className="w-20" />
                        <span className="text-muted-foreground">a</span>
                        <Input type="number" min={0} placeholder="Máx" value={localMaxAttempts} onChange={(e) => setLocalMaxAttempts(e.target.value)} className="w-20" />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleApplyAttemptsFilter} className="flex-1">Aplicar</Button>
                        {filters.attemptsRange && (
                          <Button size="sm" variant="ghost" onClick={handleClearAttemptsFilter}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </section>

            {/* Reunião */}
            <section className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reunião</h4>
              <div className="space-y-1.5">
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label className="inline-flex items-center gap-1 text-sm">
                        Closer da reunião (R1/R2)
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                      </Label>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p>Filtra pelo closer que realizou <strong>R1 ou R2</strong>, não pelo dono do negócio.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Select
                  value={filters.closerEmail || 'all'}
                  onValueChange={(value) => onChange({ ...filters, closerEmail: value === 'all' ? null : value })}
                >
                  <SelectTrigger className={`h-9 w-full text-sm ${filters.closerEmail ? 'border-primary' : ''}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {(closerFilterOptions || []).map((opt) => (
                      <SelectItem key={opt.email} value={opt.email}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>
          </div>

          <SheetFooter className="flex-row gap-2 border-t px-5 py-3 sm:justify-between">
            <Button variant="ghost" onClick={onClear}>Limpar filtros</Button>
            <Button onClick={() => setIsDrawerOpen(false)}>Ver resultados</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {activeFiltersCount > 0 && (
        <Button variant="ghost" size="sm" className="h-9" onClick={onClear}>
          <X className="h-4 w-4 mr-1" />
          Limpar ({activeFiltersCount})
        </Button>
      )}
    </div>
  );
};
