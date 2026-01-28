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
  useDeleteCompPlan,
  useUsers,
  useUpdateSdr,
  useUpdateCompPlan,
} from '@/hooks/useSdrFechamento';
import { Sdr, SdrCompPlan, SdrStatus } from '@/types/sdr-fechamento';
import { formatCurrency } from '@/lib/formatters';
import { Plus, Check, X, Users, FileText, RefreshCw, Calendar, Pencil, ToggleLeft, ToggleRight, Trash2, Target } from 'lucide-react';
import { toast } from 'sonner';
import { WorkingDaysCalendar } from '@/components/sdr-fechamento/WorkingDaysCalendar';
import { ActiveMetricsTab } from '@/components/fechamento/ActiveMetricsTab';

const StatusBadge = ({ status }: { status: SdrStatus }) => {
  const config = {
    PENDING: { label: 'Pendente', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    APPROVED: { label: 'Aprovado', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
    REJECTED: { label: 'Rejeitado', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
  };
  const { label, className } = config[status] || config.PENDING;
  return <Badge variant="outline" className={className}>{label}</Badge>;
};

// Edit SDR Dialog
const EditSdrDialog = ({ sdr, onSuccess }: { sdr: Sdr; onSuccess: () => void }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(sdr.name);
  const [email, setEmail] = useState(sdr.email || '');
  const [nivel, setNivel] = useState(String(sdr.nivel || 1));
  const [metaDiaria, setMetaDiaria] = useState(String(sdr.meta_diaria || 5));
  
  const updateSdr = useUpdateSdr();

  const handleSubmit = async () => {
    await updateSdr.mutateAsync({
      id: sdr.id,
      name: name.trim(),
      email: email.trim() || null,
      nivel: Number(nivel),
      meta_diaria: Number(metaDiaria),
    });
    setOpen(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-blue-500 hover:text-blue-400">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar SDR</DialogTitle>
          <DialogDescription>Atualize os dados do SDR</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email (para sincronização Clint)</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nível</Label>
              <Select value={nivel} onValueChange={setNivel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1,2,3,4,5,6,7].map(n => (
                    <SelectItem key={n} value={String(n)}>Nível {n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Meta Diária</Label>
              <Input type="number" value={metaDiaria} onChange={(e) => setMetaDiaria(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={updateSdr.isPending}>
            {updateSdr.isPending && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Edit Comp Plan Dialog
const EditCompPlanDialog = ({ plan, onSuccess }: { plan: SdrCompPlan; onSuccess: () => void }) => {
  const [open, setOpen] = useState(false);
  const [fixoValor, setFixoValor] = useState(String(plan.fixo_valor));
  const [valorMetaRpg, setValorMetaRpg] = useState(String(plan.valor_meta_rpg));
  const [valorDocsReuniao, setValorDocsReuniao] = useState(String(plan.valor_docs_reuniao));
  const [valorTentativas, setValorTentativas] = useState(String(plan.valor_tentativas));
  const [valorOrganizacao, setValorOrganizacao] = useState(String(plan.valor_organizacao));
  
  const updateCompPlan = useUpdateCompPlan();

  // Auto-calcular OTE e Variável
  const variavelTotal = Number(valorMetaRpg) + Number(valorDocsReuniao) + Number(valorTentativas) + Number(valorOrganizacao);
  const oteCalculado = Number(fixoValor) + variavelTotal;

  const handleSubmit = async () => {
    await updateCompPlan.mutateAsync({
      id: plan.id,
      ote_total: oteCalculado,
      fixo_valor: Number(fixoValor),
      variavel_total: variavelTotal,
      valor_meta_rpg: Number(valorMetaRpg),
      valor_docs_reuniao: Number(valorDocsReuniao),
      valor_tentativas: Number(valorTentativas),
      valor_organizacao: Number(valorOrganizacao),
      // Valores padrão para campos obsoletos (não usados no cálculo)
      meta_reunioes_agendadas: 0,
      meta_reunioes_realizadas: 0,
      meta_tentativas: 0,
      meta_organizacao: 100,
    });
    setOpen(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-blue-500 hover:text-blue-400">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Plano OTE</DialogTitle>
          <DialogDescription>
            Atualize os valores do plano de compensação. Metas são calculadas automaticamente.
          </DialogDescription>
        </DialogHeader>
        
        {/* Nota informativa sobre metas automáticas */}
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2.5 border">
          <strong>Metas automáticas:</strong> Reuniões Agendadas usa meta diária do SDR × dias úteis, 
          Realizadas usa 70% do realizado, Tentativas usa 84/dia e Organização usa 100%.
        </div>
        
        <div className="grid grid-cols-2 gap-4 py-2">
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
          
          {/* OTE Calculado - Read-only */}
          <div className="space-y-2">
            <Label className="text-muted-foreground">OTE Calculado</Label>
            <div className="h-9 px-3 py-2 rounded-md border bg-muted/50 text-sm font-medium">
              R$ {oteCalculado.toLocaleString('pt-BR')}
            </div>
          </div>
        </div>
        
        {/* Preview da composição */}
        <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2 grid grid-cols-2 gap-1">
          <span>Fixo:</span>
          <span className="text-right">R$ {Number(fixoValor).toLocaleString('pt-BR')}</span>
          <span>Variável Total:</span>
          <span className="text-right">R$ {variavelTotal.toLocaleString('pt-BR')}</span>
          <span className="font-medium border-t pt-1 mt-1">OTE Total:</span>
          <span className="text-right font-medium border-t pt-1 mt-1">R$ {oteCalculado.toLocaleString('pt-BR')}</span>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={updateCompPlan.isPending}>
            {updateCompPlan.isPending && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const SdrFormDialog = ({ onSuccess }: { onSuccess: () => void }) => {
  const { role } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [nivel, setNivel] = useState('1');
  const [metaDiaria, setMetaDiaria] = useState('5');
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
      email: email.trim() || null,
      user_id: userId || null,
      nivel: Number(nivel),
      meta_diaria: Number(metaDiaria),
      active,
    });
    
    setName('');
    setEmail('');
    setUserId('');
    setNivel('1');
    setMetaDiaria('5');
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
            <Label>Email (para sincronização Clint)</Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user">Usuário vinculado (opcional)</Label>
            <Select value={userId} onValueChange={(val) => setUserId(val === '__none__' ? '' : val)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um usuário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhum</SelectItem>
                {users?.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nível</Label>
              <Select value={nivel} onValueChange={setNivel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1,2,3,4,5,6,7].map(n => (
                    <SelectItem key={n} value={String(n)}>Nível {n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Meta Diária</Label>
              <Input type="number" value={metaDiaria} onChange={(e) => setMetaDiaria(e.target.value)} />
            </div>
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
  const [fixoValor, setFixoValor] = useState('2000');
  const [valorMetaRpg, setValorMetaRpg] = useState('500');
  const [valorDocsReuniao, setValorDocsReuniao] = useState('500');
  const [valorTentativas, setValorTentativas] = useState('500');
  const [valorOrganizacao, setValorOrganizacao] = useState('500');
  const [ifoodMensal, setIfoodMensal] = useState('630');
  const [ifoodUltrameta, setIfoodUltrameta] = useState('840');
  const [diasUteis, setDiasUteis] = useState('22');
  const [metaNoShowPct, setMetaNoShowPct] = useState('30');

  const createCompPlan = useCreateCompPlan();

  // Auto-calcular OTE e Variável
  const variavelTotal = Number(valorMetaRpg) + Number(valorDocsReuniao) + Number(valorTentativas) + Number(valorOrganizacao);
  const oteCalculado = Number(fixoValor) + variavelTotal;

  const handleSubmit = async () => {
    if (!sdrId) {
      toast.error('Selecione um SDR');
      return;
    }

    await createCompPlan.mutateAsync({
      sdr_id: sdrId,
      vigencia_inicio: vigenciaInicio,
      vigencia_fim: null,
      ote_total: oteCalculado,
      fixo_valor: Number(fixoValor),
      variavel_total: variavelTotal,
      valor_meta_rpg: Number(valorMetaRpg),
      valor_docs_reuniao: Number(valorDocsReuniao),
      valor_tentativas: Number(valorTentativas),
      valor_organizacao: Number(valorOrganizacao),
      // Valores padrão para campos obsoletos (não usados no cálculo)
      meta_reunioes_agendadas: 0,
      meta_reunioes_realizadas: 0,
      meta_tentativas: 0,
      meta_organizacao: 100,
      ifood_mensal: Number(ifoodMensal),
      ifood_ultrameta: Number(ifoodUltrameta),
      dias_uteis: Number(diasUteis),
      meta_no_show_pct: Number(metaNoShowPct),
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastrar Plano OTE</DialogTitle>
          <DialogDescription>
            {role === 'admin' 
              ? 'O plano será criado como aprovado automaticamente.'
              : 'O plano será criado como pendente e precisará de aprovação do Admin.'}
          </DialogDescription>
        </DialogHeader>
        
        {/* Nota informativa sobre metas automáticas */}
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2.5 border">
          <strong>Metas automáticas:</strong> Reuniões Agendadas usa meta diária do SDR × dias úteis, 
          Realizadas usa 70% do realizado, Tentativas usa 84/dia e Organização usa 100%.
        </div>
        
        <div className="grid grid-cols-2 gap-4 py-2">
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
            <Label>Dias Úteis</Label>
            <Input type="number" value={diasUteis} onChange={(e) => setDiasUteis(e.target.value)} />
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
          
          {/* OTE Calculado - Read-only */}
          <div className="space-y-2">
            <Label className="text-muted-foreground">OTE Calculado</Label>
            <div className="h-9 px-3 py-2 rounded-md border bg-muted/50 text-sm font-medium">
              R$ {oteCalculado.toLocaleString('pt-BR')}
            </div>
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
        
        {/* Preview da composição */}
        <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2 grid grid-cols-2 gap-1">
          <span>Fixo:</span>
          <span className="text-right">R$ {Number(fixoValor).toLocaleString('pt-BR')}</span>
          <span>Variável Total:</span>
          <span className="text-right">R$ {variavelTotal.toLocaleString('pt-BR')}</span>
          <span className="font-medium border-t pt-1 mt-1">OTE Total:</span>
          <span className="text-right font-medium border-t pt-1 mt-1">R$ {oteCalculado.toLocaleString('pt-BR')}</span>
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
  const deleteCompPlan = useDeleteCompPlan();
  const updateSdr = useUpdateSdr();

  const handleApproveSdr = async (sdrId: string, approve: boolean) => {
    await approveSdr.mutateAsync({ sdrId, approve, userId: user?.id || '' });
    refetchSdrs();
  };

  const handleApproveCompPlan = async (planId: string, approve: boolean) => {
    await approveCompPlan.mutateAsync({ planId, approve, userId: user?.id || '' });
    refetchPlans();
  };

  const handleToggleActive = async (sdr: Sdr) => {
    await updateSdr.mutateAsync({
      id: sdr.id,
      active: !sdr.active,
    });
    refetchSdrs();
  };

  const handleDeleteCompPlan = async (planId: string, sdrName: string) => {
    if (!window.confirm(`Deseja excluir o plano OTE de ${sdrName}? Esta ação não pode ser desfeita.`)) {
      return;
    }
    await deleteCompPlan.mutateAsync(planId);
    refetchPlans();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configurações de Fechamento</h1>
        <p className="text-muted-foreground">
          Gerencie equipe, planos de compensação e métricas
        </p>
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

        <TabsContent value="equipe">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Equipe Cadastrada</CardTitle>
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
                      <TableHead>Email</TableHead>
                      <TableHead className="text-center">Nível</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ativo</TableHead>
                      <TableHead>Data Criação</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sdrs.map((sdr) => (
                      <TableRow key={sdr.id}>
                        <TableCell className="font-medium">{sdr.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{sdr.email || '-'}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="font-mono">N{sdr.nivel || 1}</Badge>
                        </TableCell>
                        <TableCell><StatusBadge status={sdr.status} /></TableCell>
                        <TableCell>
                          <Badge variant={sdr.active ? 'default' : 'outline'}>
                            {sdr.active ? 'Sim' : 'Não'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(sdr.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {sdr.status === 'PENDING' && isAdmin && (
                              <>
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
                              </>
                            )}
                            {sdr.status === 'APPROVED' && (
                              <>
                                <EditSdrDialog sdr={sdr} onSuccess={() => refetchSdrs()} />
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className={sdr.active ? "text-orange-500 hover:text-orange-400" : "text-green-500 hover:text-green-400"}
                                  onClick={() => handleToggleActive(sdr)}
                                  disabled={updateSdr.isPending}
                                  title={sdr.active ? "Desativar SDR" : "Ativar SDR"}
                                >
                                  {sdr.active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
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
                      <TableHead className="text-center">Ações</TableHead>
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
                        <TableCell>
                          <StatusBadge status={(plan.status as string) === 'active' ? 'APPROVED' : plan.status} />
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {plan.status === 'PENDING' && isAdmin && (
                              <>
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
                              </>
                            )}
                            {(plan.status === 'APPROVED' || (plan.status as string) === 'active') && (
                              <>
                                <EditCompPlanDialog plan={plan as SdrCompPlan} onSuccess={() => refetchPlans()} />
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="text-red-500 hover:text-red-400"
                                  onClick={() => handleDeleteCompPlan(plan.id, (plan as any).sdr?.name || 'N/A')}
                                  disabled={deleteCompPlan.isPending}
                                  title="Excluir plano OTE"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metricas">
          <ActiveMetricsTab />
        </TabsContent>

        <TabsContent value="calendar">
          <WorkingDaysCalendar />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ConfiguracoesSdr;
