import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { WaConversation } from '@/hooks/wa/useWaConversations';
import { formatPhone } from './waLabels';

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
  const { data: assignedName } = useAssignedName(conversation.assigned_to);

  return (
    <Card className="w-72 p-4 shrink-0 flex flex-col gap-4 overflow-y-auto">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="font-semibold truncate">
            {conversation.contact_name?.trim() || 'Contato sem nome'}
          </div>
          <div className="text-xs text-muted-foreground">Contato WhatsApp</div>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <InfoRow label="Telefone" value={formatPhone(conversation.phone_e164)} />
        <InfoRow label="Responsável" value={assignedName ?? (conversation.assigned_to ? '—' : 'Não atribuído')} />
        <InfoRow label="Motivo da atribuição" value={conversation.assigned_reason} />
      </div>

      {conversation.deal_id ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/crm/negocios?deal=${conversation.deal_id}`)}
        >
          <ExternalLink className="h-3.5 w-3.5 mr-2" />
          Abrir no CRM
        </Button>
      ) : (
        <div className="text-xs text-muted-foreground border rounded-md p-2">
          Este número não casou com nenhum negócio.
        </div>
      )}
    </Card>
  );
}