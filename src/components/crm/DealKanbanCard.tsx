import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Phone,
  MessageCircle,
  Clock,
  Loader2,
  AlertCircle,
  Calendar,
  User,
  Flame,
  Thermometer,
  Snowflake,
  PhoneCall,
  PhoneMissed,
} from "lucide-react";
import { formatDistanceToNow, format, isToday, isTomorrow, isPast, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTwilio } from "@/contexts/TwilioContext";
import { toast } from "sonner";
import { extractPhoneFromDeal, findPhoneByEmail, normalizePhoneNumber, isValidPhoneNumber } from "@/lib/phoneUtils";
import { ActivitySummary } from "@/hooks/useDealActivitySummary";

interface DealKanbanCardProps {
  deal: any;
  isDragging: boolean;
  provided: any;
  onClick?: () => void;
  activitySummary?: ActivitySummary;
}

// Mapeamento de origens para nomes curtos
const ORIGIN_SHORT_NAMES: Record<string, string> = {
  "PIPELINE INSIDE SALES": "Inside Sales",
  "Twilio – Teste": "Twilio",
  "A010 Hubla": "A010",
  "Meta Ads": "Meta",
  "Google Ads": "Google",
};

// Tipos de ação com ícones
const ACTION_ICONS: Record<string, React.ReactNode> = {
  ligar: <Phone className="h-3 w-3" />,
  whatsapp: <MessageCircle className="h-3 w-3" />,
  email: <span className="text-xs">📧</span>,
  reuniao: <Calendar className="h-3 w-3" />,
};

