import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Link2, Loader2, X, BadgeCheck, Phone, Mail, User, Star } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/formatters';
import { useVendasSemVinculo, useVincularVenda } from '@/hooks/useVincularVendaR2';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attendeeId: string;
  attendeeName: string;
}

export function VincularVendaR2Dialog({ open, onOpenChange, attendeeId, attendeeName }: Props) {
  const [busca, setBusca] = useState('');
  const { data: vendas = [], isLoading } = useVendasSemVinculo(open ? attendeeId : null, busca);
  const vincular = useVincularVenda();
  const [vinculandoId, setVinculandoId] = useState<string | null>(null);

  const handleVincular = async (transactionId: string) => {
    setVinculandoId(transactionId);
    try {
      await vincular.mutateAsync({ transactionId, attendeeId });
      onOpenChange(false);
      setBusca('');
    } finally {
      setVinculandoId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setBusca(''); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Vincular venda
          </DialogTitle>
          <DialogDescription>
            Amarrar uma venda de Hubla, MCF Pay ou Kiwify a <strong>{attendeeName}</strong>.
            <span className="block text-xs mt-1 opacity-75">
              Use quando a compra saiu no nome, email ou telefone de outra pessoa. Ao vincular, o lead vai para "Venda realizada".
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="relative shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email, telefone, CPF ou produto..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
          {busca && (
            <Button variant="ghost" size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setBusca('')}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain -mx-6 px-6">
          <div className="space-y-2 py-2 pb-4">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
            ) : vendas.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                {busca
                  ? 'Nenhuma venda sem dono com essa busca.'
                  : 'Nenhuma venda sem dono nos 60 dias anteriores a esta R2. Use a busca para procurar em todo o histórico.'}
              </div>
            ) : (
              vendas.map((v) => {
                const provavel = v.score >= 50;
                return (
                  <div key={v.id}
                    className={`rounded-lg border p-3 transition-colors ${
                      provavel ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    }`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">{v.produto}</span>
                          {v.eh_parceria && (
                            <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400">
                              <Star className="h-3 w-3" /> parceria
                            </Badge>
                          )}
                          {v.gateway && <Badge variant="secondary" className="text-[10px]">{v.gateway}</Badge>}
                          {v.parcela && v.total_parcelas && v.total_parcelas > 1 && (
                            <Badge variant="outline" className="text-[10px]">{v.parcela}/{v.total_parcelas}</Badge>
                          )}
                        </div>

                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-bold">{formatCurrency(v.liquido)}</span>
                          <span className="text-[10px] text-muted-foreground">líquido</span>
                          <span className="text-[11px] text-muted-foreground">· bruto {formatCurrency(v.bruto)}</span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <User className="h-3 w-3 shrink-0" />
                          <span className="truncate">{v.comprador_nome || 'sem nome'}</span>
                        </div>
                        {v.comprador_email && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{v.comprador_email}</span>
                          </div>
                        )}
                        {v.comprador_telefone && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3 shrink-0" />
                            <span>{v.comprador_telefone}</span>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {v.match_cpf && <Badge className="text-[10px] gap-1"><BadgeCheck className="h-3 w-3" />CPF confere</Badge>}
                          {v.match_telefone && <Badge className="text-[10px] gap-1"><BadgeCheck className="h-3 w-3" />telefone confere</Badge>}
                          {v.match_email && <Badge className="text-[10px] gap-1"><BadgeCheck className="h-3 w-3" />email confere</Badge>}
                          {v.match_nome && <Badge className="text-[10px] gap-1"><BadgeCheck className="h-3 w-3" />nome confere</Badge>}
                        </div>

                        <div className="text-[11px] text-muted-foreground pt-0.5">
                          {format(parseISO(v.sale_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </div>
                      </div>

                      <Button size="sm"
                        variant={provavel ? 'default' : 'outline'}
                        className="shrink-0"
                        disabled={vincular.isPending}
                        onClick={() => handleVincular(v.id)}>
                        {vinculandoId === v.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <><Link2 className="h-4 w-4 mr-1" />Vincular</>}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
