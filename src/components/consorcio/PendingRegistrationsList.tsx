import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, FolderOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePendingRegistrations } from '@/hooks/useConsorcioPendingRegistrations';
import { OpenCotaModal } from './OpenCotaModal';

export function PendingRegistrationsList() {
  const { data: registrations = [], isLoading } = usePendingRegistrations();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FolderOpen className="h-5 w-5" />
          Cadastros Pendentes ({registrations.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {registrations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum cadastro pendente de abertura.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome / Razão Social</TableHead>
                <TableHead>CPF / CNPJ</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Data Aceite</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registrations.map(reg => (
                <TableRow key={reg.id}>
                  <TableCell className="font-medium">
                    {reg.tipo_pessoa === 'pf' ? reg.nome_completo : reg.razao_social}
                  </TableCell>
                  <TableCell className="text-sm">
                    {reg.tipo_pessoa === 'pf' ? reg.cpf : reg.cnpj}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {reg.tipo_pessoa === 'pf' ? 'PF' : 'PJ'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {reg.tipo_pessoa === 'pf' ? reg.telefone : reg.telefone_comercial}
                  </TableCell>
                  <TableCell className="text-sm">{reg.vendedor_name || '—'}</TableCell>
                  <TableCell className="text-sm">
                    {reg.aceite_date
                      ? format(new Date(reg.aceite_date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs text-orange-700 border-orange-300">
                      Aguardando abertura
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" onClick={() => setSelectedId(reg.id)}>
                      Abrir Cadastro
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {selectedId && (
          <OpenCotaModal
            open={!!selectedId}
            onOpenChange={o => !o && setSelectedId(null)}
            registrationId={selectedId}
          />
        )}
      </CardContent>
    </Card>
  );
}
