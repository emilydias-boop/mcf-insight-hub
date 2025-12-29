import { useState } from 'react';
import { Copy, Check, MessageSquare, ExternalLink, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { withCalendlyDateTimeParams, withCalendlyDateOnly } from '@/lib/calendlyLink';

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
  
  const shortDate = scheduledDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });

  // Add date/time params to Calendly link using São Paulo timezone
  const enhancedMeetingLink = withCalendlyDateTimeParams(meetingLink, scheduledAt);
  // Fallback link without time (only date)
  const fallbackLink = withCalendlyDateOnly(meetingLink, scheduledAt);

  const message = `Olá${contactName ? ` ${contactName.split(' ')[0]}` : ''}! 🙂

Sua reunião foi confirmada para:
📅 ${formattedDate}
🕐 ${formattedTime}

Acesse pelo link abaixo:
${enhancedMeetingLink}

Se o horário não aparecer disponível, use este link alternativo:
${fallbackLink}

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
      // Open WhatsApp Web with the message (user will select contact)
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
      return;
    }

    // Clean phone number
    const cleanPhone = contactPhone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    setSendingWhatsapp(true);
    try {
      // Try Z-API first
      const { data, error } = await supabase.functions.invoke('zapi-send-message', {
        body: {
          phone: formattedPhone,
          message,
        },
      });

      if (error || !data?.success) {
        // Fallback to WhatsApp Web
        const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
        toast.info('Abrindo WhatsApp Web...');
      } else {
        toast.success('Mensagem enviada via WhatsApp!');
      }
    } catch {
      // Fallback to WhatsApp Web
      const whatsappUrl = `https://wa.me/${contactPhone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
    } finally {
      setSendingWhatsapp(false);
    }
  };

  const handleOpenLink = () => {
    if (enhancedMeetingLink) {
      window.open(enhancedMeetingLink, '_blank');
    }
  };
  
  const handleOpenFallbackLink = () => {
    if (fallbackLink) {
      window.open(fallbackLink, '_blank');
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

      {enhancedMeetingLink && (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopy}
              className="flex-1 min-w-[100px]"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  Copiar
                </>
              )}
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

            <Button
              size="sm"
              variant="ghost"
              onClick={handleOpenLink}
              className="px-2"
              title="Abrir link com horário"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="pt-1 border-t border-green-200 dark:border-green-800">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleOpenFallbackLink}
              className="w-full text-xs text-muted-foreground hover:text-foreground"
            >
              <Calendar className="h-3 w-3 mr-1.5" />
              Abrir sem horário (se não aparecer disponível)
            </Button>
          </div>
        </>
      )}

      {!enhancedMeetingLink && (
        <p className="text-xs text-muted-foreground">
          Link será disponibilizado após confirmação do Calendly
        </p>
      )}
    </div>
  );
}
