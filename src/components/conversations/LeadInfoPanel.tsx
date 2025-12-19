import { useState } from 'react';
import { Phone, Mail, MessageCircle, Calendar, ExternalLink, ChevronDown, User, FileText, History, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { useCRMDeal, useCRMContact } from '@/hooks/useCRMData';
import { useA010Journey } from '@/hooks/useA010Journey';
import { useTwilio } from '@/contexts/TwilioContext';
import { buildWhatsAppMessage } from '@/lib/whatsappTemplates';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface LeadInfoPanelProps {
  dealId: string | null;
  contactId: string | null;
}

export function LeadInfoPanel({ dealId, contactId }: LeadInfoPanelProps) {
  const { data: deal, isLoading: dealLoading } = useCRMDeal(dealId || '');
  const { data: contact, isLoading: contactLoading } = useCRMContact(contactId || '');
  const { data: a010Journey } = useA010Journey(contact?.email, contact?.phone);
  const { makeCall, deviceStatus } = useTwilio();
  
  const [openSections, setOpenSections] = useState<string[]>(['contact', 'deal']);

  const toggleSection = (section: string) => {
    setOpenSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const isLoading = dealLoading || contactLoading;
  const twilioReady = deviceStatus === 'ready';

  // Get phone from contact or deal custom_fields
  const getPhone = (): string | null => {
    if (contact?.phone) return contact.phone;
    if (deal?.custom_fields && typeof deal.custom_fields === 'object') {
      const cf = deal.custom_fields as Record<string, unknown>;
      if (typeof cf.telefone === 'string') return cf.telefone;
    }
    return null;
  };

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  };

  // Handle call
  const handleCall = () => {
    const phone = getPhone();
    if (phone && twilioReady) {
      makeCall(phone);
    }
  };

  // Handle WhatsApp
  const handleWhatsApp = () => {
    const phone = getPhone();
    if (!phone) return;
    
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    
    const message = buildWhatsAppMessage(deal as any, contact as any);
    const encodedMessage = encodeURIComponent(message);
    
    window.open(`https://wa.me/${formattedPhone}?text=${encodedMessage}`, '_blank');
  };

  // Handle view in CRM
  const handleViewInCRM = () => {
    if (dealId) {
      window.open(`/crm/negocios?dealId=${dealId}`, '_blank');
    } else if (contactId) {
      window.open(`/crm/contatos?contactId=${contactId}`, '_blank');
    }
  };

  if (!dealId && !contactId) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <User className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground text-sm">
          Selecione uma conversa para ver as informações do lead
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex flex-col p-4 space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const displayName = contact?.name || deal?.name || 'Lead';
  const stageName = deal?.crm_stages?.stage_name || 'Sem etapa';
  const stageColor = deal?.crm_stages?.color || '#6b7280';
  const originName = deal?.crm_origins?.name;
  const phone = getPhone();

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col">
        {/* Header */}
        <div className="p-4 border-b bg-secondary/30">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
            Próximo Negócio
          </p>
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="font-semibold truncate">{displayName}</p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {originName && (
                  <Badge variant="outline" className="text-xs">
                    {originName}
                  </Badge>
                )}
                <Badge 
                  className="text-xs"
                  style={{ 
                    backgroundColor: `${stageColor}20`,
                    color: stageColor,
                    borderColor: stageColor
                  }}
                >
                  {stageName}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="p-4 border-b">
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 gap-1.5"
              onClick={handleCall}
              disabled={!twilioReady || !phone}
            >
              <Phone className="h-4 w-4" />
              Ligar
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 gap-1.5 text-green-600 border-green-600/30 hover:bg-green-50 hover:text-green-700"
              onClick={handleWhatsApp}
              disabled={!phone}
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </Button>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full mt-2 gap-1.5 text-muted-foreground"
            onClick={handleViewInCRM}
          >
            <ExternalLink className="h-4 w-4" />
            Ver no CRM
          </Button>
        </div>

        {/* Deal Value */}
        {deal?.value && (
          <div className="p-4 border-b bg-primary/5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Valor do Negócio
            </p>
            <p className="text-2xl font-bold text-primary">
              {formatCurrency(deal.value)}
            </p>
          </div>
        )}

        {/* Collapsible Sections */}
        <div className="flex-1">
          {/* Contact Section */}
          <Collapsible 
            open={openSections.includes('contact')} 
            onOpenChange={() => toggleSection('contact')}
          >
            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors border-b">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">Contato</span>
              </div>
              <ChevronDown className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                openSections.includes('contact') && "rotate-180"
              )} />
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 py-3 border-b bg-muted/20 space-y-2">
              {contact?.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${contact.email}`} className="text-primary hover:underline truncate">
                    {contact.email}
                  </a>
                </div>
              )}
              {phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{phone}</span>
                </div>
              )}
              {contact?.organization_name && (
                <div className="text-sm text-muted-foreground">
                  Empresa: {contact.organization_name}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Deal Section */}
          {deal && (
            <Collapsible 
              open={openSections.includes('deal')} 
              onOpenChange={() => toggleSection('deal')}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors border-b">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Negócio</span>
                </div>
                <ChevronDown className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  openSections.includes('deal') && "rotate-180"
                )} />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-4 py-3 border-b bg-muted/20 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Produto</span>
                  <span>{deal.product_name || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Origem</span>
                  <span>{originName || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Probabilidade</span>
                  <span>{deal.probability ? `${deal.probability}%` : '-'}</span>
                </div>
                {deal.next_action_date && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Próxima Ação</span>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{format(new Date(deal.next_action_date), 'dd/MM HH:mm', { locale: ptBR })}</span>
                    </div>
                  </div>
                )}
                {deal.tags && deal.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {deal.tags.map((tag: string) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Notes Section */}
          <Collapsible 
            open={openSections.includes('notes')} 
            onOpenChange={() => toggleSection('notes')}
          >
            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors border-b">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">Notas</span>
              </div>
              <ChevronDown className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                openSections.includes('notes') && "rotate-180"
              )} />
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 py-3 border-b bg-muted/20">
              {contact?.notes ? (
                <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">Nenhuma nota registrada</p>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* A010 Journey Section */}
          {a010Journey && a010Journey.purchaseCount > 0 && (
            <Collapsible 
              open={openSections.includes('a010')} 
              onOpenChange={() => toggleSection('a010')}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors border-b">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Jornada A010</span>
                  <Badge variant="secondary" className="text-xs">
                    {a010Journey.purchaseCount} compra{a010Journey.purchaseCount > 1 ? 's' : ''}
                  </Badge>
                </div>
                <ChevronDown className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  openSections.includes('a010') && "rotate-180"
                )} />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-4 py-3 border-b bg-muted/20 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Investido</span>
                  <span className="font-semibold text-green-600">
                    {formatCurrency(a010Journey.totalPaid)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ticket Médio</span>
                  <span>{formatCurrency(a010Journey.averageTicket)}</span>
                </div>
                {a010Journey.firstPurchaseDate && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Primeira Compra</span>
                    <span>{format(new Date(a010Journey.firstPurchaseDate), 'dd/MM/yyyy', { locale: ptBR })}</span>
                  </div>
                )}
                {a010Journey.products && a010Journey.products.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-2">Produtos adquiridos:</p>
                    <div className="flex flex-wrap gap-1">
                      {a010Journey.products.map((product: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {product}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* History Section */}
          <Collapsible 
            open={openSections.includes('history')} 
            onOpenChange={() => toggleSection('history')}
          >
            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors border-b">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">Histórico</span>
              </div>
              <ChevronDown className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                openSections.includes('history') && "rotate-180"
              )} />
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 py-3 border-b bg-muted/20">
              <p className="text-sm text-muted-foreground italic">
                Histórico de atividades em breve...
              </p>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </ScrollArea>
  );
}
