import { useEffect, useMemo, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProposals } from '@/hooks/useConsorcioPostMeeting';

const REMINDER_INTERVAL_MS = 10 * 60 * 1000; // 10 minutos

export function CloserPendingDocsAlert() {
  const { user, allRoles } = useAuth();
  const isCloser = (allRoles as string[] | undefined)?.some(r => r === 'closer' || r === 'closer_sombra') ?? false;

  const { data: proposals = [] } = useProposals();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const myPending = useMemo(() => {
    if (!user?.email) return [];
    const myEmail = user.email.toLowerCase();
    return proposals.filter(p => {
      const ownerEmail = (p as any).closer_name; // fallback
      // documentos_pendentes já garante status = 'aceita' sem docs
      if (!p.documentos_pendentes) return false;
      const proposalDate = p.created_at ? new Date(p.created_at) : null;
      const daysOverdue = proposalDate
        ? Math.floor((Date.now() - proposalDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      if (daysOverdue < 2) return false;
      // Match closer via owner_id (email) — recuperamos via crm_deals owner
      // O hook expõe apenas closer_name, então também aceitamos quando
      // o email do usuário corresponde ao owner exposto.
      const ownerId = (p as any).owner_id || ownerEmail;
      return String(ownerId).toLowerCase() === myEmail;
    });
  }, [proposals, user?.email]);

  useEffect(() => {
    if (!isCloser) return;
    if (myPending.length === 0) {
      setOpen(false);
      return;
    }
    // Abre imediatamente quando houver pendências
    setOpen(true);
    const interval = setInterval(() => {
      setOpen(true);
    }, REMINDER_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isCloser, myPending.length]);

  if (!isCloser || myPending.length === 0) return null;

  const handleGo = () => {
    setOpen(false);
    navigate('/consorcio/crm/pos-reuniao');
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Documentação pendente há 2+ dias
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Você tem <strong>{myPending.length}</strong>{' '}
                carta{myPending.length > 1 ? 's negociadas' : ' negociada'} com
                documentação pendente há 2 dias ou mais. Enquanto a documentação
                não estiver anexada e a carta não for cadastrada e enviada para
                <strong> Concluídas – Operacional</strong>, ela{' '}
                <strong>não será contabilizada nas vendas</strong>.
              </p>
              <ul className="max-h-48 overflow-auto rounded-md border border-border bg-muted/40 p-2 text-sm">
                {myPending.map(p => {
                  const proposalDate = p.created_at ? new Date(p.created_at) : null;
                  const daysOverdue = proposalDate
                    ? Math.floor((Date.now() - proposalDate.getTime()) / (1000 * 60 * 60 * 24))
                    : 0;
                  return (
                    <li key={p.id} className="flex items-center justify-between py-1">
                      <span className="truncate">{p.contact_name || p.deal_name}</span>
                      <span className="ml-2 font-bold text-destructive">{daysOverdue}d</span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-muted-foreground">
                Este aviso reaparecerá automaticamente a cada 10 minutos até que
                a documentação seja regularizada.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={handleGo}>
            Ir para Cartas Negociadas
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
