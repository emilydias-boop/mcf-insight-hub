import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, CreditCard, Calendar, TrendingUp, Trophy } from 'lucide-react';
import { format } from 'date-fns';
import { parseDateWithoutTimezone } from '@/lib/dateHelpers';
import { GrupoSaudeItem } from '@/hooks/useGruposSaude';
import { cn } from '@/lib/utils';

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
}

const statusStyles: Record<GrupoSaudeItem['status'], { label: string; cls: string }> = {
  verde: { label: 'Saudável', cls: 'bg-green-500/15 text-green-600 border-green-500/30' },
  amarelo: { label: 'Atenção', cls: 'bg-yellow-500/15 text-yellow-700 border-yellow-500/30' },
  cinza: { label: 'Sem dados', cls: 'bg-muted text-muted-foreground border-border' },
};

interface Props {
  item: GrupoSaudeItem;
  onClick: () => void;
}

export function GrupoCard({ item, onClick }: Props) {
  const s = statusStyles[item.status];
  return (
    <Card
      onClick={onClick}
      className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Grupo</p>
            <p className="text-2xl font-bold">{item.grupo}</p>
          </div>
          <Badge variant="outline" className={cn('text-xs', s.cls)}>
            {s.label}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>{item.qtd_cotas} cota{item.qtd_cotas !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Trophy className="h-3.5 w-3.5" />
            <span>{item.qtd_contempladas} contemplada{item.qtd_contempladas !== 1 ? 's' : ''}</span>
          </div>
          <div className="col-span-2 flex items-center gap-1.5 text-muted-foreground">
            <CreditCard className="h-3.5 w-3.5" />
            <span>{formatCurrency(item.valor_credito_total)}</span>
          </div>
        </div>

        <div className="border-t pt-2 space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Vagas estimadas
            </span>
            <span className="font-semibold">{item.vagas_estimadas}/assembleia</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Última assembleia
            </span>
            <span className="font-medium">
              {item.ultima_assembleia
                ? format(parseDateWithoutTimezone(item.ultima_assembleia), 'dd/MM/yyyy')
                : '—'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}