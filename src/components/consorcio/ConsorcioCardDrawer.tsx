import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { X, Phone, Mail, MapPin, User, Building2, CreditCard, Calendar, Check, Clock, AlertCircle, Trash2, Edit } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useConsorcioCardDetails, usePayInstallment, useDeleteConsorcioCard } from '@/hooks/useConsorcio';
import { STATUS_OPTIONS, ConsorcioInstallment } from '@/types/consorcio';
import { calcularResumoComissoes } from '@/lib/commissionCalculator';
import { ConsorcioCardForm } from './ConsorcioCardForm';

interface ConsorcioCardDrawerProps {
  cardId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function getInitials(name?: string): string {
  if (!name) return '??';
  return name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function ConsorcioCardDrawer({ cardId, open, onOpenChange }: ConsorcioCardDrawerProps) {
  const [editFormOpen, setEditFormOpen] = useState(false);
  const { data: card, isLoading } = useConsorcioCardDetails(cardId);
  const payInstallment = usePayInstallment();
  const deleteCard = useDeleteConsorcioCard();

  if (!cardId) return null;

  const statusConfig = STATUS_OPTIONS.find(s => s.value === card?.status);
  
  const parcelasPagas = card?.installments
    ?.filter(i => i.status === 'pago')
    .map(i => i.numero_parcela) || [];
  
  const resumoComissoes = card
    ? calcularResumoComissoes(
        Number(card.valor_credito),
        card.tipo_produto,
        parcelasPagas
      )
    : { total: 0, recebida: 0, pendente: 0 };

  const handlePayInstallment = async (installment: ConsorcioInstallment) => {
    await payInstallment.mutateAsync({
      installmentId: installment.id,
      dataPagamento: new Date().toISOString().split('T')[0],
    });
  };

  const handleDelete = async () => {
    if (cardId) {
      await deleteCard.mutateAsync(cardId);
      onOpenChange(false);
    }
  };

  const displayName = card?.tipo_pessoa === 'pf' 
    ? card?.nome_completo 
    : card?.razao_social;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[95vh]">
        <DrawerHeader className="border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="text-lg bg-primary/10">
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>
              <div>
                <DrawerTitle className="text-xl">{displayName || 'Sem nome'}</DrawerTitle>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-muted-foreground">
                    Grupo {card?.grupo} - Cota {card?.cota}
                  </span>
                  {statusConfig && (
                    <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                  )}
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DrawerHeader>

        <ScrollArea className="flex-1 p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <span className="text-muted-foreground">Carregando...</span>
            </div>
          ) : card ? (
            <div className="space-y-6">
              {/* Resumo Financeiro */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Resumo Financeiro
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Valor do Crédito</p>
                      <p className="text-xl font-bold">{formatCurrency(Number(card.valor_credito))}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Comissão Total</p>
                      <p className="text-xl font-bold">{formatCurrency(resumoComissoes.total)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Comissão Recebida</p>
                      <p className="text-xl font-bold text-green-600">{formatCurrency(resumoComissoes.recebida)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Comissão Pendente</p>
                      <p className="text-xl font-bold text-orange-600">{formatCurrency(resumoComissoes.pendente)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Tabs defaultValue="parcelas">
                <TabsList className="w-full">
                  <TabsTrigger value="parcelas" className="flex-1">Parcelas</TabsTrigger>
                  <TabsTrigger value="dados" className="flex-1">Dados do Cliente</TabsTrigger>
                  <TabsTrigger value="documentos" className="flex-1">Documentos</TabsTrigger>
                </TabsList>

                {/* Tab: Parcelas */}
                <TabsContent value="parcelas" className="mt-4">
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">#</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Vencimento</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead className="text-right">Comissão</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-24">Ação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {card.installments?.map((installment) => (
                            <TableRow key={installment.id}>
                              <TableCell className="font-medium">{installment.numero_parcela}</TableCell>
                              <TableCell>
                                <Badge variant={installment.tipo === 'empresa' ? 'default' : 'secondary'}>
                                  {installment.tipo === 'empresa' ? 'Empresa' : 'Cliente'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {format(new Date(installment.data_vencimento), 'dd/MM/yyyy')}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(Number(installment.valor_parcela))}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(Number(installment.valor_comissao))}
                              </TableCell>
                              <TableCell>
                                {installment.status === 'pago' ? (
                                  <Badge className="bg-green-500">
                                    <Check className="h-3 w-3 mr-1" />
                                    Pago
                                  </Badge>
                                ) : installment.status === 'atrasado' ? (
                                  <Badge variant="destructive">
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    Atrasado
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">
                                    <Clock className="h-3 w-3 mr-1" />
                                    Pendente
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {installment.status !== 'pago' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handlePayInstallment(installment)}
                                    disabled={payInstallment.isPending}
                                  >
                                    Pagar
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab: Dados do Cliente */}
                <TabsContent value="dados" className="mt-4">
                  <Card>
                    <CardContent className="pt-6">
                      {card.tipo_pessoa === 'pf' ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm text-muted-foreground">Nome</p>
                                <p className="font-medium">{card.nome_completo || '-'}</p>
                              </div>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">CPF</p>
                              <p className="font-medium">{card.cpf || '-'}</p>
                            </div>
                          </div>

                          <Separator />

                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm text-muted-foreground">Telefone</p>
                                <p className="font-medium">{card.telefone || '-'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm text-muted-foreground">Email</p>
                                <p className="font-medium">{card.email || '-'}</p>
                              </div>
                            </div>
                          </div>

                          <Separator />

                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                            <div>
                              <p className="text-sm text-muted-foreground">Endereço</p>
                              <p className="font-medium">
                                {card.endereco_rua ? (
                                  <>
                                    {card.endereco_rua}, {card.endereco_numero}
                                    {card.endereco_complemento && ` - ${card.endereco_complemento}`}
                                    <br />
                                    {card.endereco_bairro} - {card.endereco_cidade}/{card.endereco_estado}
                                    <br />
                                    CEP: {card.endereco_cep}
                                  </>
                                ) : '-'}
                              </p>
                            </div>
                          </div>

                          <Separator />

                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Profissão</p>
                              <p className="font-medium">{card.profissao || '-'}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Renda</p>
                              <p className="font-medium">
                                {card.renda ? formatCurrency(Number(card.renda)) : '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Patrimônio</p>
                              <p className="font-medium">
                                {card.patrimonio ? formatCurrency(Number(card.patrimonio)) : '-'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm text-muted-foreground">Razão Social</p>
                                <p className="font-medium">{card.razao_social || '-'}</p>
                              </div>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">CNPJ</p>
                              <p className="font-medium">{card.cnpj || '-'}</p>
                            </div>
                          </div>

                          <Separator />

                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm text-muted-foreground">Telefone Comercial</p>
                                <p className="font-medium">{card.telefone_comercial || '-'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm text-muted-foreground">Email Comercial</p>
                                <p className="font-medium">{card.email_comercial || '-'}</p>
                              </div>
                            </div>
                          </div>

                          <Separator />

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Faturamento Mensal</p>
                              <p className="font-medium">
                                {card.faturamento_mensal ? formatCurrency(Number(card.faturamento_mensal)) : '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Funcionários</p>
                              <p className="font-medium">{card.num_funcionarios || '-'}</p>
                            </div>
                          </div>

                          {card.partners && card.partners.length > 0 && (
                            <>
                              <Separator />
                              <div>
                                <p className="text-sm text-muted-foreground mb-2">Sócios</p>
                                <div className="space-y-2">
                                  {card.partners.map((partner, idx) => (
                                    <div key={partner.id} className="flex items-center gap-4 p-2 bg-muted/50 rounded">
                                      <span className="font-medium">{idx + 1}.</span>
                                      <span>{partner.nome}</span>
                                      <span className="text-muted-foreground">CPF: {partner.cpf}</span>
                                      {partner.renda && (
                                        <span className="text-muted-foreground">
                                          Renda: {formatCurrency(Number(partner.renda))}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab: Documentos */}
                <TabsContent value="documentos" className="mt-4">
                  <Card>
                    <CardContent className="pt-6">
                      {card.documents && card.documents.length > 0 ? (
                        <div className="space-y-2">
                          {card.documents.map((doc) => (
                            <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div>
                                <p className="font-medium">{doc.nome_arquivo}</p>
                                <p className="text-sm text-muted-foreground capitalize">{doc.tipo}</p>
                              </div>
                              <Button variant="outline" size="sm">
                                Visualizar
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center text-muted-foreground py-8">
                          Nenhum documento anexado
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              {/* Info da Cota */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Informações da Cota
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Data Contratação</p>
                      <p className="font-medium">
                        {format(new Date(card.data_contratacao), 'dd/MM/yyyy')}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Prazo</p>
                      <p className="font-medium">{card.prazo_meses} meses</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Tipo Produto</p>
                      <p className="font-medium capitalize">{card.tipo_produto}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Tipo Contrato</p>
                      <p className="font-medium capitalize">{card.tipo_contrato}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Origem</p>
                      <p className="font-medium capitalize">{card.origem}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Vendedor</p>
                      <p className="font-medium">{card.vendedor_name || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Dia Vencimento</p>
                      <p className="font-medium">Dia {card.dia_vencimento}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex justify-between pt-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir Carta
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir carta?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita. A carta e todas as suas parcelas serão excluídas permanentemente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete}>
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <Button variant="outline" onClick={() => setEditFormOpen(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar Carta
                </Button>
              </div>
            </div>
          ) : null}
        </ScrollArea>
      </DrawerContent>

      {/* Edit Form */}
      <ConsorcioCardForm 
        open={editFormOpen} 
        onOpenChange={setEditFormOpen}
        card={card}
      />
    </Drawer>
  );
}
