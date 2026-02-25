import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useUpdateProductConfiguration,
  TARGET_BU_OPTIONS,
  PRODUCT_CATEGORY_OPTIONS,
  ProductConfiguration,
} from "@/hooks/useProductConfigurations";
import { Loader2 } from "lucide-react";
import { PriceHistorySection } from "./PriceHistorySection";

const formSchema = z.object({
  product_code: z.string().nullable(),
  display_name: z.string().nullable(),
  product_category: z.string(),
  target_bu: z.string().nullable(),
  reference_price: z.coerce.number().min(0),
  is_active: z.boolean(),
  count_in_dashboard: z.boolean(),
  notes: z.string().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

interface ProductConfigDrawerProps {
  product: ProductConfiguration | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductConfigDrawer({
  product,
  open,
  onOpenChange,
}: ProductConfigDrawerProps) {
  const updateMutation = useUpdateProductConfiguration();
  const [priceChanged, setPriceChanged] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      product_code: "",
      display_name: "",
      product_category: "outros",
      target_bu: null,
      reference_price: 0,
      is_active: true,
      count_in_dashboard: true,
      notes: "",
    },
  });

  useEffect(() => {
    if (product) {
      form.reset({
        product_code: product.product_code || "",
        display_name: product.display_name || "",
        product_category: product.product_category,
        target_bu: product.target_bu,
        reference_price: product.reference_price,
        is_active: product.is_active,
        count_in_dashboard: product.count_in_dashboard,
        notes: product.notes || "",
      });
      setPriceChanged(false);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      setEffectiveFrom(today);
    }
  }, [product, form]);

  // Watch price changes
  const currentPrice = form.watch("reference_price");
  useEffect(() => {
    if (product) {
      setPriceChanged(Number(currentPrice) !== product.reference_price);
    }
  }, [currentPrice, product]);

  const onSubmit = async (values: FormValues) => {
    if (!product) return;

    await updateMutation.mutateAsync({
      id: product.id,
      updates: {
        product_code: values.product_code || null,
        display_name: values.display_name || null,
        product_category: values.product_category,
        target_bu: values.target_bu,
        reference_price: values.reference_price,
        is_active: values.is_active,
        count_in_dashboard: values.count_in_dashboard,
        notes: values.notes || null,
      },
      effectiveFrom: priceChanged ? effectiveFrom : undefined,
    });

    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Editar Produto</SheetTitle>
          <SheetDescription className="truncate">
            {product?.product_name}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-6">
            <FormField
              control={form.control}
              name="product_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código do Produto</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: A010"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormDescription>
                    Código de identificação único (A001, A010, etc.)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="display_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome de Exibição</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Nome amigável para exibição"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormDescription>
                    Nome curto para exibir nos relatórios (opcional)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="product_category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma categoria" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PRODUCT_CATEGORY_OPTIONS.map((opt) => (
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

            <FormField
              control={form.control}
              name="target_bu"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>BU de Destino</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || undefined}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma BU" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TARGET_BU_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Define em qual Business Unit este produto aparecerá
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reference_price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preço de Referência (R$)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Valor base usado para cálculos de faturamento bruto
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {priceChanged && (
              <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4 space-y-2">
                <FormLabel className="text-sm font-medium">Vigência a partir de</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !effectiveFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {effectiveFrom
                        ? format(effectiveFrom, "dd/MM/yyyy", { locale: ptBR })
                        : "Selecione uma data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                    <Calendar
                      mode="single"
                      selected={effectiveFrom}
                      onSelect={(date) => date && setEffectiveFrom(date)}
                      locale={ptBR}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <FormDescription className="text-xs">
                  O novo preço será aplicado para todas as transações a partir desta data
                </FormDescription>
              </div>
            )}

            <div className="space-y-4">
              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Produto Ativo</FormLabel>
                      <FormDescription>
                        Produtos inativos não aparecem em novos relatórios
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
                name="count_in_dashboard"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Contar no Dashboard</FormLabel>
                      <FormDescription>
                        Se deve ser contabilizado nas métricas do dashboard
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
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Notas sobre este produto..."
                      className="resize-none"
                      rows={3}
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <PriceHistorySection productConfigId={product?.id ?? null} />

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Salvar
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
