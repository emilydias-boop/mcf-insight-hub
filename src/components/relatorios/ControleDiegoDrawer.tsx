import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  MessageCircle,
  User,
  Phone,
  Mail,
  Calendar,
  CheckCircle2,
  Clock,
  Users,
  ClipboardList,
  StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useToggleVideoSent } from "@/hooks/useVideoControl";
import { useLeadJourney } from "@/hooks/useLeadJourney";
import { useA010Journey } from "@/hooks/useA010Journey";
import { useLeadPurchaseHistory } from "@/hooks/useLeadPurchaseHistory";
import { useLeadProfile } from "@/hooks/useLeadProfile";
import { useLeadNotes, NoteType } from "@/hooks/useLeadNotes";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatters";
import type { KanbanRow } from "./ControleDiegoPanel";

interface ControleDiegoDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: KanbanRow | null;
  videoSent: boolean;
  videoNotes: string | null;
}

function formatWhatsAppUrl(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const number = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${number}`;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{children}</h3>;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs font-medium text-right">{value || "-"}</span>
    </div>
  );
}

// === Profile helpers ===
interface FieldDef {
  key: string;
  label: string;
  format?: "currency" | "date" | "boolean" | "json";
}

const PROFILE_CATEGORIES: { title: string; fields: FieldDef[] }[] = [
  {
    title: "Dados Pessoais",
    fields: [
      { key: "nome_completo", label: "Nome Completo" },
      { key: "cpf", label: "CPF" },
      { key: "data_nascimento", label: "Nascimento", format: "date" },
      { key: "estado_civil", label: "Estado Civil" },
      { key: "num_filhos", label: "Filhos" },
      { key: "estado_cidade", label: "Estado/Cidade" },
      { key: "profissao", label: "Profissão" },
      { key: "whatsapp", label: "WhatsApp" },
    ],
  },
  {
    title: "Financeiro",
    fields: [
      { key: "renda_bruta", label: "Renda Bruta", format: "currency" },
      { key: "fonte_renda", label: "Fonte de Renda" },
      { key: "faixa_aporte", label: "Faixa de Aporte", format: "currency" },
      { key: "faixa_aporte_descricao", label: "Aporte (descrição)" },
      { key: "investe", label: "Investe?", format: "boolean" },
      { key: "valor_investido", label: "Valor Investido", format: "currency" },
      { key: "corretora", label: "Corretora" },
      { key: "possui_divida", label: "Possui Dívida?", format: "boolean" },
      { key: "saldo_fgts", label: "Saldo FGTS", format: "currency" },
    ],
  },
  {
    title: "Patrimônio",
    fields: [
      { key: "is_empresario", label: "Empresário?", format: "boolean" },
      { key: "porte_empresa", label: "Porte Empresa" },
      { key: "imovel_financiado", label: "Imóvel Financiado?", format: "boolean" },
      { key: "possui_consorcio", label: "Consórcio?", format: "boolean" },
      { key: "possui_carro", label: "Possui Carro?", format: "boolean" },
      { key: "possui_seguros", label: "Possui Seguros?", format: "boolean" },
      { key: "precisa_capital_giro", label: "Precisa Capital de Giro?", format: "boolean" },
      { key: "valor_capital_giro", label: "Valor Capital de Giro", format: "currency" },
    ],
  },
  {
    title: "Interesse & Objetivos",
    fields: [
      { key: "objetivos_principais", label: "Objetivos", format: "json" },
      { key: "renda_passiva_meta", label: "Meta Renda Passiva", format: "currency" },
      { key: "tempo_independencia", label: "Tempo p/ Independência" },
      { key: "interesse_holding", label: "Interesse em Holding?", format: "boolean" },
      { key: "perfil_indicacao", label: "Perfil de Indicação" },
      { key: "esporte_hobby", label: "Esporte/Hobby" },
      { key: "gosta_futebol", label: "Gosta de Futebol?", format: "boolean" },
      { key: "time_futebol", label: "Time" },
      { key: "bancos", label: "Bancos", format: "json" },
    ],
  },
];

function formatProfileValue(value: unknown, fmt?: string): string {
  if (value === null || value === undefined || value === "") return "";
  if (fmt === "currency") return formatCurrency(Number(value));
  if (fmt === "date") {
    try {
      return format(new Date(String(value)), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return String(value);
    }
  }
  if (fmt === "boolean") return value ? "Sim" : "Não";
  if (fmt === "json") {
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "object") return JSON.stringify(value);
  }
  return String(value);
}

const NOTE_TYPE_CONFIG: Record<NoteType, { label: string; color: string }> = {
  manual: { label: "Manual", color: "bg-muted text-muted-foreground" },
  scheduling: { label: "Agendamento", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  call: { label: "Ligação", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  closer: { label: "Closer", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  r2: { label: "R2", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" },
  qualification: {
    label: "Qualificação",
    color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
};

export function ControleDiegoDrawer({ open, onOpenChange, contract, videoSent, videoNotes }: ControleDiegoDrawerProps) {
  const toggleMutation = useToggleVideoSent();
  const [notes, setNotes] = useState(videoNotes || "");
  const [sent, setSent] = useState(videoSent);

  // Lead journey data
  const { data: journey, isLoading: loadingJourney } = useLeadJourney(contract?.dealId || null);
  const { data: a010, isLoading: loadingA010 } = useA010Journey(contract?.leadEmail, contract?.leadPhone);
  const { data: purchaseHistory, isLoading: loadingPurchases } = useLeadPurchaseHistory(
    contract?.leadEmail,
    contract?.leadPhone,
  );

  // Lead profile (anamnese)
  const { data: profile, isLoading: loadingProfile } = useLeadProfile(
    contract?.contactId || null,
    contract?.dealId || null,
  );

  // Lead notes
  const { data: leadNotes = [], isLoading: loadingNotes } = useLeadNotes(
    contract?.dealId || null,
    contract?.id || null,
  );

  useEffect(() => {
    setSent(videoSent);
    setNotes(videoNotes || "");
  }, [videoSent, videoNotes, contract?.id]);

  if (!contract) return null;

  const handleToggle = async (checked: boolean) => {
    setSent(checked);
    await toggleMutation.mutateAsync({
      attendeeId: contract.id,
      videoSent: checked,
      notes: notes || undefined,
      dealId: contract.dealId || undefined,
    });
  };

  const handleSaveNotes = async () => {
    await toggleMutation.mutateAsync({
      attendeeId: contract.id,
      videoSent: sent,
      notes: notes || undefined,
      dealId: contract.dealId || undefined,
    });
  };

  const formatDate = (d: string | null | undefined) => {
    if (!d) return "-";
    try {
      return format(parseISO(d), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return d;
    }
  };

  const formatDateShort = (d: string | null | undefined) => {
    if (!d) return "-";
    try {
      return format(parseISO(d), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return d;
    }
  };

  // Profile filled fields count
  const profileFilledCount = profile
    ? PROFILE_CATEGORIES.flatMap((c) => c.fields).filter((f) => {
        const v = (profile as any)[f.key];
        return v !== null && v !== undefined && v !== "";
      }).length
    : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[820px] max-w-full p-0 flex flex-col">
        <SheetHeader className="px-4 py-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {contract.leadName}
          </SheetTitle>
          <SheetDescription>Jornada completa do lead, perfil e notas</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4 space-y-4">
          {/* === Dados do Contrato === */}
          <div className="space-y-2">
            <SectionTitle>Dados do Contrato</SectionTitle>
            <div className="rounded-lg border border-border p-3 space-y-1.5">
              <InfoRow label="Closer" value={contract.closerName} />
              <InfoRow label="SDR" value={journey?.sdr?.name || contract.sdrName} />
              <InfoRow label="Data Pgto" value={formatDateShort(contract.date)} />
              <InfoRow
                label="Pipeline"
                value={
                  <Badge variant="outline" className="text-[10px]">
                    {contract.originName}
                  </Badge>
                }
              />
              <InfoRow label="Estágio" value={contract.currentStage} />
              <InfoRow
                label="Canal"
                value={
                  <Badge variant="secondary" className="text-[10px]">
                    {contract.salesChannel}
                  </Badge>
                }
              />
              {contract.isRefunded && (
                <InfoRow
                  label="Status"
                  value={
                    <Badge variant="destructive" className="text-[10px]">
                      Reembolsado
                    </Badge>
                  }
                />
              )}
            </div>
          </div>

          <Separator />

          {/* === Contato === */}
          <div className="space-y-2">
            <SectionTitle>Contato</SectionTitle>
            <div className="rounded-lg border border-border p-3 space-y-2">
              {contract.leadEmail && (
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs">{contract.leadEmail}</span>
                </div>
              )}
              {contract.leadPhone && (
                <>
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-mono">{contract.leadPhone}</span>
                  </div>
                  <Button
                    size="sm"
                    className="w-full bg-green-600 hover:bg-green-700 text-white h-8 text-xs"
                    onClick={() => window.open(formatWhatsAppUrl(contract.leadPhone), "_blank")}
                  >
                    <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                    Enviar vídeo via WhatsApp
                  </Button>
                </>
              )}
            </div>
          </div>

          <Separator />

          {/* === Controle de Vídeo === */}
          <div className="space-y-2">
            <SectionTitle>Controle de Vídeo</SectionTitle>
            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="video-sent"
                  checked={sent}
                  onCheckedChange={(checked) => handleToggle(!!checked)}
                  disabled={toggleMutation.isPending}
                />
                <label htmlFor="video-sent" className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  {sent ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-600" /> Vídeo enviado
                    </>
                  ) : (
                    <>
                      <Clock className="h-4 w-4 text-muted-foreground" /> Pendente de envio
                    </>
                  )}
                </label>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Observação</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observação opcional..."
                  rows={2}
                  className="text-sm"
                />
                <Button size="sm" variant="outline" onClick={handleSaveNotes} disabled={toggleMutation.isPending}>
                  Salvar nota
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          {/* === Perfil do Lead (Anamnese) === */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              <SectionTitle>Perfil do Lead</SectionTitle>
              {profileFilledCount > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  {profileFilledCount} campos
                </Badge>
              )}
            </div>
            {loadingProfile ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : profile && profileFilledCount > 0 ? (
              <div className="space-y-3">
                {PROFILE_CATEGORIES.map((cat) => {
                  const filledFields = cat.fields.filter((f) => {
                    const v = (profile as any)[f.key];
                    return v !== null && v !== undefined && v !== "";
                  });
                  if (filledFields.length === 0) return null;
                  return (
                    <div key={cat.title} className="rounded-lg border border-border bg-card p-3">
                      <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        {cat.title}
                      </h4>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                        {filledFields.map((f) => (
                          <div key={f.key} className="min-w-0">
                            <span className="text-[10px] text-muted-foreground">{f.label}</span>
                            <p className="text-xs text-foreground break-words">
                              {formatProfileValue((profile as any)[f.key], f.format)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {profile.lead_score != null && (
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[10px] text-muted-foreground">Lead Score:</span>
                    <Badge variant="outline" className="text-[10px]">
                      {profile.lead_score}
                    </Badge>
                    {profile.icp_level && (
                      <Badge variant="secondary" className="text-[10px]">
                        {profile.icp_level}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Sem perfil preenchido</p>
            )}
          </div>

          <Separator />

          {/* === Notas do Lead === */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-primary" />
              <SectionTitle>Notas do Lead</SectionTitle>
              {leadNotes.length > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  {leadNotes.length}
                </Badge>
              )}
            </div>
            {loadingNotes ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : leadNotes.length > 0 ? (
              <div className="rounded-lg border border-border divide-y divide-border max-h-[300px] overflow-y-auto">
                {leadNotes.map((note) => {
                  const cfg = NOTE_TYPE_CONFIG[note.type] || NOTE_TYPE_CONFIG.manual;
                  return (
                    <div key={note.id} className="p-3 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-[10px] px-1.5 py-0 ${cfg.color} border-0`}>{cfg.label}</Badge>
                        {note.author && (
                          <span className="text-[10px] text-muted-foreground font-medium">{note.author}</span>
                        )}
                        <span className="text-[10px] text-muted-foreground ml-auto">{formatDate(note.created_at)}</span>
                      </div>
                      <p className="text-xs text-foreground whitespace-pre-wrap break-words">{note.content}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Sem notas registradas</p>
            )}
          </div>

          <Separator />

          {/* === Jornada do Lead === */}
          <div className="space-y-2">
            <SectionTitle>Jornada do Lead</SectionTitle>
            {loadingJourney ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              <div className="rounded-lg border border-border p-3 space-y-3">
                {/* SDR */}
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">SDR:</span>
                  <span className="text-xs font-medium">{journey?.sdr?.name || contract.sdrName}</span>
                </div>

                {/* R1 */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-xs font-medium">R1</span>
                    {journey?.r1Meeting ? (
                      <Badge variant="outline" className="text-[10px]">
                        {journey.r1Meeting.status}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        Sem dados
                      </Badge>
                    )}
                  </div>
                  {journey?.r1Meeting && (
                    <div className="pl-5 space-y-0.5">
                      <p className="text-[11px] text-muted-foreground">
                        Data: {formatDate(journey.r1Meeting.scheduledAt)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Closer: {journey.r1Meeting.closer.name}</p>
                      {journey.r1Meeting.bookedBy && (
                        <p className="text-[11px] text-muted-foreground">
                          Agendado por: {journey.r1Meeting.bookedBy.name}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* R2 */}
                {journey?.r2Meeting && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-purple-500" />
                      <span className="text-xs font-medium">R2</span>
                      <Badge variant="outline" className="text-[10px]">
                        {journey.r2Meeting.status}
                      </Badge>
                    </div>
                    <div className="pl-5 space-y-0.5">
                      <p className="text-[11px] text-muted-foreground">
                        Data: {formatDate(journey.r2Meeting.scheduledAt)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Closer: {journey.r2Meeting.closer.name}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* === A010 === */}
          <div className="space-y-2">
            <SectionTitle>Jornada A010</SectionTitle>
            {loadingA010 ? (
              <Skeleton className="h-4 w-full" />
            ) : a010?.hasA010 ? (
              <div className="rounded-lg border border-border p-3 space-y-1.5">
                <InfoRow label="Compras" value={a010.purchaseCount} />
                <InfoRow label="Total pago" value={`R$ ${a010.totalPaid.toFixed(2)}`} />
                <InfoRow label="Ticket médio" value={`R$ ${a010.averageTicket.toFixed(2)}`} />
                <InfoRow label="1ª compra" value={formatDateShort(a010.firstPurchaseDate)} />
                <InfoRow label="Última" value={formatDateShort(a010.lastPurchaseDate)} />
                <InfoRow
                  label="Fonte"
                  value={
                    <Badge variant="secondary" className="text-[10px]">
                      {a010.source}
                    </Badge>
                  }
                />
                {a010.products.length > 0 && (
                  <div className="pt-1">
                    <p className="text-[10px] text-muted-foreground mb-1">Produtos:</p>
                    <div className="flex flex-wrap gap-1">
                      {a010.products.map((p, i) => (
                        <Badge key={i} variant="outline" className="text-[10px]">
                          {p}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Sem histórico A010</p>
            )}
          </div>

          <Separator />

          {/* === Histórico de Compras === */}
          <div className="space-y-2">
            <SectionTitle>Histórico de Compras</SectionTitle>
            {loadingPurchases ? (
              <Skeleton className="h-4 w-full" />
            ) : purchaseHistory && purchaseHistory.length > 0 ? (
              <div className="rounded-lg border border-border divide-y divide-border">
                {purchaseHistory.map((tx) => (
                  <div key={tx.id} className="p-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{tx.product_name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">{formatDateShort(tx.sale_date)}</span>
                        {tx.source && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            {tx.source}
                          </Badge>
                        )}
                        <Badge
                          variant={tx.sale_status === "completed" ? "default" : "secondary"}
                          className="text-[10px] px-1 py-0"
                        >
                          {tx.sale_status === "completed" ? "Pago" : tx.sale_status}
                        </Badge>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-primary whitespace-nowrap">
                      R$ {tx.product_price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Sem histórico de compras</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
