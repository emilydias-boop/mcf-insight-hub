import { useState } from 'react';
import { Employee, EMPLOYEE_STATUS_LABELS } from '@/types/hr';
import { useEmployeeMutations } from '@/hooks/useEmployees';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Pencil, Save, X } from 'lucide-react';

interface EmployeeGeneralTabProps {
  employee: Employee;
}

export default function EmployeeGeneralTab({ employee }: EmployeeGeneralTabProps) {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState(employee);
  const { updateEmployee } = useEmployeeMutations();

  const handleSave = () => {
    updateEmployee.mutate(
      { id: employee.id, data: formData },
      { onSuccess: () => setEditing(false) }
    );
  };

  const handleCancel = () => {
    setFormData(employee);
    setEditing(false);
  };

  const InfoRow = ({ label, value }: { label: string; value: string | null }) => (
    <div className="flex justify-between py-2">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="font-medium text-sm">{value || '-'}</span>
    </div>
  );

  if (editing) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={handleCancel}>
            <X className="h-4 w-4 mr-1" /> Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={updateEmployee.isPending}>
            <Save className="h-4 w-4 mr-1" /> Salvar
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados Pessoais</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Nome Completo</Label>
              <Input
                value={formData.nome_completo}
                onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })}
              />
            </div>
            <div>
              <Label>CPF</Label>
              <Input
                value={formData.cpf || ''}
                onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
              />
            </div>
            <div>
              <Label>RG</Label>
              <Input
                value={formData.rg || ''}
                onChange={(e) => setFormData({ ...formData, rg: e.target.value })}
              />
            </div>
            <div>
              <Label>Data de Nascimento</Label>
              <Input
                type="date"
                value={formData.data_nascimento || ''}
                onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
              />
            </div>
            <div>
              <Label>Estado Civil</Label>
              <Select
                value={formData.estado_civil || ''}
                onValueChange={(v) => setFormData({ ...formData, estado_civil: v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                  <SelectItem value="casado">Casado(a)</SelectItem>
                  <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                  <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                  <SelectItem value="uniao_estavel">União Estável</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={formData.telefone || ''}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
              />
            </div>
            <div>
              <Label>Email Pessoal</Label>
              <Input
                type="email"
                value={formData.email_pessoal || ''}
                onChange={(e) => setFormData({ ...formData, email_pessoal: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Endereço</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Endereço</Label>
              <Input
                value={formData.endereco || ''}
                onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
              />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input
                value={formData.cidade || ''}
                onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
              />
            </div>
            <div>
              <Label>Estado</Label>
              <Input
                value={formData.estado || ''}
                onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
              />
            </div>
            <div>
              <Label>CEP</Label>
              <Input
                value={formData.cep || ''}
                onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados Profissionais</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div>
              <Label>Cargo</Label>
              <Input
                value={formData.cargo || ''}
                onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
              />
            </div>
            <div>
              <Label>Departamento</Label>
              <Input
                value={formData.departamento || ''}
                onChange={(e) => setFormData({ ...formData, departamento: e.target.value })}
              />
            </div>
            <div>
              <Label>Tipo de Contrato</Label>
              <Select
                value={formData.tipo_contrato || 'CLT'}
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
              <Label>Jornada de Trabalho</Label>
              <Input
                value={formData.jornada_trabalho || ''}
                onChange={(e) => setFormData({ ...formData, jornada_trabalho: e.target.value })}
              />
            </div>
            <div>
              <Label>Data de Admissão</Label>
              <Input
                type="date"
                value={formData.data_admissao || ''}
                onChange={(e) => setFormData({ ...formData, data_admissao: e.target.value })}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData({ ...formData, status: v as Employee['status'] })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(EMPLOYEE_STATUS_LABELS).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil className="h-4 w-4 mr-1" /> Editar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados Pessoais</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <InfoRow label="Nome Completo" value={employee.nome_completo} />
          <InfoRow label="CPF" value={employee.cpf} />
          <InfoRow label="RG" value={employee.rg} />
          <InfoRow
            label="Data de Nascimento"
            value={employee.data_nascimento ? format(new Date(employee.data_nascimento), 'dd/MM/yyyy', { locale: ptBR }) : null}
          />
          <InfoRow label="Estado Civil" value={employee.estado_civil} />
          <InfoRow label="Nacionalidade" value={employee.nacionalidade} />
          <InfoRow label="Telefone" value={employee.telefone} />
          <InfoRow label="Email Pessoal" value={employee.email_pessoal} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Endereço</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <InfoRow label="Endereço" value={employee.endereco} />
          <InfoRow label="Cidade" value={employee.cidade} />
          <InfoRow label="Estado" value={employee.estado} />
          <InfoRow label="CEP" value={employee.cep} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados Profissionais</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <InfoRow label="Cargo" value={employee.cargo} />
          <InfoRow label="Departamento" value={employee.departamento} />
          <InfoRow label="Tipo de Contrato" value={employee.tipo_contrato} />
          <InfoRow label="Jornada de Trabalho" value={employee.jornada_trabalho} />
          <InfoRow
            label="Data de Admissão"
            value={employee.data_admissao ? format(new Date(employee.data_admissao), 'dd/MM/yyyy', { locale: ptBR }) : null}
          />
          <InfoRow
            label="Data de Demissão"
            value={employee.data_demissao ? format(new Date(employee.data_demissao), 'dd/MM/yyyy', { locale: ptBR }) : null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
