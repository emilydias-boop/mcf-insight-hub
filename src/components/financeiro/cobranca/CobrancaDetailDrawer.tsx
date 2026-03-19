import { useState, useMemo } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { BillingSubscription, BillingInstallment, SUBSCRIPTION_STATUS_LABELS } from '@/types/billing';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useBillingInstallments, useMarkInstallmentPaid } from '@/hooks/useBillingInstallments';
import { useBillingAgreements } from '@/hooks/useBillingAgreements';
import { useBillingHistory, useAddBillingHistory } from '@/hooks/useBillingHistory';
import { useReceivablesBySubscription } from '@/hooks/useBillingReceivables';
import { CobrancaInstallments } from './CobrancaInstallments';
import { CobrancaAgreements } from './CobrancaAgreements';
import { CobrancaHistory } from './CobrancaHistory';
import { CreateAgreementModal } from './CreateAgreementModal';
import { EditSubscriptionModal } from './EditSubscriptionModal';
import { RegisterPaymentModal } from './RegisterPaymentModal';
import { toast } from 'sonner';
import { Handshake, Ban, CheckCircle2, Pencil, MessageSquarePlus, Send, Phone, MessageCircle } from 'lucide-react';
import { useUpdateSubscription } from '@/hooks/useBillingSubscriptions';

