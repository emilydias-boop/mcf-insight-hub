import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useReguaFaixas, useReguaMutations } from "@/hooks/useFechamentoGenerico";
import { ReguaMultiplicador } from "@/types/fechamento-generico";

const reguaSchema = z.object({
  nome_regua: z.string().min(1, "Nome é obrigatório"),
  ativo: z.boolean(),
});

type ReguaFormValues = z.infer<typeof reguaSchema>;

interface FaixaLocal {
  id?: string;
  faixa_de: number;
  faixa_ate: number;
  multiplicador: number;
  ordem: number;
}

interface ReguaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  regua: ReguaMultiplicador | null;
}

export function ReguaFormDialog({ open, onOpenChange, regua }: ReguaFormDialogProps) {
  const { createRegua, updateRegua, createFaixa, updateFaixa, deleteFaixa } = useReguaMutations();
  const { data: existingFaixas = [] } = useReguaFaixas(regua?.id || null);
  const isEditing = !!regua;

  const [faixas, setFaixas] = useState<FaixaLocal[]>([]);

  const form = useForm<ReguaFormValues>({
    resolver: zodResolver(reguaSchema),
    defaultValues: {
      nome_regua: "",
      ativo: true,
    },
  });

  useEffect(() => {
    if (regua) {
      form.reset({
        nome_regua: regua.nome_regua,
        ativo: regua.ativo,
      });
    } else {
      form.reset({
        nome_regua: "",
        ativo: true,
      });
      // Default faixas for new régua
      setFaixas([
        { faixa_de: 0, faixa_ate: 80, multiplicador: 0, ordem: 1 },
        { faixa_de: 80, faixa_ate: 100, multiplicador: 1, ordem: 2 },
        { faixa_de: 100, faixa_ate: 120, multiplicador: 1.2, ordem: 3 },
        { faixa_de: 120, faixa_ate: 999, multiplicador: 1.5, ordem: 4 },
      ]);
    }
  }, [regua, form, open]);

  useEffect(() => {
    if (existingFaixas.length > 0) {
      setFaixas(
        existingFaixas.map((f) => ({
          id: f.id,
          faixa_de: f.faixa_de,
          faixa_ate: f.faixa_ate,
          multiplicador: f.multiplicador,
          ordem: f.ordem,
        }))
      );
    }
  }, [existingFaixas]);

  const addFaixa = () => {
    const lastFaixa = faixas[faixas.length - 1];
    const newOrdem = (lastFaixa?.ordem || 0) + 1;
    const newFaixaDe = lastFaixa?.faixa_ate || 0;
    
    setFaixas([
      ...faixas,
      {
        faixa_de: newFaixaDe,
        faixa_ate: newFaixaDe + 20,
        multiplicador: 1,
        ordem: newOrdem,
      },
    ]);
  };

  const removeFaixa = (index: number) => {
    setFaixas(faixas.filter((_, i) => i !== index));
  };

  const updateFaixaLocal = (index: number, field: keyof FaixaLocal, value: number) => {
    setFaixas(
      faixas.map((f, i) => (i === index ? { ...f, [field]: value } : f))
    );
  };

  const onSubmit = async (values: ReguaFormValues) => {
    try {
      if (isEditing) {
        // Update régua
        await updateRegua.mutateAsync({ id: regua.id, ...values });

        // Handle faixas
        const existingIds = new Set(existingFaixas.map((f) => f.id));
        const newFaixaIds = new Set(faixas.filter((f) => f.id).map((f) => f.id));

        // Delete removed faixas
        for (const existing of existingFaixas) {
          if (!newFaixaIds.has(existing.id)) {
            await deleteFaixa.mutateAsync({ id: existing.id, reguaId: regua.id });
          }
        }

        // Update or create faixas
        for (const faixa of faixas) {
          if (faixa.id && existingIds.has(faixa.id)) {
            await updateFaixa.mutateAsync({
              id: faixa.id,
              faixa_de: faixa.faixa_de,
              faixa_ate: faixa.faixa_ate,
              multiplicador: faixa.multiplicador,
              ordem: faixa.ordem,
            });
          } else {
            await createFaixa.mutateAsync({
              regua_id: regua.id,
              faixa_de: faixa.faixa_de,
              faixa_ate: faixa.faixa_ate,
              multiplicador: faixa.multiplicador,
              ordem: faixa.ordem,
            });
          }
        }

        onOpenChange(false);
      } else {
        // Create new régua first, then add faixas
        const newRegua = await createRegua.mutateAsync({ nome_regua: values.nome_regua, ativo: values.ativo });
        
        // Create faixas for the new régua
        for (const faixa of faixas) {
          await createFaixa.mutateAsync({
            regua_id: newRegua.id,
            faixa_de: faixa.faixa_de,
            faixa_ate: faixa.faixa_ate,
            multiplicador: faixa.multiplicador,
            ordem: faixa.ordem,
          });
        }
        
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Error saving régua:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Régua" : "Nova Régua"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="nome_regua"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Régua</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Padrão Comercial" {...field} />
                  </FormControl>
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
                    <FormLabel className="text-base">Ativa</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Régua disponível para uso em metas
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

            {/* Faixas */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Faixas de Multiplicador</h3>
                <Button type="button" variant="outline" size="sm" onClick={addFaixa}>
                  <Plus className="mr-1 h-4 w-4" />
                  Adicionar Faixa
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Ordem</TableHead>
                    <TableHead>De (%)</TableHead>
                    <TableHead>Até (%)</TableHead>
                    <TableHead>Multiplicador</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {faixas
                    .sort((a, b) => a.ordem - b.ordem)
                    .map((faixa, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Input
                            type="number"
                            value={faixa.ordem}
                            onChange={(e) =>
                              updateFaixaLocal(index, "ordem", Number(e.target.value))
                            }
                            className="w-16"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={faixa.faixa_de}
                            onChange={(e) =>
                              updateFaixaLocal(index, "faixa_de", Number(e.target.value))
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={faixa.faixa_ate}
                            onChange={(e) =>
                              updateFaixaLocal(index, "faixa_ate", Number(e.target.value))
                            }
                            placeholder="999 = infinito"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={faixa.multiplicador}
                            onChange={(e) =>
                              updateFaixaLocal(index, "multiplicador", Number(e.target.value))
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFaixa(index)}
                            disabled={faixas.length <= 1}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground">
                Use 999 para "até infinito". Exemplo: 120% até 999% = 120%+
              </p>
            </div>

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
                disabled={createRegua.isPending || updateRegua.isPending}
              >
                {isEditing ? "Salvar" : "Criar Régua"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
