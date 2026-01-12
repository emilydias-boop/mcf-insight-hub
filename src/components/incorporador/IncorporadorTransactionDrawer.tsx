import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useIncorporadorLeadJourney } from '@/hooks/useIncorporadorLeadJourney';
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
  Building2
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

export const IncorporadorTransactionDrawer = ({ 
  transaction, 
  open, 
  onOpenChange 
}: IncorporadorTransactionDrawerProps) => {
  const { data: journey, isLoading } = useIncorporadorLeadJourney(transaction?.customer_email || null);

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

            {/* Resumo da Transação */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Resumo da Transação
              </h4>
              <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Produto</span>
                  <span className="font-medium text-right max-w-[200px] truncate">
                    {transaction.product_name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data da Venda</span>
                  <span className="font-medium">{formatDate(transaction.sale_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Parcela</span>
                  <span className="font-medium">
                    {transaction.installment_number && transaction.total_installments
                      ? `${transaction.installment_number}/${transaction.total_installments}`
                      : '1/1'}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor Bruto</span>
                  <span className="font-medium">{formatCurrency(transaction.product_price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor Líquido</span>
                  <span className="font-bold text-green-600">{formatCurrency(transaction.net_value)}</span>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
