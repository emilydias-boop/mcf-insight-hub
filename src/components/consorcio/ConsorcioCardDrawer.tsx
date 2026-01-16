import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Phone,
  Mail,
  MapPin,
  User,
  Building2,
  CreditCard,
  Calendar,
  Trash2,
  Edit,
  RefreshCw,
  Wallet,
  FileText,
  Briefcase,
  Heart,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
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
} from "@/components/ui/alert-dialog";
import { useConsorcioCardDetails, usePayInstallment, useDeleteConsorcioCard, useUpdateCardStatus } from "@/hooks/useConsorcio";
import { useRecalculateCommissions } from "@/hooks/useRecalculateCommissions";
import { STATUS_OPTIONS, ESTADO_CIVIL_OPTIONS, ConsorcioInstallment, ConsorcioStatus, MotivoContemplacao } from "@/types/consorcio";
import { calcularResumoComissoes } from "@/lib/commissionCalculator";
import { verificarRiscoCancelamento, deveSerCancelado } from "@/lib/inadimplenciaUtils";
import { ConsorcioCardForm } from "./ConsorcioCardForm";
import { InstallmentsPaginated } from "./InstallmentsPaginated";
import { GroupDetailsCard } from "./GroupDetailsCard";
import { InadimplenciaAlert } from "./InadimplenciaAlert";
import { ContemplationCard } from "./ContemplationCard";
import { StatusEditDropdown } from "./StatusEditDropdown";

