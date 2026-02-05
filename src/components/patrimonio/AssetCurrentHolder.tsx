import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AssetAssignment } from '@/types/patrimonio';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { User, Calendar, Building2, Briefcase, FileCheck } from 'lucide-react';

interface AssetCurrentHolderProps {
  assignment?: AssetAssignment & {
    employee?: {
      id: string;
      nome_completo: string;
      email_pessoal: string | null;
      departamento: string | null;
      cargo: string | null;
    };
  };
}

export const AssetCurrentHolder = ({ assignment }: AssetCurrentHolderProps) => {
  if (!assignment || !assignment.employee) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-5 w-5" />
            Responsável Atual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p>Equipamento sem responsável</p>
            <p className="text-sm">Disponível para liberação</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const employee = assignment.employee;
  const initials = employee.nome_completo
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="h-5 w-5" />
          Responsável Atual
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Employee Info */}
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{employee.nome_completo}</p>
            {employee.email_pessoal && (
              <p className="text-sm text-muted-foreground">{employee.email_pessoal}</p>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="space-y-2">
          {(assignment.setor || employee.departamento) && (
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span>{assignment.setor || employee.departamento}</span>
            </div>
          )}
          {(assignment.cargo || employee.cargo) && (
            <div className="flex items-center gap-2 text-sm">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <span>{assignment.cargo || employee.cargo}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>
              Desde {format(new Date(assignment.data_liberacao), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
            </span>
          </div>
          {assignment.data_prevista_devolucao && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>
                Devolução prevista: {format(new Date(assignment.data_prevista_devolucao), 'dd/MM/yyyy', { locale: ptBR })}
              </span>
            </div>
          )}
        </div>

        {/* Term Status */}
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <FileCheck className="h-4 w-4 text-muted-foreground" />
              <span>Termo de Responsabilidade</span>
            </div>
            {assignment.termo_id ? (
              <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">
                Aceito
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-secondary text-secondary-foreground border-secondary">
                Pendente
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
