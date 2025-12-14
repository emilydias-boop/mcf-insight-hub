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
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Search, X, Calendar as CalendarIcon } from 'lucide-react';
import { useClintTags, useClintUsers } from '@/hooks/useClintAPI';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';

export interface DealFiltersState {
  search: string;
  dateRange: DateRange | undefined;
  tags: string[];
  owner: string | null;
}

interface DealFiltersProps {
  filters: DealFiltersState;
  onChange: (filters: DealFiltersState) => void;
  onClear: () => void;
}

export const DealFilters = ({ filters, onChange, onClear }: DealFiltersProps) => {
  const { data: tagsData } = useClintTags();
  const { data: usersData } = useClintUsers();
  const tags = tagsData?.data || [];
  const users = usersData?.data || [];
  
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  
  const activeFiltersCount = [
    filters.search,
    filters.dateRange?.from,
    filters.tags.length > 0,
    filters.owner,
  ].filter(Boolean).length;
  
  return (
    <div className="flex flex-wrap gap-2 items-center p-4 bg-muted/20 border-b">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar negócios..."
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="pl-8"
        />
      </div>
      
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
              "Data"
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
      
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline">
            Tags
            {filters.tags.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {filters.tags.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Filtrar por Tags</h4>
            <div className="space-y-1">
              {tags.map((tag: any) => (
                <label key={tag.id} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.tags.includes(tag.id)}
                    onChange={(e) => {
                      const newTags = e.target.checked
                        ? [...filters.tags, tag.id]
                        : filters.tags.filter(t => t !== tag.id);
                      onChange({ ...filters, tags: newTags });
                    }}
                    className="rounded"
                  />
                  <Badge style={{ backgroundColor: tag.color }}>{tag.name}</Badge>
                </label>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      
      <Select
        value={filters.owner || 'all'}
        onValueChange={(value) => onChange({ ...filters, owner: value === 'all' ? null : value })}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Dono do negócio" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
{users
            .filter((user: any) => user.id && user.email && user.email.trim() !== '' && user.first_name)
            .map((user: any) => (
              <SelectItem key={user.id} value={user.email}>
                {`${user.first_name} ${user.last_name || ''}`.trim()}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
      
      {activeFiltersCount > 0 && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="h-4 w-4 mr-1" />
          Limpar ({activeFiltersCount})
        </Button>
      )}
    </div>
  );
};
