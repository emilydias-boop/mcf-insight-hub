import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Cargo, useCargoMutations, useAreas } from "@/hooks/useHRConfig";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MODELO_VARIAVEL_OPTIONS = [
  { value: 'score_metricas', label: 'Score de Métricas' },
  { value: 'componentes_regua_global', label: 'Régua Global' },
  { value: 'comissao_direta', label: 'Comissão Direta' },
  { value: 'bonus_metas', label: 'Bônus por Metas' },
];

const formSchema = z.object({
  nome_exibicao: z.string().min(2, "Nome é obrigatório"),
  cargo_base: z.string().min(2, "Cargo base é obrigatório"),
  area: z.string().min(1, "Área é obrigatória"),
  nivel: z.number().nullable().optional(),
  fixo_valor: z.number().min(0),
  variavel_valor: z.number().min(0),
  modelo_variavel: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface CargoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cargo: Cargo | null;
}

export default function CargoFormDialog({ open, onOpenChange, cargo }: CargoFormDialogProps) {
  const { create, update } = useCargoMutations();
  const { data: areas } = useAreas();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome_exibicao: "",
      cargo_base: "",
      area: "",
      nivel: null,
      fixo_valor: 0,
      variavel_valor: 0,
      modelo_variavel: "score_metricas",
    },
  });

  useEffect(() => {
    if (cargo) {
      form.reset({
        nome_exibicao: cargo.nome_exibicao,
        cargo_base: cargo.cargo_base,
        area: cargo.area,
        nivel: cargo.nivel,
        fixo_valor: cargo.fixo_valor,
        variavel_valor: cargo.variavel_valor,
        modelo_variavel: cargo.modelo_variavel,
      });
    } else {
      form.reset({
        nome_exibicao: "",
        cargo_base: "",
        area: "",
        nivel: null,
        fixo_valor: 0,
        variavel_valor: 0,
        modelo_variavel: "score_metricas",
      });
    }
  }, [cargo, form]);

  const fixoValor = form.watch("fixo_valor") || 0;
  const variavelValor = form.watch("variavel_valor") || 0;
  const oteTotal = fixoValor + variavelValor;

  const onSubmit = (data: FormData) => {
    const payload = {
      ...data,
      ote_total: (data.fixo_valor || 0) + (data.variavel_valor || 0),
      ativo: true,
    };

    if (cargo) {
      update.mutate(
        { id: cargo.id, data: payload },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      create.mutate(payload, {
        onSuccess: () => onOpenChange(false),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {cargo ? "Editar Cargo" : "Novo Cargo"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome_exibicao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome de Exibição</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: SDR Inside N1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cargo_base"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cargo Base</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: SDR" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="area"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Área</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {areas?.filter(a => a.ativo).map((area) => (
                          <SelectItem key={area.id} value={area.nome}>
                            {area.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="nivel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nível (opcional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        placeholder="1-10"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="modelo_variavel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modelo Variável</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MODELO_VARIAVEL_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="fixo_valor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fixo (R$)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step={100}
                        value={field.value}
                        onChange={(e) => field.onChange(Number(e.target.value))}
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
                        min={0}
                        step={100}
                        value={field.value}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <FormLabel>OTE Total</FormLabel>
                <div className="mt-2 p-2 bg-muted rounded-md text-center font-medium text-primary">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(oteTotal)}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={create.isPending || update.isPending}>
                {cargo ? "Salvar" : "Criar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
