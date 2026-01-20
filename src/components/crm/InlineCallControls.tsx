import { useTwilio } from '@/contexts/TwilioContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PhoneOff, Mic, MicOff, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

interface InlineCallControlsProps {
  dealId: string;
}

export function InlineCallControls({ dealId }: InlineCallControlsProps) {
  const { 
    callStatus, 
    callDuration, 
    isMuted, 
    hangUp, 
    toggleMute,
    currentCallDealId,
    qualificationModalOpen,
    openQualificationModal
  } = useTwilio();

  const isInCall = callStatus !== 'idle' && callStatus !== 'completed' && callStatus !== 'failed';
  const isThisDealCall = currentCallDealId === dealId;
  
  // Only show if there's an active call for THIS deal
  if (!isInCall || !isThisDealCall) return null;

  const callStatusLabels: Record<string, string> = {
    connecting: 'Conectando...',
    ringing: 'Chamando...',
    'in-progress': 'Em chamada',
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg w-full">
      <Badge variant="outline" className="bg-orange-500 text-white border-orange-500 animate-pulse shrink-0">
        {callStatusLabels[callStatus] || 'Em chamada'}
      </Badge>
      
      <span className="font-mono text-lg tabular-nums">
        {formatDuration(callDuration)}
      </span>
      
      <div className="flex gap-2 ml-auto">
        <Button 
          variant={isMuted ? "default" : "outline"} 
          size="icon" 
          className="h-9 w-9 rounded-full"
          onClick={toggleMute}
        >
          {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
        
        <Button
          variant={qualificationModalOpen ? "default" : "outline"}
          size="icon"
          className="h-9 w-9 rounded-full"
          onClick={() => openQualificationModal(dealId)}
        >
          <FileText className="h-4 w-4" />
        </Button>
        
        <Button 
          variant="destructive" 
          size="icon" 
          className="h-9 w-9 rounded-full"
          onClick={hangUp}
        >
          <PhoneOff className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