export const DealKanbanCard = ({ deal, isDragging, provided, onClick, activitySummary }: DealKanbanCardProps) => {
  const { makeCall, isTestPipeline, deviceStatus, initializeDevice } = useTwilio();
  const isTestDeal = isTestPipeline(deal.origin_id);
  const [isSearchingPhone, setIsSearchingPhone] = useState(false);

  // Dados derivados
  const contactName = deal.crm_contacts?.name || deal.contact?.name;
  const contactEmail = deal.crm_contacts?.email || deal.contact?.email;
  const originName = deal.crm_origins?.name || deal.origin?.name || "";
  const shortOrigin = ORIGIN_SHORT_NAMES[originName] || originName.split(" ").slice(0, 2).join(" ");

  // Próxima ação
  const nextActionDate = deal.next_action_date ? parseISO(deal.next_action_date) : null;
  const nextActionType = deal.next_action_type;

  // Prioridade baseada em tags
  const getPriorityInfo = () => {
    const tags = deal.tags || [];
    const tagNames = tags.map((t: any) => (typeof t === "string" ? t : t.name)?.toLowerCase() || "");

    if (tagNames.some((t: string) => t.includes("quente") || t.includes("hot"))) {
      return {
        icon: <Flame className="h-3 w-3" />,
        label: "Quente",
        color: "bg-red-500/20 text-red-400 border-red-500/30",
      };
    }
    if (tagNames.some((t: string) => t.includes("morno") || t.includes("warm"))) {
      return {
        icon: <Thermometer className="h-3 w-3" />,
        label: "Morno",
        color: "bg-orange-500/20 text-orange-400 border-orange-500/30",
      };
    }
    if (tagNames.some((t: string) => t.includes("frio") || t.includes("cold"))) {
      return {
        icon: <Snowflake className="h-3 w-3" />,
        label: "Frio",
        color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      };
    }
    return null;
  };

  const priority = getPriorityInfo();

  // Status da próxima ação
  const getNextActionStatus = () => {
    if (!nextActionDate) return null;

    const daysDiff = Math.floor((Date.now() - nextActionDate.getTime()) / (1000 * 60 * 60 * 24));

    if (isPast(nextActionDate) && !isToday(nextActionDate)) {
      const daysLabel = daysDiff === 1 ? "há 1 dia" : `há ${daysDiff} dias`;
      return { label: `Atrasada ${daysLabel}`, color: "bg-destructive/20 text-destructive", urgent: true, isOverdue: true };
    }
    if (isToday(nextActionDate)) {
      return {
        label: `Próx: hoje às ${format(nextActionDate, "HH:mm")}`,
        color: "bg-yellow-500/20 text-yellow-400",
        urgent: true,
        isOverdue: false,
      };
    }
    if (isTomorrow(nextActionDate)) {
      return {
        label: `Próx: amanhã às ${format(nextActionDate, "HH:mm")}`,
        color: "bg-green-500/20 text-green-400",
        urgent: false,
        isOverdue: false,
      };
    }
    return { label: `Próx: ${format(nextActionDate, "dd/MM")} às ${format(nextActionDate, "HH:mm")}`, color: "bg-muted text-muted-foreground", urgent: false, isOverdue: false };
  };

  const nextActionStatus = getNextActionStatus();

  const handleCall = async (e: React.MouseEvent) => {
    e.stopPropagation();

    let phone = extractPhoneFromDeal(deal);

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

    if (deviceStatus !== "ready") {
      toast.info("Inicializando Twilio...");
      await initializeDevice();
      return;
    }

    await makeCall(normalizedPhone, deal.id, deal.contact_id, deal.origin_id);
  };

  const handleWhatsApp = async (e: React.MouseEvent) => {
    e.stopPropagation();

    let phone = extractPhoneFromDeal(deal);

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
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const timeAgo = deal.updated_at
    ? formatDistanceToNow(new Date(deal.updated_at), { addSuffix: true, locale: ptBR })
    : null;

  return (
    <Card
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      className={`cursor-pointer hover:shadow-md transition-shadow ${
        isDragging ? "shadow-lg ring-2 ring-primary" : ""
      } ${nextActionStatus?.isOverdue ? "border-l-2 border-l-destructive" : nextActionStatus?.urgent ? "border-l-2 border-l-yellow-500" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-2">
        {/* Linha 1: Tags + Origem + Prioridade */}
        <div className="flex flex-wrap gap-1 items-center">
          {deal.tags &&
            deal.tags.slice(0, 2).map((tag: any, idx: number) => (
              <Badge
                key={idx}
                variant="secondary"
                className="text-[10px] px-1.5 py-0"
                style={{ backgroundColor: tag.color || undefined }}
              >
                {typeof tag === "string" ? tag : tag.name}
              </Badge>
            ))}

          {shortOrigin && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">
              {shortOrigin}
            </Badge>
          )}

          {priority && (
            <Badge className={`text-[10px] px-1.5 py-0 flex items-center gap-0.5 ${priority.color}`}>
              {priority.icon}
              {priority.label}
            </Badge>
          )}
        </div>

        {/* Linha 2: Nome do Lead */}
        <div className="font-medium text-sm line-clamp-2">{contactName || deal.name}</div>

        {/* Linha 3: Indicadores de Atividade */}
        {activitySummary && (activitySummary.totalCalls > 0 || activitySummary.whatsappSent > 0) && (
          <div className="flex items-center gap-2 text-xs">
            {activitySummary.totalCalls > 0 && (
              <span 
                className={`flex items-center gap-0.5 ${
                  activitySummary.answeredCalls > 0 ? 'text-green-500' : 'text-muted-foreground'
                }`}
                title={`${activitySummary.answeredCalls} atendidas, ${activitySummary.missedCalls} não atendidas`}
              >
                {activitySummary.answeredCalls > 0 ? (
                  <PhoneCall className="h-3 w-3" />
                ) : (
                  <PhoneMissed className="h-3 w-3" />
                )}
                {activitySummary.totalCalls}
              </span>
            )}
            {activitySummary.whatsappSent > 0 && (
              <span className="flex items-center gap-0.5 text-green-500" title="WhatsApp enviados">
                <MessageCircle className="h-3 w-3" />
                {activitySummary.whatsappSent}
              </span>
            )}
            {activitySummary.attemptsExhausted && (
              <Badge variant="destructive" className="text-[9px] px-1 py-0">
                Tentativas esgotadas
              </Badge>
            )}
          </div>
        )}

        {/* Linha 4: SDR Responsável */}
        {(deal.custom_fields?.deal_user_name || deal.custom_fields?.user_name) && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            <span className="truncate">
              Dono: {deal.custom_fields?.deal_user_name || deal.custom_fields?.user_name}
            </span>
          </div>
        )}

        {/* Linha 4: Próxima ação */}
        {nextActionStatus && (
          <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded ${nextActionStatus.color}`}>
            {nextActionType && ACTION_ICONS[nextActionType]}
            {nextActionStatus.urgent && <AlertCircle className="h-3 w-3" />}
            <span>{nextActionStatus.label}</span>
          </div>
        )}

        {/* Linha 5: Ações + Valor + Tempo */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex gap-0.5">
            <Button
              size="icon"
              variant={isTestDeal ? "default" : "ghost"}
              className={`h-6 w-6 ${isTestDeal ? "bg-green-500 hover:bg-green-600 text-white" : ""}`}
              onClick={handleCall}
              disabled={isSearchingPhone}
              title="Ligar"
            >
              {isSearchingPhone ? <Loader2 className="h-3 w-3 animate-spin" /> : <Phone className="h-3 w-3" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 hover:bg-green-500/20 hover:text-green-500"
              onClick={handleWhatsApp}
              title="WhatsApp"
            >
              <MessageCircle className="h-3 w-3" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-emerald-500">
              {deal.value ? `R$ ${(deal.value / 1000).toFixed(1)}k` : "R$ 0"}
            </span>

            {timeAgo && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                {timeAgo}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
