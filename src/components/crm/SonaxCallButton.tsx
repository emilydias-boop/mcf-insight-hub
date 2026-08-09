import { Phone, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSonaxClickToCall } from '@/hooks/useSonaxClickToCall';
import { cn } from '@/lib/utils';

interface SonaxCallButtonProps {
  phone?: string | null;
  dealId?: string;
  size?: 'icon' | 'sm';
  className?: string;
}

/**
 * Botão "Ligar" (click-to-call Sonax). Só aparece quando há telefone.
 */
export function SonaxCallButton({ phone, dealId, size = 'icon', className }: SonaxCallButtonProps) {
  const { mutate, isPending } = useSonaxClickToCall();

  if (!phone) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    mutate({ numero: phone, dealId });
  };

  const icon = isPending
    ? <Loader2 className="h-4 w-4 animate-spin" />
    : <Phone className="h-4 w-4" />;

  if (size === 'sm') {
    return (
      <Button size="sm" variant="outline" onClick={handleClick} disabled={isPending} className={className}>
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
          disabled={isPending}
          className={cn('h-7 w-7 text-primary hover:text-primary', className)}
          aria-label="Ligar para o lead"
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Ligar (Sonax)</TooltipContent>
    </Tooltip>
  );
}
