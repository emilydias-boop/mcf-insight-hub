import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trophy, Users, CreditCard, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { parseDateWithoutTimezone } from '@/lib/dateHelpers';
import { GrupoSaudeItem } from '@/hooks/useGruposSaude';
import { HistoricoAssembleiaPanel } from '../HistoricoAssembleiaPanel';
import { SaudeGrupoSection } from './SaudeGrupoSection';
import { CalendarioAssembleiasSection } from './CalendarioAssembleiasSection';
import { ResultadoAssembleiaSection } from './ResultadoAssembleiaSection';

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

interface Props {
  item: GrupoSaudeItem | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function GrupoDetailDrawer({ item, open, onOpenChange }: Props) {
  const grupo = item?.grupo || null;

  const { data: cotas = [] } = useQuery({
    queryKey: ['grupo-cotas', grupo],
    enabled: !!grupo,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consortium_cards')
        .select('id, cota, nome_completo, razao_social, valor_credito, status, numero_contemplacao, data_contemplacao')
        .eq('grupo', grupo!)
        .order('cota', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: contemplacoesEmpresa = [] } = useQuery({
    queryKey: ['grupo-contemplacoes-empresa', grupo],
    enabled: !!grupo,
    queryFn: async () => {
      const { data: assems, error: e1 } = await supabase
        .from('consorcio_assembleias_historico' as any)
        .select('id, data_assembleia')
        .eq('grupo', grupo!);
      if (e1) throw e1;
      const ids = (assems || []).map((a: any) => a.id);
      if (ids.length === 0) return [];
      const { data: contemps, error: e2 } = await supabase
        .from('consorcio_assembleia_contemplados' as any)
        .select('assembleia_id, cota, motivo, percentual_lance')
        .in('assembleia_id', ids);
      if (e2) throw e2;
      const cotasEmpresa = new Set((cotas || []).map((c: any) => String(c.cota)));
      const assemMap = new Map<string, string>(
        (assems || []).map((a: any) => [a.id, a.data_assembleia]),
      );
      return ((contemps || []) as any[])
        .filter((c) => cotasEmpresa.has(String(c.cota)))
        .map((c) => ({
          ...c,
          data_assembleia: assemMap.get(c.assembleia_id) || null,
        }))
        .sort((a, b) => (b.data_assembleia || '').localeCompare(a.data_assembleia || ''));
    },
  });

  const totalCredito = useMemo(
    () => (cotas || []).reduce((s: number, c: any) => s + Number(c.valor_credito || 0), 0),
    [cotas],
  );

  if (!item) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Grupo {item.grupo}
            <Badge variant="outline">{item.qtd_cotas} cota(s)</Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Card>
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" /> Cotas
                </div>
                <p className="text-xl font-bold">{item.qtd_cotas}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CreditCard className="h-3 w-3" /> Crédito total
                </div>
                <p className="text-base font-bold">{formatCurrency(totalCredito)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3" /> Vagas estimadas
                </div>
                <p className="text-xl font-bold">{item.vagas_estimadas}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Trophy className="h-3 w-3" /> Contempladas
                </div>
                <p className="text-xl font-bold">{item.qtd_contempladas}</p>
              </CardContent>
            </Card>
          </div>

          {/* Cotas da empresa */}
          <Card>
            <CardContent className="p-0">
              <div className="p-3 border-b">
                <h3 className="font-semibold text-sm">Cotas da empresa neste grupo</h3>
              </div>
              {cotas.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">Nenhuma cota.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cota</TableHead>
                      <TableHead>Consorciado</TableHead>
                      <TableHead className="text-right">Crédito</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Contemplada</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cotas.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.cota}</TableCell>
                        <TableCell className="text-sm">
                          {c.nome_completo || c.razao_social || '—'}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {formatCurrency(Number(c.valor_credito || 0))}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{c.status}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {c.numero_contemplacao ? (
                            <span className="text-green-600 font-medium">
                              #{c.numero_contemplacao}
                              {c.data_contemplacao
                                ? ` · ${format(parseDateWithoutTimezone(c.data_contemplacao), 'dd/MM/yyyy')}`
                                : ''}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Histórico de assembleias (reaproveitado) */}
          {grupo && <HistoricoAssembleiaPanel grupo={grupo} vagasFallback={2} />}

          {/* Saúde do grupo */}
          {grupo && <SaudeGrupoSection grupo={grupo} />}

          {/* Calendário de próximas assembleias */}
          {grupo && <CalendarioAssembleiasSection grupo={grupo} />}

          {/* Resultado da última assembleia */}
          {grupo && <ResultadoAssembleiaSection grupo={grupo} />}

          {/* Contemplações registradas da empresa */}
          <Card>
            <CardContent className="p-0">
              <div className="p-3 border-b">
                <h3 className="font-semibold text-sm">Contemplações da empresa registradas em assembleias</h3>
              </div>
              {contemplacoesEmpresa.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">
                  Nenhuma cota da empresa registrada em assembleias deste grupo.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Cota</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead className="text-right">% Lance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contemplacoesEmpresa.map((c: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">
                          {c.data_assembleia
                            ? format(parseDateWithoutTimezone(c.data_assembleia), 'dd/MM/yyyy')
                            : '—'}
                        </TableCell>
                        <TableCell className="font-medium">{c.cota}</TableCell>
                        <TableCell className="text-sm capitalize">
                          {String(c.motivo).replace('_', ' ')}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {c.percentual_lance != null ? `${c.percentual_lance}%` : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}