import { AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMyEmployee, useMyEmployeeGestor } from "@/hooks/useMyEmployee";
import { MeuRHHeader } from "@/components/meu-rh/MeuRHHeader";
import { MeuRHVinculoSection } from "@/components/meu-rh/MeuRHVinculoSection";
import { MeuRHDadosPessoaisSection } from "@/components/meu-rh/MeuRHDadosPessoaisSection";
import { MeuRHRemuneracaoSection } from "@/components/meu-rh/MeuRHRemuneracaoSection";
import { MeuRHNfseSection } from "@/components/meu-rh/MeuRHNfseSection";
import { MeuRHDocumentosSection } from "@/components/meu-rh/MeuRHDocumentosSection";
import { MeuRHHistoricoSection } from "@/components/meu-rh/MeuRHHistoricoSection";

export default function MeuRH() {
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
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-32 w-full" />
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
    <div className="max-w-[1200px] mx-auto p-5 space-y-6">
      {/* 1. Header */}
      <MeuRHHeader employee={employee} gestorName={gestorName} />

      {/* 2. Resumo do vínculo */}
      <MeuRHVinculoSection employee={employee} />

      {/* 3. Dados pessoais */}
      <MeuRHDadosPessoaisSection employee={employee} />

      {/* 4. Remuneração */}
      <MeuRHRemuneracaoSection employee={employee} />

      {/* 5. NFSe / Pagamentos (PJ only) */}
      {employee.tipo_contrato === 'PJ' && (
        <MeuRHNfseSection employee={employee} />
      )}

      {/* 6. Documentos */}
      <MeuRHDocumentosSection employee={employee} />

      {/* 7. Histórico */}
      <MeuRHHistoricoSection employee={employee} />
    </div>
  );
}
