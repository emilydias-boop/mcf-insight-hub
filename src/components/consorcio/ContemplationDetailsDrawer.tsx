import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSorteioHistory, useLanceHistory, useMarcarContemplada } from '@/hooks/useContemplacao';
import { ConsorcioCard } from '@/types/consorcio';
import { MOTIVO_CONTEMPLACAO_OPTIONS, getCorChanceLance } from '@/lib/contemplacao';
import { VerificarSorteioModal } from './VerificarSorteioModal';
import { LanceModal } from './LanceModal';
import { format } from 'date-fns';
import { Search, Target, Award } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: ConsorcioCard | null;
}

export function ContemplationDetailsDrawer({ open, onOpenChange, card }: Props) {
  const [sorteioOpen, setSorteioOpen] = useState(false);
  const [lanceOpen, setLanceOpen] = useState(false);
  const [motivoManual, setMotivoManual] = useState('');

  const { data: sorteios = [] } = useSorteioHistory(card?.id || null);
  const { data: lances = [] } = useLanceHistory(card?.id || null);
  const marcarMutation = useMarcarContemplada();

  if (!card) return null;

  const displayName = card.tipo_pessoa === 'pf' ? card.nome_completo : card.razao_social;
  const isContemplada = !!card.motivo_contemplacao;

  const statusBadge = () => {
    if (!card.motivo_contemplacao) return <Badge variant="outline">Não contemplada</Badge>;
    if (card.motivo_contemplacao === 'sorteio') return <Badge className="bg-green-600">Contemplada por sorteio</Badge>;
    if (card.motivo_contemplacao === 'lance') return <Badge className="bg-blue-600">Contemplada por lance</Badge>;
    return <Badge className="bg-purple-600">Contemplada ({card.motivo_contemplacao})</Badge>;
  };

  const handleMarcarManual = async () => {
    if (!motivoManual || !card) return;
    await marcarMutation.mutateAsync({ cardId: card.id, motivo: motivoManual });
    setMotivoManual('');
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalhes da Contemplação</SheetTitle>
          </SheetHeader>

          <div className="space-y-6 mt-4">
            {/* Card data */}
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-base">{displayName}</p>
              <p className="text-muted-foreground">
                Grupo {card.grupo} • Cota {card.cota} • R$ {Number(card.valor_credito).toLocaleString('pt-BR')}
              </p>
              <p className="text-muted-foreground">
                Tipo: {card.tipo_produto} • Responsável: {card.vendedor_name || '-'}
              </p>
            </div>

            {/* Status */}
            <div className="flex items-center gap-2">
              {statusBadge()}
              {card.data_contemplacao && (
                <span className="text-xs text-muted-foreground">
                  em {format(new Date(card.data_contemplacao), 'dd/MM/yyyy')}
                </span>
              )}
            </div>

            {/* Quick actions */}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setSorteioOpen(true)}>
                <Search className="h-4 w-4 mr-1" /> Verificar Sorteio
              </Button>
              <Button size="sm" variant="outline" onClick={() => setLanceOpen(true)}>
                <Target className="h-4 w-4 mr-1" /> Registrar Lance
              </Button>
            </div>

            {!isContemplada && (
              <div className="flex items-center gap-2 p-3 border rounded-lg">
                <Award className="h-4 w-4 text-muted-foreground" />
                <Select value={motivoManual} onValueChange={setMotivoManual}>
                  <SelectTrigger className="flex-1 h-8">
                    <SelectValue placeholder="Marcar como contemplada..." />
                  </SelectTrigger>
                  <SelectContent>
                    {MOTIVO_CONTEMPLACAO_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" disabled={!motivoManual || marcarMutation.isPending} onClick={handleMarcarManual}>
                  Confirmar
                </Button>
              </div>
            )}

            {/* Sorteio history */}
            <div>
              <h3 className="font-semibold text-sm mb-2">Histórico de Sorteios ({sorteios.length})</h3>
              {sorteios.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma verificação registrada</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Data</TableHead>
                      <TableHead className="text-xs">Nº Sorteado</TableHead>
                      <TableHead className="text-xs">Result.</TableHead>
                      <TableHead className="text-xs">Dist.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorteios.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-xs">{format(new Date(s.data_assembleia), 'dd/MM/yy')}</TableCell>
                        <TableCell className="text-xs font-mono">{s.numero_sorteado}</TableCell>
                        <TableCell>
                          <Badge variant={s.contemplado ? 'default' : 'outline'} className={`text-xs ${s.contemplado ? 'bg-green-600' : ''}`}>
                            {s.contemplado ? '✓' : '✗'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{s.distancia}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Lance history */}
            <div>
              <h3 className="font-semibold text-sm mb-2">Histórico de Lances ({lances.length})</h3>
              {lances.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum lance registrado</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Data</TableHead>
                      <TableHead className="text-xs">%</TableHead>
                      <TableHead className="text-xs">Valor</TableHead>
                      <TableHead className="text-xs">Chance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lances.map((l: any) => (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs">{format(new Date(l.created_at), 'dd/MM/yy')}</TableCell>
                        <TableCell className="text-xs">{Number(l.percentual_lance).toFixed(1)}%</TableCell>
                        <TableCell className="text-xs">R$ {Number(l.valor_lance).toLocaleString('pt-BR')}</TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${getCorChanceLance(l.chance_classificacao)}`}>
                            {l.chance_classificacao}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <VerificarSorteioModal open={sorteioOpen} onOpenChange={setSorteioOpen} card={card} />
      <LanceModal open={lanceOpen} onOpenChange={setLanceOpen} card={card} />
    </>
  );
}
