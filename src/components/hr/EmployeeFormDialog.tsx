import { useState, useEffect, useMemo } from 'react';
import { useEmployeeMutations } from '@/hooks/useEmployees';
import { Employee } from '@/types/hr';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Copy, RotateCcw, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import CargoSelect from './CargoSelect';
import {
  CORPORATE_EMAIL_DOMAIN,
  suggestCorporateEmail,
  normalizeEmail,
  validateAccessEmail,
  buildEmailMismatchWarning,
} from '@/lib/corporateEmail';
import { extractFunctionErrorMessage } from '@/lib/functionError';


interface EmployeeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Quando presente, o diálogo entra em modo edição: pré-preenche e atualiza esse registro em vez de criar um novo. */
  employee?: Employee | null;
}

const BLANK_FORM = {
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
};

export default function EmployeeFormDialog({ open, onOpenChange, employee }: EmployeeFormDialogProps) {
  const { createEmployee, updateEmployee } = useEmployeeMutations();
  const [formData, setFormData] = useState(BLANK_FORM);
  const [createSystemUser, setCreateSystemUser] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  // E-mail de acesso: sugestão automática, validação de domínio e confirmação
  const [emailTouched, setEmailTouched] = useState(false);
  const [allowExternalDomain, setAllowExternalDomain] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [confirmStep, setConfirmStep] = useState(false);
  const [accessResult, setAccessResult] = useState<{
    email: string;
    reset_link_sent: boolean;
    reset_error_message?: string | null;
    access_link?: string | null;
    access_link_error?: string | null;
  } | null>(null);


  const isEditing = !!employee;

  // Ao abrir o diálogo, preenche com os dados do colaborador (modo edição)
  // ou reseta pro formulário em branco (modo criação).
  useEffect(() => {
    if (!open) return;
    if (employee) {
      setFormData({
        nome_completo: employee.nome_completo || '',
        cpf: employee.cpf || '',
        cargo: employee.cargo,
        cargo_catalogo_id: employee.cargo_catalogo_id,
        departamento: employee.departamento || '',
        data_admissao: employee.data_admissao || '',
        tipo_contrato: employee.tipo_contrato || 'CLT',
        salario_base: employee.salario_base ?? 0,
        nivel: employee.nivel ?? 1,
        email_pessoal: employee.email_pessoal || '',
      });
    } else {
      setFormData(BLANK_FORM);
    }
    setDuplicateWarning(null);
    // Em edição o e-mail já existe: não sobrescrever com a sugestão.
    setEmailTouched(!!employee);
    setAllowExternalDomain(false);
    setEmailError(null);
    setConfirmStep(false);
    setAccessResult(null);
  }, [open, employee]);

  const suggestedEmail = useMemo(
    () => suggestCorporateEmail(formData.nome_completo),
    [formData.nome_completo]
  );

  // Preenche o e-mail de login pelo nome até o RH editar manualmente
  useEffect(() => {
    if (isEditing || emailTouched) return;
    setFormData((prev) => ({ ...prev, email_pessoal: suggestedEmail }));
  }, [suggestedEmail, emailTouched, isEditing]);

  const mismatchWarning = emailTouched
    ? buildEmailMismatchWarning(formData.nome_completo, formData.email_pessoal)
    : null;



  const emailIsRequired = !isEditing && createSystemUser;

  const handleSubmit = async () => {
    if (!formData.nome_completo.trim()) return;

    // Validação real do e-mail de acesso (mesma regra do cadastro de usuários)
    if (emailIsRequired || (isEditing && formData.email_pessoal.trim())) {
      const check = validateAccessEmail(formData.email_pessoal, { allowExternalDomain });
      if (!check.valid) {
        setEmailError(check.error || 'E-mail inválido');
        setConfirmStep(false);
        return;
      }
      setEmailError(null);
    }

    // Passo de revisão antes de criar o login
    if (emailIsRequired && !confirmStep) {
      setConfirmStep(true);
      return;
    }

    // Guard defensivo (só no modo criação): se já existe um colaborador ativo
    // com o mesmo e-mail, avisa e não insere. Segundo clique confirma e segue.
    const emailNorm = normalizeEmail(formData.email_pessoal);
    if (!isEditing && emailNorm && !duplicateWarning) {
      const { data: existing } = await supabase
        .from('employees')
        .select('id, nome_completo, cargo')
        .eq('status', 'ativo')
        .ilike('email_pessoal', emailNorm)
        .limit(1)
        .maybeSingle();
      if (existing) {
        setDuplicateWarning(
          `Já existe um colaborador ativo com esse e-mail: ${existing.nome_completo}${existing.cargo ? ` (${existing.cargo})` : ''}. Clique em "Cadastrar" novamente para confirmar que quer criar outro registro para essa pessoa.`
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      if (isEditing && employee) {
        // Modo edição: atualiza o registro existente, não cria nada.
        await updateEmployee.mutateAsync({ id: employee.id, data: { ...formData, email_pessoal: emailNorm } });
      } else {
        // Modo criação
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

        const created = await createEmployee.mutateAsync({ ...formData, email_pessoal: emailNorm });

        if (createSystemUser && roleSistema && emailNorm) {
          const squadGuess = (() => {
            const a = (area || '').toLowerCase();
            if (a.includes('consórcio') || a.includes('consorcio')) return 'consorcio';
            if (a.includes('inside') || a.includes('incorporador')) return 'incorporador';
            if (a.includes('crédito') || a.includes('credito')) return 'credito';
            if (a.includes('leilão') || a.includes('leilao')) return 'leilao';
            if (a.includes('solar')) return 'solar';
            return null;
          })();
          const { data: fnData, error: fnError } = await supabase.functions.invoke('create-user', {
            body: {
              email: emailNorm,
              full_name: formData.nome_completo.trim(),
              role: roleSistema,
              squad: squadGuess,
              cargo_id: formData.cargo_catalogo_id,
              employee_id: created.id,
              allow_external_domain: allowExternalDomain,
            },
          });
          if (fnError || fnData?.error) {
            // Lê o corpo da resposta para mostrar a mensagem real da função
            const realMessage = fnData?.error
              ? String(fnData.error)
              : await extractFunctionErrorMessage(fnError, 'Falha ao criar o usuário');
            toast.error('Colaborador criado, mas o login NÃO foi criado: ' + realMessage);
          } else if (fnData?.reset_link_sent === false) {
            toast.error('Usuário criado, mas o email de acesso NÃO foi enviado. Copie o link de acesso e envie ao colaborador.');
          } else {
            toast.success('Usuário do sistema criado e e-mail de senha enviado');
          }

          if (fnData?.user_id) {
            // Mantém o diálogo aberto para o gestor copiar o link de acesso
            setAccessResult({
              email: fnData.email || emailNorm,
              reset_link_sent: !!fnData.reset_link_sent,
              reset_error_message: fnData.reset_error_message,
              access_link: fnData.access_link,
              access_link_error: fnData.access_link_error,
            });
            setDuplicateWarning(null);
            setConfirmStep(false);
            return;
          }
        }

        setFormData(BLANK_FORM);
      }

      setDuplicateWarning(null);
      setConfirmStep(false);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyAccessLink = async () => {
    if (!accessResult?.access_link) return;
    await navigator.clipboard.writeText(accessResult.access_link);
    toast.success('Link copiado!');
  };

  const handleCloseAfterCreate = () => {
    setFormData(BLANK_FORM);
    setAccessResult(null);
    setEmailTouched(false);
    onOpenChange(false);
  };

  // Resultado da criação do login: link de acesso copiável (o e-mail é pouco confiável)
  if (accessResult) {
    return (
      <Dialog open={open} onOpenChange={(o) => { if (!o) handleCloseAfterCreate(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {accessResult.reset_link_sent ? (
                <CheckCircle2 className="h-5 w-5 text-primary" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              )}
              {accessResult.reset_link_sent
                ? 'Colaborador e login criados'
                : 'Login criado, mas o e-mail de acesso NÃO foi enviado'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground mb-1">Login</p>
              <p className="font-mono text-sm break-all">{accessResult.email}</p>
            </div>

            {!accessResult.reset_link_sent && accessResult.reset_error_message && (
              <Alert variant="destructive">
                <AlertDescription className="text-xs">{accessResult.reset_error_message}</AlertDescription>
              </Alert>
            )}

            {accessResult.access_link ? (
              <div className="space-y-2">
                <Label className="text-xs">Link para definir a senha</Label>
                <div className="font-mono text-xs p-2 rounded-md bg-muted break-all select-all max-h-24 overflow-auto">
                  {accessResult.access_link}
                </div>
                <Button variant="outline" size="sm" onClick={handleCopyAccessLink}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar link
                </Button>
                <p className="text-xs text-muted-foreground">
                  Link sensível: aparece só agora e não fica salvo em nenhum lugar. Envie ao colaborador.
                </p>
              </div>
            ) : (
              <Alert variant="destructive">
                <AlertDescription className="text-xs">
                  Não foi possível gerar o link de acesso
                  {accessResult.access_link_error ? `: ${accessResult.access_link_error}` : '.'} Use
                  "Gerar link de acesso" na tela de usuários.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button onClick={handleCloseAfterCreate}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (

    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Colaborador' : 'Novo Colaborador'}</DialogTitle>
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

          {!isEditing && (
            <>
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
                    <div className="flex items-center justify-between gap-2">
                      <Label>E-mail de login *</Label>
                      {emailTouched && suggestedEmail && suggestedEmail !== normalizeEmail(formData.email_pessoal) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => {
                            setFormData({ ...formData, email_pessoal: suggestedEmail });
                            setEmailTouched(false);
                            setEmailError(null);
                            setConfirmStep(false);
                          }}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Usar sugestão
                        </Button>
                      )}
                    </div>
                    <Input
                      type="email"
                      value={formData.email_pessoal}
                      onChange={(e) => {
                        setFormData({ ...formData, email_pessoal: e.target.value });
                        setDuplicateWarning(null);
                        setEmailTouched(true);
                        setEmailError(null);
                        setConfirmStep(false);
                      }}
                      placeholder={`nome.sobrenome@${CORPORATE_EMAIL_DOMAIN}`}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      É com este e-mail que o colaborador faz login. Sugerido pelo nome:{' '}
                      <span className="font-mono">nome.sobrenome@{CORPORATE_EMAIL_DOMAIN}</span>.
                    </p>
                    {mismatchWarning && (
                      <p className="text-xs text-amber-500 mt-1 flex items-start gap-1">
                        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                        {mismatchWarning}
                      </p>
                    )}
                    {emailError && <p className="text-sm text-destructive mt-1">{emailError}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      <Checkbox
                        id="hr_allow_external"
                        checked={allowExternalDomain}
                        onCheckedChange={(v) => {
                          setAllowExternalDomain(v === true);
                          setEmailError(null);
                        }}
                      />
                      <Label htmlFor="hr_allow_external" className="text-xs font-normal text-muted-foreground">
                        Usar email de outro domínio
                      </Label>
                    </div>
                  </div>
                )}

              </div>
            </>
          )}

          {isEditing && (
            <div>
              <Label>E-mail pessoal</Label>
              <Input
                type="email"
                value={formData.email_pessoal}
                onChange={(e) => setFormData({ ...formData, email_pessoal: e.target.value })}
                placeholder="usuario@minhacasafinanciada.com"
              />
            </div>
          )}
        </div>

        {duplicateWarning && (
          <Alert variant="destructive">
            <AlertDescription>{duplicateWarning}</AlertDescription>
          </Alert>
        )}

        {confirmStep && (
          <div className="rounded-md border border-primary/40 bg-primary/5 p-3 space-y-2">
            <p className="text-sm font-semibold">Confira antes de cadastrar</p>
            <div className="text-sm flex justify-between gap-3">
              <span className="text-muted-foreground">Nome</span>
              <span className="text-right">{formData.nome_completo}</span>
            </div>
            <div className="text-sm flex justify-between gap-3">
              <span className="text-muted-foreground">Cargo</span>
              <span className="text-right">{formData.cargo || '—'}</span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">E-mail de acesso (login)</p>
              <p className="font-mono text-base font-semibold break-all">
                {normalizeEmail(formData.email_pessoal)}
              </p>
            </div>
            {mismatchWarning && (
              <p className="text-xs text-amber-500 flex items-start gap-1">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                {mismatchWarning}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => (confirmStep ? setConfirmStep(false) : onOpenChange(false))}
          >
            {confirmStep ? 'Corrigir' : 'Cancelar'}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !formData.nome_completo.trim() ||
              submitting ||
              createEmployee.isPending ||
              updateEmployee.isPending ||
              (!isEditing && createSystemUser && !formData.email_pessoal.trim())
            }
          >
            {isEditing ? 'Salvar Alterações' : confirmStep ? 'Confirmar e cadastrar' : emailIsRequired ? 'Revisar e cadastrar' : 'Cadastrar'}
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
