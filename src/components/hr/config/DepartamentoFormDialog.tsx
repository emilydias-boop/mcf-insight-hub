import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Departamento, useDepartamentoMutations } from "@/hooks/useHRConfig";
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
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

const formSchema = z.object({
  nome: z.string().min(2, "Nome é obrigatório"),
  codigo: z.string().optional(),
  is_bu: z.boolean(),
  ordem: z.number().min(0),
});

type FormData = z.infer<typeof formSchema>;

interface DepartamentoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departamento: Departamento | null;
}

export default function DepartamentoFormDialog({ open, onOpenChange, departamento }: DepartamentoFormDialogProps) {
  const { create, update } = useDepartamentoMutations();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      codigo: "",
      is_bu: false,
      ordem: 0,
    },
  });

  useEffect(() => {
    if (departamento) {
      form.reset({
        nome: departamento.nome,
        codigo: departamento.codigo || "",
        is_bu: departamento.is_bu,
        ordem: departamento.ordem,
      });
    } else {
      form.reset({
        nome: "",
        codigo: "",
        is_bu: false,
        ordem: 0,
      });
    }
  }, [departamento, form]);

  const onSubmit = (data: FormData) => {
    const payload = {
      ...data,
      codigo: data.codigo || null,
      ativo: true,
    };

    if (departamento) {
      update.mutate(
        { id: departamento.id, data: payload },
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {departamento ? "Editar Departamento" : "Novo Departamento"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: BU - Incorporador 50K" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="codigo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: incorporador" {...field} />
                  </FormControl>
                  <FormDescription>
                    Usado para mapeamentos internos
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_bu"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <FormLabel className="mb-0">É uma Business Unit?</FormLabel>
                    <FormDescription>
                      BUs são unidades de negócio com produtos próprios
                    </FormDescription>
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

            <FormField
              control={form.control}
              name="ordem"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ordem de exibição</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      value={field.value}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={create.isPending || update.isPending}>
                {departamento ? "Salvar" : "Criar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
