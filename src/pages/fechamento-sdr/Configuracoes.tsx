import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { 
  useSdrsAll, 
  useAllCompPlans,
  useCreateSdr, 
  useApproveSdr,
  useCreateCompPlan,
  useApproveCompPlan,
  useUsers,
} from '@/hooks/useSdrFechamento';
import { Sdr, SdrCompPlan, SdrStatus } from '@/types/sdr-fechamento';
import { formatCurrency } from '@/lib/formatters';
import { Plus, Check, X, Users, FileText, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const StatusBadge = ({ status }: { status: SdrStatus }) => {
  const config = {
    PENDING: { label: 'Pendente', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    APPROVED: { label: 'Aprovado', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
    REJECTED: { label: 'Rejeitado', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
  };
  const { label, className } = config[status] || config.PENDING;
  return <Badge variant="outline" className={className}>{label}</Badge>;
};

const SdrFormDialog = ({ onSuccess }: { onSuccess: () => void }) => {
  const { role } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [userId, setUserId] = useState('');
  const [active, setActive] = useState(true);
  
  const { data: users } = useUsers();
  const createSdr = useCreateSdr();

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    await createSdr.mutateAsync({
      name: name.trim(),
      user_id: userId || null,
      active,
    });
    
    setName('');
    setUserId('');
    setActive(true);
    setOpen(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Novo SDR
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cadastrar SDR</DialogTitle>
          <DialogDescription>
            {role === 'admin' 
              ? 'O SDR será criado como aprovado automaticamente.'
              : 'O SDR será criado como pendente e precisará de aprovação do Admin.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do SDR</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome completo"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user">Usuário vinculado (opcional)</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um usuário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhum</SelectItem>
                {users?.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="active" checked={active} onCheckedChange={setActive} />
            <Label htmlFor="active">Ativo</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={createSdr.isPending}>
            {createSdr.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const CompPlanFormDialog = ({ sdrs, onSuccess }: { sdrs: Sdr[]; onSuccess: () => void }) => {
  const { role } = useAuth();
  const [open, setOpen] = useState(false);
  const [sdrId, setSdrId] = useState('');
  const [vigenciaInicio, setVigenciaInicio] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [oteTotal, setOteTotal] = useState('4000');
  const [fixoValor, setFixoValor] = useState('2000');
  const [valorMetaRpg, setValorMetaRpg] = useState('500');
  const [valorDocsReuniao, setValorDocsReuniao] = useState('500');
  const [valorTentativas, setValorTentativas] = useState('500');
  const [valorOrganizacao, setValorOrganizacao] = useState('500');
  const [metaReunioesAgendadas, setMetaReunioesAgendadas] = useState('40');
  const [metaReunioesRealizadas, setMetaReunioesRealizadas] = useState('30');
  const [metaTentativas, setMetaTentativas] = useState('300');
  const [metaOrganizacao, setMetaOrganizacao] = useState('100');
  const [ifoodMensal, setIfoodMensal] = useState('200');
  const [ifoodUltrameta, setIfoodUltrameta] = useState('100');

  const createCompPlan = useCreateCompPlan();

  const handleSubmit = async () => {
    if (!sdrId) {
      toast.error('Selecione um SDR');
      return;
    }

    const variavelTotal = Number(valorMetaRpg) + Number(valorDocsReuniao) + Number(valorTentativas) + Number(valorOrganizacao);

    await createCompPlan.mutateAsync({
      sdr_id: sdrId,
      vigencia_inicio: vigenciaInicio,
      vigencia_fim: null,
      ote_total: Number(oteTotal),
      fixo_valor: Number(fixoValor),
      variavel_total: variavelTotal,
      valor_meta_rpg: Number(valorMetaRpg),
      valor_docs_reuniao: Number(valorDocsReuniao),
      valor_tentativas: Number(valorTentativas),
      valor_organizacao: Number(valorOrganizacao),
      meta_reunioes_agendadas: Number(metaReunioesAgendadas),
      meta_reunioes_realizadas: Number(metaReunioesRealizadas),
      meta_tentativas: Number(metaTentativas),
      meta_organizacao: Number(metaOrganizacao),
      ifood_mensal: Number(ifoodMensal),
      ifood_ultrameta: Number(ifoodUltrameta),
    });

    setOpen(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Novo Plano OTE
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastrar Plano OTE</DialogTitle>
          <DialogDescription>
            {role === 'admin' 
              ? 'O plano será criado como aprovado automaticamente.'
              : 'O plano será criado como pendente e precisará de aprovação do Admin.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="space-y-2 col-span-2">
            <Label>SDR</Label>
            <Select value={sdrId} onValueChange={setSdrId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um SDR" />
              </SelectTrigger>
              <SelectContent>
                {sdrs.filter(s => s.status === 'APPROVED').map((sdr) => (
                  <SelectItem key={sdr.id} value={sdr.id}>{sdr.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Vigência Início</Label>
            <Input type="date" value={vigenciaInicio} onChange={(e) => setVigenciaInicio(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>OTE Total (R$)</Label>
            <Input type="number" value={oteTotal} onChange={(e) => setOteTotal(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Fixo (R$)</Label>
            <Input type="number" value={fixoValor} onChange={(e) => setFixoValor(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Valor Meta RPG (R$)</Label>
            <Input type="number" value={valorMetaRpg} onChange={(e) => setValorMetaRpg(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Valor Docs Reunião (R$)</Label>
            <Input type="number" value={valorDocsReuniao} onChange={(e) => setValorDocsReuniao(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Valor Tentativas (R$)</Label>
            <Input type="number" value={valorTentativas} onChange={(e) => setValorTentativas(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Valor Organização (R$)</Label>
            <Input type="number" value={valorOrganizacao} onChange={(e) => setValorOrganizacao(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Meta Reuniões Agendadas</Label>
            <Input type="number" value={metaReunioesAgendadas} onChange={(e) => setMetaReunioesAgendadas(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Meta Reuniões Realizadas</Label>
            <Input type="number" value={metaReunioesRealizadas} onChange={(e) => setMetaReunioesRealizadas(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Meta Tentativas</Label>
            <Input type="number" value={metaTentativas} onChange={(e) => setMetaTentativas(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Meta Organização</Label>
            <Input type="number" value={metaOrganizacao} onChange={(e) => setMetaOrganizacao(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>iFood Mensal (R$)</Label>
            <Input type="number" value={ifoodMensal} onChange={(e) => setIfoodMensal(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>iFood Ultrameta (R$)</Label>
            <Input type="number" value={ifoodUltrameta} onChange={(e) => setIfoodUltrameta(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={createCompPlan.isPending}>
            {createCompPlan.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ConfiguracoesSdr = () => {
  const { role, user } = useAuth();
  const isAdmin = role === 'admin';
  
  const { data: sdrs, isLoading: sdrsLoading, refetch: refetchSdrs } = useSdrsAll();
  const { data: compPlans, isLoading: plansLoading, refetch: refetchPlans } = useAllCompPlans();
  
  const approveSdr = useApproveSdr();
  const approveCompPlan = useApproveCompPlan();

  const handleApproveSdr = async (sdrId: string, approve: boolean) => {
    await approveSdr.mutateAsync({ sdrId, approve, userId: user?.id || '' });
    refetchSdrs();
  };

  const handleApproveCompPlan = async (planId: string, approve: boolean) => {
    await approveCompPlan.mutateAsync({ planId, approve, userId: user?.id || '' });
    refetchPlans();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configurações de Fechamento SDR</h1>
        <p className="text-muted-foreground">
          Gerencie SDRs e planos de compensação OTE
        </p>
      </div>

      <Tabs defaultValue="sdrs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sdrs" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            SDRs
          </TabsTrigger>
          <TabsTrigger value="plans" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Planos OTE
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sdrs">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>SDRs Cadastrados</CardTitle>
              <SdrFormDialog onSuccess={() => refetchSdrs()} />
            </CardHeader>
            <CardContent>
              {sdrsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !sdrs || sdrs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum SDR cadastrado.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ativo</TableHead>
                      <TableHead>Data Criação</TableHead>
                      {isAdmin && <TableHead className="text-center">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sdrs.map((sdr) => (
                      <TableRow key={sdr.id}>
                        <TableCell className="font-medium">{sdr.name}</TableCell>
                        <TableCell><StatusBadge status={sdr.status} /></TableCell>
                        <TableCell>
                          <Badge variant={sdr.active ? 'default' : 'outline'}>
                            {sdr.active ? 'Sim' : 'Não'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(sdr.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-center">
                            {sdr.status === 'PENDING' && (
                              <div className="flex items-center justify-center gap-2">
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="text-green-500 hover:text-green-400"
                                  onClick={() => handleApproveSdr(sdr.id, true)}
                                  disabled={approveSdr.isPending}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="text-red-500 hover:text-red-400"
                                  onClick={() => handleApproveSdr(sdr.id, false)}
                                  disabled={approveSdr.isPending}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Planos OTE</CardTitle>
              <CompPlanFormDialog sdrs={sdrs || []} onSuccess={() => refetchPlans()} />
            </CardHeader>
            <CardContent>
              {plansLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !compPlans || compPlans.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum plano OTE cadastrado.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SDR</TableHead>
                      <TableHead>Vigência</TableHead>
                      <TableHead className="text-right">OTE Total</TableHead>
                      <TableHead className="text-right">Fixo</TableHead>
                      <TableHead className="text-right">Variável</TableHead>
                      <TableHead>Status</TableHead>
                      {isAdmin && <TableHead className="text-center">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {compPlans.map((plan) => (
                      <TableRow key={plan.id}>
                        <TableCell className="font-medium">{(plan as any).sdr?.name || 'N/A'}</TableCell>
                        <TableCell>
                          {format(new Date(plan.vigencia_inicio), 'dd/MM/yyyy', { locale: ptBR })}
                          {plan.vigencia_fim && ` - ${format(new Date(plan.vigencia_fim), 'dd/MM/yyyy', { locale: ptBR })}`}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(plan.ote_total)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(plan.fixo_valor)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(plan.variavel_total)}</TableCell>
                        <TableCell><StatusBadge status={plan.status} /></TableCell>
                        {isAdmin && (
                          <TableCell className="text-center">
                            {plan.status === 'PENDING' && (
                              <div className="flex items-center justify-center gap-2">
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="text-green-500 hover:text-green-400"
                                  onClick={() => handleApproveCompPlan(plan.id, true)}
                                  disabled={approveCompPlan.isPending}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="text-red-500 hover:text-red-400"
                                  onClick={() => handleApproveCompPlan(plan.id, false)}
                                  disabled={approveCompPlan.isPending}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ConfiguracoesSdr;
