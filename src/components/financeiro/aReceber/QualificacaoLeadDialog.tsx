import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Sparkles } from 'lucide-react';
import { QualificationHistorySection } from '@/components/crm/qualification/QualificationHistorySection';

interface Props {
  email?: string | null;
  phone?: string | null;
  customerName?: string | null;
}

/**
 * Botão + Dialog que localiza o deal do cliente (por email ou sufixo de 9 dígitos
 * do telefone) e exibe a nota de qualificação registrada pelo SDR/IA antes da R1.
 * Usado no detalhe do Financeiro → A Receber para apoiar o time de cobrança.
 */
export function QualificacaoLeadDialog({ email, phone, customerName }: Props) {
  const [open, setOpen] = useState(false);

  const { data: dealId, isLoading } = useQuery({
    queryKey: ['ar-qualif-deal', email, phone],
    enabled: open && !!(email || phone),
    queryFn: async (): Promise<string | null> => {
      // 1) tenta por email (case-insensitive) no crm_contacts
      if (email) {
        const { data: contacts } = await supabase
          .from('crm_contacts')
          .select('id')
          .ilike('email', email.trim())
          .limit(5);
        const contactIds = (contacts || []).map((c: any) => c.id);
        if (contactIds.length > 0) {
          const { data: deals } = await supabase
            .from('crm_deals')
            .select('id, updated_at')
            .in('contact_id', contactIds)
            .order('updated_at', { ascending: false })
            .limit(1);
          if (deals && deals[0]) return deals[0].id;
        }
      }
      // 2) fallback: sufixo de 9 dígitos do telefone
      if (phone) {
        const digits = phone.replace(/\D/g, '');
        const suffix = digits.slice(-9);
        if (suffix.length === 9) {
          const { data: contacts } = await supabase
            .from('crm_contacts')
            .select('id, phone')
            .ilike('phone', `%${suffix}`)
            .limit(10);
          const contactIds = (contacts || []).map((c: any) => c.id);
          if (contactIds.length > 0) {
            const { data: deals } = await supabase
              .from('crm_deals')
              .select('id, updated_at')
              .in('contact_id', contactIds)
              .order('updated_at', { ascending: false })
              .limit(1);
            if (deals && deals[0]) return deals[0].id;
          }
        }
      }
      return null;
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Sparkles className="w-4 h-4 mr-1 text-purple-600" />
          Qualificação do Lead
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Qualificação pré-R1 {customerName ? `— ${customerName}` : ''}
          </DialogTitle>
        </DialogHeader>
        {isLoading && (
          <p className="text-sm text-muted-foreground">Buscando registros…</p>
        )}
        {!isLoading && !dealId && (
          <p className="text-sm text-muted-foreground">
            Nenhum negócio localizado para esse cliente no CRM (busca por e-mail e telefone).
          </p>
        )}
        {dealId && (
          <>
            <QualificationHistorySection dealId={dealId} />
            <EmptyQualifNotice dealId={dealId} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EmptyQualifNotice({ dealId }: { dealId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['ar-qualif-count', dealId],
    queryFn: async () => {
      const { count } = await supabase
        .from('deal_activities')
        .select('id', { count: 'exact', head: true })
        .eq('deal_id', dealId)
        .in('activity_type', ['qualification_note', 'ai_call_summary']);
      return count ?? 0;
    },
  });
  if (isLoading || (data ?? 0) > 0) return null;
  return (
    <p className="text-sm text-muted-foreground">
      Negócio localizado, mas ainda sem nota de qualificação registrada pelo SDR/IA.
    </p>
  );
}