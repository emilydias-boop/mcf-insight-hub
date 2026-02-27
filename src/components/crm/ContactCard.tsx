import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, User, AlertTriangle, Clock, Copy } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { EnrichedContact, ThermalStatus } from '@/hooks/useContactsEnriched';

interface ContactCardProps {
  contact: EnrichedContact;
  onClick: (id: string) => void;
}

const thermalConfig: Record<ThermalStatus, { label: string; borderClass: string; badgeClass: string }> = {
  quente: {
    label: 'Quente',
    borderClass: 'border-l-4 border-l-green-500',
    badgeClass: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30',
  },
  morno: {
    label: 'Morno',
    borderClass: 'border-l-4 border-l-yellow-500',
    badgeClass: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
  },
  frio: {
    label: 'Frio',
    borderClass: 'border-l-4 border-l-orange-500',
    badgeClass: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30',
  },
  perdido: {
    label: 'Perdido',
    borderClass: 'border-l-4 border-l-destructive',
    badgeClass: 'bg-destructive/15 text-destructive border-destructive/30',
  },
  sem_deal: {
    label: 'Sem deal',
    borderClass: 'border-l-4 border-l-muted',
    badgeClass: 'bg-muted text-muted-foreground border-border',
  },
};

const activityTypeLabels: Record<string, string> = {
  stage_change: 'Mov. etapa',
  stage_changed: 'Mov. etapa',
  note: 'Nota',
  call: 'Ligação',
  email: 'Email',
  whatsapp: 'WhatsApp',
  meeting: 'Reunião',
  task: 'Tarefa',
};

export const ContactCard = ({ contact, onClick }: ContactCardProps) => {
  const thermal = thermalConfig[contact.thermalStatus];
  const isStale = contact.daysSinceActivity !== null && contact.daysSinceActivity > 7;

  return (
    <Card
      className={`bg-card border-border hover:border-primary/50 transition-all cursor-pointer ${thermal.borderClass} ${isStale ? 'opacity-75' : ''}`}
      onClick={() => onClick(contact.id)}
    >
      <CardContent className="p-4">
        {/* Row 1: Name + Thermal badge */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground truncate text-sm">{contact.name}</h3>
              {contact.organization_name && (
                <p className="text-xs text-muted-foreground truncate">{contact.organization_name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {contact.isDuplicate && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5">
                <Copy className="h-3 w-3 mr-0.5" />
                Dup
              </Badge>
            )}
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${thermal.badgeClass}`}>
              {thermal.label}
            </Badge>
          </div>
        </div>

        {/* Row 2: Stage badge (dominant) */}
        {contact.latestDeal?.stage_name && (
          <div className="mb-2">
            <Badge
              className="text-xs font-semibold px-3 py-1"
              style={{
                backgroundColor: contact.latestDeal.stage_color ? `${contact.latestDeal.stage_color}25` : undefined,
                color: contact.latestDeal.stage_color || undefined,
                borderColor: contact.latestDeal.stage_color ? `${contact.latestDeal.stage_color}50` : undefined,
                borderWidth: '1px',
              }}
            >
              {contact.latestDeal.stage_name}
            </Badge>
            {contact.latestDeal.origin_name && (
              <span className="text-[10px] text-muted-foreground ml-2">
                {contact.latestDeal.origin_name}
              </span>
            )}
          </div>
        )}

        {/* Row 3: Contact info (muted) */}
        <div className="flex flex-col gap-0.5 mb-2 text-xs text-muted-foreground">
          {contact.email && (
            <div className="flex items-center gap-1 truncate">
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate">{contact.email}</span>
            </div>
          )}
          {contact.phone && (
            <div className="flex items-center gap-1">
              <Phone className="h-3 w-3 shrink-0" />
              <span>{contact.phone}</span>
            </div>
          )}
        </div>

        {/* Row 4: Operational data grid */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
          {contact.sdrName && (
            <div className="truncate">
              <span className="text-muted-foreground">SDR: </span>
              <span className="text-foreground font-medium">{contact.sdrName.split(' ')[0]}</span>
            </div>
          )}
          {contact.closerName && (
            <div className="truncate">
              <span className="text-muted-foreground">Closer: </span>
              <span className="text-foreground font-medium">{contact.closerName.split(' ')[0]}</span>
            </div>
          )}
          {contact.lastActivity && (
            <div className="truncate">
              <span className="text-muted-foreground">Última: </span>
              <span className="text-foreground">
                {activityTypeLabels[contact.lastActivity.type] || contact.lastActivity.type}{' '}
                {formatDistanceToNow(new Date(contact.lastActivity.date), { addSuffix: true, locale: ptBR })}
              </span>
            </div>
          )}
          {contact.daysSinceActivity !== null && (
            <div className={`flex items-center gap-0.5 ${isStale ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
              {isStale ? <AlertTriangle className="h-3 w-3 shrink-0" /> : <Clock className="h-3 w-3 shrink-0" />}
              <span>{contact.daysSinceActivity}d parado</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
