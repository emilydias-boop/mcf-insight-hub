import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Phone } from 'lucide-react';
import { useTwilio } from '@/contexts/TwilioContext';
import { QuickDialer } from './QuickDialer';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Botão flutuante global para abrir o discador rápido.
 * Atalho: Ctrl/Cmd + Shift + D
 */
export function QuickDialerLauncher() {
  const { deviceStatus } = useTwilio();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Mesma regra do TwilioSoftphone: só renderiza se device estiver disponível
  if (deviceStatus === 'disconnected') return null;

  return (
    <>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              className="fixed bottom-4 left-4 z-[100] h-12 w-12 rounded-full shadow-lg bg-primary hover:bg-primary/90"
              onClick={() => setOpen(true)}
              aria-label="Abrir discador rápido"
            >
              <Phone className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            Discador rápido <kbd className="ml-2 text-[10px] opacity-70">Ctrl+Shift+D</kbd>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <QuickDialer open={open} onOpenChange={setOpen} />
    </>
  );
}
