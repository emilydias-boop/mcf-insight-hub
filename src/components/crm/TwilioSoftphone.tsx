import { useState, useEffect, useRef, useCallback } from 'react';
import { useTwilio } from '@/contexts/TwilioContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, PhoneOff, Mic, MicOff, Minimize2, Maximize2, GripVertical, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PostCallModal } from './PostCallModal';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

const STORAGE_KEY = 'softphone-position';

interface Position {
  x: number;
  y: number;
}

export function TwilioSoftphone() {
  const { 
    deviceStatus, 
    callStatus, 
    callDuration, 
    isMuted,
    currentCallId,
    currentCallDealId,
    currentCall,
    initializeDevice, 
    hangUp, 
    toggleMute,
    qualificationModalOpen,
    openQualificationModal
  } = useTwilio();
  
  const [isMinimized, setIsMinimized] = useState(false);
  const [showPostCallModal, setShowPostCallModal] = useState(false);
  const [completedCallId, setCompletedCallId] = useState<string | null>(null);
  
  // Drag state
  const [position, setPosition] = useState<Position | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);

  // Load saved position
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPosition(parsed);
      } catch (e) {
        console.error('Failed to parse saved position');
      }
    }
  }, []);

  // Save position when it changes
  useEffect(() => {
    if (position) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
    }
  }, [position]);

  // Show post-call modal when call completes
  useEffect(() => {
    if (callStatus === 'completed' && currentCallId) {
      setCompletedCallId(currentCallId);
      setShowPostCallModal(true);
    }
  }, [callStatus, currentCallId]);

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return;
    
    e.preventDefault();
    const rect = dragRef.current.getBoundingClientRect();
    
    dragStartPos.current = {
      x: e.clientX,
      y: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top
    };
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !dragStartPos.current || !dragRef.current) return;
    
    const newX = e.clientX - dragStartPos.current.offsetX;
    const newY = e.clientY - dragStartPos.current.offsetY;
    
    // Constrain to viewport
    const rect = dragRef.current.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width;
    const maxY = window.innerHeight - rect.height;
    
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStartPos.current = null;
  }, []);

  // Add/remove global mouse listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Handle opening qualification modal
  const handleOpenQualification = () => {
    if (currentCallDealId) {
      openQualificationModal(currentCallDealId);
    }
  };

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

  const isInCall = callStatus !== 'idle' && callStatus !== 'completed' && callStatus !== 'failed';

  // Calculate position style
  const positionStyle: React.CSSProperties = position 
    ? { 
        left: position.x, 
        top: position.y, 
        right: 'auto', 
        bottom: 'auto' 
      }
    : { 
        right: 16, 
        bottom: 16 
      };

  if (isMinimized) {
    return (
      <>
        <div 
          ref={dragRef}
          className={cn(
            "fixed z-[100]",
            isDragging && "cursor-grabbing"
          )}
          style={positionStyle}
        >
          <div 
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full shadow-lg cursor-pointer select-none",
              deviceStatus === 'busy' ? "bg-orange-500 text-white animate-pulse" : "bg-card border"
            )}
          >
            {/* Drag handle */}
            <div 
              className="cursor-grab active:cursor-grabbing p-1 -ml-2 hover:bg-black/10 rounded"
              onMouseDown={handleMouseDown}
            >
              <GripVertical className="h-3 w-3 opacity-50" />
            </div>
            
            <div 
              className="flex items-center gap-2"
              onClick={() => setIsMinimized(false)}
            >
              <div className={cn("w-2 h-2 rounded-full", statusColors[deviceStatus])} />
              <Phone className="h-4 w-4" />
              {deviceStatus === 'busy' && (
                <span className="font-mono text-sm">{formatDuration(callDuration)}</span>
              )}
            </div>
            
            {/* Show form button when in call */}
            {isInCall && currentCallDealId && (
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-6 w-6 rounded-full",
                  qualificationModalOpen ? "bg-primary text-primary-foreground" : "hover:bg-black/10"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenQualification();
                }}
              >
                <FileText className="h-3 w-3" />
              </Button>
            )}
            
            <Maximize2 
              className="h-3 w-3 ml-1 cursor-pointer hover:opacity-70" 
              onClick={() => setIsMinimized(false)}
            />
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
      <Card 
        ref={dragRef}
        className={cn(
          "fixed z-[100] w-72 shadow-xl select-none",
          isDragging && "cursor-grabbing"
        )}
        style={positionStyle}
      >
        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            {/* Drag handle */}
            <div 
              className="cursor-grab active:cursor-grabbing p-1 -ml-1 hover:bg-muted rounded"
              onMouseDown={handleMouseDown}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
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
          {isInCall && (
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
                
                {/* Form button */}
                {currentCallDealId && (
                  <Button
                    variant={qualificationModalOpen ? "default" : "outline"}
                    size="icon"
                    className="h-10 w-10 rounded-full"
                    onClick={handleOpenQualification}
                  >
                    <FileText className="h-5 w-5" />
                  </Button>
                )}
                
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-12 w-12 rounded-full"
                  onClick={hangUp}
                >
                  <PhoneOff className="h-5 w-5" />
                </Button>
              </div>
              
              {/* Indicator if form is open */}
              {qualificationModalOpen && (
                <p className="text-xs text-center text-muted-foreground">
                  Formulário de qualificação aberto
                </p>
              )}
            </div>
          )}

          {/* Quando disponível (sem chamada ativa) */}
          {!isInCall && deviceStatus === 'ready' && (
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
