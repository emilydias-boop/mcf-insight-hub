import { useState } from 'react';
import { Search, User, Briefcase, ShoppingCart, Loader2, X, Sparkles, History } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useConsorciadoSearch, useConsorciadoHistory, type ConsorciadoMatch } from '@/hooks/useConsorciadoSearch';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';

const sourceMeta: Record<ConsorciadoMatch['source'], { label: string; icon: any; color: string }> = {
  consortium: { label: 'Cota anterior', icon: Briefcase, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  crm: { label: 'Lead CRM', icon: User, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  hubla: { label: 'Comprador', icon: ShoppingCart, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
};

interface Props {
  tipoPessoa: 'pf' | 'pj';
  onSelect: (match: ConsorciadoMatch) => void;
}

export function ConsorciadoSearchPanel({ tipoPessoa, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ConsorciadoMatch | null>(null);
  const { data: results = [], isFetching } = useConsorciadoSearch(query);
  const { data: history, isFetching: loadingHistory } = useConsorciadoHistory(selected);

  const handlePick = (m: ConsorciadoMatch) => {
    setSelected(m);
    setOpen(false);
    onSelect(m);
  };

  const clearSelected = () => setSelected(null);

  return (
    <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium text-primary">
        <Sparkles className="h-3.5 w-3.5" />
        Buscar consorciado existente (cotas, leads, compradores)
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => query.length >= 3 && setOpen(true)}
              placeholder={tipoPessoa === 'pf' ? 'Nome, CPF, telefone ou email…' : 'Razão social, CNPJ, telefone ou email…'}
              className="pl-8"
            />
            {isFetching && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={4}
          className="w-[--radix-popover-trigger-width] p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <ScrollArea className="max-h-72">
            {query.trim().length < 3 ? (
              <div className="p-3 text-xs text-muted-foreground">Digite ao menos 3 caracteres…</div>
            ) : results.length === 0 && !isFetching ? (
              <div className="p-3 text-xs text-muted-foreground">Nenhum registro encontrado.</div>
            ) : (
              <div className="p-1">
                {results.map((m) => {
                  const meta = sourceMeta[m.source];
                  const Icon = meta.icon;
                  return (
                    <button
                      type="button"
                      key={`${m.source}-${m.id}`}
                      onClick={() => handlePick(m)}
                      className="flex w-full items-start gap-2 rounded px-2 py-2 text-left hover:bg-muted/60"
                    >
                      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{m.nome || m.email || '(sem nome)'}</span>
                          <Badge variant="secondary" className={cn('text-[10px]', meta.color)}>{meta.label}</Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {[m.cpf_cnpj, m.telefone, m.email].filter(Boolean).join(' · ')}
                        </div>
                        {m.source === 'consortium' && (m.grupo || m.cota) && (
                          <div className="text-[11px] text-muted-foreground">Grupo {m.grupo} · Cota {m.cota} · {m.status}</div>
                        )}
                        {m.source === 'hubla' && m.product_name && (
                          <div className="text-[11px] text-muted-foreground truncate">{m.product_name} {m.sale_date ? `· ${formatDate(m.sale_date)}` : ''}</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {selected && (
        <div className="rounded border bg-background p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <History className="h-3.5 w-3.5" />
              Histórico de {selected.nome || 'contato'}
            </div>
            <Button type="button" size="sm" variant="ghost" className="h-6 px-2" onClick={clearSelected}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          {loadingHistory ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Carregando…</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
              <div className="rounded border bg-muted/30 p-2">
                <div className="font-semibold mb-1 flex items-center gap-1"><Briefcase className="h-3 w-3" /> Cotas ({history?.cards.length ?? 0})</div>
                {(history?.cards || []).slice(0, 5).map((c) => (
                  <div key={c.id} className="truncate text-muted-foreground">G{c.grupo}/C{c.cota} · {formatCurrency(Number(c.valor_credito))} · {c.status}</div>
                ))}
                {!history?.cards.length && <div className="text-muted-foreground/60 italic">Nenhuma</div>}
              </div>
              <div className="rounded border bg-muted/30 p-2">
                <div className="font-semibold mb-1 flex items-center gap-1"><User className="h-3 w-3" /> Leads CRM ({history?.deals.length ?? 0})</div>
                {(history?.deals || []).slice(0, 5).map((d) => (
                  <div key={d.id} className="truncate text-muted-foreground">{d.product_name || d.name} · {formatDate(d.created_at)}</div>
                ))}
                {!history?.deals.length && <div className="text-muted-foreground/60 italic">Nenhum</div>}
              </div>
              <div className="rounded border bg-muted/30 p-2">
                <div className="font-semibold mb-1 flex items-center gap-1"><ShoppingCart className="h-3 w-3" /> Compras ({history?.hubla.length ?? 0})</div>
                {(history?.hubla || []).slice(0, 5).map((h) => (
                  <div key={h.id} className="truncate text-muted-foreground">{h.product_name} {h.sale_date ? `· ${formatDate(h.sale_date)}` : ''}</div>
                ))}
                {!history?.hubla.length && <div className="text-muted-foreground/60 italic">Nenhuma</div>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}