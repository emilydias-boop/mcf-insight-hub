import { useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
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
import { useEmployees } from '@/hooks/useEmployees';

interface EmployeeSearchComboboxProps {
  value: string | null;
  onChange: (value: string | null) => void;
  excludeIds?: string[];
  placeholder?: string;
}

export default function EmployeeSearchCombobox({
  value,
  onChange,
  excludeIds = [],
  placeholder = 'Buscar colaborador...',
}: EmployeeSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const { data: employees = [] } = useEmployees();

  // Filtrar apenas colaboradores ativos e que não estão na lista de exclusão
  const availableEmployees = employees.filter(
    (e) => e.status === 'ativo' && !excludeIds.includes(e.id)
  );

  const selectedEmployee = employees.find((e) => e.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedEmployee ? (
            <span className="truncate">{selectedEmployee.nome_completo}</span>
          ) : (
            <span className="text-muted-foreground flex items-center gap-2">
              <Search className="h-4 w-4" />
              {placeholder}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Digite o nome..." />
          <CommandList>
            <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
            <CommandGroup>
              {availableEmployees.map((employee) => (
                <CommandItem
                  key={employee.id}
                  value={employee.nome_completo}
                  onSelect={() => {
                    onChange(employee.id === value ? null : employee.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === employee.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{employee.nome_completo}</span>
                    {employee.cargo && (
                      <span className="text-xs text-muted-foreground">{employee.cargo}</span>
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
