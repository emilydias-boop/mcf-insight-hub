import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Check,
  Lock,
  Unlock,
  Download,
  Target,
  Wallet,
  DollarSign,
  CreditCard,
  RefreshCw,
  User,
  Trash2,
} from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { ConsorcioStatusBadge } from '@/components/consorcio-fechamento/ConsorcioStatusBadge';
import { ConsorcioKpiEditForm } from '@/components/consorcio-fechamento/ConsorcioKpiEditForm';
import { ConsorcioAjusteForm } from '@/components/consorcio-fechamento/ConsorcioAjusteForm';
import { ConsorcioIndicatorCard } from '@/components/consorcio-fechamento/ConsorcioIndicatorCard';
import {
  useConsorcioPayoutDetail,
  useUpdateConsorcioPayoutKpi,
  useUpdateConsorcioPayoutStatus,
  useAddConsorcioAjuste,
  useRemoveConsorcioAjuste,
} from '@/hooks/useConsorcioFechamento';
import { AjusteConsorcio } from '@/types/consorcio-fechamento';
import { useAuth } from '@/contexts/AuthContext';

export default function ConsorcioFechamentoDetail() {
  const { payoutId } = useParams<{ payoutId: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();

  const { data: payout, isLoading } = useConsorcioPayoutDetail(payoutId || '');
  const updateKpi = useUpdateConsorcioPayoutKpi();
  const updateStatus = useUpdateConsorcioPayoutStatus();
  const addAjuste = useAddConsorcioAjuste();
  const removeAjuste = useRemoveConsorcioAjuste();

  const isAdmin = role === 'admin';
  const isManager = role === 'manager' || role === 'coordenador';
  const canEdit = (isAdmin || isManager) && payout?.status !== 'LOCKED';
  const canReopen = isAdmin && payout?.status === 'LOCKED';

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
        <Button variant="outline" className="mt-4" onClick={() => navigate('/consorcio/fechamento')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  const handleApprove = () => {
    updateStatus.mutate({ payoutId: payout.id, status: 'APPROVED' });
  };

  const handleLock = () => {
    updateStatus.mutate({ payoutId: payout.id, status: 'LOCKED' });
  };

  const handleReopen = () => {
    updateStatus.mutate({ payoutId: payout.id, status: 'DRAFT' });
  };

  const handleSaveKpi = (data: Parameters<typeof updateKpi.mutate>[0]['data']) => {
    updateKpi.mutate({ payoutId: payout.id, data });
  };

  const handleAddAjuste = (ajuste: Parameters<typeof addAjuste.mutate>[0]['ajuste']) => {
    addAjuste.mutate({ payoutId: payout.id, ajuste });
  };

  const handleExport = () => {
    const name = payout.closer?.name || 'Closer';
    const adjustments = payout.ajustes_json || [];
    const lines = [
      `FECHAMENTO CONSÓRCIO - ${name}`,
      `Período: ${payout.ano_mes}`,
      `Status: ${payout.status}`,
      '',
      '=== RESUMO FINANCEIRO ===',
      `OTE Total;${payout.ote_total}`,
      `Fixo;${payout.fixo_valor}`,
      `Variável;${payout.valor_variavel_final || 0}`,
      `Total Conta;${payout.total_conta || 0}`,
      '',
      '=== INDICADORES ===',
      'Indicador;Meta;Realizado;%;Mult;Valor',
      `Comissão Consórcio;${payout.meta_comissao_consorcio || 0};${payout.comissao_consorcio};${(payout.pct_comissao_consorcio || 0).toFixed(1)}%;${payout.mult_comissao_consorcio || 0}x;${payout.valor_comissao_consorcio || 0}`,
      `Comissão Holding;${payout.meta_comissao_holding || 0};${payout.comissao_holding};${(payout.pct_comissao_holding || 0).toFixed(1)}%;${payout.mult_comissao_holding || 0}x;${payout.valor_comissao_holding || 0}`,
      `Organização;100;${payout.score_organizacao};${(payout.pct_organizacao || 0).toFixed(1)}%;${payout.mult_organizacao || 0}x;${payout.valor_organizacao || 0}`,
      '',
    ];

    if (adjustments.length > 0) {
      lines.push('=== AJUSTES ===');
      lines.push('Tipo;Descrição;Valor;Data');
      adjustments.forEach((aj: AjusteConsorcio) => {
        lines.push(`${aj.tipo};${aj.descricao};${aj.valor};${aj.data}`);
      });
    }

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `fechamento-consorcio-${name.replace(/\s+/g, '-').toLowerCase()}-${payout.ano_mes}.csv`;
    link.click();
  };

  const adjustments = payout.ajustes_json || [];

  // Compute peso labels from the payout values
  const variavelTotal = payout.variavel_total || 0;
  const pesoConsorcio = variavelTotal > 0 && payout.mult_comissao_consorcio != null
    ? ((payout.valor_comissao_consorcio || 0) / (variavelTotal * (payout.mult_comissao_consorcio || 1)) * 100) || 0
    : 90;
  const pesoHolding = variavelTotal > 0 && payout.mult_comissao_holding != null
    ? ((payout.valor_comissao_holding || 0) / (variavelTotal * (payout.mult_comissao_holding || 1)) * 100) || 0
    : 0;
  const pesoOrg = variavelTotal > 0 && payout.mult_organizacao != null
    ? ((payout.valor_organizacao || 0) / (variavelTotal * (payout.mult_organizacao || 1)) * 100) || 0
    : 10;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/consorcio/fechamento')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              {payout.closer?.color && (
                <div
                  className="w-3.5 h-3.5 rounded-full"
                  style={{ backgroundColor: payout.closer.color }}
                />
              )}
              {payout.closer?.name || 'Closer'}
              <ConsorcioStatusBadge status={payout.status} />
              <Badge variant="secondary" className="text-xs">
                <User className="h-3 w-3 mr-1" />
                Closer Consórcio
              </Badge>
            </h1>
            <p className="text-sm text-muted-foreground">
              Fechamento de {payout.ano_mes}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Exportar
          </Button>

          {canEdit && payout.status === 'DRAFT' && (
            <Button size="sm" onClick={handleApprove} disabled={updateStatus.isPending}>
              <Check className="h-3.5 w-3.5 mr-1.5" />
              Aprovar
            </Button>
          )}

          {canEdit && payout.status === 'APPROVED' && (
            <Button size="sm" onClick={handleLock} disabled={updateStatus.isPending}>
              <Lock className="h-3.5 w-3.5 mr-1.5" />
              Travar Mês
            </Button>
          )}

          {canReopen && (
            <Button variant="outline" size="sm" onClick={handleReopen} disabled={updateStatus.isPending}>
              <Unlock className="h-3.5 w-3.5 mr-1.5" />
              Reabrir
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1.5 text-muted-foreground/70 text-xs">
              <Target className="h-3.5 w-3.5" />
              OTE Total
            </div>
            <div className="text-xl font-bold mt-1">{formatCurrency(payout.ote_total || 0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1.5 text-muted-foreground/70 text-xs">
              <Wallet className="h-3.5 w-3.5" />
              Fixo
            </div>
            <div className="text-xl font-bold mt-1">{formatCurrency(payout.fixo_valor || 0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1.5 text-muted-foreground/70 text-xs">
              <DollarSign className="h-3.5 w-3.5" />
              Variável
            </div>
            <div className="text-xl font-bold mt-1 text-primary">
              {formatCurrency(payout.valor_variavel_final || 0)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1.5 text-primary text-xs">
              <CreditCard className="h-3.5 w-3.5" />
              Total Conta
            </div>
            <div className="text-xl font-bold mt-1 text-primary">
              {formatCurrency(payout.total_conta || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPI Edit Form */}
      {canEdit && (
        <ConsorcioKpiEditForm
          payout={payout}
          disabled={!canEdit}
          onSave={handleSaveKpi}
          isSaving={updateKpi.isPending}
        />
      )}

      {/* Indicator Cards */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Indicadores de Meta</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <ConsorcioIndicatorCard
            label="Comissão Venda Consórcio"
            peso="90%"
            meta={payout.meta_comissao_consorcio || 0}
            realizado={payout.comissao_consorcio || 0}
            pct={payout.pct_comissao_consorcio || 0}
            mult={payout.mult_comissao_consorcio || 0}
            valorFinal={payout.valor_comissao_consorcio || 0}
            tipo="currency"
          />

          <ConsorcioIndicatorCard
            label="Comissão Venda Holding"
            peso="0%"
            meta={payout.meta_comissao_holding || 0}
            realizado={payout.comissao_holding || 0}
            pct={payout.pct_comissao_holding || 0}
            mult={payout.mult_comissao_holding || 0}
            valorFinal={payout.valor_comissao_holding || 0}
            tipo="currency"
          />

          <ConsorcioIndicatorCard
            label="Organização"
            peso="10%"
            meta={payout.meta_organizacao || 100}
            realizado={payout.score_organizacao || 0}
            pct={payout.pct_organizacao || 0}
            mult={payout.mult_organizacao || 0}
            valorFinal={payout.valor_organizacao || 0}
            tipo="score"
          />
        </div>
      </div>

      {/* Adjustments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold">Ajustes Manuais</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {canEdit ? (
              <ConsorcioAjusteForm
                onAdd={handleAddAjuste}
                isLoading={addAjuste.isPending}
                disabled={!canEdit}
              />
            ) : (
              <p className="text-muted-foreground/70 text-xs">Fechamento travado.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold">Histórico de Ajustes</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {adjustments.length === 0 ? (
              <p className="text-muted-foreground/70 text-xs">Nenhum ajuste registrado.</p>
            ) : (
              <div className="space-y-2">
                {adjustments.map((aj, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{aj.descricao}</div>
                      <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                        {formatDateTime(aj.data)}
                      </div>
                    </div>
                    <div className={`text-sm font-bold shrink-0 ${aj.tipo === 'bonus' ? 'text-green-400' : 'text-red-400'}`}>
                      {aj.tipo === 'bonus' ? '+' : '-'}{formatCurrency(aj.valor)}
                    </div>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeAjuste.mutate({ payoutId: payout.id, index: idx })}
                        disabled={removeAjuste.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Approval Info */}
      {payout.aprovado_em && (
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
}
