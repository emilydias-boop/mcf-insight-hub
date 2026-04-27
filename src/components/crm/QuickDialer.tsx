import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, Delete, Loader2, ExternalLink, User, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useTwilio } from '@/contexts/TwilioContext';
import { normalizePhoneNumber } from '@/lib/phoneUtils';
import { useLeadLookupByPhone, type LeadMatch, type LeadDealMatch } from '@/hooks/useLeadLookupByPhone';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatPhoneBR(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
}

const KEYS: string[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

export function QuickDialer({ open, onOpenChange }: Props) {
  const [digits, setDigits] = useState('');
  const [selectedDeal, setSelectedDeal] = useState<{ deal: LeadDealMatch; contact: LeadMatch } | null>(null);
  const [isDialing, setIsDialing] = useState(false);
  const navigate = useNavigate();
  const { makeCall, deviceStatus, initializeDevice } = useTwilio();
  const { data: matches = [], isFetching } = useLeadLookupByPhone(digits);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setDigits('');
      setSelectedDeal(null);
      setIsDialing(false);
    }
  }, [open]);

  // Reset selection when number changes meaningfully
  useEffect(() => {
    setSelectedDeal(null);
  }, [digits]);

  // Physical keyboard
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Backspace') {
        e.preventDefault();
        setDigits(d => d.slice(0, -1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (digits.replace(/\D/g, '').length >= 8) handleCall();
      } else if (/^[0-9*#]$/.test(e.key)) {
        setDigits(d => (d + e.key).slice(0, 13));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, digits]);

  const allDeals = useMemo(() => {
    const out: { deal: LeadDealMatch; contact: LeadMatch }[] = [];
    matches.forEach(m => m.deals.forEach(d => out.push({ deal: d, contact: m })));
    return out;
  }, [matches]);

  const phoneOnlyDigits = digits.replace(/\D/g, '');
  const canCall = phoneOnlyDigits.length >= 8;

  const handleKeyPress = (k: string) => {
    setDigits(d => (d + k).slice(0, 13));
  };

  const handleBackspace = () => setDigits(d => d.slice(0, -1));

  const handleCall = async () => {
    if (!canCall || isDialing) return;
    const normalized = normalizePhoneNumber(digits);

    // Se há um deal selecionado, ou se há exatamente 1 deal candidato, vincular
    let chosen = selectedDeal;
    if (!chosen && allDeals.length === 1) chosen = allDeals[0];

    setIsDialing(true);
    try {
      // Garante device pronto — popup permanece aberto durante a inicialização
      if (deviceStatus !== 'ready') {
        const ok = await initializeDevice();
        if (!ok) {
          toast.error('Não foi possível inicializar o telefone. Tente novamente.');
          setIsDialing(false);
          return;
        }
      }

      await makeCall(
        normalized,
        chosen?.deal.dealId,
        chosen?.contact.contactId,
        chosen?.deal.originId || undefined,
      );
      // Só fecha após disparar a chamada com sucesso
      onOpenChange(false);
    } catch (err) {
      console.error('[QuickDialer] erro ao ligar', err);
      toast.error('Falha ao iniciar a ligação. Tente novamente.');
    } finally {
      setIsDialing(false);
    }
  };

  const handleOpenDeal = (dealId: string) => {
    onOpenChange(false);
    navigate(`/crm/negocios?dealId=${dealId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Discador rápido
          </DialogTitle>
          <DialogDescription className="text-xs">
            Digite o número e identifique o lead automaticamente.
          </DialogDescription>
        </DialogHeader>

        {/* Display do número */}
        <div className="px-6 pt-2">
          <div className="bg-muted/40 border rounded-lg p-4 text-center">
            <input
              type="tel"
              inputMode="tel"
              autoFocus
              value={formatPhoneBR(digits)}
              onChange={(e) => {
                const onlyDigits = e.target.value.replace(/\D/g, '').slice(0, 13);
                setDigits(onlyDigits);
              }}
              onPaste={(e) => {
                e.preventDefault();
                const pasted = e.clipboardData.getData('text');
                const onlyDigits = pasted.replace(/\D/g, '').slice(0, 13);
                if (onlyDigits) setDigits(onlyDigits);
              }}
              placeholder="(__) _ ____-____"
              className="w-full bg-transparent border-0 outline-none text-center text-2xl font-mono tabular-nums tracking-wider placeholder:text-muted-foreground/50"
              aria-label="Número de telefone"
            />
            {digits && (
              <button
                onClick={handleBackspace}
                className="absolute right-8 mt-[-2.5rem] text-muted-foreground hover:text-foreground"
                aria-label="Apagar"
              >
                <Delete className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Lead identificado */}
        {canCall && (
          <div className="px-6 pt-3 max-h-48 overflow-y-auto">
            {isFetching ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Buscando lead...
              </div>
            ) : allDeals.length === 0 ? (
              <div className="text-xs text-muted-foreground py-2 italic">
                Nenhum lead com este número. Será registrada como ligação avulsa.
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="text-xs text-muted-foreground">
                  {allDeals.length === 1 ? '1 lead encontrado:' : `${allDeals.length} deals encontrados — selecione:`}
                </div>
                {allDeals.map(({ deal, contact }) => {
                  const isSelected = selectedDeal?.deal.dealId === deal.dealId;
                  const isAuto = !selectedDeal && allDeals.length === 1;
                  const notMine = !deal.isMine;
                  return (
                    <button
                      key={deal.dealId}
                      type="button"
                      onClick={() => setSelectedDeal({ deal, contact })}
                      className={cn(
                        'w-full text-left p-2 rounded border transition-colors',
                        (isSelected || isAuto)
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:bg-muted/50',
                        notMine && 'border-amber-500/50',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="text-sm font-medium truncate">
                            {contact.contactName || deal.dealName || 'Sem nome'}
                          </span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpenDeal(deal.dealId); }}
                          className="text-muted-foreground hover:text-foreground shrink-0"
                          title="Abrir no CRM"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {deal.originName && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5">{deal.originName}</Badge>
                        )}
                        {deal.stageName && (
                          <Badge variant="secondary" className="text-[10px] py-0 px-1.5">{deal.stageName}</Badge>
                        )}
                        {deal.ownerEmail && (
                          <span className={cn(
                            'text-[10px] truncate',
                            notMine ? 'text-amber-500 font-medium' : 'text-muted-foreground',
                          )}>
                            {notMine ? 'Com: ' : ''}{deal.ownerEmail.split('@')[0]}
                          </span>
                        )}
                        {contact.phone && (
                          <span className="text-[10px] text-muted-foreground">
                            {contact.phone}
                          </span>
                        )}
                      </div>
                      {notMine && (
                        <div className="flex items-center gap-1 mt-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="h-3 w-3" />
                          <span>Lead de outro responsável — você só pode ligar. Para agendar, peça transferência.</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Teclado */}
        <div className="px-6 pt-4 pb-2">
          <div className="grid grid-cols-3 gap-2">
            {KEYS.map(k => (
              <Button
                key={k}
                variant="outline"
                size="lg"
                className="h-12 text-lg font-semibold"
                onClick={() => handleKeyPress(k)}
              >
                {k}
              </Button>
            ))}
          </div>
        </div>

        {/* Ligar */}
        <div className="px-6 pb-6 pt-2 flex gap-2">
          <Button
            variant="ghost"
            size="lg"
            className="h-12 w-12 rounded-full p-0"
            onClick={handleBackspace}
            disabled={!digits || isDialing}
            aria-label="Apagar"
          >
            <Delete className="h-5 w-5" />
          </Button>
          <Button
            size="lg"
            className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-white rounded-full text-base font-semibold"
            disabled={!canCall || isDialing}
            onClick={handleCall}
          >
            {isDialing ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                {deviceStatus !== 'ready' ? 'Inicializando telefone…' : 'Conectando…'}
              </>
            ) : (
              <>
                <Phone className="h-5 w-5 mr-2" />
                Ligar
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
