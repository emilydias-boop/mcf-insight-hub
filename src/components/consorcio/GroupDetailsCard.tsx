import { Users, TrendingUp, Clock, Landmark } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useGroupDetails } from '@/hooks/useGroupDetails';
import { differenceInMonths, differenceInYears, parseISO } from 'date-fns';

interface GroupDetailsCardProps {
  grupo: string;
  dataContratacao: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatTempoPermanencia(dataContratacao: string): string {
  const dataInicio = parseISO(dataContratacao);
  const hoje = new Date();
  
  const anos = differenceInYears(hoje, dataInicio);
  const mesesRestantes = differenceInMonths(hoje, dataInicio) % 12;
  
  if (anos === 0) {
    return `${mesesRestantes} ${mesesRestantes === 1 ? 'mês' : 'meses'}`;
  }
  
  if (mesesRestantes === 0) {
    return `${anos} ${anos === 1 ? 'ano' : 'anos'}`;
  }
  
  return `${anos} ${anos === 1 ? 'ano' : 'anos'} e ${mesesRestantes} ${mesesRestantes === 1 ? 'mês' : 'meses'}`;
}

export function GroupDetailsCard({ grupo, dataContratacao }: GroupDetailsCardProps) {
  const { data: groupDetails, isLoading } = useGroupDetails(grupo);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Detalhes do Grupo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const tempoPermanencia = formatTempoPermanencia(dataContratacao);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5" />
          Detalhes do Grupo
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Landmark className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Grupo</p>
              <p className="text-xl font-bold">{grupo}</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Participantes Empresa</p>
              <p className="text-xl font-bold">{groupDetails?.participantesEmpresa || 0}</p>
              <p className="text-xs text-muted-foreground">cotas no mesmo grupo</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Valor Contemplado</p>
              <p className="text-xl font-bold text-green-600">
                {formatCurrency(groupDetails?.valorContemplado || 0)}
              </p>
              <p className="text-xs text-muted-foreground">
                de {formatCurrency(groupDetails?.totalCredito || 0)} total
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Clock className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tempo de Permanência</p>
              <p className="text-xl font-bold">{tempoPermanencia}</p>
              <p className="text-xs text-muted-foreground">nesta cota</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
