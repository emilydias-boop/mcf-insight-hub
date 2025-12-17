import { AlertCircle, User, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Employee } from "@/types/hr";
import { format } from "date-fns";

interface MeuRHGeralTabProps {
  employee: Employee;
}

export function MeuRHGeralTab({ employee }: MeuRHGeralTabProps) {
  const formatDate = (date: string | null) => {
    if (!date) return '-';
    try {
      return format(new Date(date), 'dd/MM/yyyy');
    } catch {
      return '-';
    }
  };

  const formatCPF = (cpf: string | null) => {
    if (!cpf) return '-';
    const cleaned = cpf.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
    }
    return cpf;
  };

  // Verificar campos obrigatórios incompletos
  const missingFields = [];
  if (!employee.cpf) missingFields.push('CPF');
  if (!employee.data_nascimento) missingFields.push('Data de nascimento');
  if (!employee.telefone) missingFields.push('Telefone');
  if (!employee.email_pessoal) missingFields.push('Email pessoal');

  return (
    <div className="space-y-4">
      {missingFields.length > 0 && (
        <Alert variant="default" className="border-yellow-500/50 bg-yellow-500/10">
          <AlertCircle className="h-4 w-4 text-yellow-500" />
          <AlertDescription className="text-xs">
            Alguns dados do seu cadastro estão incompletos, fale com o RH para atualizar.
          </AlertDescription>
        </Alert>
      )}

      {/* Dados Pessoais */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <User className="h-4 w-4" />
            Dados Pessoais
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <FieldDisplay label="Nome completo" value={employee.nome_completo} />
            <FieldDisplay label="CPF" value={formatCPF(employee.cpf)} />
            <FieldDisplay label="RG" value={employee.rg} />
            <FieldDisplay label="Data de nascimento" value={formatDate(employee.data_nascimento)} />
            <FieldDisplay label="Telefone pessoal" value={employee.telefone} />
            <FieldDisplay label="Email pessoal" value={employee.email_pessoal} />
            <FieldDisplay label="Nacionalidade" value={employee.nacionalidade} />
            <FieldDisplay label="Estado civil" value={employee.estado_civil} />
          </div>
        </CardContent>
      </Card>

      {/* Endereço */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Endereço
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <FieldDisplay label="Endereço" value={employee.endereco} className="col-span-2" />
            <FieldDisplay label="Cidade" value={employee.cidade} />
            <FieldDisplay label="Estado" value={employee.estado} />
            <FieldDisplay label="CEP" value={employee.cep} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FieldDisplay({ label, value, className = '' }: { label: string; value: string | null | undefined; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">{label}</p>
      <p className="text-xs font-medium">{value || '-'}</p>
    </div>
  );
}
