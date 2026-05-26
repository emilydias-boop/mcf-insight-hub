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
  const link = useLinkPendingToCard();

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ['link-cota-search', cpf, cnpj, search, open],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from('consortium_cards')
        .select('id, grupo, cota, valor_credito, nome_completo, razao_social, cpf, cnpj, status')
        .order('created_at', { ascending: false })
        .limit(50);

      if (search.trim()) {
        const s = search.trim();
        q = q.or(
          `nome_completo.ilike.%${s}%,razao_social.ilike.%${s}%,grupo.ilike.%${s}%,cota.ilike.%${s}%,cpf.ilike.%${s}%,cnpj.ilike.%${s}%`,
        );
      } else if (cpf || cnpj) {
        const parts: string[] = [];
        if (cpf) parts.push(`cpf.eq.${cpf}`);
        if (cnpj) parts.push(`cnpj.eq.${cnpj}`);
        q = q.or(parts.join(','));
      }

      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const handleLink = async () => {
    if (!selectedCardId) return;
    await link.mutateAsync({ registrationId, cardId: selectedCardId });
    onOpenChange(false);
    setSelectedCardId(null);
    setSearch('');
  };

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
                  return (
                    <li
                      key={c.id}
                      onClick={() => setSelectedCardId(c.id)}
                      className={`p-3 cursor-pointer transition ${
                        isSelected ? 'bg-primary/10 border-l-2 border-primary' : 'hover:bg-muted/50'
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
          <Button onClick={handleLink} disabled={!selectedCardId || link.isPending}>
            {link.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Vincular cadastro à cota
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}