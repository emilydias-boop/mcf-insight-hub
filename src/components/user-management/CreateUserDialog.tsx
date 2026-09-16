import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, UserPlus, RotateCcw, AlertTriangle, Copy, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateUser, CreateUserResult } from "@/hooks/useUserMutations";
import { useCargosAtivos } from "@/hooks/useHRConfig";
import { useRolesConfig } from "@/hooks/useRolesConfig";
import {
  CORPORATE_EMAIL_DOMAIN,
  suggestCorporateEmail,
  normalizeEmail,
  validateAccessEmail,
  buildEmailMismatchWarning,
} from "@/lib/corporateEmail";
import { toast } from "sonner";

const createUserSchema = z.object({
  full_name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z
    .string()
    .min(1, "Informe o e-mail de acesso")
    .email("E-mail inválido"),
  cargo_id: z.string().min(1, "Selecione um cargo"),
  role: z.string().min(1, "Selecione um role"),
  squad: z.string().optional(),
});

type CreateUserForm = z.infer<typeof createUserSchema>;

const SQUAD_OPTIONS = [
  { value: "a010", label: "A010" },
  { value: "consorcio", label: "Consórcio" },
  { value: "credito", label: "Crédito" },
  { value: "leilao", label: "Leilão" },
  { value: "projetos", label: "Projetos" },
  { value: "solar", label: "MCF Solar" },
];

type Step = "form" | "review" | "created";

