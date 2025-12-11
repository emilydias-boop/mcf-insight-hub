import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useCRMDeal, useUpdateCRMContact, useCRMContact } from '@/hooks/useCRMData';
import { useTwilio } from '@/contexts/TwilioContext';
import { DealHistory } from './DealHistory';
import { CallHistorySection } from './CallHistorySection';
import { Phone, Mail, Calendar, Edit2, Check, X, DollarSign, Percent, User } from 'lucide-react';
import { toast } from 'sonner';

interface DealDetailsDrawerProps {
  dealId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DealDetailsDrawer = ({ dealId, open, onOpenChange }: DealDetailsDrawerProps) => {
  const { data: deal, isLoading: dealLoading } = useCRMDeal(dealId || '');
  const { data: contact, isLoading: contactLoading } = useCRMContact(deal?.contact_id || '');
  const updateContact = useUpdateCRMContact();
  const { makeCall, isTestPipeline, deviceStatus, initializeDevice } = useTwilio();
  
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneValue, setPhoneValue] = useState('');
  
  const isLoading = dealLoading || contactLoading;
  const isTestDeal = deal ? isTestPipeline(deal.origin_id) : false;
  
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };
  
  const handleStartEditPhone = () => {
    setPhoneValue(contact?.phone || '');
    setEditingPhone(true);
  };
  
  const handleSavePhone = async () => {
    if (!contact?.id) return;
    
    try {
      await updateContact.mutateAsync({
        id: contact.id,
        phone: phoneValue
      });
      toast.success('Telefone atualizado');
      setEditingPhone(false);
    } catch (error) {
      toast.error('Erro ao atualizar telefone');
    }
  };
  
  const handleCancelEditPhone = () => {
    setEditingPhone(false);
    setPhoneValue('');
  };
  
  const handleCall = async () => {
    const customFields = deal?.custom_fields as Record<string, any> | null;
    const phone = contact?.phone || customFields?.telefone;
    if (!phone) {
      toast.error('Contato não possui telefone cadastrado');
      return;
    }
    
    if (deviceStatus !== 'ready') {
      toast.info('Inicializando Twilio...');
      await initializeDevice();
      return;
    }
    
    await makeCall(phone, deal?.id, contact?.id, deal?.origin_id);
  };
  
  if (!dealId) return null;
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-card border-border w-full sm:max-w-lg overflow-y-auto">
        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-20 w-20 rounded-full mx-auto" />
            <Skeleton className="h-8 w-48 mx-auto" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : deal ? (
          <>
            <SheetHeader className="pb-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">
                    {getInitials(deal.name)}
                  </span>
                </div>
                <div>
                  <SheetTitle className="text-2xl text-foreground">{deal.name}</SheetTitle>
                  {deal.crm_stages?.stage_name && (
                    <Badge className="mt-2 bg-primary/10 text-primary border-0">
                      {deal.crm_stages.stage_name}
                    </Badge>
                  )}
                </div>
              </div>
            </SheetHeader>
            
            <div className="space-y-6">
              {/* Informações do Deal */}
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  💼 Informações do Negócio
                </h3>
                <div className="space-y-2 pl-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <DollarSign className="h-4 w-4" />
                    <span>Valor: <strong className="text-emerald-600">R$ {(deal.value || 0).toLocaleString('pt-BR')}</strong></span>
                  </div>
                  {deal.probability && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Percent className="h-4 w-4" />
                      <span>Probabilidade: {deal.probability}%</span>
                    </div>
                  )}
                  {deal.expected_close_date && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Previsão: {new Date(deal.expected_close_date).toLocaleDateString('pt-BR')}</span>
                    </div>
                  )}
                  {deal.owner_id && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span>Responsável: {deal.owner_id}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Contato */}
              {contact && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    👤 Contato
                  </h3>
                  <div className="space-y-2 pl-2">
                    <div className="text-sm font-medium text-foreground">{contact.name}</div>
                    
                    {contact.email && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        <span>{contact.email}</span>
                      </div>
                    )}
                    
                    {/* Telefone editável */}
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {editingPhone ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            value={phoneValue}
                            onChange={(e) => setPhoneValue(e.target.value)}
                            placeholder="+5511999990001"
                            className="h-8 text-sm"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-green-600 hover:text-green-700"
                            onClick={handleSavePhone}
                            disabled={updateContact.isPending}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-600 hover:text-red-700"
                            onClick={handleCancelEditPhone}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-muted-foreground">
                            {contact.phone || 'Não cadastrado'}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={handleStartEditPhone}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Tags */}
              {deal.tags && deal.tags.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    🏷️ Tags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {deal.tags.map((tag: any, idx: number) => (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className="bg-primary/10 text-primary border-0"
                      >
                        {typeof tag === 'string' ? tag : tag.name || 'Tag'}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Botão de Ligar */}
              <div className="pt-4">
                {(() => {
                  const customFields = deal.custom_fields as Record<string, any> | null;
                  const hasPhone = contact?.phone || customFields?.telefone;
                  return (
                    <Button
                      className={`w-full ${isTestDeal ? 'bg-green-500 hover:bg-green-600' : 'bg-primary hover:bg-primary/90'}`}
                      onClick={handleCall}
                      disabled={!hasPhone}
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      {isTestDeal ? 'Ligar (Pipeline de Teste)' : 'Ligar via Twilio'}
                    </Button>
                  );
                })()}
              </div>
              
              {/* Histórico de Ligações */}
              {dealId && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    📞 Histórico de Ligações
                  </h3>
                  <CallHistorySection dealId={dealId} />
                </div>
              )}
              
              {/* Timeline de Atividades */}
              {dealId && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    📋 Histórico do Deal
                  </h3>
                  <DealHistory dealId={dealId} />
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>Negócio não encontrado</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
