import { useState, useEffect } from 'react';
import { useTwilio } from '@/contexts/TwilioContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, PhoneOff, Mic, MicOff, Minimize2, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PostCallModal } from './PostCallModal';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function TwilioSoftphone() {
  const { 
    deviceStatus, 
    callStatus, 
    callDuration, 
    isMuted,
    currentCallId,
    currentCall,
    initializeDevice, 
    hangUp, 
    toggleMute 
  } = useTwilio();
  
  const [isMinimized, setIsMinimized] = useState(false);
  const [showPostCallModal, setShowPostCallModal] = useState(false);
  const [completedCallId, setCompletedCallId] = useState<string | null>(null);

  // Show post-call modal when call completes
  useEffect(() => {
    if (callStatus === 'completed' && currentCallId) {
      setCompletedCallId(currentCallId);
      setShowPostCallModal(true);
    }
  }, [callStatus, currentCallId]);

  // Don't render if device is not initialized
  if (deviceStatus === 'disconnected') {
    return null;
  }

  const statusColors = {
    connecting: 'bg-yellow-500',
    ready: 'bg-green-500',
    busy: 'bg-orange-500',
    error: 'bg-red-500',
    disconnected: 'bg-gray-500'
  };

  const statusLabels = {
    connecting: 'Conectando...',
    ready: 'Disponível',
    busy: 'Em Chamada',
    error: 'Erro',
    disconnected: 'Desconectado'
  };

  const callStatusLabels = {
    idle: '',
    connecting: 'Conectando...',
    ringing: 'Chamando...',
    'in-progress': 'Em chamada',
    completed: 'Encerrada',
    failed: 'Falhou'
  };

  if (isMinimized) {
    return (
      <>
        <div 
          className="fixed bottom-4 right-4 z-50 cursor-pointer"
          onClick={() => setIsMinimized(false)}
        >
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full shadow-lg",
            deviceStatus === 'busy' ? "bg-orange-500 text-white animate-pulse" : "bg-card border"
          )}>
            <div className={cn("w-2 h-2 rounded-full", statusColors[deviceStatus])} />
            <Phone className="h-4 w-4" />
            {deviceStatus === 'busy' && (
              <span className="font-mono text-sm">{formatDuration(callDuration)}</span>
            )}
            <Maximize2 className="h-3 w-3 ml-1" />
          </div>
        </div>

        <PostCallModal
          open={showPostCallModal}
          onClose={() => setShowPostCallModal(false)}
          callId={completedCallId}
          onSave={() => setCompletedCallId(null)}
        />
      </>
    );
  }

  return (
    <>
      <Card className="fixed bottom-4 right-4 z-50 w-72 shadow-xl">
        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <div className={cn("w-3 h-3 rounded-full", statusColors[deviceStatus])} />
            <CardTitle className="text-sm font-medium">
              {statusLabels[deviceStatus]}
            </CardTitle>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6"
            onClick={() => setIsMinimized(true)}
          >
            <Minimize2 className="h-3 w-3" />
          </Button>
        </CardHeader>

        <CardContent className="py-3 px-4">
          {/* Durante chamada */}
          {callStatus !== 'idle' && callStatus !== 'completed' && callStatus !== 'failed' && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  {callStatusLabels[callStatus]}
                </p>
                <p className="text-3xl font-mono mt-2 tabular-nums">
                  {formatDuration(callDuration)}
                </p>
                {currentCall?.parameters?.To && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {currentCall.parameters.To}
                  </p>
                )}
              </div>

              <div className="flex justify-center gap-3">
                <Button
                  variant={isMuted ? "default" : "outline"}
                  size="icon"
                  className="h-10 w-10 rounded-full"
                  onClick={toggleMute}
                >
                  {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </Button>
                
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-12 w-12 rounded-full"
                  onClick={hangUp}
                >
                  <PhoneOff className="h-5 w-5" />
                </Button>
              </div>
            </div>
          )}

          {/* Quando disponível (sem chamada ativa) */}
          {(callStatus === 'idle' || callStatus === 'completed' || callStatus === 'failed') && deviceStatus === 'ready' && (
            <div className="text-center py-2">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <Phone className="h-3 w-3 mr-1" />
                Pronto para ligar
              </Badge>
              <p className="text-xs text-muted-foreground mt-2">
                Use o botão de ligar nos cards de deals
              </p>
            </div>
          )}

          {/* Status de erro */}
          {deviceStatus === 'error' && (
            <div className="text-center py-2">
              <Badge variant="destructive">Erro de conexão</Badge>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2 w-full"
                onClick={initializeDevice}
              >
                Reconectar
              </Button>
            </div>
          )}

          {/* Conectando */}
          {deviceStatus === 'connecting' && (
            <div className="text-center py-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" />
              <p className="text-xs text-muted-foreground mt-2">
                Conectando ao Twilio...
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <PostCallModal
        open={showPostCallModal}
        onClose={() => setShowPostCallModal(false)}
        callId={completedCallId}
        onSave={() => setCompletedCallId(null)}
      />
    </>
  );
}
