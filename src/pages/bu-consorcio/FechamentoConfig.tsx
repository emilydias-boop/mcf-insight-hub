import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Users, FileText, Target, Calendar, ExternalLink, RefreshCw } from 'lucide-react';
import { useEmployeesWithCargo } from '@/hooks/useEmployees';
import { PlansOteTab } from '@/components/fechamento/PlansOteTab';
import { ActiveMetricsTab } from '@/components/fechamento/ActiveMetricsTab';
import { WorkingDaysCalendar } from '@/components/sdr-fechamento/WorkingDaysCalendar';

const CONSORCIO_DEPT = 'BU - Consórcio';

export default function ConsorcioFechamentoConfig() {
  const navigate = useNavigate();
  
  // Query para colaboradores com cargo
  const { data: employees, isLoading: employeesLoading } = useEmployeesWithCargo();

  // Filtrar apenas colaboradores do Consórcio
  const consorcioEmployees = useMemo(() => {
    if (!employees) return [];
    return employees.filter(emp => emp.departamento === CONSORCIO_DEPT);
  }, [employees]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/consorcio/fechamento')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Configurações - Fechamento Consórcio</h1>
          <p className="text-muted-foreground">
            Gerencie equipe, planos de compensação e métricas
          </p>
        </div>
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
        </TabsList>

        {/* Aba Equipe */}
        <TabsContent value="equipe">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Equipe Consórcio
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
              ) : consorcioEmployees.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum colaborador encontrado no departamento Consórcio.
                  <p className="text-sm mt-2">
                    Acesse o módulo de RH para cadastrar colaboradores na BU Consórcio.
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
                    {consorcioEmployees.map((emp) => (
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
              
              {/* Nota informativa */}
              <div className="mt-4 text-xs text-muted-foreground bg-muted/50 rounded-md p-3 border">
                <strong>Fonte de dados:</strong> Os colaboradores são gerenciados no módulo de RH. 
                Para aparecer nesta lista, o colaborador deve estar na BU Consórcio.
                Para aparecer em "Planos OTE", deve também ter um cargo do catálogo vinculado.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba Planos OTE - filtrado para Consórcio */}
        <TabsContent value="plans">
          <PlansOteTab defaultBU="consorcio" lockBU />
        </TabsContent>

        {/* Aba Métricas Ativas - filtrado para Consórcio */}
        <TabsContent value="metricas">
          <ActiveMetricsTab defaultBU="consorcio" lockBU />
        </TabsContent>

        {/* Aba Dias Úteis */}
        <TabsContent value="calendar">
          <WorkingDaysCalendar />
        </TabsContent>
      </Tabs>
    </div>
  );
}
