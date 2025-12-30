import { useState } from 'react';
import { Copy, Check, MessageSquare, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface MeetingLinkShareProps {
  meetingLink: string;
  closerName: string;
  scheduledAt: string;
  contactPhone?: string;
  contactName?: string;
}

export function MeetingLinkShare({
  meetingLink,
  closerName,
  scheduledAt,
  contactPhone,
  contactName,
}: MeetingLinkShareProps) {
  const [copied, setCopied] = useState(false);
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);

  const scheduledDate = new Date(scheduledAt);
  
  // Use São Paulo timezone for display consistency
  const formattedDate = scheduledDate.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    timeZone: 'America/Sao_Paulo',
  });
  const formattedTime = scheduledDate.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });

  const message = `Olá${contactName ? ` ${contactName.split(' ')[0]}` : ''}! 🙂

Sua reunião foi confirmada para:
📅 ${formattedDate}
🕐 ${formattedTime}

Acesse pelo link abaixo:
🔗 ${meetingLink}

Até lá! 👋`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast.success('Mensagem copiada!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const handleWhatsApp = async () => {
    if (!contactPhone) {
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
      return;
    }

    const cleanPhone = contactPhone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    setSendingWhatsapp(true);
    try {
      const { data, error } = await supabase.functions.invoke('zapi-send-message', {
        body: { phone: formattedPhone, message },
      });

      if (error || !data?.success) {
        const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
        toast.info('Abrindo WhatsApp Web...');
      } else {
        toast.success('Mensagem enviada via WhatsApp!');
      }
    } catch {
      const whatsappUrl = `https://wa.me/${contactPhone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
    } finally {
      setSendingWhatsapp(false);
    }
  };

  const handleOpenLink = () => {
    if (meetingLink) {
      window.open(meetingLink, '_blank');
    }
  };

  return (
    <div className="space-y-3 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
      <div className="flex items-center gap-2">
        <Check className="h-5 w-5 text-green-600" />
        <span className="text-sm font-medium text-green-800 dark:text-green-200">
          Reunião Agendada com {closerName}
        </span>
      </div>

      <p className="text-xs text-green-700 dark:text-green-300">
        {formattedDate} às {formattedTime}
      </p>

      {meetingLink && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={handleCopy} className="flex-1 min-w-[100px]">
            {copied ? <><Check className="h-3.5 w-3.5 mr-1.5" />Copiado!</> : <><Copy className="h-3.5 w-3.5 mr-1.5" />Copiar</>}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleWhatsApp}
            disabled={sendingWhatsapp}
            className="flex-1 min-w-[100px] text-green-700 border-green-300 hover:bg-green-100 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-900/50"
          >
            <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
            {sendingWhatsapp ? 'Enviando...' : 'WhatsApp'}
          </Button>

          <Button size="sm" variant="ghost" onClick={handleOpenLink} className="px-2" title="Abrir link">
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      )}

      {!meetingLink && (
        <p className="text-xs text-muted-foreground">
          Link será disponibilizado após criação do evento
        </p>
      )}
    </div>
  );
}
