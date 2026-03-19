import { StatusChangeEntry } from '@/hooks/useStatusChangeAudit';
import { useR2AuditHistory, getAuditDiff } from '@/hooks/useR2AuditHistory';
import { formatMeetingStatus } from '@/utils/formatMeetingStatus';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, ArrowRight, Calendar, Clock, Link2, User, FileText, History, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  entry: StatusChangeEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StatusChangeDetailDrawer({ entry, open, onOpenChange }: Props) {
  const { data: history = [], isLoading: historyLoading } = useR2AuditHistory(entry?.attendee_id ?? null);

  if (!entry) return null;

  const diffFields = getDiffFromEntry(entry.old_data, entry.new_data);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0">
        <SheetHeader className="p-6 pb-4">
          <SheetTitle className="text-base">Detalhes da Alteração</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-80px)] px-6 pb-6">
          <div className="space-y-5">
            {/* Motivo */}
            <Section icon={<AlertTriangle className="h-4 w-4" />} title="Motivo da Classificação">
              <div className={`rounded-md p-3 text-sm ${entry.is_suspicious ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>
                {entry.suspension_reason}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={entry.is_suspicious ? 'destructive' : 'secondary'} className="text-xs">
                  {formatMeetingStatus(entry.old_status)}
                </Badge>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <Badge variant={entry.is_suspicious ? 'destructive' : 'secondary'} className="text-xs">
                  {formatMeetingStatus(entry.new_status)}
                </Badge>
              </div>
            </Section>

            <Separator />

            {/* Lead */}
            <Section icon={<User className="h-4 w-4" />} title="Dados do Lead">
              <InfoRow label="Nome" value={entry.attendee_name} />
              <InfoRow label="Telefone" value={entry.attendee_phone} />
              <InfoRow label="Perfil" value={entry.lead_profile} />
              <InfoRow label="Deal ID" value={entry.deal_id} mono />
              <InfoRow label="Contact ID" value={entry.contact_id} mono />
            </Section>

            <Separator />

            {/* Reunião */}
            <Section icon={<Calendar className="h-4 w-4" />} title="Dados da Reunião">
              <InfoRow label="Tipo" value={entry.meeting_type === 'r2' ? 'R2' : 'R1'} />
              <InfoRow label="Closer" value={entry.closer_name} />
              <InfoRow label="BU" value={entry.closer_bu} />
              <InfoRow
                label="Data Agendada"
                value={entry.scheduled_at ? format(new Date(entry.scheduled_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : null}
              />
              <InfoRow label="Link" value={entry.meeting_link} />
              <InfoRow label="Vídeo" value={entry.video_status} />
              <InfoRow label="Reagendamento" value={entry.is_reschedule ? 'Sim' : 'Não'} />
            </Section>

            <Separator />

            {/* Observações */}
            <Section icon={<FileText className="h-4 w-4" />} title="Observações">
              <NoteBlock label="Notas do attendee" value={entry.notes} />
              <NoteBlock label="Observações R2" value={entry.r2_observations} />
              <NoteBlock label="Notas do closer" value={entry.closer_notes} />
            </Section>

            <Separator />

            {/* Diff desta mudança */}
            <Section icon={<Eye className="h-4 w-4" />} title="Alterações neste registro">
              {diffFields.length === 0 ? (
                <p className="text-sm text-muted-foreground">Apenas status foi alterado.</p>
              ) : (
                <div className="space-y-1">
                  {diffFields.map((d, i) => (
                    <div key={i} className="text-sm bg-muted rounded px-2 py-1">
                      <span className="font-medium">{d.field}:</span>{' '}
                      <span className="text-muted-foreground line-through">{d.old}</span>{' → '}
                      <span>{d.new_val}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Separator />

            {/* Metadados */}
            <Section icon={<Clock className="h-4 w-4" />} title="Metadados">
              <InfoRow label="Alterado por" value={entry.changed_by_name || 'Sistema'} />
              <InfoRow
                label="Data alteração"
                value={entry.changed_at ? format(new Date(entry.changed_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }) : null}
              />
            </Section>

            <Separator />

            {/* Histórico */}
            <Section icon={<History className="h-4 w-4" />} title="Histórico do Attendee">
              {historyLoading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : history.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum histórico encontrado.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {history.map((log) => {
                    const diffs = getAuditDiff(
                      log.old_data as Record<string, unknown> | null,
                      log.new_data as Record<string, unknown> | null
                    );
                    return (
                      <div key={log.id} className="rounded-md border p-2 text-xs space-y-1">
                        <div className="flex justify-between text-muted-foreground">
                          <span>{log.action}</span>
                          <span>{log.created_at ? format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR }) : ''}</span>
                        </div>
                        {(log as any).user && (
                          <div className="text-muted-foreground">
                            Por: {(log as any).user.name || (log as any).user.email}
                          </div>
                        )}
                        {diffs.length > 0 && (
                          <ul className="list-disc list-inside text-foreground">
                            {diffs.map((d, i) => <li key={i}>{d}</li>)}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2 text-foreground">
        {icon} {title}
      </h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  const display = value && value !== 'undefined' && value !== 'null' && value !== '' ? value : '—';
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-foreground ${mono ? 'font-mono text-xs' : ''}`}>{display}</span>
    </div>
  );
}

function NoteBlock({ label, value }: { label: string; value: string | null | undefined }) {
  const display = value && value !== 'undefined' && value !== 'null' && value !== '' ? value : null;
  if (!display) return null;
  return (
    <div className="text-sm">
      <span className="text-muted-foreground text-xs">{label}:</span>
      <p className="mt-0.5 bg-muted rounded p-2 text-foreground">{display}</p>
    </div>
  );
}

function getDiffFromEntry(
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null
): { field: string; old: string; new_val: string }[] {
  if (!oldData || !newData) return [];
  const diffs: { field: string; old: string; new_val: string }[] = [];
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

  for (const key of allKeys) {
    if (key === 'status') continue; // already shown
    const oldVal = oldData[key];
    const newVal = newData[key];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      diffs.push({
        field: key,
        old: oldVal != null ? String(oldVal) : '(vazio)',
        new_val: newVal != null ? String(newVal) : '(vazio)',
      });
    }
  }
  return diffs;
}
