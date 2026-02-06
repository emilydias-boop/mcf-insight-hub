import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GRWalletEntry, GREntryStatus, GR_STATUS_LABELS, GR_ACTION_LABELS } from '@/types/gr-types';
import { useUpdateGREntry } from '@/hooks/useGRWallet';
import { useGREntryTimeline, useGREntryActions } from '@/hooks/useGRActions';
import { GRActionModal } from './GRActionModal';
import { Phone, MessageCircle, Calendar, User, Mail, Clock, ArrowRight } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface GREntryDrawerProps {
  entry: GRWalletEntry | null;
  open: boolean;
  onClose: () => void;
}

export const GREntryDrawer = ({ entry, open, onClose }: GREntryDrawerProps) => {
  const [showActionModal, setShowActionModal] = useState(false);
  
  const updateEntry = useUpdateGREntry();
  const { data: timeline = [] } = useGREntryTimeline(entry?.id, entry?.customer_email || undefined);
  const { data: actions = [] } = useGREntryActions(entry?.id);
  
  if (!entry) return null;
  
  const statusConfig = GR_STATUS_LABELS[entry.status];
  
  const handleStatusChange = (newStatus: GREntryStatus) => {
    updateEntry.mutate({ id: entry.id, status: newStatus });
  };
  
  const handleWhatsApp = () => {
    if (entry.customer_phone) {
      const phone = entry.customer_phone.replace(/\D/g, '');
      window.open(`https://wa.me/55${phone}`, '_blank');
    }
  };
  
  const handleCall = () => {
    if (entry.customer_phone) {
      window.open(`tel:${entry.customer_phone}`, '_blank');
    }
  };
  
  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <SheetTitle className="text-left">{entry.customer_name}</SheetTitle>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {entry.customer_email && (
                      <>
                        <Mail className="h-3 w-3" />
                        <span>{entry.customer_email}</span>
                      </>
                    )}
                    {entry.customer_phone && (
                      <>
                        <span className="mx-1">•</span>
                        <Phone className="h-3 w-3" />
                        <span>{entry.customer_phone}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Status Select */}
            <div className="flex items-center gap-2 mt-4">
              <span className="text-sm text-muted-foreground">Status:</span>
              <Select value={entry.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(GR_STATUS_LABELS).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </SheetHeader>
          
          <Tabs defaultValue="timeline" className="mt-6">
            <TabsList className="w-full">
              <TabsTrigger value="timeline" className="flex-1">Timeline</TabsTrigger>
              <TabsTrigger value="dados" className="flex-1">Dados</TabsTrigger>
              <TabsTrigger value="acoes" className="flex-1">Ações</TabsTrigger>
            </TabsList>
            
            {/* Timeline */}
            <TabsContent value="timeline" className="mt-4 space-y-4">
              {timeline.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum histórico encontrado
                </p>
              ) : (
                <div className="space-y-4">
                  {timeline.map((item, index) => (
                    <div key={index} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        {index < timeline.length - 1 && (
                          <div className="w-0.5 flex-1 bg-border mt-1" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {item.type === 'gr_action' && GR_ACTION_LABELS[item.title as keyof typeof GR_ACTION_LABELS]?.label || item.title}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(item.date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {item.description}
                          </p>
                        )}
                        {item.performer && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Por: {item.performer}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            
            {/* Dados */}
            <TabsContent value="dados" className="mt-4 space-y-4">
              <div className="grid gap-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data de Entrada</span>
                  <span>{format(new Date(entry.entry_date), "dd/MM/yyyy", { locale: ptBR })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Origem</span>
                  <span>{entry.entry_source}</span>
                </div>
                {entry.product_purchased && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Produto</span>
                    <span>{entry.product_purchased}</span>
                  </div>
                )}
                {entry.purchase_value && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor</span>
                    <span>R$ {entry.purchase_value.toLocaleString('pt-BR')}</span>
                  </div>
                )}
                {entry.last_contact_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Último Contato</span>
                    <span>{formatDistanceToNow(new Date(entry.last_contact_at), { addSuffix: true, locale: ptBR })}</span>
                  </div>
                )}
                {entry.recommended_products.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Produtos Sugeridos</span>
                    <div className="flex gap-1 mt-1">
                      {entry.recommended_products.map(p => (
                        <Badge key={p} variant="outline">{p}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
            
            {/* Ações */}
            <TabsContent value="acoes" className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={handleCall} disabled={!entry.customer_phone}>
                  <Phone className="h-4 w-4 mr-2" />
                  Ligar
                </Button>
                <Button variant="outline" onClick={handleWhatsApp} disabled={!entry.customer_phone}>
                  <MessageCircle className="h-4 w-4 mr-2" />
                  WhatsApp
                </Button>
                <Button variant="outline" onClick={() => setShowActionModal(true)}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Agendar
                </Button>
                <Button variant="outline" onClick={() => setShowActionModal(true)}>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Registrar
                </Button>
              </div>
              
              <Button className="w-full" onClick={() => setShowActionModal(true)}>
                + Nova Ação
              </Button>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
      
      <GRActionModal
        entryId={entry.id}
        open={showActionModal}
        onClose={() => setShowActionModal(false)}
      />
    </>
  );
};
