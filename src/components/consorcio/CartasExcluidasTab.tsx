import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Search, Info, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCartasExcluidas, type DeletedProposalLog } from '@/hooks/useConsorcioPostMeeting';

export function CartasExcluidasTab() {
  const { data: logs, isLoading } = useCartasExcluidas();
  const [search, setSearch] = useState('');

  if (isLoading) return <LoadingState />;

  const filtered = (logs || []).filter(l =>
    !search.trim()
      ? true
      : (l.contact_name || '').toLowerCase().includes(search.toLowerCase()),
  );

  const formatCurrency = (v: number | null) =>
    v == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <CardTitle className="text-base">Cartas Excluídas ({filtered.length})</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por contato..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-8"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma carta excluída registrada.
          </p>
        ) : (
          <TooltipProvider delayDuration={100}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contato</TableHead>
                  <TableHead>Closer</TableHead>
                  <TableHead>Valor Crédito</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Excluída em</TableHead>
                  <TableHead>Excluída por</TableHead>
                  <TableHead>Fluxo / Log</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l: DeletedProposalLog) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">
                      {l.contact_name || '—'}
                      {l.had_pending_registration && (
                        <Badge variant="outline" className="ml-2 text-[10px] border-amber-500/50 text-amber-700 dark:text-amber-300">
                          tinha cadastro pendente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{l.closer_name || '—'}</TableCell>
                    <TableCell>{formatCurrency(l.valor_credito)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs capitalize">
                        {l.tipo_produto || '—'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {format(new Date(l.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-sm">
                      {l.deleted_by_name || l.deleted_by_email || '—'}
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Info className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-sm space-y-2">
                          <div className="text-xs">
                            <div><strong>Motivo:</strong> {l.deletion_reason}</div>
                            <div><strong>Usuário:</strong> {l.deleted_by_name || l.deleted_by_email || '—'}</div>
                            <div>
                              <strong>Data/hora:</strong>{' '}
                              {format(new Date(l.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                            </div>
                            <div>
                              <strong>Cadastro pendente vinculado:</strong>{' '}
                              {l.had_pending_registration ? 'Sim (removido junto)' : 'Não'}
                            </div>
                            {l.proposal_created_at && (
                              <div>
                                <strong>Carta criada em:</strong>{' '}
                                {format(new Date(l.proposal_created_at), "dd/MM/yyyy", { locale: ptBR })}
                              </div>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
