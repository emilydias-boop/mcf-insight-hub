import { useState } from "react";
import { User, Phone, Pencil, X, Save, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Employee } from "@/types/hr";
import { format, parse, isValid } from "date-fns";
import { useUpdateMyEmployee, UpdateMyEmployeeData } from "@/hooks/useMyEmployee";
import { ESTADOS_BRASIL } from "@/lib/constants";

interface MeuRHDadosPessoaisSectionProps {
  employee: Employee;
}

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function cleanCpf(value: string): string {
  return value.replace(/\D/g, '');
}

function cleanPhone(value: string): string {
  return value.replace(/\D/g, '');
}

function formatDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseDateInput(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  const day = parseInt(digits.slice(0, 2), 10);
  const month = parseInt(digits.slice(2, 4), 10);
  const year = parseInt(digits.slice(4, 8), 10);
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) return null;
  const date = new Date(year, month - 1, day);
  if (!isValid(date)) return null;
  return format(date, 'yyyy-MM-dd');
}

function isoToDisplay(iso: string | null): string {
  if (!iso) return '';
  try {
    const date = new Date(iso);
    if (!isValid(date)) return '';
    return format(date, 'dd/MM/yyyy');
  } catch {
    return '';
  }
}

export function MeuRHDadosPessoaisSection({ employee }: MeuRHDadosPessoaisSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const updateMutation = useUpdateMyEmployee();

  const [formData, setFormData] = useState({
    nome_completo: employee.nome_completo || '',
    cpf: employee.cpf || '',
    data_nascimento: employee.data_nascimento || null,
    data_nascimento_display: isoToDisplay(employee.data_nascimento),
    nacionalidade: employee.nacionalidade || 'Brasileira',
    telefone: employee.telefone || '',
    email_pessoal: employee.email_pessoal || '',
    cidade: employee.cidade || '',
    estado: employee.estado || '',
  });

  const handleCancel = () => {
    setFormData({
      nome_completo: employee.nome_completo || '',
      cpf: employee.cpf || '',
      data_nascimento: employee.data_nascimento || null,
      data_nascimento_display: isoToDisplay(employee.data_nascimento),
      nacionalidade: employee.nacionalidade || 'Brasileira',
      telefone: employee.telefone || '',
      email_pessoal: employee.email_pessoal || '',
      cidade: employee.cidade || '',
      estado: employee.estado || '',
    });
    setIsEditing(false);
  };

  const handleSave = async () => {
    const payload: UpdateMyEmployeeData = {
      nome_completo: formData.nome_completo,
      cpf: cleanCpf(formData.cpf),
      data_nascimento: formData.data_nascimento,
      nacionalidade: formData.nacionalidade,
      telefone: cleanPhone(formData.telefone),
      email_pessoal: formData.email_pessoal,
      cidade: formData.cidade,
      estado: formData.estado,
    };

    await updateMutation.mutateAsync(payload);
    setIsEditing(false);
  };

  const dadosPrincipais = [
    { label: 'Nome completo', value: employee.nome_completo, field: 'nome_completo' },
    { label: 'CPF', value: employee.cpf ? formatCpf(employee.cpf) : 'N/A', field: 'cpf' },
    { label: 'Data de nascimento', value: employee.data_nascimento 
      ? format(new Date(employee.data_nascimento), 'dd/MM/yyyy')
      : 'N/A', field: 'data_nascimento' },
    { label: 'Nacionalidade', value: employee.nacionalidade || 'Brasileira', field: 'nacionalidade' },
  ];

  const dadosContato = [
    { label: 'Telefone', value: employee.telefone ? formatPhone(employee.telefone) : 'N/A', field: 'telefone' },
    { label: 'Email pessoal', value: employee.email_pessoal || 'N/A', field: 'email_pessoal' },
    { label: 'Cidade', value: employee.cidade || 'N/A', field: 'cidade' },
    { label: 'Estado', value: employee.estado || 'N/A', field: 'estado' },
  ];

  if (isEditing) {
    return (
      <div className="space-y-3">
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={handleCancel} disabled={updateMutation.isPending}>
            <X className="h-4 w-4 mr-1" />
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Salvar
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card Dados Principais - Edição */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                Dados principais
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Nome completo</Label>
                <Input
                  value={formData.nome_completo}
                  onChange={(e) => setFormData(prev => ({ ...prev, nome_completo: e.target.value }))}
                  placeholder="Nome completo"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">CPF</Label>
                <Input
                  value={formatCpf(formData.cpf)}
                  onChange={(e) => setFormData(prev => ({ ...prev, cpf: e.target.value }))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data de nascimento</Label>
                <Input
                  value={formData.data_nascimento_display}
                  onChange={(e) => {
                    const formatted = formatDateInput(e.target.value);
                    const parsed = parseDateInput(formatted);
                    setFormData(prev => ({ 
                      ...prev, 
                      data_nascimento_display: formatted,
                      data_nascimento: parsed
                    }));
                  }}
                  placeholder="dd/mm/aaaa"
                  maxLength={10}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Nacionalidade</Label>
                <Input
                  value={formData.nacionalidade}
                  onChange={(e) => setFormData(prev => ({ ...prev, nacionalidade: e.target.value }))}
                  placeholder="Nacionalidade"
                />
              </div>
            </CardContent>
          </Card>

          {/* Card Contato - Edição */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Contato
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Telefone</Label>
                <Input
                  value={formatPhone(formData.telefone)}
                  onChange={(e) => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Email pessoal</Label>
                <Input
                  type="email"
                  value={formData.email_pessoal}
                  onChange={(e) => setFormData(prev => ({ ...prev, email_pessoal: e.target.value }))}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Cidade</Label>
                <Input
                  value={formData.cidade}
                  onChange={(e) => setFormData(prev => ({ ...prev, cidade: e.target.value }))}
                  placeholder="Cidade"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Estado</Label>
                <Select
                  value={formData.estado}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, estado: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS_BRASIL.map((estado) => (
                      <SelectItem key={estado.value} value={estado.value}>
                        {estado.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
          <Pencil className="h-4 w-4 mr-1" />
          Editar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card Dados Principais */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Dados principais
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {dadosPrincipais.map((item) => (
              <div key={item.label} className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <span className="text-sm font-medium">{item.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Card Contato */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Contato
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {dadosContato.map((item) => (
              <div key={item.label} className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <span className="text-sm font-medium truncate max-w-[180px]">{item.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
