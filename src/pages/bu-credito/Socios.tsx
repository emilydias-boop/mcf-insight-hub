import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCreditPartners, useCreateCreditPartner, useUpdateCreditPartner } from '@/hooks/useCreditoData';
import { formatCurrency } from '@/lib/formatters';
import { Plus, Users, Wallet, FileText, Phone, Mail } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import type { CreditPartner, PartnerStatus, PartnerTipo } from '@/types/credito';

const STATUS_CONFIG: Record<PartnerStatus, { label: string; color: string }> = {
  prospect: { label: 'Prospect', color: 'bg-blue-500' },
  negociacao: { label: 'Negociação', color: 'bg-yellow-500' },
  documentacao: { label: 'Documentação', color: 'bg-purple-500' },
  ativo: { label: 'Ativo', color: 'bg-green-500' },
  inativo: { label: 'Inativo', color: 'bg-gray-500' },
};

const TIPO_LABELS: Record<PartnerTipo, string> = {
  capital_proprio: 'Capital Próprio',
  carta_consorcio: 'Carta de Consórcio',
};

export default function CreditoSocios() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<CreditPartner>>({
    tipo: 'capital_proprio',
    status: 'prospect',
  });

  const { data: partners, isLoading } = useCreditPartners();
  const createPartner = useCreateCreditPartner();
  const updatePartner = useUpdateCreditPartner();

  // Group partners by status for Kanban view
  const partnersByStatus = partners?.reduce((acc, partner) => {
    const status = partner.status || 'prospect';
    if (!acc[status]) acc[status] = [];
    acc[status].push(partner);
    return acc;
  }, {} as Record<PartnerStatus, CreditPartner[]>);

  // Stats
  const totalPartners = partners?.length || 0;
  const activePartners = partners?.filter(p => p.status === 'ativo').length || 0;
  const totalAportado = partners?.reduce((sum, p) => sum + (p.valor_aportado || 0), 0) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createPartner.mutateAsync(formData);
      toast({ title: 'Sócio criado com sucesso' });
      setIsDialogOpen(false);
      setFormData({ tipo: 'capital_proprio', status: 'prospect' });
    } catch (error) {
      toast({ title: 'Erro ao criar sócio', variant: 'destructive' });
    }
  };

  const handleStatusChange = async (partnerId: string, newStatus: PartnerStatus) => {
    try {
      await updatePartner.mutateAsync({ id: partnerId, status: newStatus });
      toast({ title: 'Status atualizado' });
    } catch (error) {
      toast({ title: 'Erro ao atualizar status', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Pipeline de Sócios</h1>
          <p className="text-muted-foreground mt-1">Gestão de parceiros e investidores</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Sócio
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar Novo Sócio</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="full_name">Nome Completo</Label>
                <Input
                  id="full_name"
                  value={formData.full_name || ''}
                  onChange={e => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="cpf_cnpj">CPF/CNPJ</Label>
                <Input
                  id="cpf_cnpj"
                  value={formData.cpf_cnpj || ''}
                  onChange={e => setFormData(prev => ({ ...prev, cpf_cnpj: e.target.value }))}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email || ''}
                    onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.phone || ''}
                    onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="tipo">Tipo</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(value: PartnerTipo) => setFormData(prev => ({ ...prev, tipo: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="capital_proprio">Capital Próprio</SelectItem>
                    <SelectItem value="carta_consorcio">Carta de Consórcio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="valor_aportado">Valor Aportado</Label>
                <Input
                  id="valor_aportado"
                  type="number"
                  value={formData.valor_aportado || ''}
                  onChange={e => setFormData(prev => ({ ...prev, valor_aportado: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <Button type="submit" className="w-full" disabled={createPartner.isPending}>
                {createPartner.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Sócios</p>
                <p className="text-2xl font-bold">{totalPartners}</p>
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
                <p className="text-sm text-muted-foreground">Sócios Ativos</p>
                <p className="text-2xl font-bold">{activePartners}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning/10 rounded-lg">
                <Wallet className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Aportado</p>
                <p className="text-2xl font-bold">{formatCurrency(totalAportado)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Kanban by Status */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-[400px]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {(Object.keys(STATUS_CONFIG) as PartnerStatus[]).map(status => {
            const statusPartners = partnersByStatus?.[status] || [];
            const config = STATUS_CONFIG[status];
            
            return (
              <div key={status} className="flex flex-col">
                <div className={`p-3 rounded-t-lg ${config.color} bg-opacity-20`}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">{config.label}</h3>
                    <Badge variant="secondary">{statusPartners.length}</Badge>
                  </div>
                </div>
                
                <div className="flex-1 bg-muted/30 rounded-b-lg p-2 space-y-2 min-h-[300px]">
                  {statusPartners.map(partner => (
                    <Card key={partner.id} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardContent className="p-3">
                        <h4 className="font-medium text-sm truncate">{partner.full_name}</h4>
                        <p className="text-xs text-muted-foreground">{partner.cpf_cnpj}</p>
                        <Badge variant="outline" className="text-xs mt-2">
                          {TIPO_LABELS[partner.tipo]}
                        </Badge>
                        <p className="text-sm font-bold text-primary mt-2">
                          {formatCurrency(partner.valor_aportado)}
                        </p>
                        <div className="flex gap-2 mt-2">
                          {partner.phone && (
                            <Phone className="h-3 w-3 text-muted-foreground" />
                          )}
                          {partner.email && (
                            <Mail className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {statusPartners.length === 0 && (
                    <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
                      Nenhum sócio
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table View */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Sócios</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF/CNPJ</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor Aportado</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Contato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partners?.map(partner => (
                <TableRow key={partner.id}>
                  <TableCell className="font-medium">{partner.full_name}</TableCell>
                  <TableCell>{partner.cpf_cnpj}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{TIPO_LABELS[partner.tipo]}</Badge>
                  </TableCell>
                  <TableCell className="font-bold">{formatCurrency(partner.valor_aportado)}</TableCell>
                  <TableCell>
                    <Select
                      value={partner.status}
                      onValueChange={(value: PartnerStatus) => handleStatusChange(partner.id, value)}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUS_CONFIG) as PartnerStatus[]).map(s => (
                          <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {partner.phone && <Phone className="h-4 w-4 text-muted-foreground" />}
                      {partner.email && <Mail className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
