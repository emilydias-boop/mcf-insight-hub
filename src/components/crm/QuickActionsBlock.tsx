import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Phone, MessageCircle, ArrowRight, Loader2, XCircle, Calendar, CalendarClock, FolderInput, Trash2, ClipboardList, RotateCcw } from 'lucide-react';
import { useTwilio } from '@/contexts/TwilioContext';
import { useUpdateCRMDeal, useCRMStages, useDeleteCRMDeal } from '@/hooks/useCRMData';
import { toast } from 'sonner';
import { extractPhoneFromDeal, findPhoneByEmail, normalizePhoneNumber, isValidPhoneNumber } from '@/lib/phoneUtils';
import { buildWhatsAppMessage } from '@/lib/whatsappTemplates';
import { format, parseISO } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MarkAsLostModal } from './MarkAsLostModal';
import { InlineCallControls } from './InlineCallControls';
import { SdrScheduleDialog } from './SdrScheduleDialog';
import { MoveToPipelineModal } from './MoveToPipelineModal';
import { RefundModal } from './RefundModal';

interface QuickActionsBlockProps {
  deal: any;
  contact: any;
  onStageChange?: () => void;
  onQualify?: () => void;
}

export const QuickActionsBlock = ({ deal, contact, onStageChange, onQualify }: QuickActionsBlockProps) => {
  const { makeCall, isTestPipeline, deviceStatus, initializeDevice, callStatus, currentCallDealId } = useTwilio();
  const updateDeal = useUpdateCRMDeal();
  const { data: stages } = useCRMStages(deal?.origin_id);
  
  const deleteDeal = useDeleteCRMDeal();
  
  const [isSearchingPhone, setIsSearchingPhone] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<string>('');
  const [showLostModal, setShowLostModal] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  
  const alreadyRefunded = deal?.custom_fields?.reembolso_solicitado === true;
  
  const isTestDeal = deal ? isTestPipeline(deal.origin_id) : false;
  const currentStageOrder = deal?.crm_stages?.stage_order || 0;
  const stageName = deal?.crm_stages?.stage_name?.toLowerCase() || '';
  const isNoShowStage = stageName.includes('no-show') || stageName.includes('no_show') || stageName.includes('noshow');
  
  // Padrões de estágios que sempre devem estar disponíveis para mover
  const ALWAYS_AVAILABLE_PATTERNS = [
    'sem sucesso', 'sem interesse', 'não quer', 'perdido', 
    'desistente', 'cancelado', 'reembolsado', 'a reembolsar'
  ];

  const isAlwaysAvailable = (name: string) => {
    const lower = name.toLowerCase().trim();
    return ALWAYS_AVAILABLE_PATTERNS.some(p => lower.includes(p));
  };

  const futureStages = stages?.filter(s => 
    s.stage_order > currentStageOrder || isAlwaysAvailable(s.stage_name)
  ).filter(s => s.id !== deal?.stage_id) || [];
  
  // Check if there's an active call for THIS deal
  const isInCallWithThisDeal = 
    currentCallDealId === deal?.id && 
    callStatus !== 'idle' && 
    callStatus !== 'completed' && 
    callStatus !== 'failed';
  
  const handleCall = async () => {
    let phone = extractPhoneFromDeal(deal, contact);
    
    if (!phone && contact?.email) {
      setIsSearchingPhone(true);
      try {
        phone = await findPhoneByEmail(contact.email);
      } finally {
        setIsSearchingPhone(false);
      }
    }
    
    if (!phone) {
      toast.error('Contato não possui telefone cadastrado');
      return;
    }
    
    if (!isValidPhoneNumber(phone)) {
      toast.error('Número de telefone inválido');
      return;
    }
    
    const normalizedPhone = normalizePhoneNumber(phone);
    
    // If device is not ready, initialize and wait
    if (deviceStatus !== 'ready') {
      toast.info('Inicializando Twilio...');
      const success = await initializeDevice();
      if (!success) {
        toast.error('Erro ao inicializar Twilio');
        return;
      }
    }
    
    // Now device is ready, make the call
    await makeCall(normalizedPhone, deal?.id, contact?.id, deal?.origin_id);
  };
  
  const handleWhatsApp = () => {
    let phone = extractPhoneFromDeal(deal, contact);
    
    if (!phone) {
      toast.error('Contato não possui telefone cadastrado');
      return;
    }
    
    const cleanPhone = phone.replace(/\D/g, '');
    const whatsappNumber = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    
    // Get contact name (first name only)
    const contactName = contact?.name?.split(' ')[0] || deal?.name?.split(' ')[0] || 'Cliente';
    
    // Get SDR name (first name only)
    const sdrName = deal?.custom_fields?.deal_user_name?.split(' ')[0] || '';
    
    // Get stage name for template selection
    const stageName = deal?.crm_stages?.stage_name || 'default';
    
    // Format next action date if available
    let actionDate = '';
    if (deal?.next_action_date) {
      try {
        actionDate = format(parseISO(deal.next_action_date), "dd/MM 'às' HH:mm");
      } catch {
        actionDate = '';
      }
    }
    
    // Build message using template
    const message = buildWhatsAppMessage(stageName, {
      nome: contactName,
      sdr: sdrName,
      data: actionDate,
      produto: deal?.product_name || ''
    });
    
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, '_blank');
  };
  
  const handleMoveStage = async () => {
    if (!selectedStageId) {
      toast.error('Selecione um estágio');
      return;
    }
    
    try {
      await updateDeal.mutateAsync({
        id: deal.id,
        stage_id: selectedStageId
      });
      
      toast.success('Estágio atualizado!');
      setSelectedStageId('');
      onStageChange?.();
    } catch (error) {
      // Error handled by hook
    }
  };
  
  const handleDelete = async () => {
    try {
      await deleteDeal.mutateAsync(deal.id);
      setShowDeleteDialog(false);
      onStageChange?.();
    } catch (error) {
      // Error handled by hook
    }
  };

  const hasPhone = extractPhoneFromDeal(deal, contact);
  
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {/* Controles inline quando em chamada com este deal */}
        {isInCallWithThisDeal && deal?.id ? (
          <InlineCallControls dealId={deal.id} />
        ) : (
          <>
            {/* Botão Ligar */}
            <Button
              size="sm"
              className="bg-primary hover:bg-primary/90 h-8"
              onClick={handleCall}
              disabled={isSearchingPhone}
            >
              {isSearchingPhone ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Phone className="h-3.5 w-3.5 mr-1.5" />
              )}
              {isTestDeal ? 'Ligar' : 'Ligar'}
            </Button>
            
            {/* Botão WhatsApp */}
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white h-8"
              onClick={handleWhatsApp}
              disabled={!hasPhone}
            >
              <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
              WhatsApp
            </Button>
            
            {/* Botão Agendar */}
            <Button
              size="sm"
              variant="outline"
              className={`h-8 ${isNoShowStage ? 'border-amber-500/50 text-amber-600 hover:bg-amber-50' : 'border-blue-500/50 text-blue-600 hover:bg-blue-50'}`}
              onClick={() => setShowScheduleDialog(true)}
            >
              {isNoShowStage ? <CalendarClock className="h-3.5 w-3.5 mr-1.5" /> : <Calendar className="h-3.5 w-3.5 mr-1.5" />}
              {isNoShowStage ? 'Reagendar' : 'Agendar'}
            </Button>
            
            {/* Botão Qualificar */}
            {onQualify && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-purple-500/50 text-purple-600 hover:bg-purple-50"
                onClick={onQualify}
              >
                <ClipboardList className="h-3.5 w-3.5 mr-1.5" />
                Qualificar
              </Button>
            )}
          </>
        )}
        
        {/* Mover estágio inline */}
        {futureStages.length > 0 && (
          <>
            <div className="h-4 w-px bg-border mx-1" />
            <Select value={selectedStageId} onValueChange={setSelectedStageId}>
              <SelectTrigger className="w-[140px] h-8 bg-background text-xs">
                <SelectValue placeholder="Mover para..." />
              </SelectTrigger>
              <SelectContent>
                {futureStages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.stage_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              onClick={handleMoveStage}
              disabled={!selectedStageId || updateDeal.isPending}
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
        
        {/* Botões Perdido, Mover Pipeline, Excluir - esconder quando em chamada */}
        {!isInCallWithThisDeal && (
          <>
            <div className="h-4 w-px bg-border mx-1" />
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-destructive border-destructive/50 hover:bg-destructive/10"
              onClick={() => setShowLostModal(true)}
            >
              <XCircle className="h-3.5 w-3.5 mr-1.5" />
              Perdido
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => setShowMoveModal(true)}
            >
              <FolderInput className="h-3.5 w-3.5 mr-1.5" />
              Mover Pipeline
            </Button>
            
            {!alreadyRefunded && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-orange-600 border-orange-500/50 hover:bg-orange-50"
                onClick={() => setShowRefundModal(true)}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Reembolso
              </Button>
            )}
            
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-destructive border-destructive/50 hover:bg-destructive/10"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Excluir
            </Button>
          </>
        )}
      </div>

      {/* Modal de Perda */}
      <MarkAsLostModal
        open={showLostModal}
        onOpenChange={setShowLostModal}
        dealId={deal?.id}
        dealName={deal?.name || 'Lead'}
        originId={deal?.origin_id}
        currentCustomFields={deal?.custom_fields || {}}
        onSuccess={onStageChange}
      />
      
      {/* Modal de Agendamento */}
      <SdrScheduleDialog
        open={showScheduleDialog}
        onOpenChange={setShowScheduleDialog}
        dealId={deal?.id}
        contactName={contact?.name || deal?.name}
        isReschedule={isNoShowStage}
        onScheduled={onStageChange}
      />
      
      {/* Modal Mover Pipeline */}
      <MoveToPipelineModal
        open={showMoveModal}
        onOpenChange={setShowMoveModal}
        dealId={deal?.id}
        dealName={deal?.name || 'Lead'}
        currentOriginId={deal?.origin_id}
        currentStageName={deal?.crm_stages?.stage_name}
        onSuccess={onStageChange}
      />
      
      {/* Modal Reembolso */}
      <RefundModal
        open={showRefundModal}
        onOpenChange={setShowRefundModal}
        dealId={deal?.id}
        dealName={deal?.name || 'Lead'}
        originId={deal?.origin_id}
        currentCustomFields={deal?.custom_fields || {}}
        onSuccess={onStageChange}
      />
      
      {/* AlertDialog Excluir */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lead</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deal?.name || 'este lead'}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteDeal.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
