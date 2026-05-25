import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Award, ArrowRightLeft, Store, UserCheck } from 'lucide-react';
import { useActiveTransfer, useStartTransfer, useSetPosContemplacaoDecisao } from '@/hooks/useConsortiumTransfer';
import { TransferProcessDrawer } from './TransferProcessDrawer';
import type { PosContemplacaoDecisao } from '@/types/consorcioTransfer';

interface Props {
  cardId: string;
  decisao: PosContemplacaoDecisao | null | undefined;
}

const LABELS: Record<PosContemplacaoDecisao, string> = {
  manter: 'Mantida com consorciado',
  a_venda: 'À venda',
  em_transferencia: 'Em transferência',
  transferida: 'Transferida',
};

export function PosContemplacaoPanel({ cardId, decisao }: Props) {
  const [transferOpen, setTransferOpen] = useState(false);
  const { data: transfer } = useActiveTransfer(cardId);
  const startTransfer = useStartTransfer();
  const setDecisao = useSetPosContemplacaoDecisao();

  const hasActiveTransfer = !!transfer && transfer.status_fase !== 'concluida' && transfer.status_fase !== 'cancelada';

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" /> Pós-contemplação
          </CardTitle>
          {decisao && <Badge variant="secondary">{LABELS[decisao]}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button
          variant={decisao === 'manter' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setDecisao.mutate({ cardId, decisao: 'manter' })}
          disabled={hasActiveTransfer}
        >
          <UserCheck className="h-4 w-4 mr-2" /> Manter com consorciado
        </Button>
        <Button
          variant={decisao === 'a_venda' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setDecisao.mutate({ cardId, decisao: 'a_venda' })}
          disabled={hasActiveTransfer}
        >
          <Store className="h-4 w-4 mr-2" /> Colocar à venda
        </Button>
        {hasActiveTransfer ? (
          <Button size="sm" onClick={() => setTransferOpen(true)}>
            <ArrowRightLeft className="h-4 w-4 mr-2" /> Abrir transferência
          </Button>
        ) : (
          <Button
            size="sm"
            variant={decisao === 'transferida' ? 'secondary' : 'default'}
            onClick={async () => {
              await startTransfer.mutateAsync(cardId);
              setTransferOpen(true);
            }}
            disabled={startTransfer.isPending || decisao === 'transferida'}
          >
            <ArrowRightLeft className="h-4 w-4 mr-2" /> Iniciar transferência
          </Button>
        )}
      </CardContent>

      <TransferProcessDrawer open={transferOpen} onOpenChange={setTransferOpen} cardId={cardId} />
    </Card>
  );
}