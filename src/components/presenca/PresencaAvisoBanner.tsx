import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { usePresencaConfig, useConfirmacoesDia } from '@/hooks/usePresencaDia';
import { deveMostrarAviso, hojeSP, ROTULO_BU } from '@/lib/presencaDia';

/** Aviso interno (sem WhatsApp/e-mail/notificações): só para líder/admin, a partir do horário configurado. */
export function PresencaAvisoBanner() {
  const location = useLocation();
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setAgora(new Date()), 60_000); return () => clearInterval(t); }, []);
  const data = hojeSP(agora);
  const { data: configs } = usePresencaConfig();
  const { data: confs } = useConfirmacoesDia(data, !!configs?.length);

  if (!configs?.length || !confs || location.pathname === '/presenca-do-dia') return null;
  const pendentes = configs.filter((c) => deveMostrarAviso(agora, c.horario_aviso.slice(0, 5), confs.some((x) => x.bu === c.bu)));
  if (!pendentes.length) return null;

  return (
    <div className="flex items-center gap-2 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <span>Confirme a presença do dia: {pendentes.map((c) => ROTULO_BU[c.bu]).join(' e ')}.</span>
      <Link to="/presenca-do-dia" className="ml-auto font-medium underline">Abrir Presença do dia</Link>
    </div>
  );
}
