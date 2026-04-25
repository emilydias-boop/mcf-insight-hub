import { useEffect } from 'react';
import { QuickDialer } from './QuickDialer';
import { AutoDialerPanel } from '@/components/sdr/AutoDialerPanel';
import { useAutoDialer } from '@/contexts/AutoDialerContext';
import { useDialerLauncher } from '@/contexts/DialerLauncherContext';

/**
 * Monta os modais globais do discador e mantém os atalhos de teclado:
 *  - Ctrl+Shift+D → Discador rápido
 *  - Ctrl+Shift+A → Auto-Discador
 *
 * Os botões de acesso ficam dentro do AppSidebar (visíveis apenas para SDR/Closer).
 */
export function QuickDialerLauncher() {
  const { quickOpen, setQuickOpen, autoOpen, setAutoOpen } = useDialerLauncher();
  const ad = useAutoDialer();

  // Fecha automaticamente o painel do auto-discador quando a fila começa a rodar
  // ou quando um lead atende — assim o DealDetailsDrawer e o banner ficam visíveis
  // sem competir com o Sheet do painel.
  useEffect(() => {
    if (ad.state === 'running' || ad.state === 'paused-in-call') {
      setAutoOpen(false);
    }
  }, [ad.state, setAutoOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setQuickOpen(!quickOpen);
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setAutoOpen(!autoOpen);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [quickOpen, autoOpen, setQuickOpen, setAutoOpen]);

  return (
    <>
      <QuickDialer open={quickOpen} onOpenChange={setQuickOpen} />
      <AutoDialerPanel open={autoOpen} onOpenChange={setAutoOpen} />
    </>
  );
}
