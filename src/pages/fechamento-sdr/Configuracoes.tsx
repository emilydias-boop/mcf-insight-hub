import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEmployeesWithCargo } from '@/hooks/useEmployees';
import { Users, FileText, RefreshCw, Calendar, Target, ExternalLink, ArrowLeft } from 'lucide-react';
import { WorkingDaysCalendar } from '@/components/sdr-fechamento/WorkingDaysCalendar';
import { ActiveMetricsTab } from '@/components/fechamento/ActiveMetricsTab';
import { PlansOteTab } from '@/components/fechamento/PlansOteTab';
import { TeamMonthlyGoalsTab } from '@/components/fechamento/TeamMonthlyGoalsTab';
import { useActiveBU } from '@/hooks/useActiveBU';
import { BusinessUnit } from '@/hooks/useMyBU';

// Mapeamento de BU key para departamento RH
const BU_DEPT_MAP: Record<string, string[]> = {
  'incorporador': ['BU - Incorporador 50K', 'BU - Incorporador MCF'],
  'consorcio': ['BU - Consórcio', 'BU - Consorcio'],
  'credito': ['BU - Crédito', 'BU - Credito'],
  'projetos': ['BU - Projetos'],
  'leilao': ['BU - Leilão', 'BU - Leilao'],
  'marketing': ['BU - Marketing'],
};

const BU_LABELS: Record<string, string> = {
  'incorporador': 'Incorporador MCF',
  'consorcio': 'Consórcio',
  'credito': 'Crédito',
  'projetos': 'Projetos',
  'leilao': 'Leilão',
  'marketing': 'Marketing',
};

const ConfiguracoesSdr = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeBU = useActiveBU();

  // Determinar BU efetiva: URL > contexto > fallback
  const buFromUrl = searchParams.get('bu') as BusinessUnit | null;
  const effectiveBu: BusinessUnit = buFromUrl && Object.keys(BU_DEPT_MAP).includes(buFromUrl)
    ? buFromUrl
    : activeBU && Object.keys(BU_DEPT_MAP).includes(activeBU)
      ? activeBU
      : 'incorporador';

  const buLabel = BU_LABELS[effectiveBu] || effectiveBu;
  
  // Buscar colaboradores do RH para aba Equipe
  const { data: employees, isLoading: employeesLoading } = useEmployeesWithCargo();
  
  // Filtrar colaboradores pela BU efetiva
  const filteredEmployees = useMemo(() => {
    if (!employees) return [];
    const validDepts = BU_DEPT_MAP[effectiveBu] || [];
    return employees.filter(emp => 
      emp.departamento && validDepts.some(d => emp.departamento?.includes(d.replace('BU - ', '')))
    );
  }, [employees, effectiveBu]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/fechamento-sdr')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Configurações de Fechamento</h1>
            <p className="text-muted-foreground">
              Gerencie equipe, planos de compensação e métricas
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-sm px-3 py-1">
          {buLabel}
        </Badge>
      </div>

      <Tabs defaultValue="equipe" className="space-y-4">
        <TabsList>
          <TabsTrigger value="equipe" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Equipe
          </TabsTrigger>
          <TabsTrigger value="plans" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Planos OTE
          </TabsTrigger>
          <TabsTrigger value="metricas" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Métricas Ativas
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Dias Úteis
          </TabsTrigger>
          <TabsTrigger value="metas-equipe" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Metas Equipe
          </TabsTrigger>
        </TabsList>

        <TabsContent value="equipe">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Equipe {buLabel}
              </CardTitle>
              <Button onClick={() => navigate('/rh')}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Gerenciar no RH
              </Button>
            </CardHeader>
            <CardContent>
              {employeesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !filteredEmployees || filteredEmployees.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum colaborador encontrado para a BU {buLabel}.
                  <p className="text-sm mt-2">
                    Acesse o módulo de RH para cadastrar colaboradores nesta BU.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome Completo</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead className="text-center">Nível</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Admissão</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployees.map((emp) => (
                      <TableRow key={emp.id}>
                        <TableCell className="font-medium">{emp.nome_completo}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {emp.cargo_catalogo?.nome_exibicao || emp.cargo || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {emp.cargo_catalogo?.nivel ? (
                            <Badge variant="outline" className="font-mono">N{emp.cargo_catalogo.nivel}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={emp.status === 'ativo' ? 'default' : 'outline'}>
                            {emp.status === 'ativo' ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {emp.data_admissao 
                            ? format(new Date(emp.data_admissao), 'dd/MM/yyyy', { locale: ptBR })
                            : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => navigate(`/rh?employee=${emp.id}`)}
                            title="Editar no RH"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              
              <div className="mt-4 text-xs text-muted-foreground bg-muted/50 rounded-md p-3 border">
                <strong>Fonte de dados:</strong> Os colaboradores são gerenciados no módulo de RH. 
                Para aparecer nesta lista, o colaborador deve estar na BU {buLabel}.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans">
          <PlansOteTab defaultBU={effectiveBu} lockBU />
        </TabsContent>

        <TabsContent value="metricas">
          <ActiveMetricsTab defaultBU={effectiveBu} lockBU />
        </TabsContent>

        <TabsContent value="calendar">
          <WorkingDaysCalendar />
        </TabsContent>

        <TabsContent value="metas-equipe">
          <TeamMonthlyGoalsTab defaultBU={effectiveBu} lockBU />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ConfiguracoesSdr;
