import { useState } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useContactDeals } from '@/hooks/useContactDeals';
import { useA010Journey } from '@/hooks/useA010Journey';
import { ContactNotesSection } from './ContactNotesSection';
import { ContactTransactionsSection } from './ContactTransactionsSection';
import { CrossPipelineHistory } from './CrossPipelineHistory';
import { LeadFullTimeline } from './LeadFullTimeline';
import { CallHistorySection } from './CallHistorySection';
import { DealNotesTab } from './DealNotesTab';
import { LeadJourneyCard } from './LeadJourneyCard';
import { A010JourneyCollapsible } from './A010JourneyCollapsible';
import {
  Mail, Phone, MapPin, Calendar, Briefcase, Copy,
  MessageCircle, History, StickyNote, PhoneCall, ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface ContactDetailsDrawerProps {
  contactId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ContactDetailsDrawer = ({ contactId, open, onOpenChange }: ContactDetailsDrawerProps) => {
  const { data: contactData, isLoading } = useQuery({
    queryKey: ['crm-contact-detail', contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_contacts')
        .select('*')
        .eq('id', contactId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!contactId && open,
  });

  // Get ALL deals for this contact (no exclusion)
  const { data: allDeals } = useContactDeals(contactId || undefined, undefined);

  // A010 journey
  const { data: a010Journey } = useA010Journey(contactData?.email, contactData?.phone);

  // Primary deal = most recent
  const primaryDeal = allDeals && allDeals.length > 0 ? allDeals[0] : null;

  if (!contactId) return null;

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  const getValidTags = (tags: any[]): { name: string; color: string | null }[] => {
    if (!tags || !Array.isArray(tags)) return [];
    return tags
      .map((tag: any) => {
        if (typeof tag === 'string') {
          const trimmed = tag.trim();
          if (trimmed.startsWith('{')) {
            try {
              const parsed = JSON.parse(trimmed);
              if (parsed?.name?.trim()) return { name: parsed.name.trim(), color: parsed.color || null };
            } catch { if (trimmed) return { name: trimmed, color: null }; }
          } else if (trimmed) return { name: trimmed, color: null };
          return null;
        }
        if (tag?.name?.trim()) return { name: tag.name.trim(), color: tag.color || null };
        return null;
      })
      .filter(Boolean) as { name: string; color: string | null }[];
  };

  const validTags = getValidTags(contactData?.tags || []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado!');
  };

  const openWhatsApp = (phone: string) => {
    const clean = phone.replace(/\D/g, '');
    const num = clean.startsWith('55') ? clean : `55${clean}`;
    window.open(`https://wa.me/${num}`, '_blank');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-card border-border w-full sm:max-w-xl overflow-y-auto p-0">
        {isLoading ? (
          <div className="space-y-4 p-6">
            <Skeleton className="h-16 w-16 rounded-full mx-auto" />
            <Skeleton className="h-6 w-48 mx-auto" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : contactData ? (
          <div className="flex flex-col h-full">
            {/* ===== HEADER COMPACTO ===== */}
            <div className="p-4 pb-3 border-b border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg font-bold text-primary">
                    {getInitials(contactData.name)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold text-foreground truncate">{contactData.name}</h2>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {contactData.email && (
                      <span className="truncate">{contactData.email}</span>
                    )}
                  </div>
                  {contactData.phone && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Phone className="h-3 w-3" />
                      <span>{contactData.phone}</span>
                    </div>
                  )}
                </div>
              </div>
              {/* Quick actions */}
              <div className="flex gap-1.5 mt-3">
                {contactData.phone && (
                  <>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openWhatsApp(contactData.phone)}>
                      <MessageCircle className="h-3 w-3 mr-1" /> WhatsApp
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => copyToClipboard(contactData.phone)}>
                      <Copy className="h-3 w-3 mr-1" /> Copiar Tel
                    </Button>
                  </>
                )}
                {contactData.email && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => copyToClipboard(contactData.email)}>
                    <Mail className="h-3 w-3 mr-1" /> Copiar Email
                  </Button>
                )}
              </div>
              {/* Tags inline */}
              {validTags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {validTags.map((tag, idx) => (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0"
                      style={tag.color ? {
                        backgroundColor: `${tag.color}20`,
                        color: tag.color,
                        borderColor: tag.color
                      } : undefined}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* ===== BODY ===== */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Info geral */}
              <div className="text-xs text-muted-foreground space-y-1">
                {contactData.organization_name && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3 w-3" />
                    <span>{contactData.organization_name}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  <span>Cadastro: {format(new Date(contactData.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                </div>
              </div>

              {/* ===== NEGÓCIOS RELACIONADOS ===== */}
              {allDeals && allDeals.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-primary" />
                    Negócios ({allDeals.length})
                  </h3>
                  <div className="space-y-1.5">
                    {allDeals.map((deal: any) => {
                      const originName = (deal.crm_origins as any)?.name || 'Sem pipeline';
                      const stageName = (deal.crm_stages as any)?.stage_name || '—';
                      const stageColor = (deal.crm_stages as any)?.color;
                      return (
                        <div key={deal.id} className="p-2.5 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1 min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground truncate">{deal.name}</p>
                              <div className="flex flex-wrap gap-1">
                                <Badge variant="outline" className="text-[10px] px-1 py-0 bg-primary/10 text-primary border-primary/30">
                                  {originName}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1 py-0"
                                  style={{
                                    backgroundColor: stageColor ? `${stageColor}20` : undefined,
                                    color: stageColor || undefined,
                                    borderColor: stageColor ? `${stageColor}50` : undefined,
                                  }}
                                >
                                  {stageName}
                                </Badge>
                              </div>
                              {deal.owner_id && (
                                <p className="text-[10px] text-muted-foreground">👤 {deal.owner_id}</p>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {deal.created_at ? format(new Date(deal.created_at), "dd/MM/yyyy", { locale: ptBR }) : '—'}
                            </span>
                          </div>
                          {deal.value > 0 && (
                            <p className="text-xs font-semibold text-green-600 mt-1">
                              R$ {deal.value.toLocaleString('pt-BR')}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ===== COMPRAS / TRANSAÇÕES ===== */}
              <ContactTransactionsSection email={contactData.email} />

              {/* ===== JORNADA A010 ===== */}
              {a010Journey?.hasA010 && (
                <A010JourneyCollapsible email={contactData.email} phone={contactData.phone} />
              )}

              {/* ===== JORNADA DO LEAD (do deal principal) ===== */}
              {primaryDeal && (
                <LeadJourneyCard dealId={primaryDeal.id} dealCreatedAt={primaryDeal.created_at} />
              )}

              {/* ===== ABAS: Timeline / Ligações / Notas / Observações ===== */}
              <Tabs defaultValue="timeline" className="w-full">
                <TabsList className="w-full h-8">
                  <TabsTrigger value="timeline" className="text-xs gap-1">
                    <History className="h-3 w-3" /> Timeline
                  </TabsTrigger>
                  <TabsTrigger value="ligacoes" className="text-xs gap-1">
                    <PhoneCall className="h-3 w-3" /> Ligações
                  </TabsTrigger>
                  <TabsTrigger value="notas" className="text-xs gap-1">
                    <StickyNote className="h-3 w-3" /> Notas
                  </TabsTrigger>
                  <TabsTrigger value="obs" className="text-xs gap-1">
                    <Mail className="h-3 w-3" /> Obs
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="timeline" className="mt-2 border rounded-lg min-h-[200px] p-2">
                  {primaryDeal ? (
                    <LeadFullTimeline
                      dealId={primaryDeal.id}
                      dealUuid={primaryDeal.id}
                      contactEmail={contactData.email}
                      contactId={contactId}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhum deal para exibir timeline</p>
                  )}
                </TabsContent>

                <TabsContent value="ligacoes" className="mt-2">
                  <CallHistorySection contactId={contactId} dealId={primaryDeal?.id} />
                </TabsContent>

                <TabsContent value="notas" className="mt-2">
                  {primaryDeal ? (
                    <DealNotesTab dealUuid={primaryDeal.id} contactId={contactId} />
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhum deal vinculado</p>
                  )}
                </TabsContent>

                <TabsContent value="obs" className="mt-2">
                  <ContactNotesSection
                    contactId={contactData.id}
                    initialNotes={(contactData as any).notes}
                  />
                </TabsContent>
              </Tabs>

              {/* ===== CAMPOS CUSTOMIZADOS ===== */}
              {contactData.custom_fields && Object.keys(contactData.custom_fields).length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">⚙️ Campos Customizados</h3>
                  <div className="space-y-1 text-xs">
                    {Object.entries(contactData.custom_fields).map(([key, value]) => (
                      <div key={key}>
                        <span className="font-medium text-foreground">{key}: </span>
                        <span className="text-muted-foreground">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground p-6">
            <p>Contato não encontrado</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
