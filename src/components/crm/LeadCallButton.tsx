import { Phone, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SonaxCallButton } from './SonaxCallButton';
import { useDialerEngine } from '@/hooks/useDialerEngine';
import { useTwilio } from '@/contexts/TwilioContext';
import { normalizePhoneNumber } from '@/lib/phoneUtils';
import { cn } from '@/lib/utils';

interface LeadCallButtonProps {
  phone?: string | null;
  dealId?: string;
  contactId?: string;
  originId?: string;
  size?: 'icon' | 'sm';
  className?: string;
}

/**
 * Botão "Ligar" que resolve o motor de discagem do usuário logado:
 * - engine 'sonax' (SDRs já migrados) → comportamento atual, inalterado;
 * - engine 'twilio' (default, inclui closers sem sdr_ramal_mapping) → softphone Twilio.
 */
export function LeadCallButton({ phone, dealId, contactId, originId, size = 'icon', className }: LeadCallButtonProps) {
  const { data: dialer } = useDialerEngine();
  const { makeCall, deviceStatus, initializeDevice } = useTwilio();
  const [isDialing, setIsDialing] = useState(false);

  if (!phone) return null;

  // Enquanto o motor não resolve, mantém o comportamento legado (Sonax).
  if (!dialer || dialer.engine === 'sonax') {
    return <SonaxCallButton phone={phone} dealId={dealId} size={size} className={className} />;
  }

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDialing) return;
    setIsDialing(true);
    try {
      if (deviceStatus !== 'ready') {
        toast.info('Inicializando Twilio...');
        const ok = await initializeDevice();
        if (!ok) {
          toast.error('Erro ao inicializar Twilio');
          return;
        }
      }
      await makeCall(normalizePhoneNumber(phone), dealId, contactId, originId);
    } finally {
      setIsDialing(false);
    }
  };

  const icon = isDialing
    ? <Loader2 className="h-4 w-4 animate-spin" />
    : <Phone className="h-4 w-4" />;

  if (size === 'sm') {
    return (
      <Button size="sm" variant="outline" onClick={handleClick} disabled={isDialing} className={className}>
        {icon}
        <span className="ml-1.5">Ligar</span>
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleClick}
          disabled={isDialing}
          className={cn('h-7 w-7 text-primary hover:text-primary', className)}
          aria-label="Ligar para o lead"
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Ligar (Twilio)</TooltipContent>
    </Tooltip>
  );
}