import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCreditClients } from '@/hooks/useCreditoData';
import { formatCurrency } from '@/lib/formatters';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Phone, Mail } from 'lucide-react';

export default function CreditoClientes() {
  const { data: clients, isLoading } = useCreditClients();

  const getScoreBadge = (score: number | null) => {
    if (!score) return <Badge variant="outline">N/A</Badge>;
    if (score >= 700) return <Badge className="bg-success">Alto ({score})</Badge>;
    if (score >= 500) return <Badge className="bg-warning">Médio ({score})</Badge>;
    return <Badge className="bg-destructive">Baixo ({score})</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Clientes de Crédito</h1>
        <p className="text-muted-foreground mt-1">Base de clientes do BU Crédito</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Clientes</p>
                <p className="text-2xl font-bold">{clients?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success/10 rounded-lg">
                <Users className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Crédito Concedido</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(clients?.reduce((sum, c) => sum + (c.total_credit || 0), 0) || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/10 rounded-lg">
                <Users className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total em Dívida</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(clients?.reduce((sum, c) => sum + (c.total_debt || 0), 0) || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Clientes</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : clients?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum cliente cadastrado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Crédito Total</TableHead>
                  <TableHead>Dívida</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Contato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients?.map(client => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.full_name}</TableCell>
                    <TableCell>{client.cpf}</TableCell>
                    <TableCell>{getScoreBadge(client.credit_score)}</TableCell>
                    <TableCell className="text-success font-medium">
                      {formatCurrency(client.total_credit || 0)}
                    </TableCell>
                    <TableCell className="text-destructive font-medium">
                      {formatCurrency(client.total_debt || 0)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={client.status === 'active' ? 'default' : 'secondary'}>
                        {client.status || 'N/A'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {client.phone && <Phone className="h-4 w-4 text-muted-foreground" />}
                        {client.email && <Mail className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
