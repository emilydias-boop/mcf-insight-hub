import { User, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Employee } from "@/types/hr";
import { format } from "date-fns";

interface MeuRHDadosPessoaisSectionProps {
  employee: Employee;
}

function maskCpf(cpf: string | null): string {
  if (!cpf) return 'N/A';
  // Format: ***. 456.789-**
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return cpf;
  return `***.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-**`;
}

export function MeuRHDadosPessoaisSection({ employee }: MeuRHDadosPessoaisSectionProps) {
  const dadosPrincipais = [
    { label: 'Nome completo', value: employee.nome_completo },
    { label: 'CPF', value: maskCpf(employee.cpf) },
    { label: 'Data de nascimento', value: employee.data_nascimento 
      ? format(new Date(employee.data_nascimento), 'dd/MM/yyyy')
      : 'N/A' },
    { label: 'Nacionalidade', value: employee.nacionalidade || 'Brasileira' },
  ];

  const dadosContato = [
    { label: 'Telefone', value: employee.telefone || 'N/A' },
    { label: 'Email pessoal', value: employee.email_pessoal || 'N/A' },
    { label: 'Cidade', value: employee.cidade || 'N/A' },
    { label: 'Estado', value: employee.estado || 'N/A' },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card Dados Principais */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Dados principais
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {dadosPrincipais.map((item) => (
              <div key={item.label} className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <span className="text-sm font-medium">{item.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Card Contato */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Contato
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {dadosContato.map((item) => (
              <div key={item.label} className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <span className="text-sm font-medium truncate max-w-[180px]">{item.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <p className="text-[10px] text-muted-foreground/70 text-center">
        Para atualizar dados pessoais, fale com o RH.
      </p>
    </div>
  );
}
