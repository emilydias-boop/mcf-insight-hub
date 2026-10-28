import { HarveyStageBadge, harveyTagStyle, isHarveyTag } from '@/components/crm/pos-venda/HarveyOrigem';
import { contratoReembolsoInfo } from '@/components/crm/RefundedBadge';
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
  Mail,
  RefreshCw,
  Clock,
  Video,
} from "lucide-react";
import { useTwilio } from "@/contexts/TwilioContext";
import { useDialerEngine } from "@/hooks/useDialerEngine";
import { useSonaxClickToCall } from "@/hooks/useSonaxClickToCall";
import { toast } from "sonner";
import { extractPhoneFromDeal, findPhoneByEmail, normalizePhoneNumber, isValidPhoneNumber } from "@/lib/phoneUtils";
import { LeadSegmentBadge } from "@/components/crm/LeadSegmentBadge";
import { ResgateBadge } from "@/components/crm/ResgateBadge";
import { ActivitySummary } from "@/hooks/useDealActivitySummary";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { OwnerChangeDialog } from "./OwnerChangeDialog";
import { useMyContactsCapabilities } from "@/hooks/useMyContactsCapabilities";
import { SalesChannel, detectSalesChannel } from "@/hooks/useBulkA010Check";
import { cn } from "@/lib/utils";
import { LeadTemperatureDot, type LeadTemperature } from "./LeadTemperatureSelector";
import { AnamneseExternaButton, getAnamneseV2 } from "./AnamneseExternaButton";
import { isPosVendaDeal, precisaVerificarHarvey } from "@/lib/posVenda";
import { diasCalendarioDesde, rotuloContato } from "@/lib/diasCalendario";
import { LeadTotalCompradoBadge } from "./LeadTotalCompradoBadge";
import type { TotaisCliente } from "@/hooks/useTotaisPorCliente";
import { isSemInteresseStageName } from '@/lib/lossReasons';


const NEXT_ACTION_ICONS: Record<string, React.ReactNode> = {
  ligar: <Phone className="h-2.5 w-2.5" />,
  whatsapp: <MessageCircle className="h-2.5 w-2.5" />,
  email: <Mail className="h-2.5 w-2.5" />,
  reuniao: <Video className="h-2.5 w-2.5" />,
};

const CANAL_DOT_CLASSES: Record<string, string> = {
  blue: 'bg-blue-400', teal: 'bg-teal-400', orange: 'bg-orange-400', cyan: 'bg-cyan-400',
  purple: 'bg-purple-400', green: 'bg-green-400', indigo: 'bg-indigo-400', pink: 'bg-pink-400',
  amber: 'bg-amber-400', slate: 'bg-slate-400', zinc: 'bg-zinc-400', gray: 'bg-gray-400',
};
const SALES_CHANNEL_COR: Record<string, string> = { a010: 'blue', bio: 'green', live: 'purple' };

const TAGS_REDUNDANTES = ['a010', 'anamnese', 'planilha', 'lead-lançamento'];
const TAG_ROTULOS: Record<string, string> = {
  'a010 kiwify': 'Kiwify',
  'a010 - construa para vender': 'Construa p/ Vender',
  'anamnese-incompleta': 'Anamnese incompleta',
  'base resgatada': 'Base resgatada',
  'a010 em aberto': 'em aberto',
};
const rotuloTag = (t: string) => TAG_ROTULOS[t.trim().toLowerCase()] ?? t;

