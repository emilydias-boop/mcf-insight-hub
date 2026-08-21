import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OpcaoMultiSelecao {
  valor: string;
  rotulo: string;
  /** quantos leads a opção alcança — exibido ao lado do rótulo */
  leads?: number;
}

interface Props {
  rotuloBotao: string;
  placeholderBusca: string;
  opcoes: OpcaoMultiSelecao[];
  selecionados: string[];
  onChange: (valores: string[]) => void;
  disabled?: boolean;
  isLoading?: boolean;
  vazioTexto?: string;
}

const fmt = (n: number) => new Intl.NumberFormat('pt-BR').format(n ?? 0);

/**
 * Multi-seleção no mesmo formato dos filtros do CRM (TagFilterPopover /
 * ProductFilterPopover): busca, lista com rolagem, contador no gatilho.
 */
export function MultiSelecaoPopover({
  rotuloBotao,
  placeholderBusca,
  opcoes,
  selecionados,
  onChange,
  disabled = false,
  isLoading = false,
  vazioTexto = 'Nenhuma opção disponível',
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return opcoes;
    return opcoes.filter((o) => o.rotulo.toLowerCase().includes(termo));
  }, [opcoes, busca]);

  const alternar = (valor: string) => {
    onChange(
      selecionados.includes(valor)
        ? selecionados.filter((v) => v !== valor)
        : [...selecionados, valor],
    );
  };

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={selecionados.length > 0 ? 'default' : 'outline'}
          className="w-full justify-start text-left font-normal"
          disabled={disabled}
        >
          {rotuloBotao}
          {selecionados.length > 0 && (
            <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
              {selecionados.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="space-y-2 border-b p-3">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={placeholderBusca}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-9 pl-8"
            />
          </div>
        </div>

        <ScrollArea className="h-[220px]">
          <div className="p-2">
            {isLoading ? (
              <div className="py-4 text-center text-sm text-muted-foreground">Carregando...</div>
            ) : filtradas.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                {busca ? 'Nada encontrado' : vazioTexto}
              </div>
            ) : (
              <div className="space-y-0.5">
                {filtradas.map((o) => {
                  const marcado = selecionados.includes(o.valor);
                  return (
                    <button
                      key={o.valor}
                      type="button"
                      onClick={() => alternar(o.valor)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted',
                        marcado && 'bg-muted',
                      )}
                    >
                      <Check
                        className={cn(
                          'h-4 w-4 shrink-0',
                          marcado ? 'text-primary' : 'text-transparent',
                        )}
                      />
                      <span className="flex-1 truncate text-sm">{o.rotulo}</span>
                      {typeof o.leads === 'number' && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          ({fmt(o.leads)})
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>

        {selecionados.length > 0 && (
          <div className="border-t p-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="w-full"
              onClick={() => onChange([])}
            >
              <X className="mr-1 h-4 w-4" />
              Limpar ({selecionados.length})
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
