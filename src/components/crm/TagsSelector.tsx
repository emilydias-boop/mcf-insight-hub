import { useState } from 'react';
import { Check, X, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useClintTags } from '@/hooks/useClintAPI';

interface TagsSelectorProps {
  value: string[];
  onValueChange: (value: string[]) => void;
}

export function TagsSelector({ value = [], onValueChange }: TagsSelectorProps) {
  const [open, setOpen] = useState(false);
  
  const { data: tagsResponse, isLoading } = useClintTags();
  
  // Extract array from API response structure
  const tags = Array.isArray(tagsResponse) ? tagsResponse : (tagsResponse?.data || []);

  const selectedTags = tags.filter((tag) => value.includes(tag.id));

  const toggleTag = (tagId: string) => {
    if (value.includes(tagId)) {
      onValueChange(value.filter((id) => id !== tagId));
    } else {
      onValueChange([...value, tagId]);
    }
  };

  const removeTag = (tagId: string) => {
    onValueChange(value.filter((id) => id !== tagId));
  };

  return (
    <div className="space-y-2">
      {/* Selected Tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="gap-1"
              style={{
                backgroundColor: tag.color ? `${tag.color}20` : undefined,
                borderColor: tag.color || undefined,
              }}
            >
              {tag.name}
              <button
                type="button"
                onClick={() => removeTag(tag.id)}
                className="ml-1 rounded-full hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Tag Selector */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-start"
          >
            <Tag className="mr-2 h-4 w-4" />
            {value.length === 0 ? (
              <span className="text-muted-foreground">Selecione tags...</span>
            ) : (
              <span>{value.length} tag(s) selecionada(s)</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar tags..." />
            <CommandList>
              <CommandEmpty>
                {isLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <span className="text-sm">Carregando tags...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <Tag className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Nenhuma tag encontrada
                    </p>
                  </div>
                )}
              </CommandEmpty>
              <CommandGroup>
                {tags.map((tag) => (
                  <CommandItem
                    key={tag.id}
                    value={tag.id}
                    onSelect={() => toggleTag(tag.id)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value.includes(tag.id) ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <Badge
                      variant="outline"
                      style={{
                        backgroundColor: tag.color ? `${tag.color}20` : undefined,
                        borderColor: tag.color || undefined,
                      }}
                    >
                      {tag.name}
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
