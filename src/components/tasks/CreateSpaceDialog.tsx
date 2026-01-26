import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Building2, Folder, ListTodo } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { useCreateTaskSpace, TaskSpaceType } from "@/hooks/useTaskSpaces";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  type: z.enum(["setor", "pasta", "lista"]),
  is_private: z.boolean().default(false),
  color: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface CreateSpaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId?: string | null;
  parentType?: TaskSpaceType | null;
  defaultType?: TaskSpaceType;
}

const typeConfig = {
  setor: {
    icon: Building2,
    label: "Setor",
    description: "Nível superior de organização",
    color: "bg-emerald-100 text-emerald-700 border-emerald-300",
  },
  pasta: {
    icon: Folder,
    label: "Pasta",
    description: "Agrupa listas dentro de um setor",
    color: "bg-amber-100 text-amber-700 border-amber-300",
  },
  lista: {
    icon: ListTodo,
    label: "Lista",
    description: "Contém as tarefas",
    color: "bg-blue-100 text-blue-700 border-blue-300",
  },
};

const colors = [
  { name: "Verde", value: "#10b981" },
  { name: "Azul", value: "#3b82f6" },
  { name: "Roxo", value: "#8b5cf6" },
  { name: "Rosa", value: "#ec4899" },
  { name: "Laranja", value: "#f97316" },
  { name: "Amarelo", value: "#eab308" },
  { name: "Cinza", value: "#6b7280" },
];

export function CreateSpaceDialog({
  open,
  onOpenChange,
  parentId,
  parentType,
  defaultType,
}: CreateSpaceDialogProps) {
  const createSpace = useCreateTaskSpace();
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  // Determina quais tipos são permitidos baseado no contexto
  const getAvailableTypes = (): TaskSpaceType[] => {
    if (!parentId) return ["setor"];
    if (parentType === "setor") return ["pasta", "lista"];
    if (parentType === "pasta") return ["lista"];
    return ["setor", "pasta", "lista"];
  };

  const availableTypes = getAvailableTypes();
  const initialType = defaultType || availableTypes[0];

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: initialType,
      is_private: false,
    },
  });

  const selectedType = form.watch("type") as TaskSpaceType;

  const onSubmit = async (data: FormData) => {
    await createSpace.mutateAsync({
      name: data.name,
      type: data.type,
      parent_id: parentId,
      is_private: data.is_private,
      color: selectedColor,
    });
    form.reset();
    setSelectedColor(null);
    onOpenChange(false);
  };

  const getTitle = () => {
    if (!parentId) return "Criar Setor";
    if (parentType === "setor") return "Adicionar ao Setor";
    if (parentType === "pasta") return "Adicionar à Pasta";
    return "Criar Espaço";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome do espaço..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {availableTypes.length > 1 && (
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <FormControl>
                      <RadioGroup
                        value={field.value}
                        onValueChange={field.onChange}
                        className="grid gap-2"
                      >
                        {availableTypes.map((type) => {
                          const config = typeConfig[type];
                          const Icon = config.icon;
                          return (
                            <label
                              key={type}
                              className={cn(
                                "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                                field.value === type
                                  ? config.color
                                  : "hover:bg-muted"
                              )}
                            >
                              <RadioGroupItem value={type} className="sr-only" />
                              <Icon className="h-5 w-5" />
                              <div className="flex-1">
                                <div className="font-medium">{config.label}</div>
                                <div className="text-xs text-muted-foreground">
                                  {config.description}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Color picker */}
            <div className="space-y-2">
              <FormLabel>Cor (opcional)</FormLabel>
              <div className="flex gap-2 flex-wrap">
                {colors.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setSelectedColor(
                      selectedColor === color.value ? null : color.value
                    )}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-all",
                      selectedColor === color.value
                        ? "ring-2 ring-offset-2 ring-primary"
                        : "border-transparent hover:scale-110"
                    )}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            <FormField
              control={form.control}
              name="is_private"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Privado</FormLabel>
                    <div className="text-xs text-muted-foreground">
                      Visível apenas para você
                    </div>
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createSpace.isPending}>
                {createSpace.isPending ? "Criando..." : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
