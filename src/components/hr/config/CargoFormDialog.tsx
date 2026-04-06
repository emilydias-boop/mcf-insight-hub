import { useEffect, useState, KeyboardEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Cargo, useCargoMutations, useAreas } from "@/hooks/useHRConfig";
import { useRolesConfig } from "@/hooks/useRolesConfig";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";

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
  role_sistema: z.string().optional(),
  descricao: z.string().optional(),
  trilha_pdi: z.string().optional(),
  ativo: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder: string;
}

function TagInput({ value, onChange, placeholder }: TagInputProps) {
  const [input, setInput] = useState("");

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      if (!value.includes(input.trim())) {
        onChange([...value, input.trim()]);
      }
      setInput("");
    }
  };

  const removeTag = (tag: string) => {
    onChange(value.filter(t => t !== tag));
  };

  return (
    <div className="space-y-2">
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 pr-1">
              {tag}
              <button type="button" onClick={() => removeTag(tag)} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

interface CargoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cargo: Cargo | null;
}

export default function CargoFormDialog({ open, onOpenChange, cargo }: CargoFormDialogProps) {
  const { create, update } = useCargoMutations();
  const { data: areas } = useAreas();
  const { roles: activeRoles } = useRolesConfig(true);

  const [compEssenciais, setCompEssenciais] = useState<string[]>([]);
  const [compTecnicas, setCompTecnicas] = useState<string[]>([]);
  const [docsPadrao, setDocsPadrao] = useState<string[]>([]);

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
      role_sistema: "viewer",
      descricao: "",
      trilha_pdi: "",
      ativo: true,
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
        role_sistema: cargo.role_sistema || "viewer",
        descricao: cargo.descricao || "",
        trilha_pdi: cargo.trilha_pdi || "",
        ativo: cargo.ativo,
      });
      setCompEssenciais(cargo.competencias_essenciais || []);
      setCompTecnicas(cargo.competencias_tecnicas || []);
      setDocsPadrao(cargo.documentos_padrao || []);
    } else {
      form.reset({
        nome_exibicao: "",
        cargo_base: "",
        area: "",
        nivel: null,
        fixo_valor: 0,
        variavel_valor: 0,
        modelo_variavel: "score_metricas",
        role_sistema: "viewer",
        descricao: "",
        trilha_pdi: "",
        ativo: true,
      });
      setCompEssenciais([]);
      setCompTecnicas([]);
      setDocsPadrao([]);
    }
  }, [cargo, form]);

  const fixoValor = form.watch("fixo_valor") || 0;
  const variavelValor = form.watch("variavel_valor") || 0;
  const oteTotal = fixoValor + variavelValor;

  const onSubmit = (data: FormData) => {
    const payload = {
      ...data,
      ote_total: (data.fixo_valor || 0) + (data.variavel_valor || 0),
      competencias_essenciais: compEssenciais,
      competencias_tecnicas: compTecnicas,
      documentos_padrao: docsPadrao,
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
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {cargo ? "Editar Cargo" : "Novo Cargo"}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Seção 1 — Dados básicos */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dados Básicos</h4>
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

                <FormField
                  control={form.control}
                  name="role_sistema"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role de Sistema</FormLabel>
                      <Select value={field.value || "viewer"} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {activeRoles.map((r) => (
                            <SelectItem key={r.role_key} value={r.role_key}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Define as permissões de acesso ao sistema para usuários com este cargo
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* Seção 2 — Descrição */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Descrição</h4>
                <FormField
                  control={form.control}
                  name="descricao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição do Cargo</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Descreva as responsabilidades e atribuições do cargo..."
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* Seção 3 — Competências */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Competências</h4>
                <div>
                  <Label className="text-sm">Competências Essenciais</Label>
                  <p className="text-xs text-muted-foreground mb-2">Pressione Enter para adicionar</p>
                  <TagInput
                    value={compEssenciais}
                    onChange={setCompEssenciais}
                    placeholder="Ex: Comunicação, Liderança..."
                  />
                </div>
                <div>
                  <Label className="text-sm">Competências Técnicas</Label>
                  <p className="text-xs text-muted-foreground mb-2">Pressione Enter para adicionar</p>
                  <TagInput
                    value={compTecnicas}
                    onChange={setCompTecnicas}
                    placeholder="Ex: Excel avançado, CRM..."
                  />
                </div>
              </div>

              <Separator />

              {/* Seção 4 — Documentos padrão */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Documentos Padrão</h4>
                <div>
                  <Label className="text-sm">Tipos de Documentos</Label>
                  <p className="text-xs text-muted-foreground mb-2">Pressione Enter para adicionar</p>
                  <TagInput
                    value={docsPadrao}
                    onChange={setDocsPadrao}
                    placeholder="Ex: Contrato PJ, Job Description..."
                  />
                </div>
              </div>

              <Separator />

              {/* Seção 5 — Desenvolvimento */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Desenvolvimento</h4>
                <FormField
                  control={form.control}
                  name="trilha_pdi"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Trilha de PDI Sugerida</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Trilha de vendas consultivas" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* Seção 6 — Remuneração */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Remuneração</h4>
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
                            step={0.01}
                            value={field.value}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                            placeholder="0,00"
                          />
                        </FormControl>
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
                            step={0.01}
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
              </div>

              <Separator />

              {/* Seção 7 — Status */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Status</h4>
                <FormField
                  control={form.control}
                  name="ativo"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-3">
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <Label>{field.value ? "Cargo Ativo" : "Cargo Inativo"}</Label>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
