import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle, Lock, Loader2 } from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { ConsorcioStatusBadge } from '@/components/consorcio-fechamento/ConsorcioStatusBadge';
import { ConsorcioPayoutSummary } from '@/components/consorcio-fechamento/ConsorcioPayoutSummary';
import { ConsorcioIndicatorCard } from '@/components/consorcio-fechamento/ConsorcioIndicatorCard';
import { ConsorcioKpiForm } from '@/components/consorcio-fechamento/ConsorcioKpiForm';
import { ConsorcioAjusteForm } from '@/components/consorcio-fechamento/ConsorcioAjusteForm';
import { 
  useConsorcioPayoutDetail, 
  useUpdateConsorcioPayoutKpi,
  useUpdateConsorcioPayoutStatus,
  useAddConsorcioAjuste,
} from '@/hooks/useConsorcioFechamento';
import { PESOS_CLOSER_CONSORCIO } from '@/types/consorcio-fechamento';
import { useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

export default function ConsorcioFechamentoDetail() {
  const { payoutId } = useParams<{ payoutId: string }>();
  const navigate = useNavigate();
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showLockDialog, setShowLockDialog] = useState(false);

  const { data: payout, isLoading } = useConsorcioPayoutDetail(payoutId || '');
  const updateKpi = useUpdateConsorcioPayoutKpi();
  const updateStatus = useUpdateConsorcioPayoutStatus();
  const addAjuste = useAddConsorcioAjuste();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!payout) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-center text-muted-foreground">Fechamento não encontrado.</p>
        <div className="flex justify-center mt-4">
          <Button variant="outline" onClick={() => navigate('/consorcio/fechamento')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  const isLocked = payout.status === 'LOCKED';
  const isApproved = payout.status === 'APPROVED';

  const handleApprove = () => {
    updateStatus.mutate({ payoutId: payout.id, status: 'APPROVED' });
    setShowApproveDialog(false);
  };

  const handleLock = () => {
    updateStatus.mutate({ payoutId: payout.id, status: 'LOCKED' });
    setShowLockDialog(false);
  };

  const handleSaveKpi = (data: Parameters<typeof updateKpi.mutate>[0]['data']) => {
    updateKpi.mutate({ payoutId: payout.id, data });
  };

  const handleAddAjuste = (ajuste: Parameters<typeof addAjuste.mutate>[0]['ajuste']) => {
    addAjuste.mutate({ payoutId: payout.id, ajuste });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/consorcio/fechamento')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              {payout.closer?.color && (
                <div 
                  className="w-4 h-4 rounded-full" 
                  style={{ backgroundColor: payout.closer.color }}
                />
              )}
              <h1 className="text-2xl font-bold">{payout.closer?.name}</h1>
              <ConsorcioStatusBadge status={payout.status} />
            </div>
            <p className="text-muted-foreground">
              Fechamento de {payout.ano_mes}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {!isApproved && !isLocked && (
            <Button onClick={() => setShowApproveDialog(true)}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Aprovar
            </Button>
          )}
          {isApproved && !isLocked && (
            <Button variant="outline" onClick={() => setShowLockDialog(true)}>
              <Lock className="h-4 w-4 mr-2" />
              Travar
            </Button>
          )}
        </div>
      </div>

      {/* Summary */}
      <ConsorcioPayoutSummary
        ote={payout.ote_total || 0}
        fixo={payout.fixo_valor || 0}
        variavel={payout.valor_variavel_final || 0}
        totalConta={payout.total_conta || 0}
      />

      {/* Indicators */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Indicadores de Meta</h2>
        
        <div className="grid gap-4">
          <ConsorcioIndicatorCard
            label="Comissão Venda Consórcio"
            peso={`${(PESOS_CLOSER_CONSORCIO.comissao_consorcio * 100).toFixed(0)}%`}
            meta={payout.meta_comissao_consorcio || 0}
            realizado={payout.comissao_consorcio || 0}
            pct={payout.pct_comissao_consorcio || 0}
            mult={payout.mult_comissao_consorcio || 0}
            valorFinal={payout.valor_comissao_consorcio || 0}
            tipo="currency"
          />
          
          <ConsorcioIndicatorCard
            label="Comissão Venda Holding"
            peso={`${(PESOS_CLOSER_CONSORCIO.comissao_holding * 100).toFixed(0)}%`}
            meta={payout.meta_comissao_holding || 0}
            realizado={payout.comissao_holding || 0}
            pct={payout.pct_comissao_holding || 0}
            mult={payout.mult_comissao_holding || 0}
            valorFinal={payout.valor_comissao_holding || 0}
            tipo="currency"
          />
          
          <ConsorcioIndicatorCard
            label="Organização"
            peso={`${(PESOS_CLOSER_CONSORCIO.organizacao * 100).toFixed(0)}%`}
            meta={payout.meta_organizacao || 100}
            realizado={payout.score_organizacao || 0}
            pct={payout.pct_organizacao || 0}
            mult={payout.mult_organizacao || 0}
            valorFinal={payout.valor_organizacao || 0}
            tipo="score"
          />
        </div>
      </div>

      {/* Edit KPIs */}
      {!isLocked && (
        <ConsorcioKpiForm
          initialData={{
            comissao_consorcio: payout.comissao_consorcio || 0,
            comissao_holding: payout.comissao_holding || 0,
            score_organizacao: payout.score_organizacao || 100,
            meta_comissao_consorcio: payout.meta_comissao_consorcio || undefined,
            meta_comissao_holding: payout.meta_comissao_holding || undefined,
          }}
          onSave={handleSaveKpi}
          isLoading={updateKpi.isPending}
          disabled={isLocked}
        />
      )}

      {/* Ajustes */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Ajustes</h2>
        
        {payout.ajustes_json && payout.ajustes_json.length > 0 ? (
          <Card>
            <CardContent className="p-4">
              <div className="space-y-2">
                {payout.ajustes_json.map((aj, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium">{aj.descricao}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(aj.data)}
                      </p>
                    </div>
                    <p className={aj.tipo === 'bonus' ? 'text-green-400' : 'text-red-400'}>
                      {aj.tipo === 'bonus' ? '+' : '-'}{formatCurrency(aj.valor)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum ajuste registrado.</p>
        )}
        
        {!isLocked && (
          <ConsorcioAjusteForm
            onAdd={handleAddAjuste}
            isLoading={addAjuste.isPending}
            disabled={isLocked}
          />
        )}
      </div>

      {/* Approve Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar Fechamento</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a aprovar o fechamento de {payout.closer?.name} 
              no valor de {formatCurrency(payout.total_conta || 0)}.
              Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove}>Aprovar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lock Dialog */}
      <AlertDialog open={showLockDialog} onOpenChange={setShowLockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Travar Fechamento</AlertDialogTitle>
            <AlertDialogDescription>
              Ao travar o fechamento, nenhuma alteração poderá ser feita.
              Essa ação não pode ser desfeita facilmente.
              Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleLock}>Travar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
