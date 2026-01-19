import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar, ExternalLink } from 'lucide-react';
import { QuickScheduleModal } from './QuickScheduleModal';
import { useClosersWithAvailability } from '@/hooks/useAgendaData';

interface SdrScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  contactName?: string;
  initialNotes?: string;
  onScheduled?: () => void;
}

export function SdrScheduleDialog({
  open,
  onOpenChange,
  dealId,
  contactName,
  initialNotes,
  onScheduled,
}: SdrScheduleDialogProps) {
  const navigate = useNavigate();
  const [showQuickSchedule, setShowQuickSchedule] = useState(false);
  const { data: closers = [] } = useClosersWithAvailability();
  
  const handleScheduleHere = () => {
    onOpenChange(false);
    setShowQuickSchedule(true);
  };
  
  const handleGoToAgenda = () => {
    onOpenChange(false);
    // Navegar para agenda com parâmetros para pré-preenchimento
    const params = new URLSearchParams();
    params.set('dealId', dealId);
    if (initialNotes) {
      params.set('notes', encodeURIComponent(initialNotes));
    }
    navigate(`/crm/agenda?${params.toString()}`);
  };
  
  const handleQuickScheduleClose = (isOpen: boolean) => {
    setShowQuickSchedule(isOpen);
    if (!isOpen) {
      onScheduled?.();
    }
  };
  
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Agendar Reunião
            </DialogTitle>
            <DialogDescription>
              {contactName ? (
                <>Agendar reunião para <strong>{contactName}</strong></>
              ) : (
                'Como deseja agendar a reunião?'
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 pt-2">
            <Button
              variant="default"
              className="w-full justify-start h-auto py-3"
              onClick={handleScheduleHere}
            >
              <Calendar className="h-5 w-5 mr-3" />
              <div className="text-left">
                <div className="font-medium">Agendar aqui</div>
                <div className="text-xs text-primary-foreground/70 font-normal">
                  Abrir modal de agendamento rápido
                </div>
              </div>
            </Button>
            
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-3"
              onClick={handleGoToAgenda}
            >
              <ExternalLink className="h-5 w-5 mr-3" />
              <div className="text-left">
                <div className="font-medium">Ir para Agenda</div>
                <div className="text-xs text-muted-foreground font-normal">
                  Visualizar agenda completa e agendar
                </div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Modal de agendamento rápido */}
      <QuickScheduleModal
        open={showQuickSchedule}
        onOpenChange={handleQuickScheduleClose}
        closers={closers}
        prefilledDealId={dealId}
        prefilledNotes={initialNotes}
      />
    </>
  );
}
