import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Phone,
  MessageCircle,
  Loader2,
  Flame,
  Thermometer,
  Snowflake,
  Mail,
  RefreshCw,
  Clock,
} from "lucide-react";
import { useTwilio } from "@/contexts/TwilioContext";
import { toast } from "sonner";
import { extractPhoneFromDeal, findPhoneByEmail, normalizePhoneNumber, isValidPhoneNumber } from "@/lib/phoneUtils";
import { ActivitySummary } from "@/hooks/useDealActivitySummary";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { OwnerChangeDialog } from "./OwnerChangeDialog";
import { SalesChannel, detectSalesChannel } from "@/hooks/useBulkA010Check";

// Helper para calcular badge de prioridade de atividade
const getActivityPriorityBadge = (totalActivities: number) => {
  if (totalActivities === 0) {
    return { 
      color: 'bg-red-500', 
      textColor: 'text-white',
      label: '0', 
      tooltip: 'Alta prioridade - sem atividades' 
    };
  }
  if (totalActivities <= 3) {
    return { 
      color: 'bg-yellow-500', 
      textColor: 'text-black',
      label: totalActivities.toString(), 
      tooltip: 'Média prioridade - poucas atividades' 
    };
  }
  return { 
    color: 'bg-green-500', 
    textColor: 'text-white',
    label: totalActivities.toString(), 
    tooltip: 'Baixa prioridade - bastante trabalhado' 
  };
};

interface DealKanbanCardProps {
  deal: any;
  isDragging: boolean;
  provided: any;
  onClick?: () => void;
  activitySummary?: ActivitySummary;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: (dealId: string, selected: boolean) => void;
  salesChannel?: SalesChannel;
  isOutside?: boolean;
}

