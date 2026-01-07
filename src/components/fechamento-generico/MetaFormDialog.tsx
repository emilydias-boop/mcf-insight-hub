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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  useMetaComponentes, 
  useMetaMutations,
  useReguas,
  useCargos
} from "@/hooks/useFechamentoGenerico";
import { MetaMes, AREA_OPTIONS } from "@/types/fechamento-generico";
import { CompetenciaSelector } from "./CompetenciaSelector";

const metaSchema = z.object({
  competencia: z.string().min(1, "Competência é obrigatória"),
  area: z.string().min(1, "Área é obrigatória"),
  cargo_base: z.string().min(1, "Cargo base é obrigatório"),
  nivel: z.coerce.number().nullable(),
  cargo_catalogo_id: z.string().nullable(),
  regua_id: z.string().nullable(),
  observacao: z.string().nullable(),
  ativo: z.boolean(),
});

type MetaFormValues = z.infer<typeof metaSchema>;

interface ComponenteLocal {
  id?: string;
  nome_componente: string;
  valor_base: number;
  ordem: number;
  ativo: boolean;
}

interface MetaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meta: MetaMes | null;
  defaultCompetencia?: string;
}

export function MetaFormDialog({ 
  open, 
  onOpenChange, 
  meta,
  defaultCompetencia 
}: MetaFormDialogProps) {
  const { createMeta, updateMeta, createComponente, updateComponente, deleteComponente } = useMetaMutations();
  const { data: existingComponentes = [] } = useMetaComponentes(meta?.id || null);
  const { data: reguas = [] } = useReguas();
  const { data: cargos = [] } = useCargos();
  const isEditing = !!meta;

  const [componentes, setComponentes] = useState<ComponenteLocal[]>([]);

  const form = useForm<MetaFormValues>({
    resolver: zodResolver(metaSchema),
    defaultValues: {
      competencia: defaultCompetencia || "",
      area: "",
      cargo_base: "",
      nivel: null,
      cargo_catalogo_id: null,
      regua_id: null,
      observacao: null,
      ativo: true,
    },
  });

  useEffect(() => {
    if (meta) {
      form.reset({
        competencia: meta.competencia,
        area: meta.area,
        cargo_base: meta.cargo_base,
        nivel: meta.nivel,
        cargo_catalogo_id: meta.cargo_catalogo_id,
        regua_id: meta.regua_id,
        observacao: meta.observacao,
        ativo: meta.ativo,
      });
    } else {
      form.reset({
        competencia: defaultCompetencia || "",
        area: "",
        cargo_base: "",
        nivel: null,
        cargo_catalogo_id: null,
        regua_id: null,
        observacao: null,
        ativo: true,
      });
      setComponentes([]);
    }
  }, [meta, form, defaultCompetencia, open]);

  useEffect(() => {
    if (existingComponentes.length > 0) {
      setComponentes(
        existingComponentes.map((c) => ({
          id: c.id,
          nome_componente: c.nome_componente,
          valor_base: c.valor_base,
          ordem: c.ordem,
          ativo: c.ativo,
        }))
      );
    }
  }, [existingComponentes]);

  const addComponente = () => {
    const lastComp = componentes[componentes.length - 1];
    const newOrdem = (lastComp?.ordem || 0) + 1;
    
    setComponentes([
      ...componentes,
      {
        nome_componente: "",
        valor_base: 0,
        ordem: newOrdem,
        ativo: true,
      },
    ]);
  };

  const removeComponente = (index: number) => {
    setComponentes(componentes.filter((_, i) => i !== index));
  };

  const updateComponenteLocal = (
    index: number, 
    field: keyof ComponenteLocal, 
    value: string | number | boolean
  ) => {
    setComponentes(
      componentes.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  };

  // Auto-fill from cargo catalog
  const selectedCargoId = form.watch("cargo_catalogo_id");
  useEffect(() => {
    if (selectedCargoId) {
      const cargo = cargos.find(c => c.id === selectedCargoId);
      if (cargo) {
        form.setValue("area", cargo.area);
        form.setValue("cargo_base", cargo.cargo_base);
        form.setValue("nivel", cargo.nivel);
      }
    }
  }, [selectedCargoId, cargos, form]);

  const onSubmit = async (values: MetaFormValues) => {
    try {
      if (isEditing) {
        // Update meta
        await updateMeta.mutateAsync({ id: meta.id, ...values });

        // Handle componentes
        const existingIds = new Set(existingComponentes.map((c) => c.id));
        const newCompIds = new Set(componentes.filter((c) => c.id).map((c) => c.id));

        // Delete removed componentes
        for (const existing of existingComponentes) {
          if (!newCompIds.has(existing.id)) {
            await deleteComponente.mutateAsync(existing.id);
          }
        }

        // Update or create componentes
        for (const comp of componentes) {
          if (comp.id && existingIds.has(comp.id)) {
            await updateComponente.mutateAsync({
              id: comp.id,
              nome_componente: comp.nome_componente,
              valor_base: comp.valor_base,
              ordem: comp.ordem,
              ativo: comp.ativo,
            });
          } else if (comp.nome_componente) {
            await createComponente.mutateAsync({
              meta_mes_id: meta.id,
              nome_componente: comp.nome_componente,
              valor_base: comp.valor_base,
              ordem: comp.ordem,
              ativo: comp.ativo,
            });
          }
        }

        onOpenChange(false);
      } else {
        // Create new meta with componentes
        createMeta.mutate(
          { ...values, componentes: componentes.filter(c => c.nome_componente) },
          { onSuccess: () => onOpenChange(false) }
        );
      }
    } catch (error) {
      console.error("Error saving meta:", error);
    }
  };

  const activeReguas = reguas.filter(r => r.ativo);
  const activeCargos = cargos.filter(c => c.ativo);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Meta" : "Nova Meta"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="competencia"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Competência</FormLabel>
                  <FormControl>
                    <CompetenciaSelector
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cargo_catalogo_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cargo do Catálogo (opcional)</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value || undefined}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione para preencher automaticamente" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activeCargos.map((cargo) => (
                        <SelectItem key={cargo.id} value={cargo.id}>
                          {cargo.nome_exibicao} ({cargo.area})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

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
              name="regua_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Régua de Multiplicador (opcional)</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value || undefined}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma régua" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activeReguas.map((regua) => (
                        <SelectItem key={regua.id} value={regua.id}>
                          {regua.nome_regua}
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
              name="observacao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observação (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Notas sobre esta meta..."
                      {...field}
                      value={field.value || ""}
                    />
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
                      Meta disponível para fechamentos
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

            {/* Componentes */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Componentes da Meta</h3>
                <Button type="button" variant="outline" size="sm" onClick={addComponente}>
                  <Plus className="mr-1 h-4 w-4" />
                  Adicionar Componente
                </Button>
              </div>

              {componentes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
                  Nenhum componente. Clique em "Adicionar Componente" para começar.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">#</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead className="w-[120px]">Valor Base</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {componentes
                      .sort((a, b) => a.ordem - b.ordem)
                      .map((comp, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Input
                              type="number"
                              value={comp.ordem}
                              onChange={(e) =>
                                updateComponenteLocal(index, "ordem", Number(e.target.value))
                              }
                              className="w-14"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={comp.nome_componente}
                              onChange={(e) =>
                                updateComponenteLocal(index, "nome_componente", e.target.value)
                              }
                              placeholder="Ex: Reuniões R1"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={comp.valor_base}
                              onChange={(e) =>
                                updateComponenteLocal(index, "valor_base", Number(e.target.value))
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeComponente(index)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
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
                disabled={createMeta.isPending || updateMeta.isPending}
              >
                {isEditing ? "Salvar" : "Criar Meta"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
