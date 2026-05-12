import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SimpleChannel } from '@/lib/r2ChannelClassify';
import { useActiveR2SpecialMarkings } from '@/hooks/useR2SpecialMarkings';
import { matchR2SpecialMarking } from '@/types/r2SpecialMarking';

interface R2LeadBadgesProps {
  channel: SimpleChannel | null | undefined;
  r1CloserName?: string | null;
  isContractPaid?: boolean;
  scheduledAt?: string | Date | null;
  size?: 'xs' | 'sm';
  /** Esconde o chip de canal "Outro" (quando o usuário só quer ver A010/ANAMNESE). */
  hideOutro?: boolean;
  className?: string;
}

const CHANNEL_STYLE: Record<SimpleChannel, { label: string; cls: string; emoji: string }> = {
  A010: {
    label: 'A010',
    emoji: '🟣',
    cls: 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30',
  },
  ANAMNESE: {
    label: 'ANAMNESE',
    emoji: '🩺',
    cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  },
  Outro: {
    label: 'Outro',
    emoji: '•',
    cls: 'bg-muted text-muted-foreground border-border',
  },
};

export function R2LeadBadges({
  channel,
  r1CloserName,
  isContractPaid = false,
  scheduledAt,
  size = 'xs',
  hideOutro = false,
  className,
}: R2LeadBadgesProps) {
  const { data: rules = [] } = useActiveR2SpecialMarkings();

  const matched = matchR2SpecialMarking(rules, {
    channel: channel || null,
    r1CloserName: r1CloserName || null,
    isContractPaid,
    referenceDate: scheduledAt || null,
  });

  const showChannel = !!channel && !(hideOutro && channel === 'Outro');
  if (!showChannel && !matched) return null;

  const sizeCls = size === 'xs'
    ? 'h-5 px-1.5 text-[10px] gap-1'
    : 'h-6 px-2 text-xs gap-1';

  return (
    <span className={cn('inline-flex items-center gap-1 flex-wrap', className)}>
      {showChannel && channel && (
        <Badge
          variant="outline"
          className={cn(sizeCls, 'font-medium border', CHANNEL_STYLE[channel].cls)}
        >
          <span aria-hidden>{CHANNEL_STYLE[channel].emoji}</span>
          {CHANNEL_STYLE[channel].label}
        </Badge>
      )}
      {matched && (
        <Badge
          variant="outline"
          className={cn(sizeCls, 'font-medium border')}
          style={{
            backgroundColor: matched.bg_color,
            color: matched.text_color,
            borderColor: matched.bg_color,
          }}
          title={matched.name}
        >
          <span aria-hidden>{matched.icon}</span>
          {matched.badge_label}
        </Badge>
      )}
    </span>
  );
}