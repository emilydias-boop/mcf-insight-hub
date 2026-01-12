import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useIncorporadorLeadJourney } from '@/hooks/useIncorporadorLeadJourney';
import { useCustomerTransactions } from '@/hooks/useCustomerTransactions';
import { 
  Phone, 
  Mail, 
  MessageCircle, 
  User, 
  Calendar, 
  ExternalLink,
  CheckCircle2,
  Circle,
  Clock,
  UserCheck,
  Video,
  Target,
  Building2,
  Receipt,
  ChevronLeft,
  ChevronRight,
  ChevronDown
} from 'lucide-react';

interface IncorporadorTransactionDrawerProps {
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

const formatDateTime = (date: string | null) => {
  if (!date) return '-';
  return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
};

const getMeetingStatusBadge = (status: string | null) => {
  switch (status?.toLowerCase()) {
    case 'completed':
    case 'realizada':
      return <Badge className="bg-green-500/20 text-green-600 border-green-500/30">Realizada</Badge>;
    case 'scheduled':
    case 'agendada':
      return <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30">Agendada</Badge>;
    case 'cancelled':
    case 'cancelada':
      return <Badge className="bg-red-500/20 text-red-600 border-red-500/30">Cancelada</Badge>;
    case 'no_show':
    case 'no-show':
      return <Badge className="bg-orange-500/20 text-orange-600 border-orange-500/30">No-show</Badge>;
    case 'rescheduled':
    case 'reagendada':
      return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">Reagendada</Badge>;
    default:
      return status ? <Badge variant="outline">{status}</Badge> : null;
  }
};

interface JourneyStepProps {
  completed: boolean;
  inProgress?: boolean;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

const JourneyStep = ({ completed, inProgress, title, icon, children }: JourneyStepProps) => {
  const getStepIcon = () => {
    if (completed) return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    if (inProgress) return <Clock className="h-5 w-5 text-yellow-500" />;
    return <Circle className="h-5 w-5 text-muted-foreground" />;
  };

  return (
    <div className={`p-4 rounded-lg border ${
      completed ? 'bg-green-500/5 border-green-500/20' : 
      inProgress ? 'bg-yellow-500/5 border-yellow-500/20' : 
      'bg-muted/30 border-border'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        {getStepIcon()}
        <span className="text-muted-foreground">{icon}</span>
        <h4 className="font-medium">{title}</h4>
      </div>
      <div className="pl-7 text-sm">
        {children}
      </div>
    </div>
  );
};

const ITEMS_PER_PAGE = 5;

export const IncorporadorTransactionDrawer = ({ 
  transaction, 
  open, 
  onOpenChange 
}: IncorporadorTransactionDrawerProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);

  const { data: journey, isLoading } = useIncorporadorLeadJourney(
    transaction?.customer_email || null,
    transaction?.customer_phone || null
  );

  const { data: allTransactions, isLoading: isLoadingTransactions } = useCustomerTransactions(
    transaction?.customer_email || null
  );

  // Reset page and expanded state when drawer opens with new transaction
  useEffect(() => {
    if (open) {
      setCurrentPage(1);
      setExpandedTxId(null);
    }
  }, [open, transaction?.id]);

  if (!transaction) return null;

  const whatsappLink = transaction.customer_phone 
    ? `https://wa.me/${transaction.customer_phone.replace(/\D/g, '')}`
    : null;

  const hasSdr = !!journey?.sdrName || !!journey?.sdrEmail;
  const hasMeeting01 = !!journey?.meeting01;
  const meeting01Completed = journey?.meeting01?.status?.toLowerCase() === 'completed' || 
                             journey?.meeting01?.status?.toLowerCase() === 'realizada';
  const hasMeeting02 = !!journey?.meeting02;
  const meeting02Completed = journey?.meeting02?.status?.toLowerCase() === 'completed' || 
                             journey?.meeting02?.status?.toLowerCase() === 'realizada';

  // Pagination calculations
  const totalTransactions = allTransactions?.length || 0;
  const totalPages = Math.ceil(totalTransactions / ITEMS_PER_PAGE);
  const paginatedTransactions = allTransactions?.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

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

            {/* Jornada do Lead */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Target className="h-4 w-4" />
                Jornada do Lead
              </h4>
              
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : journey ? (
                <div className="space-y-3">
                  {/* SDR */}
                  <JourneyStep
                    completed={hasSdr}
                    title="SDR que Atendeu"
                    icon={<UserCheck className="h-4 w-4" />}
                  >
                    {hasSdr ? (
                      <div className="space-y-1">
                        <p className="font-medium">{journey.sdrName || 'SDR'}</p>
                        {journey.sdrEmail && (
                          <p className="text-muted-foreground text-xs">{journey.sdrEmail}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Sem informação de SDR</p>
                    )}
                  </JourneyStep>

                  {/* Reunião 01 */}
                  <JourneyStep
                    completed={meeting01Completed}
                    inProgress={hasMeeting01 && !meeting01Completed}
                    title="Reunião 01"
                    icon={<Video className="h-4 w-4" />}
                  >
                    {hasMeeting01 && journey.meeting01 ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span>{formatDateTime(journey.meeting01.scheduledAt)}</span>
                        </div>
                        {journey.meeting01.closerName && (
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span>Closer: <strong>{journey.meeting01.closerName}</strong></span>
                          </div>
                        )}
                        <div className="mt-1">
                          {getMeetingStatusBadge(journey.meeting01.status)}
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Não agendada</p>
                    )}
                  </JourneyStep>

                  {/* R2 */}
                  <JourneyStep
                    completed={meeting02Completed}
                    inProgress={hasMeeting02 && !meeting02Completed}
                    title="R2 (Segunda Reunião)"
                    icon={<Video className="h-4 w-4" />}
                  >
                    {hasMeeting02 && journey.meeting02 ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span>{formatDateTime(journey.meeting02.scheduledAt)}</span>
                        </div>
                        {journey.meeting02.closerName && (
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span>Closer: <strong>{journey.meeting02.closerName}</strong></span>
                          </div>
                        )}
                        <div className="mt-1">
                          {getMeetingStatusBadge(journey.meeting02.status)}
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Não agendada</p>
                    )}
                  </JourneyStep>

                  {/* Status Atual */}
                  <JourneyStep
                    completed={!!journey.dealStage}
                    title="Status Atual"
                    icon={<Building2 className="h-4 w-4" />}
                  >
                    {journey.dealStage ? (
                      <div className="space-y-2">
                        <Badge 
                          variant="outline" 
                          style={{ borderColor: journey.dealStageColor || undefined }}
                          className="font-medium"
                        >
                          {journey.dealStage}
                        </Badge>
                        {journey.originName && (
                          <p className="text-muted-foreground text-xs">
                            Origem: {journey.originName}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Sem status definido</p>
                    )}
                  </JourneyStep>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <p>Lead não encontrado no CRM</p>
                  <p className="text-xs mt-1">Verifique se o email está cadastrado corretamente</p>
                </div>
              )}

              {/* Botão Ver no CRM */}
              {journey?.dealId && (
                <Button 
                  variant="outline" 
                  className="w-full mt-3"
                  onClick={() => window.open(`/crm/negocios?deal=${journey.dealId}`, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ver Lead no CRM
                </Button>
              )}
            </div>

            <Separator />

            {/* Todas as Transações do Cliente */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2 justify-between">
                <span className="flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Transações do Cliente ({totalTransactions})
                </span>
                {totalPages > 1 && (
                  <span className="text-xs text-muted-foreground font-normal">
                    Página {currentPage} de {totalPages}
                  </span>
                )}
              </h4>

              {isLoadingTransactions ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : paginatedTransactions && paginatedTransactions.length > 0 ? (
                <>
                  <div className="space-y-2">
                    {paginatedTransactions.map((tx) => (
                      <div 
                        key={tx.id} 
                        className={`bg-muted/30 rounded-lg p-3 text-sm border cursor-pointer transition-colors hover:bg-muted/50 ${
                          tx.id === transaction.id ? 'border-primary/50 bg-primary/5' : 'border-transparent'
                        }`}
                        onClick={() => setExpandedTxId(expandedTxId === tx.id ? null : tx.id)}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex items-start gap-2 min-w-0 flex-1">
                            <ChevronDown className={`h-4 w-4 mt-0.5 text-muted-foreground transition-transform flex-shrink-0 ${
                              expandedTxId === tx.id ? 'rotate-180' : ''
                            }`} />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate" title={tx.product_name}>
                                {tx.product_name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(tx.sale_date)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-medium text-green-600">
                              {formatCurrency(tx.net_value)}
                            </p>
                            {tx.total_installments && tx.total_installments > 1 && (
                              <p className="text-xs text-muted-foreground">
                                Parcela {tx.installment_number}/{tx.total_installments}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Expanded Transaction Details */}
                        {expandedTxId === tx.id && (
                          <div className="mt-3 pt-3 border-t border-border space-y-2">
                            <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                              Resumo da Transação
                            </h5>
                            <div className="grid grid-cols-2 gap-y-2 text-sm">
                              <span className="text-muted-foreground">Produto</span>
                              <span className="text-right font-medium">{tx.product_name}</span>
                              
                              <span className="text-muted-foreground">Data da Venda</span>
                              <span className="text-right">{formatDate(tx.sale_date)}</span>
                              
                              <span className="text-muted-foreground">Parcela</span>
                              <span className="text-right">{tx.installment_number || 1}/{tx.total_installments || 1}</span>
                              
                              <span className="text-muted-foreground">Valor Bruto</span>
                              <span className="text-right">{formatCurrency(tx.product_price)}</span>
                              
                              <span className="text-muted-foreground">Valor Líquido</span>
                              <span className="text-right text-green-600 font-medium">{formatCurrency(tx.net_value)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-2 pt-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground min-w-[60px] text-center">
                        {currentPage} / {totalPages}
                      </span>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  Nenhuma transação encontrada
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
