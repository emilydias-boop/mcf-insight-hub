import { useState, useEffect } from 'react';
import { Employee, EMPLOYEE_STATUS_LABELS, CARGO_OPTIONS, SQUAD_OPTIONS, TIPO_VINCULO_OPTIONS, DEPARTAMENTO_OPTIONS } from '@/types/hr';
import { useEmployeeMutations, useEmployees } from '@/hooks/useEmployees';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Pencil, Save, X, ChevronDown, Briefcase, User, MapPin } from 'lucide-react';
import ProfileLinkSection from '../ProfileLinkSection';

interface EmployeeGeneralTabProps {
  employee: Employee;
}

export default function EmployeeGeneralTab({ employee }: EmployeeGeneralTabProps) {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState(employee);
  const [addressOpen, setAddressOpen] = useState(false);
  const { updateEmployee } = useEmployeeMutations();
  const { data: employees } = useEmployees();

  // Sync formData when employee changes
  useEffect(() => {
    setFormData(employee);
  }, [employee]);

  // Lista de possíveis gestores (excluindo o próprio colaborador)
  const gestorOptions = employees?.filter(e => e.id !== employee.id) || [];

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

        {/* Seção de Vinculação com Usuário do Sistema */}
        <ProfileLinkSection employee={employee} editing={true} />

        {/* Bloco 1: Dados de Emprego (PRIMEIRO) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Dados de Emprego
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cargo / Função</Label>
              <Select
                value={formData.cargo || '_none'}
                onValueChange={(v) => setFormData({ ...formData, cargo: v === '_none' ? null : v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Selecione...</SelectItem>
                  {CARGO_OPTIONS.map((cargo) => (
                    <SelectItem key={cargo} value={cargo}>{cargo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select
                value={formData.departamento || '_none'}
                onValueChange={(v) => setFormData({ ...formData, departamento: v === '_none' ? null : v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Selecione...</SelectItem>
                  {DEPARTAMENTO_OPTIONS.map((dept) => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Squad / Equipe</Label>
              <Select
                value={formData.squad || '_none'}
                onValueChange={(v) => setFormData({ ...formData, squad: v === '_none' ? null : v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Selecione...</SelectItem>
                  {SQUAD_OPTIONS.map((squad) => (
                    <SelectItem key={squad} value={squad}>{squad}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Gestor Direto</Label>
              <Select
                value={formData.gestor_id || '_none'}
                onValueChange={(v) => setFormData({ ...formData, gestor_id: v === '_none' ? null : v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Nenhum</SelectItem>
                  {gestorOptions.map((gestor) => (
                    <SelectItem key={gestor.id} value={gestor.id}>{gestor.nome_completo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de Vínculo</Label>
              <Select
                value={formData.tipo_contrato || 'CLT'}
                onValueChange={(v) => setFormData({ ...formData, tipo_contrato: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPO_VINCULO_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data de Entrada</Label>
              <Input
                type="date"
                value={formData.data_admissao || ''}
                onChange={(e) => setFormData({ ...formData, data_admissao: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Data de Desligamento</Label>
              <Input
                type="date"
                value={formData.data_demissao || ''}
                onChange={(e) => setFormData({ ...formData, data_demissao: e.target.value || null })}
              />
            </div>
            <div className="space-y-2">
              <Label>Status RH</Label>
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
            <div className="col-span-2 space-y-2">
              <Label>Observação Geral</Label>
              <Textarea
                value={formData.observacao_geral || ''}
                onChange={(e) => setFormData({ ...formData, observacao_geral: e.target.value })}
                rows={2}
                placeholder="Observações sobre o colaborador..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Bloco 2: Dados Pessoais (simplificado) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Dados Pessoais
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>Nome Completo</Label>
              <Input
                value={formData.nome_completo}
                onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>CPF</Label>
              <Input
                value={formData.cpf || ''}
                onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Data de Nascimento</Label>
              <Input
                type="date"
                value={formData.data_nascimento || ''}
                onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={formData.telefone || ''}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email Pessoal</Label>
              <Input
                type="email"
                value={formData.email_pessoal || ''}
                onChange={(e) => setFormData({ ...formData, email_pessoal: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Bloco 3: Endereço (colapsável) */}
        <Collapsible open={addressOpen} onOpenChange={setAddressOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="text-base flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Endereço
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform ${addressOpen ? 'rotate-180' : ''}`} />
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="grid grid-cols-2 gap-4 pt-0">
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input
                    value={formData.cidade || ''}
                    onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Input
                    value={formData.estado || ''}
                    onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Endereço Completo</Label>
                  <Textarea
                    value={formData.endereco || ''}
                    onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                    rows={2}
                    placeholder="Rua, número, complemento, bairro, CEP..."
                  />
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    );
  }

  // View Mode
  const gestor = employee.gestor_id 
    ? gestorOptions.find(e => e.id === employee.gestor_id)
    : null;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil className="h-4 w-4 mr-1" /> Editar
        </Button>
      </div>

      {/* Seção de Vinculação com Usuário do Sistema */}
      <ProfileLinkSection employee={employee} editing={false} />

      {/* Bloco 1: Dados de Emprego */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Dados de Emprego
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <InfoRow label="Cargo / Função" value={employee.cargo} />
          <InfoRow label="Departamento" value={employee.departamento} />
          <InfoRow label="Squad / Equipe" value={employee.squad} />
          <InfoRow label="Gestor Direto" value={gestor?.nome_completo || null} />
          <InfoRow label="Tipo de Vínculo" value={employee.tipo_contrato} />
          <InfoRow
            label="Data de Entrada"
            value={employee.data_admissao ? format(new Date(employee.data_admissao), 'dd/MM/yyyy', { locale: ptBR }) : null}
          />
          <InfoRow
            label="Data de Desligamento"
            value={employee.data_demissao ? format(new Date(employee.data_demissao), 'dd/MM/yyyy', { locale: ptBR }) : null}
          />
          <InfoRow label="Status RH" value={EMPLOYEE_STATUS_LABELS[employee.status].label} />
          {employee.observacao_geral && (
            <div className="py-2">
              <span className="text-muted-foreground text-sm block mb-1">Observação</span>
              <p className="text-sm">{employee.observacao_geral}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bloco 2: Dados Pessoais */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Dados Pessoais
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <InfoRow label="Nome Completo" value={employee.nome_completo} />
          <InfoRow label="CPF" value={employee.cpf} />
          <InfoRow
            label="Data de Nascimento"
            value={employee.data_nascimento ? format(new Date(employee.data_nascimento), 'dd/MM/yyyy', { locale: ptBR }) : null}
          />
          <InfoRow label="Telefone" value={employee.telefone} />
          <InfoRow label="Email Pessoal" value={employee.email_pessoal} />
        </CardContent>
      </Card>

      {/* Bloco 3: Endereço (colapsável) */}
      <Collapsible open={addressOpen} onOpenChange={setAddressOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="text-base flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Endereço
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${addressOpen ? 'rotate-180' : ''}`} />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="divide-y pt-0">
              <InfoRow label="Cidade" value={employee.cidade} />
              <InfoRow label="Estado" value={employee.estado} />
              <InfoRow label="Endereço" value={employee.endereco} />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
