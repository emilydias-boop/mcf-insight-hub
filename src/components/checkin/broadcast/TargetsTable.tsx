import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { WaBroadcastTarget } from '@/hooks/wa/useWaBroadcasts';
import { motivoLabel, TARGET_STATUS_LABEL } from './waBroadcastLabels';
import { formatDateTime } from '@/lib/formatters';

interface Props {
  targets: WaBroadcastTarget[];
  isLoading: boolean;
  status: string;
  onStatusChange: (v: string) => void;
  /** Total real no banco para o filtro atual; a lista abaixo é paginada. */
  total?: number;
  pageSize?: number;
}

const badgeVariant = (status: string) =>
  status === 'falha' ? 'destructive' : status === 'enviado' ? 'default' : 'secondary';

export function TargetsTable({
  targets,
  isLoading,
  status,
  onStatusChange,
  total,
  pageSize,
}: Props) {
  const truncado = total != null && pageSize != null && total > targets.length;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {total != null ? `${total} alvo(s) no total` : `${targets.length} alvo(s) listado(s)`}
          {truncado && ` · mostrando os ${targets.length} primeiros (lista paginada)`}
        </p>
        <Select value={status} onValueChange={onStatusChange}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(TARGET_STATUS_LABEL).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Detalhe</TableHead>
              <TableHead>Enviado em</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : targets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Nenhum alvo com esse status
                </TableCell>
              </TableRow>
            ) : (
              targets.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.contact_name ?? '—'}</TableCell>
                  <TableCell className="whitespace-nowrap">{t.phone_e164}</TableCell>
                  <TableCell>
                    <Badge variant={badgeVariant(t.status)}>
                      {TARGET_STATUS_LABEL[t.status] ?? t.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[320px] text-sm text-muted-foreground">
                    {t.status === 'falha'
                      ? (t.erro ?? 'Falha sem detalhe')
                      : t.motivo_ignorado
                        ? motivoLabel(t.motivo_ignorado)
                        : '—'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {t.enviado_em ? formatDateTime(t.enviado_em) : '—'}
                  </TableCell>
                  <TableCell>
                    {t.conversation_id && (
                      <Link
                        to={`/checkin?conversa=${t.conversation_id}`}
                        className="text-sm text-primary underline-offset-4 hover:underline"
                      >
                        Ver conversa
                      </Link>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}