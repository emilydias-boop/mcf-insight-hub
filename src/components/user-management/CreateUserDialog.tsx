import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, UserPlus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateUser } from "@/hooks/useUserMutations";
import { ROLE_LABELS } from "@/types/user-management";
import { useCargosAtivos } from "@/hooks/useHRConfig";

const createUserSchema = z.object({
  full_name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
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
];

export function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const createUser = useCreateUser();
  const { data: cargos, isLoading: cargosLoading } = useCargosAtivos();

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

  const onSubmit = async (data: CreateUserForm) => {
    try {
      await createUser.mutateAsync({
        email: data.email,
        full_name: data.full_name,
        role: data.role,
        squad: data.squad || null,
        cargo_id: data.cargo_id,
      });
      form.reset();
      setOpen(false);
    } catch {
      // Error is handled in the mutation
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      form.reset();
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Adicionar Novo Usuário</DialogTitle>
          <DialogDescription>
            O usuário receberá um email para definir sua senha e acessar o sistema.
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
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="email@exemplo.com"
              {...form.register("email")}
            />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">
                {form.formState.errors.email.message}
              </p>
            )}
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
                {Object.entries(ROLE_LABELS).map(([value, { label }]) => (
                  <SelectItem key={value} value={value}>
                    {label}
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
              {createUser.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                "Criar Usuário"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
