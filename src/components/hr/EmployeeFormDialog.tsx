import { useState } from 'react';
import { useEmployeeMutations } from '@/hooks/useEmployees';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import CargoSelect from './CargoSelect';

interface EmployeeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EmployeeFormDialog({ open, onOpenChange }: EmployeeFormDialogProps) {
  const { createEmployee } = useEmployeeMutations();
  const [formData, setFormData] = useState({
    nome_completo: '',
    cpf: '',
    cargo: '' as string | null,
    cargo_catalogo_id: null as string | null,
    departamento: '',
    data_admissao: '',
    tipo_contrato: 'CLT',
    salario_base: 0,
    nivel: 1,
    email_pessoal: '',
  });
  const [createSystemUser, setCreateSystemUser] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!formData.nome_completo.trim()) return;
    setSubmitting(true);
    try {
      // 1. Resolve cargo role_sistema (defines if we should provision a system user)
      let roleSistema: string | null = null;
      let area: string | null = null;
      if (formData.cargo_catalogo_id) {
        const { data: cargo } = await supabase
          .from('cargos_catalogo')
          .select('role_sistema, area')
          .eq('id', formData.cargo_catalogo_id)
          .maybeSingle();
        roleSistema = (cargo as any)?.role_sistema || null;
        area = (cargo as any)?.area || null;
      }

      // 2. Create employee
      const employee = await createEmployee.mutateAsync(formData);

      // 3. Optionally provision auth user + role + sdr/closer (trigger handles closer/sdr rows)
      if (createSystemUser && roleSistema && formData.email_pessoal.trim()) {
        const squadGuess = (() => {
          const a = (area || '').toLowerCase();
          if (a.includes('consórcio') || a.includes('consorcio')) return 'consorcio';
          if (a.includes('inside') || a.includes('incorporador')) return 'incorporador';
          if (a.includes('crédito') || a.includes('credito')) return 'credito';
          if (a.includes('leilão') || a.includes('leilao')) return 'leilao';
          return null;
        })();
        const { error: fnError } = await supabase.functions.invoke('create-user', {
          body: {
            email: formData.email_pessoal.trim(),
            full_name: formData.nome_completo.trim(),
            role: roleSistema,
            squad: squadGuess,
            cargo_id: formData.cargo_catalogo_id,
          },
        });
        if (fnError) {
          toast.error('Colaborador criado, mas falhou ao gerar usuário: ' + fnError.message);
        } else {
          toast.success('Usuário do sistema criado e e-mail de senha enviado');
        }
      }

      setFormData({
        nome_completo: '',
        cpf: '',
        cargo: null,
        cargo_catalogo_id: null,
        departamento: '',
        data_admissao: '',
        tipo_contrato: 'CLT',
        salario_base: 0,
        nivel: 1,
        email_pessoal: '',
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Colaborador</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Nome Completo *</Label>
              <Input
                value={formData.nome_completo}
                onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })}
                placeholder="Nome completo do colaborador"
              />
            </div>
            <div>
              <Label>CPF</Label>
              <Input
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                placeholder="000.000.000-00"
              />
            </div>
            <div>
              <Label>Data de Admissão</Label>
              <Input
                type="date"
                value={formData.data_admissao}
                onChange={(e) => setFormData({ ...formData, data_admissao: e.target.value })}
              />
            </div>
            <div>
              <Label>Cargo</Label>
              <CargoSelect
                cargoId={formData.cargo_catalogo_id}
                cargoTexto={formData.cargo}
                onChange={(cargoId, cargoTexto) => setFormData({ 
                  ...formData, 
                  cargo_catalogo_id: cargoId, 
                  cargo: cargoTexto 
                })}
                showInfo={false}
              />
            </div>
            <div>
              <Label>Departamento</Label>
              <Input
                value={formData.departamento}
                onChange={(e) => setFormData({ ...formData, departamento: e.target.value })}
                placeholder="Ex: Comercial, Marketing"
              />
            </div>
            <div>
              <Label>Tipo de Contrato</Label>
              <Select
                value={formData.tipo_contrato}
                onValueChange={(v) => setFormData({ ...formData, tipo_contrato: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLT">CLT</SelectItem>
                  <SelectItem value="PJ">PJ</SelectItem>
                  <SelectItem value="Estagio">Estágio</SelectItem>
                  <SelectItem value="Temporario">Temporário</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Salário Base</Label>
              <Input
                type="number"
                value={formData.salario_base}
                onChange={(e) => setFormData({ ...formData, salario_base: parseFloat(e.target.value) || 0 })}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label>Nível</Label>
              <Select
                value={String(formData.nivel)}
                onValueChange={(v) => setFormData({ ...formData, nivel: parseInt(v) })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <SelectItem key={n} value={String(n)}>Nível {n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-semibold">Acesso ao Sistema</Label>
                <p className="text-xs text-muted-foreground">
                  Cria login + papel + registro operacional (Closer/SDR) automaticamente.
                </p>
              </div>
              <Switch checked={createSystemUser} onCheckedChange={setCreateSystemUser} />
            </div>
            {createSystemUser && (
              <div>
                <Label>E-mail de login *</Label>
                <Input
                  type="email"
                  value={formData.email_pessoal}
                  onChange={(e) => setFormData({ ...formData, email_pessoal: e.target.value })}
                  placeholder="usuario@minhacasafinanciada.com"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Um e-mail será enviado para o colaborador definir a senha.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !formData.nome_completo.trim() ||
              submitting ||
              createEmployee.isPending ||
              (createSystemUser && !formData.email_pessoal.trim())
            }
          >
            Cadastrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
