import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Area, useAreaMutations } from "@/hooks/useHRConfig";
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

const formSchema = z.object({
  nome: z.string().min(2, "Nome é obrigatório"),
  codigo: z.string().optional(),
  ordem: z.number().min(0),
  ativo: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

interface AreaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  area: Area | null;
}

export default function AreaFormDialog({ open, onOpenChange, area }: AreaFormDialogProps) {
  const { create, update } = useAreaMutations();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      codigo: "",
      ordem: 0,
      ativo: true,
    },
  });

  useEffect(() => {
    if (area) {
      form.reset({
        nome: area.nome,
        codigo: area.codigo || "",
        ordem: area.ordem,
        ativo: area.ativo,
      });
    } else {
      form.reset({
        nome: "",
        codigo: "",
        ordem: 0,
        ativo: true,
      });
    }
  }, [area, form]);

  const onSubmit = (data: FormData) => {
    const payload = {
      ...data,
      codigo: data.codigo || data.nome.toLowerCase().replace(/\s+/g, '_').normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
    };

    if (area) {
      update.mutate(
        { id: area.id, data: payload },
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
            {area ? "Editar Área" : "Nova Área"}
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
                    <Input placeholder="Ex: Inside Sales" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="codigo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="inside_sales" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ordem"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ordem</FormLabel>
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
            </div>

            <FormField
              control={form.control}
              name="ativo"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <FormLabel>Área Ativa</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Áreas inativas não aparecem no seletor de cargos
                    </p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={create.isPending || update.isPending}>
                {area ? "Salvar" : "Criar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
