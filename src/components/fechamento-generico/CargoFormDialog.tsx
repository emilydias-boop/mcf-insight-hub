import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCargoMutations } from "@/hooks/useFechamentoGenerico";
import { CargoCatalogo, AREA_OPTIONS, MODELO_VARIAVEL_OPTIONS } from "@/types/fechamento-generico";

const cargoSchema = z.object({
  area: z.string().min(1, "Área é obrigatória"),
  cargo_base: z.string().min(1, "Cargo base é obrigatório"),
  nivel: z.coerce.number().nullable(),
  nome_exibicao: z.string().min(1, "Nome de exibição é obrigatório"),
  fixo_valor: z.coerce.number().min(0, "Valor deve ser positivo"),
  variavel_valor: z.coerce.number().min(0, "Valor deve ser positivo"),
  modelo_variavel: z.string().min(1, "Modelo é obrigatório"),
  ativo: z.boolean(),
});

type CargoFormValues = z.infer<typeof cargoSchema>;

interface CargoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cargo: CargoCatalogo | null;
}

export function CargoFormDialog({ open, onOpenChange, cargo }: CargoFormDialogProps) {
  const { create, update } = useCargoMutations();
  const isEditing = !!cargo;

  const form = useForm<CargoFormValues>({
    resolver: zodResolver(cargoSchema),
    defaultValues: {
      area: "",
      cargo_base: "",
      nivel: null,
      nome_exibicao: "",
      fixo_valor: 0,
      variavel_valor: 0,
      modelo_variavel: "nenhum",
      ativo: true,
    },
  });

  useEffect(() => {
    if (cargo) {
      form.reset({
        area: cargo.area,
        cargo_base: cargo.cargo_base,
        nivel: cargo.nivel,
        nome_exibicao: cargo.nome_exibicao,
        fixo_valor: cargo.fixo_valor,
        variavel_valor: cargo.variavel_valor,
        modelo_variavel: cargo.modelo_variavel,
        ativo: cargo.ativo,
      });
    } else {
      form.reset({
        area: "",
        cargo_base: "",
        nivel: null,
        nome_exibicao: "",
        fixo_valor: 0,
        variavel_valor: 0,
        modelo_variavel: "nenhum",
        ativo: true,
      });
    }
  }, [cargo, form]);

  const fixoValor = form.watch("fixo_valor");
  const variavelValor = form.watch("variavel_valor");
  const oteTotal = (fixoValor || 0) + (variavelValor || 0);

  const onSubmit = (values: CargoFormValues) => {
    const data = {
      area: values.area,
      cargo_base: values.cargo_base,
      nivel: values.nivel,
      nome_exibicao: values.nome_exibicao,
      fixo_valor: values.fixo_valor,
      variavel_valor: values.variavel_valor,
      modelo_variavel: values.modelo_variavel,
      ativo: values.ativo,
      ote_total: (values.fixo_valor || 0) + (values.variavel_valor || 0),
    };

    if (isEditing) {
      update.mutate(
        { id: cargo.id, ...data },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      create.mutate(data, {
        onSuccess: () => onOpenChange(false),
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Cargo" : "Novo Cargo"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="area"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Área</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {AREA_OPTIONS.map((area) => (
                          <SelectItem key={area} value={area}>
                            {area}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nivel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nível (opcional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Ex: 1, 2, 3..."
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => 
                          field.onChange(e.target.value ? Number(e.target.value) : null)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="cargo_base"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cargo Base</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: SDR, Closer, Analista..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="nome_exibicao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome de Exibição</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: SDR Nível 1, Closer Senior..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fixo_valor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fixo (R$)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0,00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="variavel_valor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Variável (R$)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0,00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">OTE Total</p>
              <p className="text-xl font-bold">{formatCurrency(oteTotal)}</p>
            </div>

            <FormField
              control={form.control}
              name="modelo_variavel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Modelo de Variável</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {MODELO_VARIAVEL_OPTIONS.map((modelo) => (
                        <SelectItem key={modelo.value} value={modelo.value}>
                          {modelo.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ativo"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <FormLabel className="text-base">Ativo</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Cargo disponível para uso em metas e fechamentos
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={create.isPending || update.isPending}
              >
                {isEditing ? "Salvar" : "Criar Cargo"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
