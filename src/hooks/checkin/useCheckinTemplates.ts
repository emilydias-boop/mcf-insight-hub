import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Templates HSM do WhatsApp usados no inbox do MCF - Atendimento.
 * Fonte única: public.automation_templates (geridos por twilio-content-manage),
 * filtrando apenas os aprovados pela Meta, ativos e com Content SID da Twilio.
 * A tabela legada wa_templates foi aposentada.
 */
export interface CheckinTemplateVariable {
  index: number; // posição posicional na Twilio ({{1}}, {{2}}…)
  name: string; // nome no corpo do template ({{nome}}, {{link}}…)
  label: string; // rótulo mostrado ao operador
  source: 'customer_name' | 'product_name' | 'purchase_date' | 'custom';
}

export interface CheckinTemplate {
  id: string;
  name: string;
  content_sid: string;
  body_preview: string | null;
  category: string | null;
  variables: CheckinTemplateVariable[];
}

const LABELS: Record<string, string> = {
  nome: 'Nome do cliente',
  produto: 'Produto',
  data: 'Data',
  data_hora: 'Data e horário',
  closer: 'Especialista (closer)',
  link: 'Link',
  meeting_link: 'Link da reunião',
  email: 'E-mail',
};

function inferSource(name: string): CheckinTemplateVariable['source'] {
  const n = name.toLowerCase();
  if (n === 'nome' || n.includes('nome_cliente') || n === 'name') return 'customer_name';
  if (n.includes('produto') || n.includes('product')) return 'product_name';
  if (n.includes('data_compra') || n.includes('purchase')) return 'purchase_date';
  return 'custom';
}

function humanize(name: string): string {
  return LABELS[name.toLowerCase()] ?? name.replace(/_/g, ' ');
}

export function useCheckinTemplates() {
  return useQuery({
    queryKey: ['checkin_templates', 'whatsapp_approved'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<CheckinTemplate[]> => {
      const { data, error } = await supabase
        .from('automation_templates')
        .select('id, name, content, category, variables, twilio_template_sid, approval_status, is_active, channel')
        .eq('channel', 'whatsapp')
        .eq('is_active', true)
        .eq('approval_status', 'approved')
        .order('name');
      if (error) throw error;

      return (data ?? [])
        .filter((t) => !!t.twilio_template_sid)
        .map((t) => {
          const names: string[] = Array.isArray(t.variables) ? (t.variables as string[]) : [];
          return {
            id: t.id,
            name: t.name,
            content_sid: t.twilio_template_sid as string,
            body_preview: t.content ?? null,
            category: t.category ?? null,
            variables: names.map((varName, idx) => ({
              index: idx + 1,
              name: varName,
              label: humanize(varName),
              source: inferSource(varName),
            })),
          };
        });
    },
  });
}
