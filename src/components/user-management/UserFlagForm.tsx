import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

const flagSchema = z.object({
  title: z.string().min(3, "Título deve ter no mínimo 3 caracteres"),
  description: z.string().optional(),
  flag_type: z.enum(['red', 'yellow', 'green']),
  category: z.enum(['desempenho', 'comportamento', 'frequencia', 'financeiro', 'compliance', 'outros']),
  severity: z.number().min(1).max(5),
});

type FlagFormValues = z.infer<typeof flagSchema>;

interface UserFlagFormProps {
  userId: string;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export function UserFlagForm({ userId, onSubmit, onCancel }: UserFlagFormProps) {
  const form = useForm<FlagFormValues>({
    resolver: zodResolver(flagSchema),
    defaultValues: {
      title: "",
      description: "",
      flag_type: "yellow",
      category: "desempenho",
      severity: 3,
    },
  });

  const handleSubmit = (data: FlagFormValues) => {
    onSubmit({
      ...data,
      user_id: userId,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição</FormLabel>
              <FormControl>
                <Textarea {...field} rows={3} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="flag_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Flag</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="red">Red Flag</SelectItem>
                    <SelectItem value="yellow">Yellow Flag</SelectItem>
                    <SelectItem value="green">Green Flag</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoria</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="desempenho">Desempenho</SelectItem>
                    <SelectItem value="comportamento">Comportamento</SelectItem>
                    <SelectItem value="frequencia">Frequência</SelectItem>
                    <SelectItem value="financeiro">Financeiro</SelectItem>
                    <SelectItem value="compliance">Compliance</SelectItem>
                    <SelectItem value="outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="severity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Severidade: {field.value}</FormLabel>
              <FormControl>
                <Slider
                  min={1}
                  max={5}
                  step={1}
                  value={[field.value]}
                  onValueChange={(value) => field.onChange(value[0])}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit">Criar Flag</Button>
        </div>
      </form>
    </Form>
  );
}
