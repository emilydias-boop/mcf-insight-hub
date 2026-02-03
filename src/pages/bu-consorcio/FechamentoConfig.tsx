import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useConsorcioClosers } from '@/hooks/useConsorcioFechamento';
import { formatCurrency } from '@/lib/formatters';
import { OTE_PADRAO_CONSORCIO, PESOS_CLOSER_CONSORCIO } from '@/types/consorcio-fechamento';

export default function ConsorcioFechamentoConfig() {
  const navigate = useNavigate();
  const { data: closers, isLoading } = useConsorcioClosers();

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
            Gerencie closers e parâmetros de compensação
          </p>
        </div>
      </div>

      {/* OTE Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estrutura de Compensação Padrão</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">OTE Total</p>
              <p className="text-lg font-bold">{formatCurrency(OTE_PADRAO_CONSORCIO.ote_total)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fixo (70%)</p>
              <p className="text-lg font-bold text-blue-400">
                {formatCurrency(OTE_PADRAO_CONSORCIO.ote_total * OTE_PADRAO_CONSORCIO.fixo_pct)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Variável (30%)</p>
              <p className="text-lg font-bold text-green-400">
                {formatCurrency(OTE_PADRAO_CONSORCIO.ote_total * OTE_PADRAO_CONSORCIO.variavel_pct)}
              </p>
            </div>
          </div>
          
          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">Distribuição do Variável:</p>
            <div className="flex gap-4 flex-wrap">
              <Badge variant="outline">
                Comissão Consórcio: {(PESOS_CLOSER_CONSORCIO.comissao_consorcio * 100).toFixed(0)}%
              </Badge>
              <Badge variant="outline">
                Comissão Holding: {(PESOS_CLOSER_CONSORCIO.comissao_holding * 100).toFixed(0)}%
              </Badge>
              <Badge variant="outline">
                Organização: {(PESOS_CLOSER_CONSORCIO.organizacao * 100).toFixed(0)}%
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Closers List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Closers do Consórcio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : !closers || closers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Nenhum closer cadastrado para consórcio.
                  </TableCell>
                </TableRow>
              ) : (
                closers.map((closer) => (
                  <TableRow key={closer.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {closer.color && (
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: closer.color }}
                          />
                        )}
                        {closer.name}
                      </div>
                    </TableCell>
                    <TableCell>{closer.email}</TableCell>
                    <TableCell>
                      <Badge variant={closer.is_active ? 'default' : 'secondary'}>
                        {closer.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          
          <p className="text-sm text-muted-foreground mt-4">
            Para adicionar ou editar closers, acesse{' '}
            <Button 
              variant="link" 
              className="p-0 h-auto"
              onClick={() => navigate('/crm/configuracoes')}
            >
              CRM &gt; Configurações &gt; Closers
            </Button>
            {' '}e configure com BU = "consorcio".
          </p>
        </CardContent>
      </Card>

      {/* Multiplier Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tabela de Multiplicadores</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>% Atingimento</TableHead>
                <TableHead>Multiplicador</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>&lt; 50%</TableCell>
                <TableCell>×0.0</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>50% - 69%</TableCell>
                <TableCell>×0.5</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>70% - 99%</TableCell>
                <TableCell>×0.7</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>100% - 149%</TableCell>
                <TableCell>×1.0</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>≥ 150%</TableCell>
                <TableCell>×1.5</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
