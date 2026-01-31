import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tag, Search, X } from 'lucide-react';

interface TagFilterPopoverProps {
  availableTags: string[];
  selectedTags: string[];
  onChange: (tags: string[]) => void;
  isLoading?: boolean;
}

export const TagFilterPopover = ({
  availableTags,
  selectedTags,
  onChange,
  isLoading = false,
}: TagFilterPopoverProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filtrar tags baseado na busca
  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return availableTags;
    const query = searchQuery.toLowerCase();
    return availableTags.filter((tag) => 
      tag.toLowerCase().includes(query)
    );
  }, [availableTags, searchQuery]);

  const handleToggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onChange(selectedTags.filter((t) => t !== tag));
    } else {
      onChange([...selectedTags, tag]);
    }
  };

  const handleClearAll = () => {
    onChange([]);
    setSearchQuery('');
  };

  const hasSelection = selectedTags.length > 0;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={hasSelection ? 'default' : 'outline'}
          className="justify-start text-left font-normal"
        >
          <Tag className="mr-2 h-4 w-4" />
          {hasSelection ? (
            <>
              Tags
              <Badge 
                variant="secondary" 
                className="ml-2 h-5 px-1.5 text-xs"
              >
                {selectedTags.length}
              </Badge>
            </>
          ) : (
            'Tags'
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-3 border-b">
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

        <ScrollArea className="h-[240px]">
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
              <div className="space-y-1">
                {filteredTags.map((tag) => (
                  <label
                    key={tag}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedTags.includes(tag)}
                      onCheckedChange={() => handleToggleTag(tag)}
                    />
                    <span className="text-sm truncate flex-1">{tag}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {hasSelection && (
          <div className="p-2 border-t">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClearAll}
              className="w-full"
            >
              <X className="h-4 w-4 mr-1" />
              Limpar seleção ({selectedTags.length})
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
