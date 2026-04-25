import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Phone, Zap } from 'lucide-react';
import { QuickDialer } from './QuickDialer';
import { AutoDialerPanel } from '@/components/sdr/AutoDialerPanel';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAutoDialer } from '@/contexts/AutoDialerContext';
import { Badge } from '@/components/ui/badge';

/**
 * Botão flutuante global para abrir o discador rápido.
 * Atalho: Ctrl/Cmd + Shift + D
 */
export function QuickDialerLauncher() {
  const [open, setOpen] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);
  const ad = useAutoDialer();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setAutoOpen(o => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Sempre renderiza — o discador inicializa o device sob demanda quando o usuário liga
  return (
    <>
      <TooltipProvider delayDuration={200}>
        <div className="fixed bottom-4 left-4 z-[100] flex flex-col gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                className="relative h-12 w-12 rounded-full shadow-lg bg-primary hover:bg-primary/90"
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="secondary"
                className="relative h-12 w-12 rounded-full shadow-lg"
                onClick={() => setAutoOpen(true)}
                aria-label="Abrir auto-discador"
              >
                <Zap className="h-5 w-5" />
                {ad.queue.length > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] rounded-full">
                    {ad.stats.called}/{ad.stats.total}
                  </Badge>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              Auto-Discador <kbd className="ml-2 text-[10px] opacity-70">Ctrl+Shift+A</kbd>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      <QuickDialer open={open} onOpenChange={setOpen} />
      <AutoDialerPanel open={autoOpen} onOpenChange={setAutoOpen} />
    </>
  );
}

// Removido bloco antigo
function _legacy() {
  return (
    <>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              className="fixed bottom-4 left-4 z-[100] h-12 w-12 rounded-full shadow-lg bg-primary hover:bg-primary/90"
              onClick={() => {}}
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
    </>
  );
}
