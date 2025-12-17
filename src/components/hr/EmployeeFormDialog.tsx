import { useState } from 'react';
import { useEmployeeMutations } from '@/hooks/useEmployees';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface EmployeeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EmployeeFormDialog({ open, onOpenChange }: EmployeeFormDialogProps) {
  const { createEmployee } = useEmployeeMutations();
  const [formData, setFormData] = useState({
    nome_completo: '',
    cpf: '',
    cargo: '',
    departamento: '',
    data_admissao: '',
    tipo_contrato: 'CLT',
    salario_base: 0,
    nivel: 1,
  });

  const handleSubmit = () => {
    if (!formData.nome_completo.trim()) return;

    createEmployee.mutate(formData, {
      onSuccess: () => {
        setFormData({
          nome_completo: '',
          cpf: '',
          cargo: '',
          departamento: '',
          data_admissao: '',
          tipo_contrato: 'CLT',
          salario_base: 0,
          nivel: 1,
        });
        onOpenChange(false);
      },
    });
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
              <Input
                value={formData.cargo}
                onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                placeholder="Ex: SDR, Closer, Analista"
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!formData.nome_completo.trim() || createEmployee.isPending}>
            Cadastrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