interface CobrancaDetailDrawerProps {
  subscription: BillingSubscription | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusColors: Record<string, string> = {
  em_dia: 'bg-green-100 text-green-800',
  atrasada: 'bg-red-100 text-red-800',
  cancelada: 'bg-gray-100 text-gray-800',
  finalizada: 'bg-blue-100 text-blue-800',
  quitada: 'bg-emerald-200 text-emerald-900 font-bold',
};

export const CobrancaDetailDrawer = ({ subscription, open, onOpenChange }: CobrancaDetailDrawerProps) => {
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState<BillingInstallment | null>(null);
  const [showObsInput, setShowObsInput] = useState(false);
  const [obsText, setObsText] = useState('');

  const { data: installments = [], isLoading: loadingInst } = useBillingInstallments(subscription?.id || null);
  const { data: agreements = [], isLoading: loadingAg } = useBillingAgreements(subscription?.id || null);
  const { data: history = [], isLoading: loadingHist } = useBillingHistory(subscription?.id || null);

  const markPaid = useMarkInstallmentPaid();
  const addHistory = useAddBillingHistory();
  const updateSub = useUpdateSubscription();

  if (!subscription) return null;

  const totalPago = installments.filter(i => i.status === 'pago').reduce((s, i) => s + (i.valor_pago || 0), 0);
  const saldoDevedor = subscription.valor_total_contrato - totalPago;
  const parcelasPagas = installments.filter(i => i.status === 'pago').length;

  const handleMarkPaid = async (inst: BillingInstallment) => {
    try {
      await markPaid.mutateAsync({
        id: inst.id,
        valor_pago: inst.valor_original,
        data_pagamento: new Date().toISOString().split('T')[0],
      });
      await addHistory.mutateAsync({
        subscription_id: subscription.id,
        tipo: 'parcela_paga',
        valor: inst.valor_original,
        descricao: `Parcela ${inst.numero_parcela} marcada como paga`,
      });
      toast.success('Parcela marcada como paga');
    } catch {
      toast.error('Erro ao marcar parcela como paga');
    }
  };

  const handleRegisterPayment = (inst: BillingInstallment) => {
    setSelectedInstallment(inst);
    setShowPaymentModal(true);
  };

  const handleCancelSubscription = async () => {
    try {
      await updateSub.mutateAsync({ id: subscription.id, status: 'cancelada' });
      await addHistory.mutateAsync({
        subscription_id: subscription.id,
        tipo: 'cancelamento',
        descricao: 'Assinatura cancelada',
      });
      toast.success('Assinatura cancelada');
    } catch {
      toast.error('Erro ao cancelar');
    }
  };

  const handleFinalize = async () => {
    try {
      await updateSub.mutateAsync({ id: subscription.id, status: 'quitada', status_quitacao: 'quitado' });
      await addHistory.mutateAsync({
        subscription_id: subscription.id,
        tipo: 'quitacao',
        valor: subscription.valor_total_contrato,
        descricao: 'Contrato quitado',
      });
      toast.success('Contrato quitado com sucesso');
    } catch {
      toast.error('Erro ao quitar contrato');
    }
  };

  const handleAddObs = async () => {
    if (!obsText.trim()) return;
    try {
      await addHistory.mutateAsync({
        subscription_id: subscription.id,
        tipo: 'observacao',
        descricao: obsText.trim(),
      });
      toast.success('Observação adicionada');
      setObsText('');
      setShowObsInput(false);
    } catch {
      toast.error('Erro ao adicionar observação');
    }
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="border-b pb-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <DrawerTitle className="text-lg">{subscription.customer_name}</DrawerTitle>
                <DrawerDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>{subscription.customer_email}</span>
                  <span>·</span>
                  <span>{subscription.product_name}</span>
                  {subscription.customer_phone && (
                    <>
                      <span>·</span>
                      <a href={`tel:${subscription.customer_phone}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                        <Phone className="h-3 w-3" />
                        {subscription.customer_phone}
                      </a>
                    </>
                  )}
                </DrawerDescription>
              </div>
              <Badge className={`text-sm px-3 py-1 ${statusColors[subscription.status] || ''}`} variant="outline">
                {SUBSCRIPTION_STATUS_LABELS[subscription.status]}
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <span className="text-xs text-muted-foreground">Total Contrato</span>
                <p className="text-lg font-bold">{formatCurrency(subscription.valor_total_contrato)}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <span className="text-xs text-muted-foreground">Total Pago</span>
                <p className="text-lg font-bold text-green-600">{formatCurrency(totalPago)}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <span className="text-xs text-muted-foreground">Saldo Devedor</span>
                <p className="text-lg font-bold text-red-600">{formatCurrency(saldoDevedor)}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <span className="text-xs text-muted-foreground">Parcelas</span>
                <p className="text-lg font-bold">{parcelasPagas} / {subscription.total_parcelas}</p>
              </div>
            </div>

            <div className="flex gap-2 mt-4 flex-wrap">
              {subscription.customer_phone && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-green-700 border-green-300 hover:bg-green-50"
                  onClick={() => {
                    const phone = subscription.customer_phone!.replace(/\D/g, '');
                    const phoneFormatted = phone.startsWith('55') ? phone : `55${phone}`;
                    const msg = encodeURIComponent(
                      `Olá ${subscription.customer_name.split(' ')[0]}! 🙂\n\n` +
                      `Estamos entrando em contato referente ao seu contrato *${subscription.product_name}*.\n` +
                      `Valor total: ${formatCurrency(subscription.valor_total_contrato)}\n` +
                      `Saldo devedor: ${formatCurrency(saldoDevedor)}\n\n` +
                      `Podemos conversar sobre sua situação financeira?`
                    );
                    window.open(`https://wa.me/${phoneFormatted}?text=${msg}`, '_blank');
                  }}
                >
                  <MessageCircle className="h-3.5 w-3.5 mr-1" /> Cobrar WhatsApp
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setShowEditModal(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAgreementModal(true)}>
                <Handshake className="h-3.5 w-3.5 mr-1" /> Criar Acordo
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowObsInput(!showObsInput)}>
                <MessageSquarePlus className="h-3.5 w-3.5 mr-1" /> Observação
              </Button>
              {subscription.status !== 'cancelada' && subscription.status !== 'quitada' && (
                <>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Quitar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Quitar contrato?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Isso marcará o contrato como quitado e não poderá ser desfeito facilmente. Deseja continuar?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleFinalize}>Confirmar Quitação</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive">
                        <Ban className="h-3.5 w-3.5 mr-1" /> Cancelar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancelar assinatura?</AlertDialogTitle>
                        <AlertDialogDescription>
                          A assinatura será cancelada e as cobranças futuras serão encerradas. Deseja continuar?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Voltar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleCancelSubscription} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Confirmar Cancelamento
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>

            {showObsInput && (
              <div className="flex gap-2 mt-3">
                <Input
                  placeholder="Digite a observação..."
                  value={obsText}
                  onChange={(e) => setObsText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddObs()}
                  className="flex-1"
                />
                <Button size="sm" onClick={handleAddObs} disabled={addHistory.isPending || !obsText.trim()}>
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </DrawerHeader>

          <div className="overflow-y-auto p-4">
            <Tabs defaultValue="parcelas">
              <TabsList className="w-full max-w-md">
                <TabsTrigger value="parcelas">Parcelas</TabsTrigger>
                <TabsTrigger value="acordos">Acordos ({agreements.length})</TabsTrigger>
                <TabsTrigger value="historico">Histórico</TabsTrigger>
              </TabsList>
              <TabsContent value="parcelas" className="mt-4">
                <CobrancaInstallments
                  installments={installments}
                  isLoading={loadingInst}
                  onMarkPaid={handleMarkPaid}
                  onRegisterPayment={handleRegisterPayment}
                />
              </TabsContent>
              <TabsContent value="acordos" className="mt-4">
                <CobrancaAgreements agreements={agreements} isLoading={loadingAg} />
              </TabsContent>
              <TabsContent value="historico" className="mt-4">
                <CobrancaHistory history={history} isLoading={loadingHist} />
              </TabsContent>
            </Tabs>
          </div>
        </DrawerContent>
      </Drawer>

      <CreateAgreementModal subscriptionId={subscription.id} open={showAgreementModal} onOpenChange={setShowAgreementModal} />
      <EditSubscriptionModal subscription={subscription} open={showEditModal} onOpenChange={setShowEditModal} />
      <RegisterPaymentModal installment={selectedInstallment} subscriptionId={subscription.id} open={showPaymentModal} onOpenChange={setShowPaymentModal} />
    </>
  );
};
