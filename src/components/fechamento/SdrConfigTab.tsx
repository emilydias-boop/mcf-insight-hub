import { useState, useMemo } from 'react';
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
import { useAuth } from '@/contexts/AuthContext';
import { 
  useSdrsAll, 
  useCreateSdr, 
  useApproveSdr,
  useUsers,
  useUpdateSdr,
} from '@/hooks/useSdrFechamento';
import { Sdr, SdrStatus } from '@/types/sdr-fechamento';
import { Plus, Check, X, Users, RefreshCw, Pencil, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';

// Squad options mapping
const SQUAD_OPTIONS = [
  { value: 'incorporador', label: 'BU - Incorporador' },
  { value: 'consorcio', label: 'BU - Consórcio' },
  { value: 'credito', label: 'BU - Crédito' },
  { value: 'projetos', label: 'BU - Projetos' },
  { value: 'leilao', label: 'BU - Leilão' },
];

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

// SDR Form Dialog
interface SdrFormDialogProps {
  onSuccess: () => void;
  defaultSquad?: string;
  lockSquad?: boolean;
}

const SdrFormDialog = ({ onSuccess, defaultSquad = 'incorporador', lockSquad = false }: SdrFormDialogProps) => {
  const { role } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [nivel, setNivel] = useState('1');
  const [metaDiaria, setMetaDiaria] = useState('5');
  const [active, setActive] = useState(true);
  const [squad, setSquad] = useState(defaultSquad);
  
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
      squad: lockSquad ? defaultSquad : squad,
    });
    
    setName('');
    setEmail('');
    setUserId('');
    setNivel('1');
    setMetaDiaria('5');
    setActive(true);
    setSquad(defaultSquad);
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
          
          {/* Business Unit - pode ser bloqueado */}
          <div className="space-y-2">
            <Label>Business Unit (Squad)</Label>
            {lockSquad ? (
              <div className="h-10 px-3 py-2 rounded-md border bg-muted/50 text-sm">
                {SQUAD_OPTIONS.find(o => o.value === defaultSquad)?.label || defaultSquad}
              </div>
            ) : (
              <Select value={squad} onValueChange={setSquad}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SQUAD_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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

// Props do componente principal
export interface SdrConfigTabProps {
  defaultSquad?: string;
  lockSquad?: boolean;
}

export function SdrConfigTab({ defaultSquad = 'incorporador', lockSquad = false }: SdrConfigTabProps) {
  const { role, user } = useAuth();
  const isAdmin = role === 'admin';
  
  const { data: sdrs, isLoading: sdrsLoading, refetch: refetchSdrs } = useSdrsAll();
  const approveSdr = useApproveSdr();
  const updateSdr = useUpdateSdr();

  // Filtrar SDRs por squad
  const filteredSdrs = useMemo(() => {
    if (!sdrs) return [];
    return sdrs.filter(s => s.squad === defaultSquad);
  }, [sdrs, defaultSquad]);

  const handleApproveSdr = async (sdrId: string, approve: boolean) => {
    await approveSdr.mutateAsync({ sdrId, approve, userId: user?.id || '' });
    refetchSdrs();
  };

  const handleToggleActive = async (sdr: Sdr) => {
    await updateSdr.mutateAsync({
      id: sdr.id,
      active: !sdr.active,
    });
    refetchSdrs();
  };

  const squadLabel = SQUAD_OPTIONS.find(o => o.value === defaultSquad)?.label || defaultSquad;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          SDRs {lockSquad && `- ${squadLabel}`}
        </CardTitle>
        <SdrFormDialog 
          onSuccess={() => refetchSdrs()} 
          defaultSquad={defaultSquad}
          lockSquad={lockSquad}
        />
      </CardHeader>
      <CardContent>
        {sdrsLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredSdrs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum SDR cadastrado{lockSquad ? ` para ${squadLabel}` : ''}.
            <p className="text-sm mt-2">
              Clique em "Novo SDR" para cadastrar.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-center">Nível</TableHead>
                <TableHead className="text-center">Meta Diária</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Ativo</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSdrs.map((sdr) => (
                <TableRow key={sdr.id}>
                  <TableCell className="font-medium">{sdr.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{sdr.email || '-'}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="font-mono">N{sdr.nivel || 1}</Badge>
                  </TableCell>
                  <TableCell className="text-center">{sdr.meta_diaria || 5}</TableCell>
                  <TableCell className="text-center">
                    <StatusBadge status={sdr.status} />
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggleActive(sdr)}
                      className={sdr.active ? "text-green-500" : "text-gray-400"}
                      title={sdr.active ? "Desativar" : "Ativar"}
                    >
                      {sdr.active ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                    </Button>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <EditSdrDialog sdr={sdr} onSuccess={() => refetchSdrs()} />
                      {isAdmin && sdr.status === 'PENDING' && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-green-500 hover:text-green-400"
                            onClick={() => handleApproveSdr(sdr.id, true)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-400"
                            onClick={() => handleApproveSdr(sdr.id, false)}
                          >
                            <X className="h-4 w-4" />
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
        
        {/* Nota informativa */}
        <div className="mt-4 text-xs text-muted-foreground bg-muted/50 rounded-md p-3 border">
          <strong>Vínculo automático:</strong> Ao criar um SDR com usuário vinculado, 
          o sistema automaticamente atualiza o campo <code>sdr_id</code> no colaborador correspondente no RH.
        </div>
      </CardContent>
    </Card>
  );
}
