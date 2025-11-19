import { useState } from 'react';
import { Check, ChevronsUpDown, Search, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
import { useClintContacts } from '@/hooks/useClintAPI';

interface ContactSelectorProps {
  value?: string;
  onValueChange: (value: string) => void;
}

export function ContactSelector({ value, onValueChange }: ContactSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: contacts = [], isLoading } = useClintContacts(
    searchQuery ? { search: searchQuery } : undefined
  );

  const selectedContact = contacts.find((contact) => contact.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedContact ? (
            <div className="flex items-center gap-2">
              <span className="truncate">{selectedContact.name}</span>
              {selectedContact.email && (
                <span className="text-xs text-muted-foreground truncate">
                  ({selectedContact.email})
                </span>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">Selecione um contato...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Buscar contato..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>
              {isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Search className="h-4 w-4 animate-spin" />
                  <span className="ml-2 text-sm">Buscando...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <UserPlus className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum contato encontrado
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Crie um novo contato primeiro
                  </p>
                </div>
              )}
            </CommandEmpty>
            <CommandGroup>
              {contacts.map((contact) => (
                <CommandItem
                  key={contact.id}
                  value={contact.id}
                  onSelect={() => {
                    onValueChange(contact.id === value ? '' : contact.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === contact.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{contact.name}</span>
                    {contact.email && (
                      <span className="text-xs text-muted-foreground">
                        {contact.email}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