export function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [emailTouched, setEmailTouched] = useState(false);
  const [allowExternalDomain, setAllowExternalDomain] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [createdResult, setCreatedResult] = useState<CreateUserResult | null>(null);

  const createUser = useCreateUser();
  const { data: cargos, isLoading: cargosLoading } = useCargosAtivos();
  const { roles: activeRoles } = useRolesConfig(true);

  const form = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      full_name: "",
      email: "",
      cargo_id: "",
      role: "",
      squad: "",
    },
  });

  const selectedCargoId = form.watch("cargo_id");
  const fullName = form.watch("full_name");
  const emailValue = form.watch("email");

  const suggestedEmail = useMemo(() => suggestCorporateEmail(fullName), [fullName]);

  // Preenche o e-mail automaticamente conforme o nome é digitado, e para de
  // sobrescrever assim que o admin editar o e-mail manualmente.
  useEffect(() => {
    if (emailTouched) return;
    form.setValue("email", suggestedEmail);
  }, [suggestedEmail, emailTouched, form]);

  // Auto-fill role and squad when cargo is selected
  useEffect(() => {
    if (selectedCargoId && cargos) {
      const selectedCargo = cargos.find(c => c.id === selectedCargoId);
      if (selectedCargo) {
        // Auto-set role from cargo
        if (selectedCargo.role_sistema) {
          form.setValue("role", selectedCargo.role_sistema);
        }
        // Auto-suggest squad from area (map area to squad)
        const areaToSquad: Record<string, string> = {
          "Inside Sales": "a010",
          "Crédito": "credito",
          "Consórcio": "consorcio",
          "Leilão": "leilao",
          "Projetos": "projetos",
        };
        const suggestedSquad = areaToSquad[selectedCargo.area];
        if (suggestedSquad) {
          form.setValue("squad", suggestedSquad);
        }
      }
    }
  }, [selectedCargoId, cargos, form]);

  const mismatchWarning = emailTouched
    ? buildEmailMismatchWarning(fullName, emailValue)
    : null;

  const cargoLabel = cargos?.find((c) => c.id === selectedCargoId)?.nome_exibicao || "—";
  const roleLabel =
    activeRoles.find((r) => r.role_key === form.watch("role"))?.label || form.watch("role") || "—";

  // Passo 1 -> revisão: valida o e-mail de verdade antes de mostrar a confirmação
  const onSubmit = (data: CreateUserForm) => {
    const result = validateAccessEmail(data.email, { allowExternalDomain });
    if (!result.valid) {
      setEmailError(result.error || "E-mail inválido");
      return;
    }
    setEmailError(null);
    form.setValue("email", result.normalized);
    setStep("review");
  };

  const handleConfirmCreate = async () => {
    const data = form.getValues();
    try {
      const result = await createUser.mutateAsync({
        email: normalizeEmail(data.email),
        full_name: data.full_name.trim(),
        role: data.role,
        squad: data.squad || null,
        cargo_id: data.cargo_id,
        allow_external_domain: allowExternalDomain,
      });
      setCreatedResult(result);
      setStep("created");
    } catch {
      // Erro tratado na mutation — volta ao formulário para correção
      setStep("form");
    }
  };

  const handleCopyLink = async () => {
    if (!createdResult?.access_link) return;
    await navigator.clipboard.writeText(createdResult.access_link);
    toast.success("Link copiado!");
  };

  const resetAll = () => {
    form.reset();
    setStep("form");
    setEmailTouched(false);
    setAllowExternalDomain(false);
    setEmailError(null);
    setCreatedResult(null);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      resetAll();
    }
  };

  // Group cargos by area for better UX
  const cargosByArea = cargos?.reduce((acc, cargo) => {
    if (!acc[cargo.area]) {
      acc[cargo.area] = [];
    }
    acc[cargo.area].push(cargo);
    return acc;
  }, {} as Record<string, typeof cargos>) || {};

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" />
          Adicionar Usuário
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[460px]">
        {step === "form" && (
          <>
            <DialogHeader>
              <DialogTitle>Adicionar Novo Usuário</DialogTitle>
              <DialogDescription>
                O e-mail informado é o login do colaborador. Nenhum e-mail é enviado: no
                final você copia o link de definição de senha e envia a ele.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Nome Completo *</Label>
                <Input
                  id="full_name"
                  placeholder="Digite o nome completo"
                  {...form.register("full_name")}
                />
                {form.formState.errors.full_name && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.full_name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="email">E-mail de acesso (login) *</Label>
                  {emailTouched && suggestedEmail && suggestedEmail !== normalizeEmail(emailValue) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => {
                        form.setValue("email", suggestedEmail);
                        setEmailTouched(false);
                        setEmailError(null);
                      }}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Usar sugestão
                    </Button>
                  )}
                </div>
                <Input
                  id="email"
                  type="email"
                  placeholder={`nome.sobrenome@${CORPORATE_EMAIL_DOMAIN}`}
                  {...form.register("email", {
                    onChange: () => {
                      setEmailTouched(true);
                      setEmailError(null);
                    },
                  })}
                />
                <p className="text-xs text-muted-foreground">
                  Gerado automaticamente pelo nome: <span className="font-mono">nome.sobrenome@{CORPORATE_EMAIL_DOMAIN}</span>.
                  É com esse e-mail que o colaborador faz login.
                </p>
                {mismatchWarning && (
                  <p className="text-xs text-amber-500 flex items-start gap-1">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    {mismatchWarning}
                  </p>
                )}
                {(emailError || form.formState.errors.email) && (
                  <p className="text-sm text-destructive">
                    {emailError || form.formState.errors.email?.message}
                  </p>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <Checkbox
                    id="allow_external"
                    checked={allowExternalDomain}
                    onCheckedChange={(v) => {
                      setAllowExternalDomain(v === true);
                      setEmailError(null);
                    }}
                  />
                  <Label htmlFor="allow_external" className="text-xs font-normal text-muted-foreground">
                    Usar email de outro domínio
                  </Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cargo_id">Cargo *</Label>
                <Select
                  value={form.watch("cargo_id")}
                  onValueChange={(value) => form.setValue("cargo_id", value)}
                  disabled={cargosLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={cargosLoading ? "Carregando..." : "Selecione o cargo"} />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(cargosByArea).map(([area, areaCargos]) => (
                      <div key={area}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                          {area}
                        </div>
                        {areaCargos.map((cargo) => (
                          <SelectItem key={cargo.id} value={cargo.id}>
                            {cargo.nome_exibicao}
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.cargo_id && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.cargo_id.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role de Acesso *</Label>
                <Select
                  value={form.watch("role")}
                  onValueChange={(value) => form.setValue("role", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o role" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeRoles.map((r) => (
                      <SelectItem key={r.role_key} value={r.role_key}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCargoId && (
                  <p className="text-xs text-muted-foreground">
                    Role auto-preenchido com base no cargo selecionado
                  </p>
                )}
                {form.formState.errors.role && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.role.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="squad">Business Unit (Opcional)</Label>
                <Select
                  value={form.watch("squad") || ""}
                  onValueChange={(value) => form.setValue("squad", value === "none" ? "" : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a BU" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {SQUAD_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={createUser.isPending}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={createUser.isPending}>
                  Revisar e criar
                </Button>
              </div>
            </form>
          </>
        )}

        {step === "review" && (
          <>
            <DialogHeader>
              <DialogTitle>Confirme os dados</DialogTitle>
              <DialogDescription>
                Confira o e-mail com atenção: é o login do colaborador e o endereço que
                recebe o link de acesso.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 mt-2">
              <div className="rounded-md border border-border p-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Nome</span>
                  <span className="font-medium text-right">{form.getValues("full_name")}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Cargo</span>
                  <span className="text-right">{cargoLabel}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Role</span>
                  <span className="text-right">{roleLabel}</span>
                </div>
              </div>

              <div className="rounded-md border border-primary/40 bg-primary/5 p-3">
                <p className="text-xs text-muted-foreground mb-1">E-mail de acesso (login)</p>
                <p className="font-mono text-base font-semibold break-all">
                  {normalizeEmail(form.getValues("email"))}
                </p>
              </div>

              {mismatchWarning && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">{mismatchWarning}</AlertDescription>
                </Alert>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("form")}
                disabled={createUser.isPending}
              >
                Corrigir
              </Button>
              <Button onClick={handleConfirmCreate} disabled={createUser.isPending}>
                {createUser.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  "Confirmar e criar"
                )}
              </Button>
            </div>
          </>
        )}

        {step === "created" && createdResult && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {createdResult.reset_link_sent ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                )}
                {createdResult.reset_link_sent
                  ? "Usuário criado"
                  : "Usuário criado, mas o e-mail NÃO foi enviado"}
              </DialogTitle>
              <DialogDescription>
                {createdResult.reset_link_sent
                  ? "Copie o link abaixo e envie ao colaborador — o envio de e-mail é pouco confiável hoje."
                  : createdResult.reset_error_message ||
                    "Falha no envio do e-mail de acesso. Envie o link abaixo ao colaborador."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 mt-2">
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground mb-1">Login</p>
                <p className="font-mono text-sm break-all">{createdResult.email}</p>
              </div>

              {createdResult.access_link ? (
                <div className="space-y-2">
                  <Label className="text-xs">Link para definir a senha</Label>
                  <div className="font-mono text-xs p-2 rounded-md bg-muted break-all select-all max-h-24 overflow-auto">
                    {createdResult.access_link}
                  </div>
                  <Button variant="outline" size="sm" onClick={handleCopyLink}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar link
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Este link é sensível e aparece só agora — não fica salvo em nenhum lugar.
                    Ele substitui o link do e-mail; use este.
                  </p>
                </div>
              ) : (
                <Alert variant="destructive">
                  <AlertDescription className="text-xs">
                    Não foi possível gerar o link de acesso
                    {createdResult.access_link_error ? `: ${createdResult.access_link_error}` : "."}{" "}
                    Use "Definir senha temporária" na ficha do usuário.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={resetAll}>
                Criar outro
              </Button>
              <Button onClick={() => handleOpenChange(false)}>Fechar</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
