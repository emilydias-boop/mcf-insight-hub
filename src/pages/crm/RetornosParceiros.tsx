import { useState } from 'react';
import { usePartnerReturns, useMarkPartnerReturnReviewed, PartnerReturn } from '@/hooks/usePartnerReturns';
import { useAuth } from '@/contexts/AuthContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle, Clock, ShieldAlert, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const sourceLabels: Record<string, string> = {
  hubla_a010: 'Hubla A010',
  clint_deal_created: 'Clint (Deal Criado)',
  clint_stage_changed: 'Clint (Mudança Estágio)',
};

const RetornosParceiros = () => {
  const { data: returns, isLoading } = usePartnerReturns();
  const markReviewed = useMarkPartnerReturnReviewed();
  const { user } = useAuth();
  const [selected, setSelected] = useState<PartnerReturn | null>(null);

  const handleMarkReviewed = (item: PartnerReturn) => {
    if (!user?.id) return;
    markReviewed.mutate(
      { id: item.id, userId: user.id },
      {
        onSuccess: () => {
          toast.success('Marcado como revisado');
          setSelected(null);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <ShieldAlert className="h-6 w-6 text-destructive" />
        <div>
          <h2 className="text-xl font-bold">Retornos de Parceiros</h2>
          <p className="text-sm text-muted-foreground">
            Parceiros que tentaram reentrar no fluxo inicial e foram bloqueados automaticamente.
          </p>
        </div>
        <Badge variant="secondary" className="ml-auto">{returns?.length || 0} registros</Badge>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Parceria</TableHead>
                <TableHead>Origem Retorno</TableHead>
                <TableHead>Produto Novo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!returns || returns.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhum retorno de parceiro registrado.
                  </TableCell>
                </TableRow>
              ) : (
                returns.map((item) => (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelected(item)}
                  >
                    <TableCell className="font-medium">{item.contact_name || '—'}</TableCell>
                    <TableCell className="text-sm">{item.contact_email || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                        {item.partner_product}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{sourceLabels[item.return_source] || item.return_source}</TableCell>
                    <TableCell className="text-sm">{item.return_product || '—'}</TableCell>
                    <TableCell className="text-sm">
                      {item.return_value ? `R$ ${Number(item.return_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {item.reviewed_at ? (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle className="h-3 w-3" /> Revisado
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <Clock className="h-3 w-3" /> Pendente
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Drawer de detalhes */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-destructive" />
                  Retorno de Parceiro
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Nome</p>
                    <p className="font-medium">{selected.contact_name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-medium text-sm">{selected.contact_email || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Produto Parceria</p>
                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 mt-1">
                      {selected.partner_product}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Origem do Retorno</p>
                    <p className="font-medium text-sm">{sourceLabels[selected.return_source] || selected.return_source}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Produto Novo</p>
                    <p className="font-medium text-sm">{selected.return_product || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Valor</p>
                    <p className="font-medium text-sm">
                      {selected.return_value ? `R$ ${Number(selected.return_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Data</p>
                    <p className="font-medium text-sm">
                      {format(new Date(selected.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Bloqueado</p>
                    <p className="font-medium text-sm">{selected.blocked ? 'Sim ✅' : 'Não'}</p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  {selected.reviewed_at ? (
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Revisado em {format(new Date(selected.reviewed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </Badge>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Badge variant="destructive" className="gap-1">
                        <Clock className="h-3 w-3" /> Pendente
                      </Badge>
                      <Button
                        size="sm"
                        onClick={() => handleMarkReviewed(selected)}
                        disabled={markReviewed.isPending}
                      >
                        {markReviewed.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <CheckCircle className="h-4 w-4 mr-1" />
                        )}
                        Marcar como Revisado
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default RetornosParceiros;
