import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import type { DuplicateMatch } from '@/hooks/useConsorcioDuplicateCheck';

function fmtBRL(n?: number | null) {
  if (n == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(n));
}

interface Props {
  matches: DuplicateMatch[];
  isLoading?: boolean;
}

export function DuplicateWarningBanner({ matches, isLoading }: Props) {
  if (isLoading || !matches || matches.length === 0) return null;

  return (
    <Alert variant="destructive" className="border-amber-500/60 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
      <AlertTriangle className="h-4 w-4 !text-amber-600" />
      <AlertTitle className="text-amber-900 dark:text-amber-100">
        Atenção: {matches.length} cadastro{matches.length > 1 ? 's' : ''} similar{matches.length > 1 ? 'es' : ''} encontrado{matches.length > 1 ? 's' : ''}
      </AlertTitle>
      <AlertDescription className="text-amber-900/90 dark:text-amber-100/90">
        <p className="mb-2 text-sm">
          Verifique se esta carta deve mesmo ser cadastrada — o cadastro <strong>não está bloqueado</strong>, é apenas um alerta para evitar duplicidade.
        </p>
        <ul className="space-y-1.5 max-h-40 overflow-auto pr-2">
          {matches.slice(0, 10).map((m) => (
            <li key={`${m.source}:${m.id}`} className="text-xs flex flex-wrap items-center gap-2 border-t border-amber-500/20 pt-1.5 first:border-0 first:pt-0">
              <Badge variant="outline" className="text-[10px] uppercase">
                {m.source === 'card' ? 'Cota cadastrada' : 'Cadastro pendente'}
              </Badge>
              <span className="font-medium">{m.nome || '—'}</span>
              {m.grupo && m.cota && <span className="text-muted-foreground">· Grupo {m.grupo}/{m.cota}</span>}
              {m.valor_credito != null && <span className="text-muted-foreground">· {fmtBRL(m.valor_credito)}</span>}
              {m.status && <span className="text-muted-foreground">· {m.status}</span>}
              <span className="ml-auto flex gap-1">
                {m.matchedFields.map((f) => (
                  <Badge key={f} variant="secondary" className="text-[10px]">{f}</Badge>
                ))}
              </span>
            </li>
          ))}
        </ul>
        {matches.length > 10 && (
          <p className="mt-2 text-xs text-muted-foreground">+ {matches.length - 10} outro(s) registro(s)…</p>
        )}
      </AlertDescription>
    </Alert>
  );
}