interface ConsorcioCardDrawerProps {
  cardId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function getInitials(name?: string): string {
  if (!name) return "??";
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "-";
  try {
    // Parse without timezone to avoid UTC conversion issues
    const [year, month, day] = dateStr.split('-').map(Number);
    return format(new Date(year, month - 1, day), "dd/MM/yyyy");
  } catch {
    return "-";
  }
}

function getEstadoCivilLabel(value?: string | null): string {
  if (!value) return "-";
  const option = ESTADO_CIVIL_OPTIONS.find((o) => o.value === value);
  return option?.label || value;
}

export function ConsorcioCardDrawer({ cardId, open, onOpenChange }: ConsorcioCardDrawerProps) {
  const [editFormOpen, setEditFormOpen] = useState(false);
  const { data: card, isLoading } = useConsorcioCardDetails(cardId);
  const payInstallment = usePayInstallment();
  const deleteCard = useDeleteConsorcioCard();
  const recalculateCommissions = useRecalculateCommissions();
  const updateCardStatus = useUpdateCardStatus();

  // Check inadimplência - must be before useEffect
  const deveCancelar = card?.installments ? deveSerCancelado(card.installments) : false;

  // Auto-cancel if 4+ overdue and still active - useEffect must be before early return
  useEffect(() => {
    if (card && deveCancelar && card.status === 'ativo') {
      updateCardStatus.mutate({ cardId: card.id, status: 'cancelado' });
    }
  }, [card, deveCancelar, updateCardStatus]);

  if (!cardId) return null;

  const statusConfig = STATUS_OPTIONS.find((s) => s.value === card?.status);

  const parcelasPagas = card?.installments?.filter((i) => i.status === "pago").map((i) => i.numero_parcela) || [];

  const resumoComissoes = card
    ? calcularResumoComissoes(Number(card.valor_credito), card.tipo_produto, parcelasPagas)
    : { total: 0, recebida: 0, pendente: 0 };

  // Calculate progress
  const progressoParcelas = card?.installments ? (parcelasPagas.length / card.installments.length) * 100 : 0;
  const progressoComissao = resumoComissoes.total > 0 ? (resumoComissoes.recebida / resumoComissoes.total) * 100 : 0;

  // Check inadimplência
  const inadimplenciaInfo = card?.installments ? verificarRiscoCancelamento(card.installments) : null;

  const handlePayInstallment = async (installment: ConsorcioInstallment) => {
    await payInstallment.mutateAsync({
      installmentId: installment.id,
      dataPagamento: new Date().toISOString().split("T")[0],
    });
  };

  const handleDelete = async () => {
    if (cardId) {
      await deleteCard.mutateAsync(cardId);
      onOpenChange(false);
    }
  };

  const handleRecalculateCommissions = async () => {
    if (cardId) {
      await recalculateCommissions.mutateAsync(cardId);
    }
  };

  const handleStatusChange = async (newStatus: ConsorcioStatus) => {
    if (cardId) {
      await updateCardStatus.mutateAsync({ cardId, status: newStatus });
    }
  };

  const handleContemplar = async (data: {
    numeroContemplacao: string;
    dataContemplacao: string;
    motivoContemplacao: MotivoContemplacao;
    valorLance?: number;
    percentualLance?: number;
  }) => {
    if (cardId) {
      await updateCardStatus.mutateAsync({
        cardId,
        status: 'contemplado',
        ...data,
      });
    }
  };

  const displayName = card?.tipo_pessoa === "pf" ? card?.nome_completo : card?.razao_social;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[95vw] lg:w-[92vw] xl:w-[90vw] 2xl:w-[88vw] max-w-none sm:max-w-none md:max-w-none lg:max-w-none xl:max-w-none 2xl:max-w-none p-0 flex flex-col">
        <SheetHeader className="border-b flex-shrink-0 p-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="text-lg bg-primary/10">{getInitials(displayName)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <SheetTitle className="text-xl text-left">{displayName || "Sem nome"}</SheetTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-muted-foreground">
                  Grupo {card?.grupo} - Cota {card?.cota}
                </span>
                <Badge variant="outline" className="capitalize">
                  {card?.categoria || "inside"}
                </Badge>
              </div>
            </div>
            {card && (
              <StatusEditDropdown
                currentStatus={card.status as ConsorcioStatus}
                onStatusChange={handleStatusChange}
                isLoading={updateCardStatus.isPending}
              />
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-6">
              {isLoading ? (
                <div className="flex items-center justify-center h-40">
                  <span className="text-muted-foreground">Carregando...</span>
                </div>
              ) : card ? (
                <div className="space-y-6">
                  {/* Alerta de Inadimplência */}
                  {inadimplenciaInfo && inadimplenciaInfo.risco !== 'baixo' && (
                    <InadimplenciaAlert 
                      info={inadimplenciaInfo}
                      onRegularizar={() => {
                        // Scroll to parcelas tab
                        const parcelasTab = document.querySelector('[value="parcelas"]');
                        if (parcelasTab instanceof HTMLElement) parcelasTab.click();
                      }}
                    />
                  )}

                  {/* Resumo Financeiro */}
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <CreditCard className="h-5 w-5" />
                          Resumo Financeiro
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleRecalculateCommissions}
                          disabled={recalculateCommissions.isPending}
                        >
                          <RefreshCw
                            className={`h-4 w-4 mr-2 ${recalculateCommissions.isPending ? "animate-spin" : ""}`}
                          />
                          Recalcular
                        </Button>
                      </div>
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
                          <p className="text-xl font-bold text-orange-600">
                            {formatCurrency(resumoComissoes.pendente)}
                          </p>
                        </div>
                      </div>

                      {/* Progress bars */}
                      <div className="mt-4 space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Parcelas pagas</span>
                            <span className="font-medium">
                              {parcelasPagas.length} de {card.installments?.length || 0}
                            </span>
                          </div>
                          <Progress value={progressoParcelas} className="h-2" />
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Comissão recebida</span>
                            <span className="font-medium">{progressoComissao.toFixed(1)}%</span>
                          </div>
                          <Progress value={progressoComissao} className="h-2" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Detalhes do Grupo */}
                  <GroupDetailsCard grupo={card.grupo} dataContratacao={card.data_contratacao} />

                  {/* Card de Contemplação */}
                  <ContemplationCard
                    cota={card.cota}
                    valorCredito={Number(card.valor_credito)}
                    status={card.status}
                    numeroContemplacao={card.numero_contemplacao}
                    dataContemplacao={card.data_contemplacao}
                    motivoContemplacao={card.motivo_contemplacao}
                    onContemplar={handleContemplar}
                  />

                  <Tabs defaultValue="parcelas">
                    <TabsList className="w-full">
                      <TabsTrigger value="parcelas" className="flex-1">
                        Parcelas
                      </TabsTrigger>
                      <TabsTrigger value="dados" className="flex-1">
                        Dados do Cliente
                      </TabsTrigger>
                      <TabsTrigger value="documentos" className="flex-1">
                        Documentos
                      </TabsTrigger>
                    </TabsList>

                    {/* Tab: Parcelas */}
                    <TabsContent value="parcelas" className="mt-4">
                      <InstallmentsPaginated
                        installments={card.installments || []}
                        onPayInstallment={handlePayInstallment}
                        isPaying={payInstallment.isPending}
                      />
                    </TabsContent>

                    {/* Tab: Dados do Cliente */}
                    <TabsContent value="dados" className="mt-4">
                      <Card>
                        <CardContent className="pt-6">
                          {card.tipo_pessoa === "pf" ? (
                            <div className="space-y-4">
                              {/* Dados Pessoais */}
                              <div>
                                <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                                  <User className="h-4 w-4" />
                                  Dados Pessoais
                                </h4>
                                <div className="grid grid-cols-3 gap-4">
                                  <div>
                                    <p className="text-sm text-muted-foreground">Nome Completo</p>
                                    <p className="font-medium">{card.nome_completo || "-"}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">CPF</p>
                                    <p className="font-medium">{card.cpf || "-"}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">RG</p>
                                    <p className="font-medium">{card.rg || "-"}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Data de Nascimento</p>
                                    <p className="font-medium">{formatDate(card.data_nascimento)}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Estado Civil</p>
                                    <p className="font-medium">{getEstadoCivilLabel(card.estado_civil)}</p>
                                  </div>
                                  {(card.estado_civil === "casado" || card.estado_civil === "uniao_estavel") && (
                                    <div>
                                      <p className="text-sm text-muted-foreground">CPF do Cônjuge</p>
                                      <p className="font-medium">{card.cpf_conjuge || "-"}</p>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <Separator />

                              {/* Contato */}
                              <div>
                                <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                                  <Phone className="h-4 w-4" />
                                  Contato
                                </h4>
                                <div className="grid grid-cols-3 gap-4">
                                  <div className="flex items-center gap-2">
                                    <Phone className="h-4 w-4 text-muted-foreground" />
                                    <div>
                                      <p className="text-sm text-muted-foreground">Telefone</p>
                                      <p className="font-medium">{card.telefone || "-"}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                    <div>
                                      <p className="text-sm text-muted-foreground">Email</p>
                                      <p className="font-medium">{card.email || "-"}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Wallet className="h-4 w-4 text-muted-foreground" />
                                    <div>
                                      <p className="text-sm text-muted-foreground">PIX</p>
                                      <p className="font-medium">{card.pix || "-"}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <Separator />

                              {/* Endereço */}
                              <div>
                                <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                                  <MapPin className="h-4 w-4" />
                                  Endereço
                                </h4>
                                <div className="bg-muted/50 p-3 rounded-lg">
                                  {card.endereco_rua ? (
                                    <>
                                      <p className="font-medium">
                                        {card.endereco_rua}, {card.endereco_numero}
                                        {card.endereco_complemento && ` - ${card.endereco_complemento}`}
                                      </p>
                                      <p className="text-muted-foreground">
                                        {card.endereco_bairro} - {card.endereco_cidade}/{card.endereco_estado}
                                      </p>
                                      <p className="text-muted-foreground">CEP: {card.endereco_cep}</p>
                                    </>
                                  ) : (
                                    <p className="text-muted-foreground">Endereço não informado</p>
                                  )}
                                </div>
                              </div>

                              <Separator />

                              {/* Profissão e Renda */}
                              <div>
                                <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                                  <Briefcase className="h-4 w-4" />
                                  Profissão e Renda
                                </h4>
                                <div className="grid grid-cols-4 gap-4">
                                  <div>
                                    <p className="text-sm text-muted-foreground">Profissão</p>
                                    <p className="font-medium">{card.profissao || "-"}</p>
                                  </div>
                                  {card.profissao === "servidor_publico" && (
                                    <div>
                                      <p className="text-sm text-muted-foreground">Tipo de Servidor</p>
                                      <p className="font-medium capitalize">{card.tipo_servidor || "-"}</p>
                                    </div>
                                  )}
                                  <div>
                                    <p className="text-sm text-muted-foreground">Renda</p>
                                    <p className="font-medium">
                                      {card.renda ? formatCurrency(Number(card.renda)) : "-"}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Patrimônio</p>
                                    <p className="font-medium">
                                      {card.patrimonio ? formatCurrency(Number(card.patrimonio)) : "-"}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {/* Dados da Empresa */}
                              <div>
                                <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                                  <Building2 className="h-4 w-4" />
                                  Dados da Empresa
                                </h4>
                                <div className="grid grid-cols-3 gap-4">
                                  <div>
                                    <p className="text-sm text-muted-foreground">Razão Social</p>
                                    <p className="font-medium">{card.razao_social || "-"}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">CNPJ</p>
                                    <p className="font-medium">{card.cnpj || "-"}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Inscrição Estadual</p>
                                    <p className="font-medium">{card.inscricao_estadual || "-"}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Natureza Jurídica</p>
                                    <p className="font-medium">{card.natureza_juridica || "-"}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Data de Fundação</p>
                                    <p className="font-medium">{formatDate(card.data_fundacao)}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Nº de Funcionários</p>
                                    <p className="font-medium">{card.num_funcionarios || "-"}</p>
                                  </div>
                                </div>
                              </div>

                              <Separator />

                              {/* Contato Comercial */}
                              <div>
                                <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                                  <Phone className="h-4 w-4" />
                                  Contato Comercial
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="flex items-center gap-2">
                                    <Phone className="h-4 w-4 text-muted-foreground" />
                                    <div>
                                      <p className="text-sm text-muted-foreground">Telefone</p>
                                      <p className="font-medium">{card.telefone_comercial || "-"}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                    <div>
                                      <p className="text-sm text-muted-foreground">Email</p>
                                      <p className="font-medium">{card.email_comercial || "-"}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <Separator />

                              {/* Endereço Comercial */}
                              <div>
                                <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                                  <MapPin className="h-4 w-4" />
                                  Endereço Comercial
                                </h4>
                                <div className="bg-muted/50 p-3 rounded-lg">
                                  {card.endereco_comercial_rua ? (
                                    <>
                                      <p className="font-medium">
                                        {card.endereco_comercial_rua}, {card.endereco_comercial_numero}
                                        {card.endereco_comercial_complemento &&
                                          ` - ${card.endereco_comercial_complemento}`}
                                      </p>
                                      <p className="text-muted-foreground">
                                        {card.endereco_comercial_bairro} - {card.endereco_comercial_cidade}/
                                        {card.endereco_comercial_estado}
                                      </p>
                                      <p className="text-muted-foreground">CEP: {card.endereco_comercial_cep}</p>
                                    </>
                                  ) : (
                                    <p className="text-muted-foreground">Endereço comercial não informado</p>
                                  )}
                                </div>
                              </div>

                              <Separator />

                              {/* Financeiro */}
                              <div>
                                <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                                  <Wallet className="h-4 w-4" />
                                  Informações Financeiras
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-sm text-muted-foreground">Faturamento Mensal</p>
                                    <p className="font-medium">
                                      {card.faturamento_mensal ? formatCurrency(Number(card.faturamento_mensal)) : "-"}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Patrimônio</p>
                                    <p className="font-medium">
                                      {card.patrimonio ? formatCurrency(Number(card.patrimonio)) : "-"}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {card.partners && card.partners.length > 0 && (
                                <>
                                  <Separator />
                                  <div>
                                    <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                                      <User className="h-4 w-4" />
                                      Sócios
                                    </h4>
                                    <div className="space-y-2">
                                      {card.partners.map((partner, idx) => (
                                        <div
                                          key={partner.id}
                                          className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg"
                                        >
                                          <Avatar className="h-8 w-8">
                                            <AvatarFallback className="text-xs">
                                              {getInitials(partner.nome)}
                                            </AvatarFallback>
                                          </Avatar>
                                          <div className="flex-1">
                                            <p className="font-medium">{partner.nome}</p>
                                            <p className="text-sm text-muted-foreground">CPF: {partner.cpf}</p>
                                          </div>
                                          {partner.renda && (
                                            <div className="text-right">
                                              <p className="text-sm text-muted-foreground">Renda</p>
                                              <p className="font-medium">{formatCurrency(Number(partner.renda))}</p>
                                            </div>
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
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-muted">
                                      <FileText className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <div>
                                      <p className="font-medium">{doc.nome_arquivo}</p>
                                      <p className="text-sm text-muted-foreground capitalize">{doc.tipo}</p>
                                    </div>
                                  </div>
                                  <Button variant="outline" size="sm">
                                    Visualizar
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-center text-muted-foreground py-8">Nenhum documento anexado</p>
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
                          <p className="font-medium">{formatDate(card.data_contratacao)}</p>
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
                      <div className="grid grid-cols-4 gap-4 mt-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Categoria</p>
                          <Badge variant="outline" className="mt-1 capitalize">
                            {card.categoria === "life" ? (
                              <>
                                <Heart className="h-3 w-3 mr-1" /> Life
                              </>
                            ) : (
                              <>
                                <Briefcase className="h-3 w-3 mr-1" /> Inside
                              </>
                            )}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Origem</p>
                          <p className="font-medium capitalize">{card.origem}</p>
                          {card.origem_detalhe && (
                            <p className="text-xs text-muted-foreground">{card.origem_detalhe}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Vendedor</p>
                          <p className="font-medium">{card.vendedor_name || "-"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Dia Vencimento</p>
                          <p className="font-medium">Dia {card.dia_vencimento}</p>
                        </div>
                      </div>
                      {card.parcelas_pagas_empresa > 0 && (
                        <div className="mt-4 p-3 bg-primary/5 rounded-lg">
                          <p className="text-sm text-muted-foreground">Parcelas pagas pela empresa</p>
                          <p className="font-medium text-primary">{card.parcelas_pagas_empresa} primeiras parcelas</p>
                        </div>
                      )}
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
                            Esta ação não pode ser desfeita. A carta e todas as suas parcelas serão excluídas
                            permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
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
            </div>
          </ScrollArea>
        </div>
      </SheetContent>

      {/* Edit Form */}
      <ConsorcioCardForm open={editFormOpen} onOpenChange={setEditFormOpen} card={card} />
    </Sheet>
  );
}
