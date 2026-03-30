import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tag, Search, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TagFilterRule {
  tag: string;
  mode: 'has' | 'not_has';
}

export type TagOperator = 'and' | 'or';

interface TagFilterPopoverProps {
  availableTags: string[];
  /** @deprecated Use tagFilters + onChangeFilters instead */
  selectedTags?: string[];
  /** @deprecated Use tagFilters + onChangeFilters instead */
  onChange?: (tags: string[]) => void;
  /** Advanced mode: structured tag filter rules */
  tagFilters?: TagFilterRule[];
  /** Advanced mode: AND/OR operator */
  tagOperator?: TagOperator;
  /** Advanced mode: handler for filter rules */
  onChangeFilters?: (filters: TagFilterRule[], operator: TagOperator) => void;
  isLoading?: boolean;
}

export const TagFilterPopover = ({
  availableTags,
  selectedTags,
  onChange,
  tagFilters,
  tagOperator = 'and',
  onChangeFilters,
  isLoading = false,
}: TagFilterPopoverProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [addMode, setAddMode] = useState<'has' | 'not_has'>('has');

  // Determine if we're in advanced mode
  const isAdvanced = !!onChangeFilters;
  const rules = tagFilters || [];
  const operator = tagOperator;

  // Legacy compatibility: convert selectedTags to rules for display count
  const activeCount = isAdvanced ? rules.length : (selectedTags?.length || 0);

  // Filter available tags based on search
  const filteredTags = useMemo(() => {
    // Exclude tags already added as rules
    const usedTags = new Set(rules.map(r => r.tag));
    let tags = availableTags.filter(t => !usedTags.has(t));
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      tags = tags.filter((tag) => tag.toLowerCase().includes(query));
    }
    return tags;
  }, [availableTags, searchQuery, rules]);

  const handleAddRule = (tag: string) => {
    if (isAdvanced && onChangeFilters) {
      onChangeFilters([...rules, { tag, mode: addMode }], operator);
    } else if (onChange && selectedTags) {
      // Legacy mode
      if (!selectedTags.includes(tag)) {
        onChange([...selectedTags, tag]);
      }
    }
    setSearchQuery('');
  };

  const handleRemoveRule = (index: number) => {
    if (isAdvanced && onChangeFilters) {
      const next = rules.filter((_, i) => i !== index);
      onChangeFilters(next, operator);
    }
  };

  const handleToggleOperator = (op: TagOperator) => {
    if (isAdvanced && onChangeFilters) {
      onChangeFilters(rules, op);
    }
  };

  const handleClearAll = () => {
    if (isAdvanced && onChangeFilters) {
      onChangeFilters([], 'and');
    } else if (onChange) {
      onChange([]);
    }
    setSearchQuery('');
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={activeCount > 0 ? 'default' : 'outline'}
          className="justify-start text-left font-normal"
        >
          <Tag className="mr-2 h-4 w-4" />
          Tags
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        {/* Operator toggle - only in advanced mode */}
        {isAdvanced && (
          <div className="p-3 border-b flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Operador:</span>
            <div className="flex rounded-md border overflow-hidden">
              <button
                className={cn(
                  "px-3 py-1 text-xs font-medium transition-colors",
                  operator === 'and'
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                )}
                onClick={() => handleToggleOperator('and')}
              >
                E
              </button>
              <button
                className={cn(
                  "px-3 py-1 text-xs font-medium transition-colors border-l",
                  operator === 'or'
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                )}
                onClick={() => handleToggleOperator('or')}
              >
                OU
              </button>
            </div>
            <span className="text-[10px] text-muted-foreground ml-auto">
              {operator === 'and' ? 'Todas as condições' : 'Qualquer condição'}
            </span>
          </div>
        )}

        {/* Active rules list */}
        {isAdvanced && rules.length > 0 && (
          <div className="p-2 border-b space-y-1">
            {rules.map((rule, idx) => (
              <div
                key={`${rule.tag}-${idx}`}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs",
                  rule.mode === 'has' 
                    ? "bg-green-500/10 text-green-700 dark:text-green-400" 
                    : "bg-red-500/10 text-red-700 dark:text-red-400"
                )}
              >
                <span className="font-medium shrink-0">
                  {rule.mode === 'has' ? 'Possui' : 'Não possui'}
                </span>
                <span className="truncate flex-1 font-mono">{rule.tag}</span>
                <button
                  onClick={() => handleRemoveRule(idx)}
                  className="shrink-0 hover:opacity-70"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add mode selector + search */}
        <div className="p-3 border-b space-y-2">
          {isAdvanced && (
            <Select value={addMode} onValueChange={(v) => setAddMode(v as 'has' | 'not_has')}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="has">✅ Possui a tag</SelectItem>
                <SelectItem value="not_has">❌ Não possui a tag</SelectItem>
              </SelectContent>
            </Select>
          )}
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>

        {/* Tags list */}
        <ScrollArea className="h-[200px]">
          <div className="p-2">
            {isLoading ? (
              <div className="text-center py-4 text-sm text-muted-foreground">
                Carregando tags...
              </div>
            ) : filteredTags.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground">
                {searchQuery ? 'Nenhuma tag encontrada' : 'Sem tags disponíveis'}
              </div>
            ) : (
              <div className="space-y-0.5">
                {filteredTags.map((tag) => (
                  <button
                    key={tag}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer text-left"
                    onClick={() => handleAddRule(tag)}
                  >
                    <Plus className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate flex-1">{tag}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Clear all */}
        {activeCount > 0 && (
          <div className="p-2 border-t">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClearAll}
              className="w-full"
            >
              <X className="h-4 w-4 mr-1" />
              Limpar filtros ({activeCount})
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
