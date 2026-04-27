import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DollarSign, Package, Calendar, User, ExternalLink, Unlink, Loader2, Sparkles, Hand } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useLinkedContracts, useUnlinkContract } from '@/hooks/useLinkedContract';

interface LinkedContractCardProps {
  attendeeId: string;
  canUnlink?: boolean;
}

const formatCurrency = (value: number | null) => {
  if (value === null) return 'R$ -';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export function LinkedContractCard({ attendeeId, canUnlink = false }: LinkedContractCardProps) {
  const { data: contracts = [], isLoading } = useLinkedContracts(attendeeId);
  const unlinkMutation = useUnlinkContract();
  const [confirmUnlinkId, setConfirmUnlinkId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Carregando contrato vinculado...
      </div>
    );
  }

  if (contracts.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
        Nenhum contrato vinculado encontrado para este participante.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {contracts.map(contract => {
        const hublaUrl = contract.hubla_id
          ? `https://app.hub.la/admin/sales/${contract.hubla_id}`
          : null;

        return (
          <div
            key={contract.id}
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <DollarSign className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="font-medium truncate">
                    {contract.customer_name || 'Cliente sem nome'}
                  </span>
                  <Badge className="bg-emerald-600 text-white hover:bg-emerald-600/90 shrink-0">
                    {formatCurrency(contract.net_value || contract.product_price)}
                  </Badge>
                </div>

                {contract.product_name && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Package className="h-3 w-3 shrink-0" />
                    <span className="truncate">{contract.product_name}</span>
                    {contract.product_category && (
                      <Badge variant="outline" className="text-[10px] py-0 h-4 shrink-0">
                        {contract.product_category}
                      </Badge>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3 shrink-0" />
                  <span>
                    Pago em {format(parseISO(contract.sale_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>

                {/* Linkage metadata */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-emerald-500/20 mt-2">
                  {contract.linked_method === 'auto' ? (
                    <Badge variant="outline" className="text-[10px] py-0 h-4 border-blue-400 text-blue-600">
                      <Sparkles className="h-2.5 w-2.5 mr-1" />
                      Automático
                    </Badge>
                  ) : contract.linked_method === 'manual' ? (
                    <Badge variant="outline" className="text-[10px] py-0 h-4 border-amber-400 text-amber-600">
                      <Hand className="h-2.5 w-2.5 mr-1" />
                      Manual
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] py-0 h-4">
                      Vinculado
                    </Badge>
                  )}
                  {contract.linked_by_name && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {contract.linked_by_name}
                    </span>
                  )}
                  {contract.linked_at && (
                    <span>
                      em {format(parseISO(contract.linked_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-1">
              {hublaUrl && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => window.open(hublaUrl, '_blank')}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Abrir na Hubla
                </Button>
              )}
              {canUnlink && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setConfirmUnlinkId(contract.id)}
                  disabled={unlinkMutation.isPending}
                >
                  <Unlink className="h-3 w-3 mr-1" />
                  Desvincular
                </Button>
              )}
            </div>
          </div>
        );
      })}

      <AlertDialog open={!!confirmUnlinkId} onOpenChange={(o) => !o && setConfirmUnlinkId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desvincular contrato?</AlertDialogTitle>
            <AlertDialogDescription>
              O contrato voltará para a lista de pendentes. Se este for o único contrato vinculado a este participante, o status volta de "Contrato Pago" para "Realizada".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmUnlinkId) {
                  unlinkMutation.mutate(
                    { transactionId: confirmUnlinkId, attendeeId },
                    { onSuccess: () => setConfirmUnlinkId(null) }
                  );
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Desvincular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}