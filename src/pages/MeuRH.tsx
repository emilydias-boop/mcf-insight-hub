import { Building2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMyEmployee, useMyEmployeeGestor } from "@/hooks/useMyEmployee";
import { EMPLOYEE_STATUS_LABELS } from "@/types/hr";
import { MeuRHGeralTab } from "@/components/meu-rh/MeuRHGeralTab";
import { MeuRHContratoTab } from "@/components/meu-rh/MeuRHContratoTab";
import { MeuRHRemuneracaoTab } from "@/components/meu-rh/MeuRHRemuneracaoTab";
import { MeuRHNfseTab } from "@/components/meu-rh/MeuRHNfseTab";
import { MeuRHDocumentosTab } from "@/components/meu-rh/MeuRHDocumentosTab";
import { MeuRHHistoricoTab } from "@/components/meu-rh/MeuRHHistoricoTab";

export default function MeuRH() {
  const { data: employee, isLoading, error } = useMyEmployee();
  const { data: gestorName } = useMyEmployeeGestor(employee?.gestor_id);

  if (isLoading) {
    return (
      <div className="p-5 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Erro ao carregar seus dados. Tente novamente mais tarde.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-5">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Seu cadastro de colaborador ainda não foi vinculado. Fale com o RH para vincular seu usuário.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const statusConfig = EMPLOYEE_STATUS_LABELS[employee.status] || { label: employee.status, color: 'bg-gray-500' };

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Meu RH
          </h1>
          <p className="text-sm text-muted-foreground">
            Veja seus dados cadastrais, contrato e status de pagamentos
          </p>
        </div>

        {/* Summary Card */}
        <Card className="min-w-[280px]">
          <CardContent className="pt-4 pb-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm">{employee.nome_completo}</span>
              <Badge className={`${statusConfig.color} text-white text-[10px]`}>
                {statusConfig.label}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p><span className="text-muted-foreground/70">Cargo:</span> {employee.cargo || '-'}</p>
              <p><span className="text-muted-foreground/70">Equipe:</span> {employee.squad || '-'}</p>
              <p><span className="text-muted-foreground/70">Coordenador:</span> {gestorName || '-'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="geral" className="w-full">
        <TabsList className="h-9">
          <TabsTrigger value="geral" className="text-xs">Geral</TabsTrigger>
          <TabsTrigger value="contrato" className="text-xs">Contrato</TabsTrigger>
          <TabsTrigger value="remuneracao" className="text-xs">Remuneração</TabsTrigger>
          {employee.tipo_contrato === 'PJ' && (
            <TabsTrigger value="nfse" className="text-xs">NFSe</TabsTrigger>
          )}
          <TabsTrigger value="documentos" className="text-xs">Documentos</TabsTrigger>
          <TabsTrigger value="historico" className="text-xs">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="mt-4">
          <MeuRHGeralTab employee={employee} />
        </TabsContent>

        <TabsContent value="contrato" className="mt-4">
          <MeuRHContratoTab employee={employee} />
        </TabsContent>

        <TabsContent value="remuneracao" className="mt-4">
          <MeuRHRemuneracaoTab employee={employee} />
        </TabsContent>

        {employee.tipo_contrato === 'PJ' && (
          <TabsContent value="nfse" className="mt-4">
            <MeuRHNfseTab employee={employee} />
          </TabsContent>
        )}

        <TabsContent value="documentos" className="mt-4">
          <MeuRHDocumentosTab employee={employee} />
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <MeuRHHistoricoTab employee={employee} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
