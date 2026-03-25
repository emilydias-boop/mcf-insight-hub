import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageCircle, User, Phone, Mail, Calendar, Building, CheckCircle2, Clock, DollarSign, Users, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { useToggleVideoSent } from '@/hooks/useVideoControl';
import { useLeadJourney } from '@/hooks/useLeadJourney';
import { useA010Journey } from '@/hooks/useA010Journey';
import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import type { KanbanRow } from './ControleDiegoPanel';

interface ControleDiegoDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: KanbanRow | null;
  videoSent: boolean;
  videoNotes: string | null;
}

function formatWhatsAppUrl(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const number = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${number}`;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{children}</h3>;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs font-medium text-right">{value || '-'}</span>
    </div>
  );
}

export function ControleDiegoDrawer({ open, onOpenChange, contract, videoSent, videoNotes }: ControleDiegoDrawerProps) {
  const toggleMutation = useToggleVideoSent();
  const [notes, setNotes] = useState(videoNotes || '');
  const [sent, setSent] = useState(videoSent);

  // Lead journey data
  const { data: journey, isLoading: loadingJourney } = useLeadJourney(contract?.dealId || null);
  const { data: a010, isLoading: loadingA010 } = useA010Journey(contract?.leadEmail, contract?.leadPhone);

  useEffect(() => {
    setSent(videoSent);
    setNotes(videoNotes || '');
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
    if (!d) return '-';
    try { return format(parseISO(d), 'dd/MM/yyyy HH:mm', { locale: ptBR }); } catch { return d; }
  };

  const formatDateShort = (d: string | null | undefined) => {
    if (!d) return '-';
    try { return format(parseISO(d), 'dd/MM/yyyy', { locale: ptBR }); } catch { return d; }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {contract.leadName}
          </DrawerTitle>
          <DrawerDescription>Jornada completa do lead e controle de vídeo</DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-4 overflow-y-auto">
          {/* === Dados do Contrato === */}
          <div className="space-y-2">
            <SectionTitle>Dados do Contrato</SectionTitle>
            <div className="rounded-lg border p-3 space-y-1.5">
              <InfoRow label="Closer" value={contract.closerName} />
              <InfoRow label="SDR" value={journey?.sdr?.name || contract.sdrName} />
              <InfoRow label="Data Pgto" value={formatDateShort(contract.date)} />
              <InfoRow label="Pipeline" value={<Badge variant="outline" className="text-[10px]">{contract.originName}</Badge>} />
              <InfoRow label="Estágio" value={contract.currentStage} />
              <InfoRow label="Canal" value={<Badge variant="secondary" className="text-[10px]">{contract.salesChannel}</Badge>} />
              {contract.isRefunded && (
                <InfoRow label="Status" value={<Badge variant="destructive" className="text-[10px]">Reembolsado</Badge>} />
              )}
            </div>
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
              <div className="rounded-lg border p-3 space-y-3">
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
                      <Badge variant="outline" className="text-[10px]">{journey.r1Meeting.status}</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Sem dados</Badge>
                    )}
                  </div>
                  {journey?.r1Meeting && (
                    <div className="pl-5 space-y-0.5">
                      <p className="text-[11px] text-muted-foreground">
                        Data: {formatDate(journey.r1Meeting.scheduledAt)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Closer: {journey.r1Meeting.closer.name}
                      </p>
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
                      <Badge variant="outline" className="text-[10px]">{journey.r2Meeting.status}</Badge>
                    </div>
                    <div className="pl-5 space-y-0.5">
                      <p className="text-[11px] text-muted-foreground">
                        Data: {formatDate(journey.r2Meeting.scheduledAt)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Closer: {journey.r2Meeting.closer.name}
                      </p>
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
              <div className="rounded-lg border p-3 space-y-1.5">
                <InfoRow label="Compras" value={a010.purchaseCount} />
                <InfoRow label="Total pago" value={`R$ ${a010.totalPaid.toFixed(2)}`} />
                <InfoRow label="Ticket médio" value={`R$ ${a010.averageTicket.toFixed(2)}`} />
                <InfoRow label="1ª compra" value={formatDateShort(a010.firstPurchaseDate)} />
                <InfoRow label="Última" value={formatDateShort(a010.lastPurchaseDate)} />
                <InfoRow label="Fonte" value={<Badge variant="secondary" className="text-[10px]">{a010.source}</Badge>} />
                {a010.products.length > 0 && (
                  <div className="pt-1">
                    <p className="text-[10px] text-muted-foreground mb-1">Produtos:</p>
                    <div className="flex flex-wrap gap-1">
                      {a010.products.map((p, i) => (
                        <Badge key={i} variant="outline" className="text-[10px]">{p}</Badge>
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

          {/* === Contato === */}
          <div className="space-y-2">
            <SectionTitle>Contato</SectionTitle>
            <div className="rounded-lg border p-3 space-y-2">
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
                    onClick={() => window.open(formatWhatsAppUrl(contract.leadPhone), '_blank')}
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
            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="video-sent"
                  checked={sent}
                  onCheckedChange={(checked) => handleToggle(!!checked)}
                  disabled={toggleMutation.isPending}
                />
                <label htmlFor="video-sent" className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  {sent ? (
                    <><CheckCircle2 className="h-4 w-4 text-green-600" /> Vídeo enviado</>
                  ) : (
                    <><Clock className="h-4 w-4 text-muted-foreground" /> Pendente de envio</>
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
        </div>
      </DrawerContent>
    </Drawer>
  );
}
