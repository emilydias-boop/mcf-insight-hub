import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useClintContact, useClintDeals } from '@/hooks/useClintAPI';
import { Mail, Phone, MapPin, Layers, Calendar, Briefcase, Edit } from 'lucide-react';

interface ContactDetailsDrawerProps {
  contactId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ContactDetailsDrawer = ({ contactId, open, onOpenChange }: ContactDetailsDrawerProps) => {
  const { data: contact, isLoading } = useClintContact(contactId || '');
  const { data: deals } = useClintDeals();
  
  const contactData = contact?.data;
  const relatedDeals = deals?.data?.filter((deal: any) => deal.contact_id === contactId) || [];
  
  if (!contactId) return null;
  
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };
  
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
        ) : contactData ? (
          <>
            <SheetHeader className="pb-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">
                    {getInitials(contactData.name)}
                  </span>
                </div>
                <div>
                  <SheetTitle className="text-2xl text-foreground">{contactData.name}</SheetTitle>
                  {contactData.email && (
                    <p className="text-sm text-muted-foreground mt-1">{contactData.email}</p>
                  )}
                  {contactData.phone && (
                    <p className="text-sm text-muted-foreground">{contactData.phone}</p>
                  )}
                </div>
              </div>
            </SheetHeader>
            
            <div className="space-y-6">
              {/* Informações Gerais */}
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  📋 Informações Gerais
                </h3>
                <div className="space-y-2 pl-2">
                  {contactData.organization_id && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>Organização: {contactData.organization_id}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Cadastro: {new Date(contactData.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Atualização: {new Date(contactData.updated_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              </div>
              
              {/* Tags */}
              {contactData.tags && contactData.tags.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    🏷️ Tags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {contactData.tags.map((tag: any, idx: number) => (
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
              
              {/* Negócios Relacionados */}
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  💼 Negócios Relacionados
                  <Badge variant="secondary" className="ml-auto">
                    {relatedDeals.length}
                  </Badge>
                </h3>
                {relatedDeals.length > 0 ? (
                  <div className="space-y-2">
                    {relatedDeals.map((deal: any) => (
                      <div
                        key={deal.id}
                        className="p-3 rounded-lg border border-border bg-background/50"
                      >
                        <div className="flex items-start justify-between mb-1">
                          <h4 className="font-medium text-foreground">{deal.name}</h4>
                          <Badge className="bg-primary/10 text-primary border-0">
                            {deal.stage}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="font-semibold text-success">
                            R$ {(deal.value || 0).toLocaleString('pt-BR')}
                          </span>
                          {deal.probability && (
                            <span>{deal.probability}% prob.</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhum negócio vinculado</p>
                  </div>
                )}
              </div>
              
              {/* Campos Customizados */}
              {contactData.custom_fields && Object.keys(contactData.custom_fields).length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    ⚙️ Campos Customizados
                  </h3>
                  <div className="space-y-2 pl-2">
                    {Object.entries(contactData.custom_fields).map(([key, value]) => (
                      <div key={key} className="text-sm">
                        <span className="font-medium text-foreground">{key}: </span>
                        <span className="text-muted-foreground">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1 border-border"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Editar Contato
                </Button>
                <Button
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Briefcase className="h-4 w-4 mr-2" />
                  Criar Negócio
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>Contato não encontrado</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
