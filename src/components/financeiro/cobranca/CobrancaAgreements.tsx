import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BillingAgreement, BillingAgreementInstallment, AGREEMENT_STATUS_LABELS, INSTALLMENT_STATUS_LABELS } from '@/types/billing';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useBillingAgreementInstallments } from '@/hooks/useBillingAgreements';
import { useMarkAgreementInstallmentPaid } from '@/hooks/useBillingAgreements';
import { EditAgreementModal } from './EditAgreementModal';
import { Pencil, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

interface CobrancaAgreementsProps {
  agreements: BillingAgreement[];
  isLoading: boolean;
}

const statusColors: Record<string, string> = {
  em_aberto: 'bg-amber-100 text-amber-800',
  em_andamento: 'bg-blue-100 text-blue-800',
  cumprido: 'bg-green-100 text-green-800',
  quebrado: 'bg-red-100 text-red-800',
};

const instStatusColors: Record<string, string> = {
  pendente: 'bg-amber-100 text-amber-800',
  pago: 'bg-green-100 text-green-800',
  atrasado: 'bg-red-100 text-red-800',
  cancelado: 'bg-gray-100 text-gray-800',
};

const AgreementInstallments = ({ agreementId }: { agreementId: string }) => {
  const { data: installments = [], isLoading } = useBillingAgreementInstallments(agreementId);
  const markPaid = useMarkAgreementInstallmentPaid();

  if (isLoading) return <p className="text-xs text-muted-foreground py-2">Carregando parcelas...</p>;
  if (installments.length === 0) return <p className="text-xs text-muted-foreground py-2">Sem parcelas</p>;

  const handleMarkPaid = async (inst: BillingAgreementInstallment) => {
    try {
      await markPaid.mutateAsync({ id: inst.id, data_pagamento: new Date().toISOString().split('T')[0] });
      toast.success(`Parcela ${inst.numero_parcela} do acordo marcada como paga`);
    } catch {
      toast.error('Erro ao marcar parcela');
    }
  };

  return (
    <div className="mt-3 border-t border-border/50 pt-3">
      <p className="text-xs font-medium text-muted-foreground mb-2">Parcelas do Acordo</p>
      <div className="space-y-1.5">
        {installments.map((inst) => (
          <div key={inst.id} className="flex items-center justify-between text-xs p-2 rounded bg-muted/30">
            <div className="flex items-center gap-2">
              <span className="font-medium">#{inst.numero_parcela}</span>
              <span>{formatCurrency(inst.valor)}</span>
              <span className="text-muted-foreground">Venc: {formatDate(inst.data_vencimento)}</span>
              <Badge className={`text-[10px] px-1.5 ${instStatusColors[inst.status] || ''}`} variant="outline">
                {INSTALLMENT_STATUS_LABELS[inst.status]}
              </Badge>
            </div>
            {inst.status !== 'pago' && inst.status !== 'cancelado' && (
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => handleMarkPaid(inst)}>
                <CheckCircle2 className="h-3 w-3 mr-1" /> Pagar
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export const CobrancaAgreements = ({ agreements, isLoading }: CobrancaAgreementsProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editAgreement, setEditAgreement] = useState<BillingAgreement | null>(null);

  if (isLoading) return <div className="text-center py-4 text-muted-foreground">Carregando acordos...</div>;
  if (agreements.length === 0) return <div className="text-center py-4 text-muted-foreground">Nenhum acordo registrado</div>;

  return (
    <>
      <div className="space-y-3">
        {agreements.map((ag) => (
          <Card key={ag.id} className="border-border/50">
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  Acordo - {formatDate(ag.data_negociacao)}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge className={`text-xs ${statusColors[ag.status] || ''}`} variant="outline">
                    {AGREEMENT_STATUS_LABELS[ag.status]}
                  </Badge>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditAgreement(ag)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setExpandedId(expandedId === ag.id ? null : ag.id)}>
                    {expandedId === ag.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Responsável</span>
                  <p className="font-medium">{ag.responsavel}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Valor original</span>
                  <p className="font-medium">{formatCurrency(ag.valor_original_divida)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Novo valor</span>
                  <p className="font-medium text-green-600">{formatCurrency(ag.novo_valor_negociado)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Parcelas</span>
                  <p className="font-medium">{ag.quantidade_parcelas}x</p>
                </div>
              </div>
              {ag.motivo_negociacao && (
                <p className="text-xs text-muted-foreground mt-2">Motivo: {ag.motivo_negociacao}</p>
              )}
              {ag.observacoes && (
                <p className="text-xs text-muted-foreground mt-1">Obs: {ag.observacoes}</p>
              )}
              {expandedId === ag.id && <AgreementInstallments agreementId={ag.id} />}
            </CardContent>
          </Card>
        ))}
      </div>
      <EditAgreementModal agreement={editAgreement} open={!!editAgreement} onOpenChange={(o) => !o && setEditAgreement(null)} />
    </>
  );
};
