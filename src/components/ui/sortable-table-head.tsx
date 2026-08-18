import * as React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { SortDir } from '@/lib/ordenacaoTabela';

interface SortableTableHeadProps<F extends string> {
  field: F;
  /** campo atualmente ordenado */
  active: F;
  dir: SortDir;
  onSort: (field: F) => void;
  className?: string;
  /** alinhamento do conteúdo do botão */
  align?: 'left' | 'right' | 'center';
  children: React.ReactNode;
}

/**
 * Cabeçalho ordenável no padrão visual do ColaboradoresTable.
 * Para colunas não ordenáveis (Ações, "Nº" de posição) use `<TableHead>` normal.
 */
export function SortableTableHead<F extends string>({
  field,
  active,
  dir,
  onSort,
  className,
  align = 'left',
  children,
}: SortableTableHeadProps<F>) {
  const ativo = active === field;
  return (
    <TableHead
      className={className}
      aria-sort={ativo ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          'flex items-center hover:text-foreground transition-colors',
          align === 'right' && 'ml-auto',
          align === 'center' && 'mx-auto',
        )}
      >
        {children}
        {!ativo ? (
          <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />
        ) : dir === 'asc' ? (
          <ArrowUp className="h-3 w-3 ml-1" />
        ) : (
          <ArrowDown className="h-3 w-3 ml-1" />
        )}
      </button>
    </TableHead>
  );
}
