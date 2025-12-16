import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useCourseCRM } from '@/hooks/useCourseCRM';
import { useCustomerJourney } from '@/hooks/useCustomerJourney';
import { Phone, Mail, MessageCircle, User, Calendar, TrendingUp, CreditCard, ShoppingBag, Star, FileText, Trophy, ExternalLink } from 'lucide-react';

interface TransactionDetailsDrawerProps {
  transaction: {
    id: string;
    customer_name: string | null;
    customer_email: string | null;
    customer_phone: string | null;
    product_name: string;
    sale_date: string;
    product_price: number | null;
    net_value: number | null;
    installment_number: number | null;
    total_installments: number | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatCurrency = (value: number | null) => {
  if (value === null) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatDate = (date: string | null) => {
  if (!date) return '-';
  return format(new Date(date), 'dd/MM/yyyy', { locale: ptBR });
};

const getMilestoneIcon = (productName: string, category: string | null) => {
  const lower = productName.toLowerCase();
  const cat = (category || '').toLowerCase();
  
  if (lower.includes('a010') || cat === 'a010') return <Star className="h-4 w-4 text-yellow-500" />;
  if (lower.includes('contrato') || lower.includes('a000')) return <FileText className="h-4 w-4 text-blue-500" />;
  if (lower.includes('parceria') || lower.includes('a009') || lower.includes('parceiro')) return <Trophy className="h-4 w-4 text-green-500" />;
  return null;
};

export const TransactionDetailsDrawer = ({ transaction, open, onOpenChange }: TransactionDetailsDrawerProps) => {
  const { data: crmData, isLoading: crmLoading } = useCourseCRM(transaction?.customer_email || null);
  const { data: journey, isLoading: journeyLoading } = useCustomerJourney(transaction?.customer_email || null);

  if (!transaction) return null;

  const whatsappLink = transaction.customer_phone 
    ? `https://wa.me/${transaction.customer_phone.replace(/\D/g, '')}`
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {transaction.customer_name || 'Cliente'}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-100px)] pr-4">
          <div className="space-y-6 py-4">
            {/* Contact Info */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                {transaction.customer_email || '-'}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                {transaction.customer_phone || '-'}
                {whatsappLink && (
                  <Button variant="ghost" size="sm" asChild className="h-6 px-2">
                    <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="h-4 w-4 text-green-500" />
                    </a>
                  </Button>
                )}
              </div>
            </div>

            <Separator />

            {/* CRM Data */}
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Dados do CRM
              </h4>
              {crmLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : crmData ? (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Deal:</span>
                    <p className="truncate">{crmData.deal_name || '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Stage:</span>
                    <p>
                      {crmData.stage_name && (
                        <Badge 
                          variant="outline" 
                          style={{ borderColor: crmData.stage_color || undefined }}
                        >
                          {crmData.stage_name}
                        </Badge>
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Closer:</span>
                    <p className="truncate">{crmData.owner_id || '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Origem:</span>
                    <p className="truncate">{crmData.origin_name || '-'}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Não encontrado no CRM</p>
              )}
              
              {/* Botão Ver no CRM */}
              {crmData?.deal_id && (
                <Button 
                  variant="outline" 
                  className="w-full mt-3"
                  onClick={() => window.open(`/crm/negocios?deal=${crmData.deal_id}`, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ver Lead no CRM
                </Button>
              )}
            </div>

            <Separator />

            {/* Resumo do Produto Atual */}
            {journey && transaction && (() => {
              // Calcular valores do produto atual
              const productTransactions = journey.transactions.filter(
                t => t.product_name === transaction.product_name
              );
              const firstInstallment = productTransactions.find(t => (t.installment_number || 1) === 1);
              const productTotalValue = firstInstallment?.product_price || transaction.product_price || 0;
              const paidValue = productTransactions.reduce((sum, t) => sum + (t.net_value || 0), 0);
              const remainingValue = Math.max(0, productTotalValue - paidValue);
              
              return (
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4" />
                    Resumo do Produto
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-muted/50 p-3 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground">Valor Total</p>
                      <p className="font-bold text-sm">{formatCurrency(productTotalValue)}</p>
                    </div>
                    <div className="bg-green-500/10 p-3 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground">Pago</p>
                      <p className="font-bold text-sm text-green-600">{formatCurrency(paidValue)}</p>
                    </div>
                    <div className="bg-orange-500/10 p-3 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground">Falta</p>
                      <p className="font-bold text-sm text-orange-600">{formatCurrency(remainingValue)}</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            <Separator />

            {/* Conversion Metrics */}
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Métricas de Conversão
              </h4>
              {journeyLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : journey ? (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-muted-foreground text-xs">A010 → Contrato</p>
                    <p className="text-lg font-semibold">
                      {journey.daysToContract !== null ? `${journey.daysToContract} dias` : '-'}
                    </p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-muted-foreground text-xs">Contrato → Parceria</p>
                    <p className="text-lg font-semibold">
                      {journey.daysToPartnership !== null ? `${journey.daysToPartnership} dias` : '-'}
                    </p>
                  </div>
                  <div className="col-span-2 bg-primary/10 rounded-lg p-3">
                    <p className="text-muted-foreground text-xs">Total Investido</p>
                    <p className="text-xl font-bold text-primary">
                      {formatCurrency(journey.totalInvested)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sem dados de jornada</p>
              )}
            </div>

            <Separator />

            {/* Payment Status */}
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Status de Pagamento
              </h4>
              {journeyLoading ? (
                <Skeleton className="h-12 w-full" />
              ) : journey && journey.currentInstallment ? (
                <div className="flex items-center gap-4 text-sm">
                  <div className="bg-muted/50 rounded-lg p-3 flex-1">
                    <p className="text-muted-foreground text-xs">Parcela</p>
                    <p className="font-semibold">
                      {journey.currentInstallment}/{journey.totalInstallments}
                    </p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 flex-1">
                    <p className="text-muted-foreground text-xs">Próximo Vencimento</p>
                    <p className="font-semibold">
                      {journey.estimatedNextDueDate ? formatDate(journey.estimatedNextDueDate) : 'Quitado'}
                    </p>
                  </div>
                  <div className="flex items-center">
                    {journey.isOverdue ? (
                      <Badge variant="destructive">Atrasado</Badge>
                    ) : journey.estimatedNextDueDate ? (
                      <Badge variant="outline" className="border-green-500 text-green-600">Em dia</Badge>
                    ) : (
                      <Badge variant="secondary">Pago</Badge>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Pagamento à vista ou sem parcelamento</p>
              )}
            </div>

            <Separator />

            {/* Transaction Timeline */}
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                Timeline de Compras
              </h4>
              {journeyLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : journey && journey.transactions.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {journey.transactions.map((t, index) => (
                    <div 
                      key={t.id} 
                      className={`flex items-center gap-3 text-sm p-2 rounded-lg ${
                        t.id === transaction.id ? 'bg-primary/10 border border-primary/20' : 'bg-muted/30'
                      }`}
                    >
                      <div className="w-20 text-xs text-muted-foreground">
                        {formatDate(t.sale_date)}
                      </div>
                      <div className="flex-1 truncate">
                        <span className="font-medium">{t.product_name}</span>
                        {(t.installment_number || 1) > 1 && (
                          <span className="text-xs text-muted-foreground ml-1">
                            (Parcela {t.installment_number})
                          </span>
                        )}
                      </div>
                      <div className="text-right font-medium">
                        {formatCurrency(t.net_value)}
                      </div>
                      <div className="w-6">
                        {getMilestoneIcon(t.product_name, t.product_category)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma transação encontrada</p>
              )}
            </div>

            <Separator />

            {/* Products Acquired */}
            <div className="space-y-2">
              <h4 className="font-medium">Produtos Adquiridos</h4>
              {journeyLoading ? (
                <Skeleton className="h-12 w-full" />
              ) : journey ? (
                <div className="flex flex-wrap gap-1">
                  {journey.uniqueProducts.map((product, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {product}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
