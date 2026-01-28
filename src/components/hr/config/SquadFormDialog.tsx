import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Squad, useSquadMutations, useDepartamentos } from "@/hooks/useHRConfig";
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

const formSchema = z.object({
  nome: z.string().min(2, "Nome é obrigatório"),
  departamento_id: z.string().optional(),
  ordem: z.number().min(0),
});

type FormData = z.infer<typeof formSchema>;

interface SquadFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  squad: Squad | null;
}

export default function SquadFormDialog({ open, onOpenChange, squad }: SquadFormDialogProps) {
  const { create, update } = useSquadMutations();
  const { data: departamentos } = useDepartamentos();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      departamento_id: undefined,
      ordem: 0,
    },
  });

  useEffect(() => {
    if (squad) {
      form.reset({
        nome: squad.nome,
        departamento_id: squad.departamento_id || undefined,
        ordem: squad.ordem,
      });
    } else {
      form.reset({
        nome: "",
        departamento_id: undefined,
        ordem: 0,
      });
    }
  }, [squad, form]);

  const onSubmit = (data: FormData) => {
    const payload = {
      ...data,
      departamento_id: data.departamento_id || null,
      ativo: true,
    };

    if (squad) {
      update.mutate(
        { id: squad.id, data: payload },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      create.mutate(payload, {
        onSuccess: () => onOpenChange(false),
      });
    }
  };

  const activeDepartamentos = departamentos?.filter(d => d.ativo) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {squad ? "Editar Squad" : "Nova Squad"}
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
                    <Input placeholder="Ex: Inside Sales Produto" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="departamento_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Departamento</FormLabel>
                  <Select value={field.value || "_none"} onValueChange={(v) => field.onChange(v === "_none" ? undefined : v)}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um departamento" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="_none">Nenhum</SelectItem>
                      {activeDepartamentos.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.nome}
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
                {squad ? "Salvar" : "Criar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
