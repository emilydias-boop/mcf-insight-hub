import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLinkPendingToCard } from '@/hooks/useConsorcioPendingRegistrations';
import { formatCurrency } from '@/lib/consorcioCalculos';

interface LinkExistingCotaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registrationId: string;
  cpf?: string | null;
  cnpj?: string | null;
  pessoaNome?: string | null;
}

export function LinkExistingCotaModal({
  open,
  onOpenChange,
  registrationId,
  cpf,
  cnpj,
  pessoaNome,
}: LinkExistingCotaModalProps) {
  const [search, setSearch] = useState('');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  /** Busca ampla (fora do CPF/CNPJ do cadastro) é ação explícita e avisada. */
  const [buscaAmpla, setBuscaAmpla] = useState(false);
  const link = useLinkPendingToCard();

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ['link-cota-search', cpf, cnpj, search, buscaAmpla, open],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from('consortium_cards')
        .select('id, grupo, cota, valor_credito, nome_completo, razao_social, cpf, cnpj, status')
        .order('created_at', { ascending: false })
        .limit(50);

      const temDoc = !!(cpf || cnpj);
      if (temDoc && !buscaAmpla) {
        // Padrão: só cotas do MESMO cliente (CPF/CNPJ do cadastro).
        const parts: string[] = [];
        if (cpf) parts.push(`cpf.eq.${cpf}`);
        if (cnpj) parts.push(`cnpj.eq.${cnpj}`);
        q = q.or(parts.join(','));
        if (search.trim()) {
          const s = search.trim();
          q = q.or(`nome_completo.ilike.%${s}%,razao_social.ilike.%${s}%,grupo.ilike.%${s}%,cota.ilike.%${s}%`);
        }
      } else if (search.trim()) {
        const s = search.trim();
        q = q.or(
          `nome_completo.ilike.%${s}%,razao_social.ilike.%${s}%,grupo.ilike.%${s}%,cota.ilike.%${s}%,cpf.ilike.%${s}%,cnpj.ilike.%${s}%`,
        );
      }

      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Cotas já vinculadas a algum cadastro pendente — não podem receber outro.
  const cardIds = cards.map((c: any) => c.id);
  const { data: jaVinculadas = new Set<string>() } = useQuery({
    queryKey: ['link-cota-ja-vinculadas', cardIds.join(',')],
    enabled: open && cardIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consorcio_pending_registrations')
        .select('consortium_card_id, id')
        .in('consortium_card_id', cardIds);
      if (error) throw error;
      const set = new Set<string>();
      for (const r of data || []) {
        const cid = (r as any).consortium_card_id;
        if (cid && (r as any).id !== registrationId) set.add(cid as string);
      }
      return set;
    },
  });

  const handleLink = async () => {
    if (!selectedCardId || jaVinculadas.has(selectedCardId)) return;
    await link.mutateAsync({ registrationId, cardId: selectedCardId });
    onOpenChange(false);
    setSelectedCardId(null);
    setSearch('');
  };

  const docLabel = cpf || cnpj || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Vincular a uma cota existente</DialogTitle>
          <DialogDescription>
            {pessoaNome ? `Selecione a cota de ${pessoaNome} já cadastrada no sistema.` : 'Selecione a cota destino.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {docLabel && (
            <div className="flex items-start gap-2 rounded-md border p-2 text-xs">
              <Checkbox
                id="busca-ampla"
                checked={buscaAmpla}
                onCheckedChange={(v) => { setBuscaAmpla(!!v); setSelectedCardId(null); }}
                className="mt-0.5"
              />
              <label htmlFor="busca-ampla" className="cursor-pointer">
                <span className="font-medium">Buscar cotas de outros clientes</span>
                <span className="block text-muted-foreground">
                  Por padrão listamos apenas cotas do CPF/CNPJ {docLabel}. Vincular a cota de
                  outro cliente corrompe o histórico — use só com validação do operacional.
                </span>
              </label>
            </div>
          )}
          {buscaAmpla && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Busca ampla ativa: as cotas abaixo podem pertencer a outro cliente.
            </div>
          )}
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome, grupo, cota, CPF/CNPJ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <ScrollArea className="h-[360px] border rounded-md">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : cards.length === 0 ? (
              <p className="text-sm text-muted-foreground p-6 text-center">
                Nenhuma cota encontrada.
              </p>
            ) : (
              <ul className="divide-y">
                {cards.map((c: any) => {
                  const isSelected = selectedCardId === c.id;
                  const vinculada = jaVinculadas.has(c.id);
                  const docDiferente =
                    !!docLabel && ((cpf && c.cpf && c.cpf !== cpf) || (cnpj && c.cnpj && c.cnpj !== cnpj));
                  return (
                    <li
                      key={c.id}
                      onClick={() => { if (!vinculada) setSelectedCardId(c.id); }}
                      className={`p-3 transition ${vinculada ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${
                        isSelected ? 'bg-primary/10 border-l-2 border-primary' : vinculada ? '' : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">
                            {c.nome_completo || c.razao_social || '—'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Grupo {c.grupo} · Cota {c.cota} · {c.cpf || c.cnpj || '—'}
                          </p>
                          {vinculada && (
                            <p className="text-xs font-medium text-destructive">
                              Já vinculada a outro cadastro pendente
                            </p>
                          )}
                          {!vinculada && docDiferente && (
                            <p className="text-xs font-medium text-destructive">
                              CPF/CNPJ diferente do cadastro que está sendo vinculado
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-medium">{formatCurrency(Number(c.valor_credito || 0))}</p>
                          <Badge variant="outline" className="text-xs mt-1">{c.status || 'ativo'}</Badge>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleLink}
            disabled={!selectedCardId || link.isPending || (!!selectedCardId && jaVinculadas.has(selectedCardId))}
          >
            {link.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Vincular cadastro à cota
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}