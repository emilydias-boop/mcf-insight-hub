import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CalendarPlus, ClipboardCheck, ExternalLink, StickyNote, User } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { WaConversation } from '@/hooks/wa/useWaConversations';
import { formatPhone } from './waLabels';
import { useCRMDeal } from '@/hooks/useCRMData';
import { LeadTemperatureSelector, type LeadTemperature } from '@/components/crm/LeadTemperatureSelector';
import { LeadTagsManager } from '@/components/crm/LeadTagsManager';
import { LeadProfileSection } from '@/components/crm/LeadProfileSection';
import { CallHistorySection } from '@/components/crm/CallHistorySection';
import { useQualificationNote } from '@/hooks/useQualificationNote';
import { AddNoteDialog } from './AddNoteDialog';
import { QualifyLeadDialog } from './QualifyLeadDialog';
import { QuickScheduleModal } from '@/components/crm/QuickScheduleModal';
import { PedidoSaidaAviso } from './PedidoSaidaAviso';


function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm break-words">{value ?? '—'}</div>
    </div>
  );
}

function useAssignedName(assignedTo: string | null) {
  return useQuery({
    queryKey: ['wa-assigned-profile', assignedTo],
    queryFn: async () => {
      if (!assignedTo) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', assignedTo)
        .maybeSingle();
      if (error) throw error;
      return data?.full_name ?? data?.email ?? null;
    },
    enabled: !!assignedTo,
    staleTime: 5 * 60 * 1000,
  });
}

export function ContactPanel({ conversation }: { conversation: WaConversation }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: assignedName } = useAssignedName(conversation.assigned_to);
  const dealId = conversation.deal_id ?? null;
  const { data: deal } = useCRMDeal(dealId || '');
  const { data: qualNote } = useQualificationNote(dealId || '');
  const [noteOpen, setNoteOpen] = useState(false);
  const [qualifyOpen, setQualifyOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const customFields = (deal?.custom_fields as Record<string, any> | null) || null;
  const refreshDeal = () => {
    queryClient.invalidateQueries({ queryKey: ['crm-deal', dealId] });
  };

  return (
    // h-full + min-h-0 limitam a altura ao contêiner do inbox; a rolagem fica
    // dentro do painel, sem fazer a página inteira rolar.
    <Card className="w-80 xl:w-96 h-full min-h-0 shrink-0 flex flex-col gap-4 overflow-y-auto overscroll-contain p-4">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="font-semibold truncate">
            {deal?.crm_contacts?.name?.trim() || conversation.contact_name?.trim() || 'Contato sem nome'}
          </div>
          <div className="text-xs text-muted-foreground">Contato WhatsApp</div>
        </div>
      </div>

      <PedidoSaidaAviso conversation={conversation} />

      <div className="space-y-2 text-sm">

        <InfoRow label="Telefone" value={formatPhone(conversation.phone_e164)} />
        <InfoRow label="Responsável" value={assignedName ?? (conversation.assigned_to ? '—' : 'Não atribuído')} />
        <InfoRow label="Motivo da atribuição" value={conversation.assigned_reason} />
      </div>

      {dealId ? (
        <>
          {deal && (
            <div className="space-y-2 text-sm border-t pt-3">
              <div>
                <div className="text-xs text-muted-foreground">Estágio</div>
                {deal.crm_stages?.stage_name ? (
                  <Badge
                    variant="outline"
                    className="mt-0.5 text-xs"
                    style={
                      deal.crm_stages?.color
                        ? {
                            borderColor: deal.crm_stages.color,
                            color: deal.crm_stages.color,
                            backgroundColor: `${deal.crm_stages.color}1a`,
                          }
                        : undefined
                    }
                  >
                    {deal.crm_stages.stage_name}
                  </Badge>
                ) : (
                  <div className="text-sm">—</div>
                )}
              </div>
              <InfoRow
                label="Origem"
                value={deal.crm_origins?.name ?? (customFields?.origem as string | undefined) ?? null}
              />
              <InfoRow
                label="Entrada"
                value={
                  deal.created_at
                    ? format(new Date(deal.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                    : null
                }
              />
              <div>
                <div className="text-xs text-muted-foreground mb-1">Temperatura</div>
                <LeadTemperatureSelector
                  dealId={deal.id}
                  value={(deal.lead_temperature as LeadTemperature) ?? null}
                  size="sm"
                  showLabel={false}
                  onChanged={refreshDeal}
                />
              </div>
              <div className="min-w-0 [&_*]:max-w-full">
                <div className="text-xs text-muted-foreground mb-1">Tags</div>
                <LeadTagsManager
                  dealId={deal.id}
                  originId={deal.origin_id}
                  tags={deal.tags as any[] | null}
                  customFields={customFields}
                  onChanged={refreshDeal}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 border-t pt-3">
            <Button variant="outline" size="sm" onClick={() => setNoteOpen(true)}>
              <StickyNote className="h-3.5 w-3.5 mr-1.5" />
              Nota
            </Button>
            <Button variant="outline" size="sm" onClick={() => setQualifyOpen(true)}>
              <ClipboardCheck className="h-3.5 w-3.5 mr-1.5" />
              Qualificar
            </Button>
            <Button variant="outline" size="sm" onClick={() => setScheduleOpen(true)}>
              <CalendarPlus className="h-3.5 w-3.5 mr-1.5" />
              Agendar R1
            </Button>
          </div>
          {qualNote && (
            <div className="text-[11px] text-emerald-600">
              Lead já qualificado
              {qualNote.created_at
                ? ` em ${format(new Date(qualNote.created_at), 'dd/MM/yyyy', { locale: ptBR })}`
                : ''}
            </div>
          )}

          <div className="border-t pt-3 text-xs [&_*]:min-w-0 overflow-x-hidden">
            <CallHistorySection contactId={deal?.contact_id} dealId={dealId} />
          </div>

          <div className="border-t pt-3 text-xs overflow-x-hidden">
            <LeadProfileSection contactId={deal?.contact_id} dealId={dealId} />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/crm/negocios?deal=${dealId}`)}
          >
            <ExternalLink className="h-3.5 w-3.5 mr-2" />
            Abrir no CRM
          </Button>

          <AddNoteDialog dealId={dealId} open={noteOpen} onOpenChange={setNoteOpen} />
          <QualifyLeadDialog
            dealId={dealId}
            conversationId={conversation.id}
            open={qualifyOpen}
            onOpenChange={setQualifyOpen}
          />
          <QuickScheduleModal
            open={scheduleOpen}
            onOpenChange={setScheduleOpen}
            prefilledDealId={dealId}
            prefilledNotes={`Agendamento de R1 a partir da conversa de WhatsApp com ${
              deal?.crm_contacts?.name?.trim() || conversation.contact_name?.trim() || formatPhone(conversation.phone_e164)
            }.`}
          />
        </>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 border-t pt-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button variant="outline" size="sm" disabled className="w-full">
                      <StickyNote className="h-3.5 w-3.5 mr-1.5" />
                      Nota
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Sem negócio vinculado a este número</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button variant="outline" size="sm" disabled className="w-full">
                      <ClipboardCheck className="h-3.5 w-3.5 mr-1.5" />
                      Qualificar
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Sem negócio vinculado a este número</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button variant="outline" size="sm" disabled className="w-full">
                      <CalendarPlus className="h-3.5 w-3.5 mr-1.5" />
                      Agendar R1
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Sem negócio vinculado a este número</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        <div className="text-xs text-muted-foreground border rounded-md p-2">
            Este número não está vinculado a nenhum negócio.
          </div>
        </>
      )}
    </Card>
  );
}