import { Button } from '@/components/ui/button';
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
import { ArrowUpDown, Check, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SortOption = 
  | 'newest' 
  | 'oldest' 
  | 'most_activities' 
  | 'least_activities' 
  | 'most_calls' 
  | 'least_calls';

interface SortOptionItem {
  value: SortOption;
  label: string;
  icon?: 'up' | 'down';
}

const sortOptions: SortOptionItem[] = [
  { value: 'newest', label: 'Mais Novo', icon: 'down' },
  { value: 'oldest', label: 'Mais Antigo', icon: 'up' },
];

const activityOptions: SortOptionItem[] = [
  { value: 'most_activities', label: '+ Atividades', icon: 'down' },
  { value: 'least_activities', label: '− Atividades', icon: 'up' },
];

const callOptions: SortOptionItem[] = [
  { value: 'most_calls', label: '+ Tentativas', icon: 'down' },
  { value: 'least_calls', label: '− Tentativas', icon: 'up' },
];

interface StageSortDropdownProps {
  currentSort: SortOption;
  onSortChange: (sort: SortOption) => void;
}

export const StageSortDropdown = ({ currentSort, onSortChange }: StageSortDropdownProps) => {
  const isDescending = ['newest', 'most_activities', 'most_calls'].includes(currentSort);
  
  const renderOption = (option: SortOptionItem) => (
    <button
      key={option.value}
      onClick={() => onSortChange(option.value)}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors",
        "hover:bg-muted",
        currentSort === option.value && "bg-muted font-medium"
      )}
    >
      {currentSort === option.value ? (
        <Check className="h-3.5 w-3.5 text-primary" />
      ) : (
        <span className="w-3.5" />
      )}
      <span className="flex-1 text-left">{option.label}</span>
      {option.icon === 'up' ? (
        <ArrowUp className="h-3 w-3 text-muted-foreground" />
      ) : (
        <ArrowDown className="h-3 w-3 text-muted-foreground" />
      )}
    </button>
  );

  return (
    <TooltipProvider>
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 hover:bg-background/50"
              >
                {isDescending ? (
                  <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ArrowUp className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Ordenar coluna</p>
          </TooltipContent>
        </Tooltip>
        
        <PopoverContent className="w-44 p-1.5" align="start">
          <div className="space-y-0.5">
            {sortOptions.map(renderOption)}
          </div>
          
          <div className="my-1.5 border-t" />
          
          <div className="space-y-0.5">
            {activityOptions.map(renderOption)}
          </div>
          
          <div className="my-1.5 border-t" />
          
          <div className="space-y-0.5">
            {callOptions.map(renderOption)}
          </div>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
};
