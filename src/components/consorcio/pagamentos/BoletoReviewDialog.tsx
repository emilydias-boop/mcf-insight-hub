import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, ExternalLink, Search, AlertTriangle, Link2, X } from 'lucide-react';
import { useBoletosReview, useConfirmBoletoMatch, useRelinkBoleto, useSearchConsortiumCards, BoletoReviewItem } from '@/hooks/useConsorcioBoletos';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function BoletoReviewDialog({ open, onOpenChange }: Props) {
  const { data: boletos = [], isLoading } = useBoletosReview();
  const confirmMutation = useConfirmBoletoMatch();
  const [search, setSearch] = useState('');

  const filtered = boletos.filter(b => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      b.nome_extraido?.toLowerCase().includes(s) ||
      b.card_nome?.toLowerCase().includes(s) ||
      b.grupo_extraido?.toLowerCase().includes(s) ||
      b.cota_extraida?.toLowerCase().includes(s)
    );
  });

  const handleOpenPdf = async (storagePath: string) => {
    try {
      const { data } = await supabase.storage
        .from('consorcio-boletos')
        .createSignedUrl(storagePath, 300);
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch {
      toast.error('Erro ao abrir PDF');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Revisar Boletos Parciais
            <Badge variant="secondary" className="ml-2">{boletos.length}</Badge>
          </DialogTitle>
          <DialogDescription>
            Boletos com match parcial ou pendente de revisão. Confirme ou corrija a vinculação.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, grupo ou cota..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-[60vh] -mx-6 px-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhum boleto pendente de revisão.</p>
          ) : (
            <div className="space-y-3 pb-4">
              {filtered.map(b => (
                <BoletoReviewCard
                  key={b.id}
                  boleto={b}
                  onConfirm={() => confirmMutation.mutate(b.id)}
                  onOpenPdf={() => handleOpenPdf(b.storage_path)}
                  isConfirming={confirmMutation.isPending}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function CardSearchInline({ boletoId, onClose }: { boletoId: string; onClose: () => void }) {
  const [term, setTerm] = useState('');
  const { data: results = [], isLoading } = useSearchConsortiumCards(term);
  const relinkMutation = useRelinkBoleto();

  const handleSelect = (cardId: string) => {
    relinkMutation.mutate({ boletoId, cardId }, {
      onSuccess: () => onClose(),
    });
  };

  return (
    <div className="mt-2 border rounded-md p-2 bg-muted/30 space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar carta por nome, grupo ou cota..."
            value={term}
            onChange={e => setTerm(e.target.value)}
            className="pl-8 h-8 text-xs"
            autoFocus
          />
        </div>
        <Button size="sm" variant="ghost" onClick={onClose} className="h-8 w-8 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {isLoading && <p className="text-xs text-muted-foreground px-1">Buscando...</p>}

      {term.length >= 2 && !isLoading && results.length === 0 && (
        <p className="text-xs text-muted-foreground px-1">Nenhuma carta encontrada.</p>
      )}

      {results.length > 0 && (
        <div className="max-h-32 overflow-y-auto space-y-1">
          {results.map(card => (
            <button
              key={card.id}
              onClick={() => handleSelect(card.id)}
              disabled={relinkMutation.isPending}
              className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors flex items-center justify-between gap-2"
            >
              <span className="truncate font-medium">{card.nome_completo}</span>
              <span className="text-muted-foreground shrink-0">G{card.grupo}/C{card.cota}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BoletoReviewCard({
  boleto,
  onConfirm,
  onOpenPdf,
  isConfirming,
}: {
  boleto: BoletoReviewItem;
  onConfirm: () => void;
  onOpenPdf: () => void;
  isConfirming: boolean;
}) {
  const hasCard = !!boleto.card_id;
  const [linking, setLinking] = useState(false);

  const hasMismatch = (field: 'grupo' | 'cota' | 'nome') => {
    if (!hasCard) return false;
    if (field === 'grupo') return boleto.grupo_extraido !== boleto.card_grupo;
    if (field === 'cota') return boleto.cota_extraida !== boleto.card_cota;
    if (field === 'nome') {
      const a = boleto.nome_extraido?.toLowerCase().trim();
      const b = boleto.card_nome?.toLowerCase().trim();
      return a !== b;
    }
    return false;
  };

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            {hasCard ? (
              <Badge variant="secondary" className="text-xs">Parcial</Badge>
            ) : (
              <Badge variant="destructive" className="text-xs">Sem Vínculo</Badge>
            )}
            {boleto.valor_extraido && (
              <span className="text-sm font-medium">{formatCurrency(boleto.valor_extraido)}</span>
            )}
            {boleto.vencimento_extraido && (
              <span className="text-xs text-muted-foreground">Venc: {boleto.vencimento_extraido}</span>
            )}
          </div>

          {hasCard ? (
            <>
              <p className="text-sm font-semibold text-primary">
                Vinculado a: {boleto.card_nome || '—'} (G{boleto.card_grupo}/C{boleto.card_cota})
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div>
                  <span className="text-muted-foreground">PDF Nome: </span>
                  <span className={hasMismatch('nome') ? 'text-amber-600 font-medium' : ''}>{boleto.nome_extraido || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Card Nome: </span>
                  <span>{boleto.card_nome || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">PDF Grupo/Cota: </span>
                  <span className={hasMismatch('grupo') || hasMismatch('cota') ? 'text-amber-600 font-medium' : ''}>
                    {boleto.grupo_extraido || '—'}/{boleto.cota_extraida || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Card Grupo/Cota: </span>
                  <span>{boleto.card_grupo || '—'}/{boleto.card_cota || '—'}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-xs space-y-1">
              <p className="text-muted-foreground italic">Nenhuma carta vinculada — vincule manualmente abaixo.</p>
              <div>
                <span className="text-muted-foreground">PDF Nome: </span>
                <span>{boleto.nome_extraido || '—'}</span>
                <span className="text-muted-foreground ml-3">Grupo/Cota: </span>
                <span>{boleto.grupo_extraido || '—'}/{boleto.cota_extraida || '—'}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-1 shrink-0">
          <Button size="sm" variant="ghost" onClick={onOpenPdf} title="Ver PDF">
            <ExternalLink className="h-4 w-4" />
          </Button>
          {hasCard && (
            <Button size="sm" variant="outline" onClick={onConfirm} disabled={isConfirming} title="Confirmar match">
              <Check className="h-4 w-4 mr-1" />
              Confirmar
            </Button>
          )}
          <Button
            size="sm"
            variant={hasCard ? 'ghost' : 'default'}
            onClick={() => setLinking(!linking)}
            title={hasCard ? 'Corrigir vinculação' : 'Vincular carta'}
          >
            <Link2 className="h-4 w-4 mr-1" />
            {hasCard ? 'Corrigir' : 'Vincular'}
          </Button>
        </div>
      </div>

      {linking && (
        <CardSearchInline boletoId={boleto.id} onClose={() => setLinking(false)} />
      )}
    </div>
  );
}
