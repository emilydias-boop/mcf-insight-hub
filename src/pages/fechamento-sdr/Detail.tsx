import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SdrStatusBadge } from '@/components/sdr-fechamento/SdrStatusBadge';
import { SdrIndicatorCard } from '@/components/sdr-fechamento/SdrIndicatorCard';
import { SdrAdjustmentForm } from '@/components/sdr-fechamento/SdrAdjustmentForm';
import {
  useSdrPayoutDetail,
  useSdrCompPlan,
  useSdrMonthKpi,
  useUpdatePayoutStatus,
  useRecalculatePayout,
} from '@/hooks/useSdrFechamento';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { PayoutAdjustment } from '@/types/sdr-fechamento';
import {
  ArrowLeft,
  Check,
  Lock,
  RefreshCw,
  Unlock,
  DollarSign,
  Target,
  Wallet,
  CreditCard,
} from 'lucide-react';

const FechamentoSDRDetail = () => {
  const { payoutId } = useParams<{ payoutId: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();

  const { data: payout, isLoading } = useSdrPayoutDetail(payoutId);
  const { data: compPlan } = useSdrCompPlan(payout?.sdr_id, payout?.ano_mes || '');
  const { data: kpi } = useSdrMonthKpi(payout?.sdr_id, payout?.ano_mes || '');

  const updateStatus = useUpdatePayoutStatus();
  const recalculate = useRecalculatePayout();

  const isAdmin = role === 'admin';
  const isManager = role === 'manager';
  const canEdit = (isAdmin || isManager) && payout?.status !== 'LOCKED';
  const canReopen = isAdmin && payout?.status === 'LOCKED';
  const isReadOnly = role === 'sdr';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!payout) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Fechamento não encontrado.</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate('/fechamento-sdr')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  const handleApprove = () => {
    if (!user) return;
    updateStatus.mutate({
      payoutId: payout.id,
      status: 'APPROVED',
      userId: user.id,
    });
  };

  const handleLock = () => {
    if (!user) return;
    updateStatus.mutate({
      payoutId: payout.id,
      status: 'LOCKED',
      userId: user.id,
    });
  };

  const handleReopen = () => {
    if (!user) return;
    updateStatus.mutate({
      payoutId: payout.id,
      status: 'DRAFT',
      userId: user.id,
    });
  };

  const handleRecalculate = () => {
    recalculate.mutate({
      sdrId: payout.sdr_id,
      anoMes: payout.ano_mes,
    });
  };

  const adjustments = payout.ajustes_json || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              {payout.sdr?.name || 'SDR'}
              <SdrStatusBadge status={payout.status} />
            </h1>
            <p className="text-muted-foreground">
              Fechamento de {payout.ano_mes}
            </p>
          </div>
        </div>

        {!isReadOnly && (
          <div className="flex items-center gap-2">
            {canEdit && (
              <>
                <Button
                  variant="outline"
                  onClick={handleRecalculate}
                  disabled={recalculate.isPending}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${recalculate.isPending ? 'animate-spin' : ''}`} />
                  Recalcular
                </Button>

                {payout.status === 'DRAFT' && (
                  <Button onClick={handleApprove} disabled={updateStatus.isPending}>
                    <Check className="h-4 w-4 mr-2" />
                    Aprovar
                  </Button>
                )}

                {payout.status === 'APPROVED' && (
                  <Button onClick={handleLock} disabled={updateStatus.isPending}>
                    <Lock className="h-4 w-4 mr-2" />
                    Travar Mês
                  </Button>
                )}
              </>
            )}

            {canReopen && (
              <Button variant="outline" onClick={handleReopen} disabled={updateStatus.isPending}>
                <Unlock className="h-4 w-4 mr-2" />
                Reabrir
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Target className="h-4 w-4" />
              OTE Total
            </div>
            <div className="text-2xl font-bold mt-1">
              {formatCurrency(compPlan?.ote_total || 4000)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Wallet className="h-4 w-4" />
              Fixo
            </div>
            <div className="text-2xl font-bold mt-1">
              {formatCurrency(payout.valor_fixo || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <DollarSign className="h-4 w-4" />
              Variável
            </div>
            <div className="text-2xl font-bold mt-1 text-primary">
              {formatCurrency(payout.valor_variavel_total || 0)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-primary text-sm">
              <CreditCard className="h-4 w-4" />
              Total Conta
            </div>
            <div className="text-2xl font-bold mt-1 text-primary">
              {formatCurrency(payout.total_conta || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">iFood Mensal</div>
            <div className="text-2xl font-bold mt-1">
              {formatCurrency(payout.ifood_mensal || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">iFood Ultrameta</div>
            <div className="text-2xl font-bold mt-1">
              {formatCurrency(payout.ifood_ultrameta || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Indicators */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Indicadores de Meta</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SdrIndicatorCard
            title="Reuniões Agendadas"
            meta={compPlan?.meta_reunioes_agendadas || 115}
            realizado={kpi?.reunioes_agendadas || 0}
            pct={payout.pct_reunioes_agendadas || 0}
            multiplicador={payout.mult_reunioes_agendadas || 0}
            valorBase={compPlan?.valor_meta_rpg || 300}
            valorFinal={payout.valor_reunioes_agendadas || 0}
          />

          <SdrIndicatorCard
            title="Reuniões Realizadas"
            meta={compPlan?.meta_reunioes_realizadas || 48}
            realizado={kpi?.reunioes_realizadas || 0}
            pct={payout.pct_reunioes_realizadas || 0}
            multiplicador={payout.mult_reunioes_realizadas || 0}
            valorBase={compPlan?.valor_docs_reuniao || 600}
            valorFinal={payout.valor_reunioes_realizadas || 0}
          />

          <SdrIndicatorCard
            title="Tentativas de Ligações"
            meta={compPlan?.meta_tentativas || 1932}
            realizado={kpi?.tentativas_ligacoes || 0}
            pct={payout.pct_tentativas || 0}
            multiplicador={payout.mult_tentativas || 0}
            valorBase={compPlan?.valor_tentativas || 0}
            valorFinal={payout.valor_tentativas || 0}
          />

          <SdrIndicatorCard
            title="Organização Clint"
            meta={compPlan?.meta_organizacao || 100}
            realizado={kpi?.score_organizacao || 0}
            pct={payout.pct_organizacao || 0}
            multiplicador={payout.mult_organizacao || 0}
            valorBase={compPlan?.valor_organizacao || 300}
            valorFinal={payout.valor_organizacao || 0}
            isPercentage
          />
        </div>
      </div>

      {/* Adjustments (only for admin/manager) */}
      {!isReadOnly && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Ajustes Manuais</CardTitle>
            </CardHeader>
            <CardContent>
              <SdrAdjustmentForm
                payoutId={payout.id}
                disabled={!canEdit}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Histórico de Ajustes</CardTitle>
            </CardHeader>
            <CardContent>
              {adjustments.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Nenhum ajuste registrado.
                </p>
              ) : (
                <div className="space-y-3">
                  {adjustments.map((adj: PayoutAdjustment, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div>
                        <div className="font-medium capitalize">{adj.tipo}</div>
                        <div className="text-sm text-muted-foreground">
                          {adj.motivo}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatDateTime(adj.created_at)}
                        </div>
                      </div>
                      <div
                        className={`font-bold ${
                          adj.valor >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {adj.valor >= 0 ? '+' : ''}
                        {formatCurrency(adj.valor)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Approval Info */}
      {payout.aprovado_em && payout.aprovado_por && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="h-4 w-4 text-green-400" />
              Aprovado em {formatDateTime(payout.aprovado_em)}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FechamentoSDRDetail;
