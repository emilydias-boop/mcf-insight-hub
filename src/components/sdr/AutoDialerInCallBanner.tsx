import { useEffect, useRef } from 'react';
import { useAutoDialer } from '@/contexts/AutoDialerContext';
import { useTwilio } from '@/contexts/TwilioContext';
import { Button } from '@/components/ui/button';
import { PhoneOff, Mic, MicOff, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    o.start(); o.stop(ctx.currentTime + 0.6);
    setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch { /* ignore */ }
}

export function AutoDialerInCallBanner() {
  const { state, currentLead } = useAutoDialer();
  const { callDuration, isMuted, hangUp, toggleMute, currentCallDealId, openQualificationModal } = useTwilio();
  const playedRef = useRef(false);

  useEffect(() => {
    if (state === 'paused-in-call' && !playedRef.current) {
      playBeep();
      setTimeout(() => playBeep(), 250);
      playedRef.current = true;
    }
    if (state !== 'paused-in-call') playedRef.current = false;
  }, [state]);

  if (state !== 'paused-in-call' || !currentLead) return null;

  return (
    <div className={cn(
      'fixed top-4 left-1/2 -translate-x-1/2 z-[110] w-[min(92vw,640px)]',
      'rounded-xl border-2 border-green-500 bg-green-500/15 backdrop-blur-md shadow-2xl shadow-green-500/30',
      'px-4 py-3 flex items-center gap-3 animate-in slide-in-from-top-4',
    )}>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="relative flex h-3 w-3 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">📞 {currentLead.name} atendeu!</div>
          <div className="text-xs text-muted-foreground">{currentLead.phone} · {formatDuration(callDuration)}</div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button size="icon" variant={isMuted ? 'default' : 'outline'} className="h-9 w-9 rounded-full" onClick={toggleMute}>
          {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
        {currentCallDealId && (
          <Button size="icon" variant="outline" className="h-9 w-9 rounded-full" onClick={() => openQualificationModal(currentCallDealId)}>
            <FileText className="h-4 w-4" />
          </Button>
        )}
        <Button size="icon" variant="destructive" className="h-9 w-9 rounded-full" onClick={hangUp}>
          <PhoneOff className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