export const DealKanbanCard = ({ 
  deal, 
  isDragging, 
  provided, 
  onClick, 
  activitySummary,
  selectionMode = false,
  isSelected = false,
  onSelect,
  salesChannel = 'live',
  isOutside = false,
}: DealKanbanCardProps) => {
  const { makeCall, isTestPipeline, deviceStatus, initializeDevice } = useTwilio();
  const { role } = useAuth();
  const isTestDeal = isTestPipeline(deal.origin_id);
  const [isSearchingPhone, setIsSearchingPhone] = useState(false);
  const [ownerDialogOpen, setOwnerDialogOpen] = useState(false);
  
  // Apenas admin, manager e coordenador podem transferir leads
  const canChangeOwner = role === 'admin' || role === 'manager' || role === 'coordenador';
  
  const handleCheckboxChange = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect?.(deal.id, !isSelected);
  };

  // Dados derivados
  const contact = deal.crm_contacts || deal.contact;
  const contactName = contact?.name;
  const contactEmail = contact?.email;
  const contactPhone = contact?.phone;

  // Badge de canal baseado na prop salesChannel
  const getChannelBadge = () => {
    switch (salesChannel) {
      case 'a010':
        return {
          label: 'A010',
          className: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-700'
        };
      case 'bio':
        return {
          label: 'BIO',
          className: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-400 dark:border-green-700'
        };
      case 'live':
      default:
        return {
          label: 'LIVE',
          className: 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-700'
        };
    }
  };
  
  const channelBadge = getChannelBadge();

  // Formatar mês de entrada: Jan/26, Fev/26, etc.
  const getEntryMonth = (createdAt: string) => {
    if (!createdAt) return null;
    const date = new Date(createdAt);
    const month = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    const year = date.getFullYear().toString().slice(-2);
    return `${month.charAt(0).toUpperCase() + month.slice(1)}/${year}`;
  };
  const entryMonth = getEntryMonth(deal.created_at);

  // Prioridade baseada em tags
  const getPriorityInfo = () => {
    const tags = deal.tags || [];
    const tagNames = tags.map((t: any) => (typeof t === "string" ? t : t.name)?.toLowerCase() || "");

    if (tagNames.some((t: string) => t.includes("quente") || t.includes("hot"))) {
      return { icon: <Flame className="h-3 w-3" />, color: "text-red-400" };
    }
    if (tagNames.some((t: string) => t.includes("morno") || t.includes("warm"))) {
      return { icon: <Thermometer className="h-3 w-3" />, color: "text-orange-400" };
    }
    if (tagNames.some((t: string) => t.includes("frio") || t.includes("cold"))) {
      return { icon: <Snowflake className="h-3 w-3" />, color: "text-blue-400" };
    }
    return null;
  };

  const priority = getPriorityInfo();
  const isRescheduled = (deal.custom_fields as Record<string, unknown>)?.is_rescheduled === true;

  const handleCall = async (e: React.MouseEvent) => {
    e.stopPropagation();

    let phone = extractPhoneFromDeal(deal, contact);

    if (!phone && contactEmail) {
      setIsSearchingPhone(true);
      try {
        phone = await findPhoneByEmail(contactEmail);
      } finally {
        setIsSearchingPhone(false);
      }
    }

    if (!phone) {
      toast.error("Contato não possui telefone cadastrado");
      return;
    }

    if (!isValidPhoneNumber(phone)) {
      toast.error("Número de telefone inválido");
      return;
    }

    const normalizedPhone = normalizePhoneNumber(phone);

    // If device is not ready, initialize and wait
    if (deviceStatus !== "ready") {
      toast.info("Inicializando Twilio...");
      const success = await initializeDevice();
      if (!success) {
        toast.error("Erro ao inicializar Twilio");
        return;
      }
    }

    // Now device is ready, make the call
    await makeCall(normalizedPhone, deal.id, deal.contact_id, deal.origin_id);
  };

  const handleWhatsApp = async (e: React.MouseEvent) => {
    e.stopPropagation();

    let phone = extractPhoneFromDeal(deal, contact);

    if (!phone && contactEmail) {
      setIsSearchingPhone(true);
      try {
        phone = await findPhoneByEmail(contactEmail);
      } finally {
        setIsSearchingPhone(false);
      }
    }

    if (!phone) {
      toast.error("Contato não possui telefone cadastrado");
      return;
    }

    const cleanPhone = phone.replace(/\D/g, "");
    const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

    window.open(`https://wa.me/${formattedPhone}`, "_blank");
  };

  const getInitials = (name: string) => {
    if (!name) return "L";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Extrair iniciais do SDR a partir do owner_id (email)
  const getSdrInitials = (ownerId: string | null | undefined) => {
    if (!ownerId) return null;
    
    // Se for email, pegar a parte antes do @
    const emailPart = ownerId.split('@')[0];
    
    // Separar por pontos ou underscores comuns em emails corporativos
    // Ex: "caroline.correa" -> "CC", "joao.silva" -> "JS"
    const parts = emailPart.split(/[._-]/).filter(Boolean);
    
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    
    // Se não tiver separador, pegar primeiras 2 letras
    return emailPart.slice(0, 2).toUpperCase();
  };

  const sdrInitials = getSdrInitials(deal.owner_id);

  // Tempo formatado curto: 89m, 2h, 1d
  const getShortTimeAgo = (date: string) => {
    const now = new Date();
    const past = new Date(date);
    const diffMinutes = Math.floor((now.getTime() - past.getTime()) / 60000);

    if (diffMinutes < 60) return `${diffMinutes}m`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h`;
    return `${Math.floor(diffMinutes / 1440)}d`;
  };

  const timeAgoShort = deal.created_at ? getShortTimeAgo(deal.created_at) : null;
  const totalCalls = activitySummary?.totalCalls || 0;
  const maxAttempts = activitySummary?.maxAttempts || 5;
  const displayPhone = contactPhone || extractPhoneFromDeal(deal, contact);

  // Formatar valor: evitar "R$ 0k" para valores pequenos
  const formatDealValue = (value: number | null | undefined) => {
    if (!value || value <= 0) return null;
    if (value < 1000) return `R$ ${value.toLocaleString('pt-BR')}`;
    if (value < 10000) return `R$ ${(value / 1000).toFixed(1).replace('.', ',')}k`;
    return `R$ ${Math.round(value / 1000)}k`;
  };

  const formattedValue = formatDealValue(deal.value);

  return (
    <TooltipProvider>
      <Tooltip delayDuration={400}>
        <TooltipTrigger asChild>
          <Card
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      className={`cursor-pointer hover:shadow-md transition-shadow ${
        isDragging ? "shadow-lg ring-2 ring-primary" : ""
      } ${activitySummary?.attemptsExhausted ? "border-l-2 border-l-destructive" : ""} ${
        isSelected ? "ring-2 ring-primary bg-primary/5" : ""
      }`}
      onClick={onClick}
    >
      <CardContent className="p-2.5 space-y-1.5">
        {/* Linha 1: Checkbox (modo seleção) + Canal + Mês + Tags + Prioridade */}
        <div className="flex items-center gap-1 flex-wrap">
          {selectionMode && (
            <div onClick={handleCheckboxChange} className="mr-1">
              <Checkbox 
                checked={isSelected} 
                className="data-[state=checked]:bg-primary"
              />
            </div>
          )}
          {/* Badge de Canal de Venda (A010 vs BIO vs LIVE) */}
          <Badge 
            variant="outline" 
            className={`text-[10px] px-1.5 py-0 font-semibold ${channelBadge.className}`}
          >
            {channelBadge.label}
          </Badge>
          
          {/* Badge de Mês de Entrada */}
          {entryMonth && (
            <Badge 
              variant="outline" 
              className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground border-border"
            >
              {entryMonth}
            </Badge>
          )}
          
          {/* Badge de Reembolso (prioridade visual) */}
          {(deal.custom_fields as Record<string, unknown>)?.reembolso_solicitado && (
            <Badge 
              variant="outline" 
              className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-400 dark:border-red-700"
            >
              Reembolso
            </Badge>
          )}
          {isRescheduled && (
            <Badge 
              variant="outline" 
              className="text-[10px] px-1.5 py-0 bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-700 gap-0.5"
            >
              <RefreshCw className="h-2.5 w-2.5" />
              Remarcado
            </Badge>
          )}
          {deal.tags?.slice(0, 1).map((tag: any, idx: number) => (
            <Badge
              key={idx}
              variant="secondary"
              className="text-[10px] px-1.5 py-0"
              style={{ backgroundColor: tag.color || undefined }}
            >
              {typeof tag === "string" ? tag : tag.name}
            </Badge>
          ))}
          {isOutside && (
            <Badge 
              variant="outline" 
              className="text-[10px] px-1.5 py-0 font-semibold bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-700 gap-0.5"
            >
              $ Outside
            </Badge>
          )}
          {priority && <span className={priority.color}>{priority.icon}</span>}
          
          {/* Badge de Prioridade de Atividade */}
          {activitySummary && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  variant="outline"
                  className={`text-[10px] px-1 py-0 ${getActivityPriorityBadge(activitySummary.totalActivities || 0).color} ${getActivityPriorityBadge(activitySummary.totalActivities || 0).textColor} border-0`}
                >
                  {getActivityPriorityBadge(activitySummary.totalActivities || 0).label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {getActivityPriorityBadge(activitySummary.totalActivities || 0).tooltip}
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Linha 2: Nome do Lead */}
        <div className="font-medium text-sm truncate">{contactName || deal.name}</div>

        {/* Linha 3: Barra inferior compacta */}
        <div className="flex items-center justify-between text-xs border-t border-border/50 pt-1.5">
          {/* Lado esquerdo: Avatar + Ações */}
          <div className="flex items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar 
                  className={`h-5 w-5 ${canChangeOwner ? 'cursor-pointer hover:ring-2 hover:ring-primary transition-all' : ''}`}
                  onClick={(e) => {
                    if (canChangeOwner) {
                      e.stopPropagation();
                      setOwnerDialogOpen(true);
                    }
                  }}
                >
                  <AvatarFallback className="text-[9px] bg-primary/20 text-primary">
                    {sdrInitials || getInitials(contactName || deal.name)}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              {canChangeOwner && (
                <TooltipContent side="top" className="text-xs">
                  Clique para transferir lead
                </TooltipContent>
              )}
            </Tooltip>

            {isSearchingPhone ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            ) : (
              <Phone
                className={`h-3.5 w-3.5 cursor-pointer transition-colors ${
                  isTestDeal ? "text-green-500 hover:text-green-400" : "text-muted-foreground hover:text-primary"
                }`}
                onClick={handleCall}
              />
            )}
            <MessageCircle
              className="h-3.5 w-3.5 cursor-pointer text-muted-foreground hover:text-green-500 transition-colors"
              onClick={handleWhatsApp}
            />
            <Mail className="h-3.5 w-3.5 text-muted-foreground/40" />
          </div>

          {/* Lado direito: Valor + Tentativas + Tempo */}
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className={`font-semibold ${formattedValue ? 'text-emerald-500' : 'text-muted-foreground'}`}>
              {formattedValue || 'R$ -'}
            </span>
            <span className={`flex items-center gap-0.5 ${activitySummary?.attemptsExhausted ? "text-destructive" : ""}`}>
              <Phone className="h-2.5 w-2.5" />
              {totalCalls}/{maxAttempts}
            </span>
            {timeAgoShort && <span>{timeAgoShort}</span>}
          </div>
        </div>
      </CardContent>
    </Card>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <div className="space-y-1.5 text-xs">
            <p className="font-medium text-sm">{contactName || deal.name}</p>
            
            {contactEmail && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Mail className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{contactEmail}</span>
              </div>
            )}
            
            {displayPhone && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Phone className="h-3 w-3 flex-shrink-0" />
                <span>{displayPhone}</span>
              </div>
            )}
            
            <div className="flex items-center gap-1.5 text-muted-foreground pt-1 border-t border-border/50">
              <Clock className="h-3 w-3 flex-shrink-0" />
              <span>
                {activitySummary?.lastContactAttempt 
                  ? `Último contato: ${format(new Date(activitySummary.lastContactAttempt), "dd/MM HH:mm")}`
                  : "Sem tentativas de contato"}
              </span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
      
      {/* Dialog de Transferência de Owner */}
      <OwnerChangeDialog
        open={ownerDialogOpen}
        onOpenChange={setOwnerDialogOpen}
        dealId={deal.id}
        dealName={contactName || deal.name}
        currentOwner={deal.owner_id}
      />
    </TooltipProvider>
  );
};