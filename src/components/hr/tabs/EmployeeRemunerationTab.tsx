import { useState } from 'react';
import { Employee } from '@/types/hr';
import { useEmployeeSdrPayouts, useEmployeeMutations } from '@/hooks/useEmployees';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DollarSign, TrendingUp, Calendar, AlertCircle, Pencil, X, Save } from 'lucide-react';

interface EmployeeRemunerationTabProps {
  employee: Employee;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatMonth = (anoMes: string) => {
  const [year, month] = anoMes.split('-');
  return format(new Date(parseInt(year), parseInt(month) - 1), 'MMMM yyyy', { locale: ptBR });
};

export default function EmployeeRemunerationTab({ employee }: EmployeeRemunerationTabProps) {
  const { data: payouts, isLoading: payoutsLoading } = useEmployeeSdrPayouts(employee.sdr_id);
  const { updateEmployee } = useEmployeeMutations();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    salario_base: employee.salario_base || 0,
    nivel: employee.nivel || 1,
    banco: employee.banco || '',
    agencia: employee.agencia || '',
    conta: employee.conta || '',
    tipo_conta: employee.tipo_conta || '',
    pix: employee.pix || '',
  });

  const handleSave = () => {
    updateEmployee.mutate(
      { id: employee.id, data: formData },
      {
        onSuccess: () => setIsEditing(false),
      }
    );
  };

  const InfoRow = ({ label, value }: { label: string; value: string | null }) => (
    <div className="flex justify-between py-2">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="font-medium text-sm">{value || '-'}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Dados de Remuneração Base */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Remuneração Base
          </CardTitle>
          {!isEditing ? (
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
              <Pencil className="h-4 w-4 mr-1" />
              Editar
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                <X className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={handleSave} disabled={updateEmployee.isPending}>
                <Save className="h-4 w-4 mr-1" />
                Salvar
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Salário Base (R$)</Label>
                <Input
                  type="number"
                  value={formData.salario_base}
                  onChange={(e) => setFormData({ ...formData, salario_base: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Nível</Label>
                <Select
                  value={String(formData.nivel)}
                  onValueChange={(v) => setFormData({ ...formData, nivel: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <SelectItem key={n} value={String(n)}>Nível {n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              <InfoRow label="Salário Base" value={formatCurrency(employee.salario_base)} />
              <InfoRow label="Nível" value={`Nível ${employee.nivel}`} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dados Bancários */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados Bancários</CardTitle>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Banco</Label>
                <Input
                  value={formData.banco}
                  onChange={(e) => setFormData({ ...formData, banco: e.target.value })}
                  placeholder="Ex: Nubank, Itaú..."
                />
              </div>
              <div className="space-y-2">
                <Label>Agência</Label>
                <Input
                  value={formData.agencia}
                  onChange={(e) => setFormData({ ...formData, agencia: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Conta</Label>
                <Input
                  value={formData.conta}
                  onChange={(e) => setFormData({ ...formData, conta: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Conta</Label>
                <Select
                  value={formData.tipo_conta}
                  onValueChange={(v) => setFormData({ ...formData, tipo_conta: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corrente">Corrente</SelectItem>
                    <SelectItem value="poupanca">Poupança</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Chave PIX</Label>
                <Input
                  value={formData.pix}
                  onChange={(e) => setFormData({ ...formData, pix: e.target.value })}
                  placeholder="CPF, email, telefone ou chave aleatória"
                />
              </div>
            </div>
          ) : (
            <div className="divide-y">
              <InfoRow label="Banco" value={employee.banco} />
              <InfoRow label="Agência" value={employee.agencia} />
              <InfoRow label="Conta" value={employee.conta} />
              <InfoRow label="Tipo de Conta" value={employee.tipo_conta} />
              <InfoRow label="PIX" value={employee.pix} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico de Fechamentos SDR (se vinculado) */}
      {employee.sdr_id && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Histórico de Fechamentos SDR
            </CardTitle>
          </CardHeader>
          <CardContent>
            {payoutsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : !payouts || payouts.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Nenhum fechamento encontrado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {payouts.map((payout: any) => (
                  <div
                    key={payout.id}
                    className="p-4 rounded-lg border bg-muted/30 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium capitalize">
                          {formatMonth(payout.ano_mes)}
                        </span>
                      </div>
                      <Badge
                        variant={
                          payout.status === 'LOCKED'
                            ? 'default'
                            : payout.status === 'APPROVED'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {payout.status === 'LOCKED'
                          ? 'Finalizado'
                          : payout.status === 'APPROVED'
                          ? 'Aprovado'
                          : 'Rascunho'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Fixo:</span>
                        <span className="ml-2 font-medium">
                          {formatCurrency(payout.fixo_valor || 0)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Variável:</span>
                        <span className="ml-2 font-medium">
                          {formatCurrency(payout.variavel_valor || 0)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">iFood:</span>
                        <span className="ml-2 font-medium">
                          {formatCurrency((payout.ifood_mensal || 0) + (payout.ifood_ultrameta || 0))}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground font-semibold">Total:</span>
                        <span className="ml-2 font-bold text-primary">
                          {formatCurrency(payout.total_payout || 0)}
                        </span>
                      </div>
                    </div>

                    {payout.sdr_month_kpi && (
                      <div className="pt-2 border-t mt-2">
                        <div className="text-xs text-muted-foreground mb-1">KPIs do mês:</div>
                        <div className="grid grid-cols-4 gap-2 text-xs">
                          <div className="text-center">
                            <div className="font-medium">{payout.sdr_month_kpi.reunioes_agendadas || 0}</div>
                            <div className="text-muted-foreground">Agendadas</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium">{payout.sdr_month_kpi.reunioes_realizadas || 0}</div>
                            <div className="text-muted-foreground">Realizadas</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium">{payout.sdr_month_kpi.no_shows || 0}</div>
                            <div className="text-muted-foreground">No-Shows</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium">{payout.sdr_month_kpi.tentativas || 0}</div>
                            <div className="text-muted-foreground">Tentativas</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!employee.sdr_id && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Colaborador não vinculado a um SDR</p>
            <p className="text-xs mt-1">Vincule este colaborador a um SDR para ver o histórico de fechamentos</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
