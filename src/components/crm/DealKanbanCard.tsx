import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Phone,
  MessageCircle,
  Loader2,
  Flame,
  Thermometer,
  Snowflake,
  Mail,
  RefreshCw,
} from "lucide-react";
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

export const DealKanbanCard = ({ deal, isDragging, provided, onClick, activitySummary }: DealKanbanCardProps) => {
  const { makeCall, isTestPipeline, deviceStatus, initializeDevice } = useTwilio();
  const isTestDeal = isTestPipeline(deal.origin_id);
  const [isSearchingPhone, setIsSearchingPhone] = useState(false);

  // Dados derivados
  const contact = deal.crm_contacts || deal.contact;
  const contactName = contact?.name;
  const contactEmail = contact?.email;

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

  // Tempo formatado curto: 89m, 2h, 1d
  const getShortTimeAgo = (date: string) => {
    const now = new Date();
    const past = new Date(date);
    const diffMinutes = Math.floor((now.getTime() - past.getTime()) / 60000);

    if (diffMinutes < 60) return `${diffMinutes}m`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h`;
    return `${Math.floor(diffMinutes / 1440)}d`;
  };

  const timeAgoShort = deal.updated_at ? getShortTimeAgo(deal.updated_at) : null;
  const totalCalls = activitySummary?.totalCalls || 0;
  const maxAttempts = activitySummary?.maxAttempts || 5;

  return (
    <Card
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      className={`cursor-pointer hover:shadow-md transition-shadow ${
        isDragging ? "shadow-lg ring-2 ring-primary" : ""
      } ${activitySummary?.attemptsExhausted ? "border-l-2 border-l-destructive" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-2.5 space-y-1.5">
        {/* Linha 1: Tags + Prioridade + Remarcado */}
        <div className="flex items-center gap-1 flex-wrap">
          {isRescheduled && (
            <Badge 
              variant="outline" 
              className="text-[10px] px-1.5 py-0 bg-orange-100 text-orange-700 border-orange-300 gap-0.5"
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
          {priority && <span className={priority.color}>{priority.icon}</span>}
        </div>

        {/* Linha 2: Nome do Lead */}
        <div className="font-medium text-sm truncate">{contactName || deal.name}</div>

        {/* Linha 3: Barra inferior compacta */}
        <div className="flex items-center justify-between text-xs border-t border-border/50 pt-1.5">
          {/* Lado esquerdo: Avatar + Ações */}
          <div className="flex items-center gap-1.5">
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-[9px] bg-primary/20 text-primary">
                {getInitials(contactName || deal.name)}
              </AvatarFallback>
            </Avatar>

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
            <span className="font-semibold text-emerald-500">
              R$ {deal.value ? (deal.value / 1000).toFixed(0) + "k" : "0"}
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
  );
};