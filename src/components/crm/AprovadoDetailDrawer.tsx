import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { X, Phone, Mail, User, MapPin, ShoppingCart, CheckCircle, ExternalLink, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { R2CarrinhoAttendee } from '@/hooks/useR2CarrinhoData';
import { useLeadJourney } from '@/hooks/useLeadJourney';
import { useAprovadoSaleData } from '@/hooks/useAprovadoSaleData';
import { Skeleton } from '@/components/ui/skeleton';

interface AprovadoDetailDrawerProps {
  attendee: R2CarrinhoAttendee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AprovadoDetailDrawer({ attendee, open, onOpenChange }: AprovadoDetailDrawerProps) {
  const { data: journey, isLoading: journeyLoading } = useLeadJourney(attendee?.deal_id || '');
  const { data: saleData, isLoading: saleLoading } = useAprovadoSaleData(
    attendee?.contact_email || null,
    attendee?.attendee_phone || attendee?.contact_phone || null
  );

  if (!attendee) return null;

  const name = attendee.attendee_name || attendee.deal_name || 'Sem nome';
  const phone = attendee.attendee_phone || attendee.contact_phone;
  const email = attendee.contact_email;

  const handleWhatsApp = () => {
    if (phone) {
      const normalized = phone.replace(/\D/g, '');
      window.open(`https://wa.me/${normalized}`, '_blank');
    }
  };

  const handleCall = () => {
    if (phone) {
      window.location.href = `tel:${phone}`;
    }
  };

  const handleOpenDeal = () => {
    if (attendee.deal_id) {
      window.open(`/crm/negocios?deal=${attendee.deal_id}`, '_blank');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getCarrinhoLabel = () => {
    switch (attendee.carrinho_status) {
      case 'vai_comprar': return 'Vai Comprar';
      case 'comprou': return 'Comprou';
      case 'nao_comprou': return 'Não Comprou';
      default: return 'Pendente';
    }
  };

  const getCarrinhoVariant = (): "default" | "secondary" | "destructive" | "outline" => {
    switch (attendee.carrinho_status) {
      case 'vai_comprar': return 'default';
      case 'comprou': return 'secondary';
      case 'nao_comprou': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="border-b">
          <div className="flex items-center justify-between">
            <DrawerTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {name}
            </DrawerTitle>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon">
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>

        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Contact Info */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Contato
            </h3>
            <div className="grid gap-2">
              {phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono">{phone}</span>
                </div>
              )}
              {email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{email}</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Status Info */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Status
            </h3>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                R2: Aprovado
              </Badge>
              <Badge variant={getCarrinhoVariant()}>
                <ShoppingCart className="h-3 w-3 mr-1" />
                {getCarrinhoLabel()}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: attendee.closer_color || 'hsl(var(--muted-foreground))' }}
              />
              <span>Closer: {attendee.closer_name || '-'}</span>
            </div>
            {attendee.partner_name && (
              <div className="text-sm text-muted-foreground">
                Sócio: {attendee.partner_name}
              </div>
            )}
          </div>

          <Separator />

          {/* Journey */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Jornada do Lead
            </h3>
            
            {journeyLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : (
              <div className="space-y-3 pl-4 border-l-2 border-muted">
                {/* Entry */}
                {journey?.sdr && (
                  <div className="relative">
                    <div className="absolute -left-[17px] top-1 w-2 h-2 rounded-full bg-primary" />
                    <div className="text-sm">
                      <div className="font-medium">Entrada na Pipeline</div>
                      <div className="text-muted-foreground">
                        SDR: {journey.sdr.name}
                      </div>
                    </div>
                  </div>
                )}

                {/* R1 Meeting */}
                {journey?.r1Meeting && (
                  <div className="relative">
                    <div className="absolute -left-[17px] top-1 w-2 h-2 rounded-full bg-secondary-foreground" />
                    <div className="text-sm">
                      <div className="font-medium flex items-center gap-2">
                        R1 - {journey.r1Meeting.status === 'completed' ? 'Realizada' : journey.r1Meeting.status}
                        {journey.r1Meeting.status === 'completed' && (
                          <CheckCircle className="h-3 w-3 text-primary" />
                        )}
                      </div>
                      <div className="text-muted-foreground">
                        {format(new Date(journey.r1Meeting.scheduledAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                      {journey.r1Meeting.closer?.name && (
                        <div className="text-muted-foreground">
                          Closer: {journey.r1Meeting.closer.name}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* R2 Meeting */}
                <div className="relative">
                  <div className="absolute -left-[17px] top-1 w-2 h-2 rounded-full bg-accent-foreground" />
                  <div className="text-sm">
                    <div className="font-medium flex items-center gap-2">
                      R2 - {attendee.meeting_status === 'completed' ? 'Realizada' : 'Agendada'}
                      {attendee.meeting_status === 'completed' && (
                        <CheckCircle className="h-3 w-3 text-primary" />
                      )}
                    </div>
                    <div className="text-muted-foreground">
                      {format(new Date(attendee.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </div>
                    {attendee.closer_name && (
                      <div className="text-muted-foreground">
                        Closer: {attendee.closer_name}
                      </div>
                    )}
                  </div>
                </div>

                {/* Sale */}
                {saleLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : saleData && (
                  <div className="relative">
                    <div className="absolute -left-[17px] top-1 w-2 h-2 rounded-full bg-chart-4" />
                    <div className="text-sm">
                      <div className="font-medium flex items-center gap-2 text-chart-4">
                        💰 Venda Realizada
                      </div>
                      <div className="text-muted-foreground">
                        {saleData.product_name}
                      </div>
                      <div className="font-semibold text-primary">
                        {formatCurrency(saleData.net_value)}
                      </div>
                      <div className="text-muted-foreground">
                        {format(new Date(saleData.sale_date), "dd/MM/yyyy", { locale: ptBR })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleWhatsApp}
              disabled={!phone}
              className="flex-1"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              WhatsApp
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleCall}
              disabled={!phone}
              className="flex-1"
            >
              <Phone className="h-4 w-4 mr-2" />
              Ligar
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleOpenDeal}
              disabled={!attendee.deal_id}
              className="flex-1"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Ver no CRM
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
