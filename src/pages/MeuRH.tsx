import { useState } from "react";
import { AlertCircle, BookOpen, MessageSquare, Target, Megaphone, History, Star, User, FolderOpen } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMyEmployee, useMyEmployeeGestor } from "@/hooks/useMyEmployee";
import { MeuRHHeader } from "@/components/meu-rh/MeuRHHeader";
import { MeuRHQuickCards } from "@/components/meu-rh/MeuRHQuickCards";
import { MeuRHQuickActions } from "@/components/meu-rh/MeuRHQuickActions";
import { MeuRHDadosPessoaisSection } from "@/components/meu-rh/MeuRHDadosPessoaisSection";
import { MeuRHRemuneracaoSection } from "@/components/meu-rh/MeuRHRemuneracaoSection";
import { MeuRHNfseSection } from "@/components/meu-rh/MeuRHNfseSection";
import { MeuRHDocumentosSection } from "@/components/meu-rh/MeuRHDocumentosSection";
import { MeuRHAvaliacoesSection } from "@/components/meu-rh/MeuRHAvaliacoesSection";
import { MeuRHHistoricoSection } from "@/components/meu-rh/MeuRHHistoricoSection";
import { MeuRHFaleComRHSection } from "@/components/meu-rh/MeuRHFaleComRHSection";
import { MeuRHPdiSection } from "@/components/meu-rh/MeuRHPdiSection";

function PlaceholderTab({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="p-3 rounded-full bg-muted mb-4">
          <AlertCircle className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-md">{description}</p>
      </CardContent>
    </Card>
  );
}

export default function MeuRH() {
  const [activeTab, setActiveTab] = useState("perfil");
  const { data: employee, isLoading, error } = useMyEmployee();
  const { data: gestorName } = useMyEmployeeGestor(employee?.gestor_id);

  if (isLoading) {
    return (
      <div className="max-w-[1200px] mx-auto p-5 space-y-6">
        <div className="flex items-start gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-[1200px] mx-auto p-5">
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
      <div className="max-w-[1200px] mx-auto p-5">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Seu cadastro de colaborador ainda não foi vinculado. Fale com o RH para vincular seu usuário.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto p-5 space-y-5">
      {/* Header */}
      <MeuRHHeader employee={employee} gestorName={gestorName} />

      {/* Quick Cards */}
      <MeuRHQuickCards employee={employee} />

      {/* Quick Actions */}
      <MeuRHQuickActions employee={employee} onTabChange={setActiveTab} />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="perfil" className="gap-1.5">
            <User className="h-3.5 w-3.5" />
            Meu Perfil
          </TabsTrigger>
          <TabsTrigger value="documentos" className="gap-1.5">
            <FolderOpen className="h-3.5 w-3.5" />
            Documentos
          </TabsTrigger>
          <TabsTrigger value="politicas" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            Políticas MCF
          </TabsTrigger>
          <TabsTrigger value="fale-rh" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            Fale com o RH
          </TabsTrigger>
          <TabsTrigger value="avaliacoes" className="gap-1.5">
            <Star className="h-3.5 w-3.5" />
            Avaliações
          </TabsTrigger>
          <TabsTrigger value="pdi" className="gap-1.5">
            <Target className="h-3.5 w-3.5" />
            PDI
          </TabsTrigger>
          <TabsTrigger value="comunicados" className="gap-1.5">
            <Megaphone className="h-3.5 w-3.5" />
            Comunicados
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5">
            <History className="h-3.5 w-3.5" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="perfil" className="space-y-6">
          <MeuRHDadosPessoaisSection employee={employee} />
          <MeuRHRemuneracaoSection employee={employee} />
          {employee.tipo_contrato === 'PJ' && (
            <MeuRHNfseSection employee={employee} />
          )}
        </TabsContent>

        <TabsContent value="documentos">
          <MeuRHDocumentosSection employee={employee} />
        </TabsContent>

        <TabsContent value="politicas">
          <PlaceholderTab
            title="Políticas da MCF"
            description="Em breve você terá acesso à biblioteca de políticas, diretrizes internas, código de conduta e materiais institucionais."
          />
        </TabsContent>

        <TabsContent value="fale-rh">
          <MeuRHFaleComRHSection employee={employee} />
        </TabsContent>

        <TabsContent value="avaliacoes">
          <MeuRHAvaliacoesSection employee={employee} />
        </TabsContent>

        <TabsContent value="pdi">
          <MeuRHPdiSection employee={employee} />
        </TabsContent>

        <TabsContent value="comunicados">
          <PlaceholderTab
            title="Comunicados"
            description="Em breve você verá aniversariantes do mês, recados da gestão e avisos da empresa."
          />
        </TabsContent>

        <TabsContent value="historico">
          <MeuRHHistoricoSection employee={employee} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
