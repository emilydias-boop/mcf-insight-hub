import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Phone, MessageCircle, ArrowRight, Loader2 } from 'lucide-react';
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

interface QuickActionsBlockProps {
  deal: any;
  contact: any;
  onStageChange?: () => void;
}

export const QuickActionsBlock = ({ deal, contact, onStageChange }: QuickActionsBlockProps) => {
  const { makeCall, isTestPipeline, deviceStatus, initializeDevice } = useTwilio();
  const updateDeal = useUpdateCRMDeal();
  const { data: stages } = useCRMStages(deal?.origin_id);
  
  const [isSearchingPhone, setIsSearchingPhone] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<string>('');
  
  const isTestDeal = deal ? isTestPipeline(deal.origin_id) : false;
  const currentStageOrder = deal?.crm_stages?.stage_order || 0;
  
  // Filtrar estágios futuros
  const futureStages = stages?.filter(s => s.stage_order > currentStageOrder) || [];
  
  const handleCall = async () => {
    let phone = extractPhoneFromDeal(deal);
    
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
    
    if (deviceStatus !== 'ready') {
      toast.info('Inicializando Twilio...');
      await initializeDevice();
      return;
    }
    
    await makeCall(normalizedPhone, deal?.id, contact?.id, deal?.origin_id);
  };
  
  const handleWhatsApp = () => {
    let phone = extractPhoneFromDeal(deal) || contact?.phone;
    
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
  
  const hasPhone = extractPhoneFromDeal(deal) || contact?.phone;
  
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {/* Botão Ligar */}
        <Button
          className="bg-primary hover:bg-primary/90"
          onClick={handleCall}
          disabled={isSearchingPhone}
        >
          {isSearchingPhone ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Phone className="h-4 w-4 mr-2" />
          )}
          {isTestDeal ? 'Ligar (Teste)' : 'Ligar'}
        </Button>
        
        {/* Botão WhatsApp */}
        <Button
          variant="secondary"
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={handleWhatsApp}
          disabled={!hasPhone}
        >
          <MessageCircle className="h-4 w-4 mr-2" />
          WhatsApp
        </Button>
      </div>
      
      {/* Mover estágio */}
      {futureStages.length > 0 && (
        <div className="flex gap-2">
          <Select value={selectedStageId} onValueChange={setSelectedStageId}>
            <SelectTrigger className="flex-1 bg-background">
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
            variant="outline"
            onClick={handleMoveStage}
            disabled={!selectedStageId || updateDeal.isPending}
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};
