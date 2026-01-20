import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Phone, MessageCircle, ArrowRight, Loader2, XCircle } from 'lucide-react';
import { useTwilio } from '@/contexts/TwilioContext';
import { useUpdateCRMDeal, useCRMStages } from '@/hooks/useCRMData';
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
import { MarkAsLostModal } from './MarkAsLostModal';
import { InlineCallControls } from './InlineCallControls';

interface QuickActionsBlockProps {
  deal: any;
  contact: any;
  onStageChange?: () => void;
}

export const QuickActionsBlock = ({ deal, contact, onStageChange }: QuickActionsBlockProps) => {
  const { makeCall, isTestPipeline, deviceStatus, initializeDevice, callStatus, currentCallDealId } = useTwilio();
  const updateDeal = useUpdateCRMDeal();
  const { data: stages } = useCRMStages(deal?.origin_id);
  
  const [isSearchingPhone, setIsSearchingPhone] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<string>('');
  const [showLostModal, setShowLostModal] = useState(false);
  
  const isTestDeal = deal ? isTestPipeline(deal.origin_id) : false;
  const currentStageOrder = deal?.crm_stages?.stage_order || 0;
  
  // Filtrar estágios futuros
  const futureStages = stages?.filter(s => s.stage_order > currentStageOrder) || [];
  
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
        
        {/* Botão Perdido - esconder quando em chamada */}
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
    </>
  );
};
