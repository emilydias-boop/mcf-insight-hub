import { useState } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useCRMDeal, useUpdateCRMContact, useCRMContact } from '@/hooks/useCRMData';
import { DealHistory } from './DealHistory';
import { CallHistorySection } from './CallHistorySection';
import { NextActionBlock } from './NextActionBlock';
import { A010JourneyBlock } from './A010JourneyBlock';
import { QuickActionsBlock } from './QuickActionsBlock';
import { DealNotesTab } from './DealNotesTab';
import { 
  Phone, Mail, Edit2, Check, X, DollarSign, 
  User, MapPin, Package, History, StickyNote 
} from 'lucide-react';
import { toast } from 'sonner';

interface DealDetailsDrawerProps {
  dealId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DealDetailsDrawer = ({ dealId, open, onOpenChange }: DealDetailsDrawerProps) => {
  const { data: deal, isLoading: dealLoading, refetch: refetchDeal } = useCRMDeal(dealId || '');
  const { data: contact, isLoading: contactLoading } = useCRMContact(deal?.contact_id || '');
  const updateContact = useUpdateCRMContact();
  
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneValue, setPhoneValue] = useState('');
  
  const isLoading = dealLoading || contactLoading;
  
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
  
  // Extrair informações do deal
  const customFields = deal?.custom_fields as Record<string, any> | null;
  const originName = deal?.crm_origins?.name || customFields?.origem || 'Não informada';
  const productName = deal?.product_name || customFields?.produto || customFields?.product_name || 'A010';
  
  if (!dealId) return null;
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-card border-border w-full sm:max-w-lg overflow-y-auto p-0">
        {isLoading ? (
          <div className="space-y-6 p-6">
            <div className="flex items-start gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : deal ? (
          <div className="flex flex-col h-full">
            {/* ===== CABEÇALHO ===== */}
            <div className="bg-secondary/50 border-b border-border p-4 space-y-4">
              <div className="flex items-start gap-4">
                <Avatar className="h-14 w-14 border-2 border-primary/30">
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                    {getInitials(deal.name)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-foreground truncate">
                    {deal.name}
                  </h2>
                  
                  {/* Badge do estágio */}
                  {deal.crm_stages?.stage_name && (
                    <Badge 
                      className="mt-1 bg-primary/20 text-primary border-0 font-medium"
                      style={{ 
                        backgroundColor: deal.crm_stages.color ? `${deal.crm_stages.color}20` : undefined,
                        color: deal.crm_stages.color || undefined
                      }}
                    >
                      {deal.crm_stages.stage_name}
                    </Badge>
                  )}
                  
                  {/* Responsável */}
                  {deal.owner_id && (
                    <div className="flex items-center gap-1.5 mt-2 text-sm text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                      <span className="truncate">{deal.owner_id}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Origem e Produto */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-xs">
                  <MapPin className="h-3 w-3 mr-1" />
                  {originName}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <Package className="h-3 w-3 mr-1" />
                  {productName}
                </Badge>
              </div>
            </div>
            
            {/* ===== CONTEÚDO PRINCIPAL ===== */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              
              {/* BLOCO: Informações do Negócio */}
              <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-2">
                <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm">
                  💼 Informações do Negócio
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Valor:</span>
                    <p className="font-bold text-primary">
                      R$ {(deal.value || 0).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  {deal.probability && (
                    <div>
                      <span className="text-muted-foreground">Probabilidade:</span>
                      <p className="font-medium text-foreground">{deal.probability}%</p>
                    </div>
                  )}
                  {deal.expected_close_date && (
                    <div>
                      <span className="text-muted-foreground">Previsão:</span>
                      <p className="font-medium text-foreground">
                        {new Date(deal.expected_close_date).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* BLOCO: Contato */}
              {contact && (
                <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
                  <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm">
                    👤 Contato
                  </h3>
                  <div className="space-y-2 text-sm">
                    <p className="font-medium text-foreground">{contact.name}</p>
                    
                    {contact.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        <a 
                          href={`mailto:${contact.email}`} 
                          className="hover:text-primary transition-colors"
                        >
                          {contact.email}
                        </a>
                      </div>
                    )}
                    
                    {/* Telefone editável */}
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {editingPhone ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            value={phoneValue}
                            onChange={(e) => setPhoneValue(e.target.value)}
                            placeholder="+5511999990001"
                            className="h-8 text-sm bg-background"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-primary hover:text-primary/80"
                            onClick={handleSavePhone}
                            disabled={updateContact.isPending}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive/80"
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
              
              {/* BLOCO: Próxima Ação */}
              <NextActionBlock
                dealId={dealId}
                currentType={deal.next_action_type}
                currentDate={deal.next_action_date}
                currentNote={deal.next_action_note}
                onSaved={() => refetchDeal()}
              />
              
              {/* BLOCO: Jornada A010 */}
              <A010JourneyBlock 
                email={contact?.email} 
                phone={contact?.phone}
              />
              
              {/* BLOCO: Ações Rápidas */}
              <QuickActionsBlock 
                deal={deal} 
                contact={contact}
                onStageChange={() => refetchDeal()}
              />
              
              {/* ===== ÁREA DE ABAS ===== */}
              <Tabs defaultValue="atividades" className="mt-4">
                <TabsList className="w-full grid grid-cols-3 bg-secondary">
                  <TabsTrigger value="atividades" className="text-xs">
                    <History className="h-3.5 w-3.5 mr-1" />
                    Atividades
                  </TabsTrigger>
                  <TabsTrigger value="ligacoes" className="text-xs">
                    <Phone className="h-3.5 w-3.5 mr-1" />
                    Ligações
                  </TabsTrigger>
                  <TabsTrigger value="notas" className="text-xs">
                    <StickyNote className="h-3.5 w-3.5 mr-1" />
                    Notas
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="atividades" className="mt-3">
                  <DealHistory dealId={dealId} />
                </TabsContent>
                
                <TabsContent value="ligacoes" className="mt-3">
                  <CallHistorySection dealId={dealId} />
                </TabsContent>
                
                <TabsContent value="notas" className="mt-3">
                  <DealNotesTab dealId={dealId} />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>Negócio não encontrado</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