const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
export const formatarNomeExibicao = (raw: string): string => {
  let n = (raw || '').split('|')[0];
  n = n.replace(/\s*-\s*A0\d{2}\s*$/i, '').replace(/\s+/g, ' ').trim();
  if (!n) return raw || '';
  const temLetra = /\p{L}/u.test(n);
  if (temLetra && (n === n.toUpperCase() || n === n.toLowerCase())) {
    n = n.toLowerCase().split(' ').map((w, i) =>
      i > 0 && PARTICULAS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)
    ).join(' ');
  }
  return n;
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
  canalEntradaRotulo?: string | null;
  canalEntradaCor?: string | null;
  outsideInfo?: { isOutside: boolean; productName: string | null };
  totaisCliente?: TotaisCliente | null;
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
  canalEntradaRotulo,
  canalEntradaCor,
  outsideInfo,
  totaisCliente,
}: DealKanbanCardProps) => {
  const { makeCall, isTestPipeline, deviceStatus, initializeDevice } = useTwilio();
  const { data: dialer } = useDialerEngine();
  const { mutate: sonaxCall } = useSonaxClickToCall();
  const { role } = useAuth();
  const isTestDeal = isTestPipeline(deal.origin_id);
  const [isSearchingPhone, setIsSearchingPhone] = useState(false);
  const [ownerDialogOpen, setOwnerDialogOpen] = useState(false);
  
  // Admin/manager/coordenador sempre podem; SDR/Closer com flag can_transfer_leads também.
  const { canTransferLeads } = useMyContactsCapabilities();
  const canChangeOwner =
    role === 'admin' || role === 'manager' || role === 'coordenador' || canTransferLeads;
  
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

  const canalEntradaColorClasses: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-700',
    teal: 'bg-teal-100 text-teal-700 border-teal-300 dark:bg-teal-950 dark:text-teal-400 dark:border-teal-700',
    orange: 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-700',
    cyan: 'bg-cyan-100 text-cyan-700 border-cyan-300 dark:bg-cyan-950 dark:text-cyan-400 dark:border-cyan-700',
    purple: 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-700',
    green: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-400 dark:border-green-700',
    indigo: 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-400 dark:border-indigo-700',
    pink: 'bg-pink-100 text-pink-700 border-pink-300 dark:bg-pink-950 dark:text-pink-400 dark:border-pink-700',
    amber: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-700',
    slate: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-950 dark:text-slate-400 dark:border-slate-700',
    zinc: 'bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-950 dark:text-zinc-400 dark:border-zinc-700',
    gray: 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-950 dark:text-gray-400 dark:border-gray-700',
  };
  const canalEntradaCorNormalizada = canalEntradaCor?.trim().toLowerCase() || 'gray';
  const channelBadge = canalEntradaRotulo?.trim()
    ? {
        label: canalEntradaRotulo.trim(),
        className: canalEntradaColorClasses[canalEntradaCorNormalizada] || canalEntradaColorClasses.gray,
      }
    : getChannelBadge();

  // Formatar mês de entrada: Jan/26, Fev/26, etc.
  const getEntryMonth = (createdAt: string) => {
    if (!createdAt) return null;
    const date = new Date(createdAt);
    const month = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    const year = date.getFullYear().toString().slice(-2);
    return `${month.toLowerCase()}/${year}`;
  };
  const entryMonth = getEntryMonth(deal.created_at);

  // Prioridade baseada em tags
  const getPriorityInfo = () => {
    const tags = deal.tags || [];
    const tagNames = tags.map((t: any) => (typeof t === "string" ? t : t.name)?.toLowerCase() || "");

    if (tagNames.some((t: string) => t.includes("quente") || t.includes("hot"))) {
      return "quente" as const;
    }
    if (tagNames.some((t: string) => t.includes("morno") || t.includes("warm"))) {
      return "morno" as const;
    }
    if (tagNames.some((t: string) => t.includes("frio") || t.includes("cold"))) {
      return "frio" as const;
    }
    return null;
  };

  const priority = getPriorityInfo();
  const isRescheduled = (deal.custom_fields as Record<string, unknown>)?.is_rescheduled === true;
  const anamneseExterna = getAnamneseV2(deal);


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

    // Motor de discagem por usuário: SDRs migrados seguem no Sonax, o resto (inclui closers) no Twilio.
    if (dialer?.engine === 'sonax') {
      sonaxCall({ numero: normalizedPhone, dealId: deal.id });
      return;
    }

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
  const stageTimeShort = deal.stage_moved_at ? getShortTimeAgo(deal.stage_moved_at) : null;
  const totalCalls = activitySummary?.totalCalls || 0;
  const maxAttempts = activitySummary?.maxAttempts || 5;
  const displayPhone = contactPhone || extractPhoneFromDeal(deal, contact);

  const cf = (deal.custom_fields ?? null) as Record<string, unknown> | null;
  const displayName = formatarNomeExibicao(contactName || deal.name || '');
  const temperatura = ((deal.lead_temperature ?? priority) ?? null) as LeadTemperature;

  // Linha 2: canal + tags úteis + mês
  const canalLabel = channelBadge.label;
  const canalDotClass = canalEntradaRotulo?.trim()
    ? (CANAL_DOT_CLASSES[canalEntradaCorNormalizada] || CANAL_DOT_CLASSES.gray)
    : (CANAL_DOT_CLASSES[SALES_CHANNEL_COR[salesChannel] || 'purple']);
  const primaryTag = (cf?.primary_tag as string | undefined)?.trim() || null;
  const todasTags: string[] = [];
  if (primaryTag) todasTags.push(primaryTag);
  for (const t of deal.tags || []) {
    const name = (typeof t === 'string' ? t : t?.name)?.trim();
    if (!name || isHarveyTag(name)) continue;
    if (todasTags.some((x) => x.toLowerCase() === name.toLowerCase())) continue;
    todasTags.push(name);
  }
  const visiveis: string[] = [];
  const escondidas: string[] = [];
  for (const t of todasTags) {
    const low = t.toLowerCase();
    if (TAGS_REDUNDANTES.includes(low)) continue;
    if (low === 'base clint' || low.includes('disparo') || low.includes('tentativa') || low === canalLabel.toLowerCase()) {
      escondidas.push(t);
      continue;
    }
    if (visiveis.length < 2) visiveis.push(rotuloTag(t));
    else escondidas.push(t);
  }
  const harveyTags = (deal.tags || []).filter((tag: any) => {
    const name = typeof tag === 'string' ? tag : tag?.name;
    return isHarveyTag(name) && !cf?.stage_harvey;
  });

  // Próxima ação
  const proximaAcao = deal.next_action_type && deal.next_action_date ? (() => {
    const nextDate = new Date(deal.next_action_date);
    return { overdue: nextDate < new Date(), text: format(nextDate, "dd/MM HH:mm", { locale: ptBR }) };
  })() : null;

  // Status
  const contratoInfo = contratoReembolsoInfo(cf as any);
  const temReembolso = !!(cf?.reembolso_solicitado || contratoInfo);
  const motivoSemInteresse = (() => {
    const motivo = String(cf?.motivo_sem_interesse ?? '').trim();
    if (!motivo || !isSemInteresseStageName(deal.crm_stages?.stage_name)) return null;
    if (motivo.toLowerCase() === 'reembolso') return null;
    const justificativa = String(cf?.justificativa_perda ?? '').trim();
    return { motivo, title: justificativa ? `${motivo} — ${justificativa}` : motivo };
  })();
  const verificarHarvey = isPosVendaDeal(deal) && precisaVerificarHarvey(deal);
  const adm = (cf as any)?.admissao;
  const temAdm = !!adm && typeof adm === 'object';
  const temHarveyStage = !!cf?.stage_harvey;
  const temTotais = !!totaisCliente;
  const temStatus = temReembolso || !!motivoSemInteresse || verificarHarvey || !!anamneseExterna || temAdm ||
    isRescheduled || harveyTags.length > 0 || temHarveyStage || !!deal.resgate_em || temTotais ||
    !!outsideInfo?.isOutside || !!proximaAcao;

  // Sem contato (dias de calendário em São Paulo, mesma regra do banco)
  const ultimoToque = activitySummary?.lastTouchAt ?? activitySummary?.lastContactAttempt ?? null;
  let semContato: { text: string; cls: string } | null = null;
  if (!activitySummary) {
    semContato = null;
  } else if (!ultimoToque && (activitySummary?.totalActivities || 0) === 0) {
    const dias = deal.created_at ? diasCalendarioDesde(deal.created_at) : 0;
    semContato = dias < 1
      ? { text: 'Nunca contatado · novo', cls: 'text-amber-400' }
      : { text: `Nunca contatado · ${dias}d`, cls: 'text-red-400' };
  } else if (ultimoToque) {
    const dias = diasCalendarioDesde(ultimoToque);
    semContato = {
      text: rotuloContato(dias),
      cls: dias <= 1 ? 'text-emerald-400' : dias <= 3 ? 'text-amber-400' : 'text-red-400',
    };
  }

  const tentativas = (() => {
    if (activitySummary?.attemptsExhausted) {
      return <span className="text-destructive font-medium">{totalCalls} lig. · esgotado</span>;
    }
    if (totalCalls > maxAttempts) return <span className="text-muted-foreground">{totalCalls} lig.</span>;
    return (
      <span className="flex items-center gap-1 text-muted-foreground">
        <span className="flex items-center gap-[3px]">
          {Array.from({ length: maxAttempts }).map((_, i) => (
            <span key={i} className={cn("h-1.5 w-1.5 rounded-full", i < totalCalls ? "bg-zinc-200" : "bg-zinc-700")} />
          ))}
        </span>
        {totalCalls}/{maxAttempts}
      </span>
    );
  })();

  return (
    <TooltipProvider>
      <Tooltip delayDuration={400}>
        <TooltipTrigger asChild>
          <Card
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      className={cn(
        "group relative cursor-pointer rounded-lg hover:shadow-md hover:border-zinc-600 transition-[box-shadow,border-color]",
        isDragging && "shadow-lg ring-2 ring-primary",
        isSelected && "ring-2 ring-primary bg-primary/5",
      )}
      onClick={onClick}
    >
      {/* Ações rápidas */}
      <div className="absolute right-2 top-2 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
        <button
          type="button"
          aria-label="Ligar"
          onClick={handleCall}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md border bg-card transition-colors",
            isTestDeal ? "text-green-500 hover:text-green-400" : "text-muted-foreground hover:text-primary",
          )}
        >
          {isSearchingPhone ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Phone className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          aria-label="WhatsApp"
          onClick={handleWhatsApp}
          className="flex h-7 w-7 items-center justify-center rounded-md border bg-card text-muted-foreground hover:text-green-500 transition-colors"
        >
          <MessageCircle className="h-3.5 w-3.5" />
        </button>
      </div>

      <CardContent className="p-3 space-y-2">
        {/* Linha 1: quem é */}
        <div className="flex items-center gap-1.5 min-w-0">
          {selectionMode && (
            <div onClick={handleCheckboxChange} className="mr-0.5">
              <Checkbox checked={isSelected} className="data-[state=checked]:bg-primary" />
            </div>
          )}
          <LeadTemperatureDot value={temperatura} />
          <span className="text-[15px] font-semibold leading-5 truncate min-w-0 flex-1" title={contactName || deal.name}>
            {displayName}
          </span>
          <LeadSegmentBadge segment={deal.icp_segment} className="text-[10px] px-1.5 py-0 shrink-0" />
        </div>

        {/* Linha 2: de onde veio */}
        <div className="flex items-center gap-1.5 text-xs min-w-0">
          <span className={cn("h-[7px] w-[7px] shrink-0 rounded-[2px]", canalDotClass)} />
          <span className="truncate min-w-0">
            <span className="text-foreground/80">{canalLabel}</span>
            <span className="text-muted-foreground">
              {visiveis.length > 0 && ` · ${visiveis.join(' · ')}`}
              {entryMonth && ` · ${entryMonth}`}
            </span>
          </span>
          {escondidas.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="shrink-0 rounded border border-border px-1 text-[11px] leading-4 text-muted-foreground">
                  +{escondidas.length}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-xs">
                {todasTags.join(', ')}
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Linha 3: status */}
        {temStatus && (
          <div className="flex items-center gap-1 flex-wrap empty:hidden">
            {temReembolso && (
              <Badge
                variant="outline"
                title={contratoInfo?.tooltip}
                className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-400 dark:border-red-700"
              >
                Reembolso
              </Badge>
            )}
            {motivoSemInteresse && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 max-w-[140px] truncate bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700"
                title={motivoSemInteresse.title}
              >
                {motivoSemInteresse.motivo}
              </Badge>
            )}
            {verificarHarvey && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-destructive/40 text-destructive" title="A ficha de anamnese ainda não chegou. Verifique o cadastro do cliente no HARVEY.">
                Verificar anamnese no HARVEY
              </Badge>
            )}
            {anamneseExterna && (
              <AnamneseExternaButton anamnese={anamneseExterna} clienteNome={deal.name} />
            )}
            {temAdm && (() => {
              const linhas = [
                adm.nota ? `Nota: ${adm.nota}` : null,
                adm.projeto_status_descricao || adm.projeto_status ? `Projeto: ${adm.projeto_status_descricao || adm.projeto_status}` : null,
                adm.credito_os?.numero ? `OS de crédito: ${adm.credito_os.numero}` : null,
                adm.venda?.produto ? `Venda: ${adm.venda.produto}` : null,
                adm.registrado_por?.nome ? `Registrado por: ${adm.registrado_por.nome}` : null,
                adm.gerente?.nome ? `Gerente: ${adm.gerente.nome}` : null,
              ].filter(Boolean).join('\n');
              return (
                <div className="w-full space-y-0.5">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0" title={linhas}>
                    Admissão{adm.projeto_status_descricao ? ` · ${adm.projeto_status_descricao}` : ''}
                  </Badge>
                  {adm.nota && (
                    <p className="text-[11px] text-muted-foreground line-clamp-2" title={adm.nota}>
                      {adm.nota}
                    </p>
                  )}
                </div>
              );
            })()}
            {isRescheduled && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-700 gap-0.5"
              >
                <RefreshCw className="h-2.5 w-2.5" />
                Remarcado
              </Badge>
            )}
            {harveyTags.map((tag: any, idx: number) => (
              <Badge key={idx} variant="secondary" className="text-[10px] px-1.5 py-0" style={harveyTagStyle}>
                {typeof tag === 'string' ? tag : tag.name}
              </Badge>
            ))}
            <HarveyStageBadge customFields={cf} />
            <ResgateBadge resgateEm={deal.resgate_em} />
            <LeadTotalCompradoBadge totais={totaisCliente} />
            {outsideInfo?.isOutside && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 font-semibold bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-700 gap-0.5"
                  >
                    $ Outside
                  </Badge>
                </TooltipTrigger>
                {outsideInfo.productName && (
                  <TooltipContent side="top" className="text-xs">
                    {outsideInfo.productName}
                  </TooltipContent>
                )}
              </Tooltip>
            )}
            {proximaAcao && (proximaAcao.overdue ? (
              <span className="flex items-center gap-1 text-[12px] font-medium text-amber-400">
                <Clock className="h-3 w-3" />
                Retorno vencido · {proximaAcao.text}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {NEXT_ACTION_ICONS[deal.next_action_type] || <Phone className="h-2.5 w-2.5" />}
                Próx.: {proximaAcao.text}
              </span>
            ))}
          </div>
        )}

        {/* Rodapé */}
        <div className="flex items-center gap-2 text-xs border-t border-border/50 pt-2">
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
            <TooltipContent side="top" className="text-xs">
              {deal.owner_id || 'Sem responsável'}
              {canChangeOwner && <div className="text-muted-foreground">Clique para transferir lead</div>}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>{tentativas}</TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Tentativas de ligação</TooltipContent>
          </Tooltip>

          <span className="flex-1" />

          {semContato && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn("font-medium whitespace-nowrap", semContato.cls)}>{semContato.text}</span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs space-y-0.5">
                <div>{ultimoToque ? `Último contato: ${format(new Date(ultimoToque), "dd/MM HH:mm")}` : 'Nunca contatado'}</div>
                {stageTimeShort && <div>Na etapa há {stageTimeShort}</div>}
                {timeAgoShort && <div>Lead criado há {timeAgoShort}</div>}
              </TooltipContent>
            </Tooltip>
          )}
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