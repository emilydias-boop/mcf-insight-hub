import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePickerCustom } from "@/components/ui/DatePickerCustom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "@/hooks/use-toast";
import { useCreateTransaction, useUpdateTransaction } from "@/hooks/useHublaTransactions";
import { PRECO_REFERENCIA } from "@/lib/precosReferencia";

const PRODUCTS = [
  { code: "A000", name: "A000 - Contrato", price: 497 },
  { code: "A001", name: "A001 - MCF INCORPORADOR COMPLETO", price: 14500 },
  { code: "A002", name: "A002 - MCF INCORPORADOR BÁSICO", price: 7500 },
  { code: "A003", name: "A003 - MCF Plano Anticrise Completo", price: 7503 },
  { code: "A004", name: "A004 - MCF Plano Anticrise Básico", price: 5503 },
  { code: "A005", name: "A005 - MCF P2", price: 0 },
  { code: "A008", name: "A008 - The CLUB", price: 5000 },
  { code: "A009", name: "A009 - MCF INCORPORADOR + THE CLUB", price: 19500 },
];

const formSchema = z.object({
  product_code: z.string().min(1, "Selecione um produto"),
  customer_name: z.string().min(1, "Nome é obrigatório"),
  customer_email: z.string().email("Email inválido"),
  customer_phone: z.string().optional(),
  sale_date: z.date({ required_error: "Data é obrigatória" }),
  product_price: z.number().min(0),
  net_value: z.number().min(0, "Valor líquido é obrigatório"),
  installment_number: z.number().min(1).default(1),
  total_installments: z.number().min(1).default(1),
  count_in_dashboard: z.boolean().default(true),
});

type FormData = z.infer<typeof formSchema>;

interface TransactionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  transaction?: {
    id: string;
    product_name: string;
    customer_name: string | null;
    customer_email: string | null;
    customer_phone: string | null;
    sale_date: string;
    product_price: number | null;
    net_value: number | null;
    installment_number: number | null;
    total_installments: number | null;
    count_in_dashboard: boolean | null;
  } | null;
  onSuccess?: () => void;
}

export function TransactionFormDialog({
  open,
  onOpenChange,
  mode,
  transaction,
  onSuccess,
}: TransactionFormDialogProps) {
  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      product_code: "",
      customer_name: "",
      customer_email: "",
      customer_phone: "",
      sale_date: new Date(),
      product_price: 0,
      net_value: 0,
      installment_number: 1,
      total_installments: 1,
      count_in_dashboard: true,
    },
  });

  const selectedProductCode = watch("product_code");

  // Auto-fill price when product changes
  useEffect(() => {
    if (selectedProductCode && mode === "create") {
      const product = PRODUCTS.find((p) => p.code === selectedProductCode);
      if (product) {
        setValue("product_price", product.price);
      }
    }
  }, [selectedProductCode, mode, setValue]);

  // Fill form when editing
  useEffect(() => {
    if (mode === "edit" && transaction && open) {
      const productCode = PRODUCTS.find((p) =>
        transaction.product_name?.toUpperCase().includes(p.code)
      )?.code || "";

      reset({
        product_code: productCode,
        customer_name: transaction.customer_name || "",
        customer_email: transaction.customer_email || "",
        customer_phone: transaction.customer_phone || "",
        sale_date: transaction.sale_date ? new Date(transaction.sale_date) : new Date(),
        product_price: transaction.product_price || 0,
        net_value: transaction.net_value || 0,
        installment_number: transaction.installment_number || 1,
        total_installments: transaction.total_installments || 1,
        count_in_dashboard: transaction.count_in_dashboard !== false,
      });
    } else if (mode === "create" && open) {
      reset({
        product_code: "",
        customer_name: "",
        customer_email: "",
        customer_phone: "",
        sale_date: new Date(),
        product_price: 0,
        net_value: 0,
        installment_number: 1,
        total_installments: 1,
        count_in_dashboard: true,
      });
    }
  }, [mode, transaction, open, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      const product = PRODUCTS.find((p) => p.code === data.product_code);
      const productName = product?.name || data.product_code;

      if (mode === "create") {
        await createMutation.mutateAsync({
          product_name: productName,
          customer_name: data.customer_name,
          customer_email: data.customer_email,
          customer_phone: data.customer_phone || undefined,
          sale_date: data.sale_date.toISOString(),
          product_price: data.product_price,
          net_value: data.net_value,
          installment_number: data.installment_number,
          total_installments: data.total_installments,
          count_in_dashboard: data.count_in_dashboard,
        });
        toast({ title: "Sucesso", description: "Transação criada com sucesso" });
      } else if (transaction) {
        await updateMutation.mutateAsync({
          id: transaction.id,
          product_name: productName,
          customer_name: data.customer_name,
          customer_email: data.customer_email,
          customer_phone: data.customer_phone || undefined,
          sale_date: data.sale_date.toISOString(),
          product_price: data.product_price,
          net_value: data.net_value,
          installment_number: data.installment_number,
          total_installments: data.total_installments,
          count_in_dashboard: data.count_in_dashboard,
        });
        toast({ title: "Sucesso", description: "Transação atualizada com sucesso" });
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível salvar a transação",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nova Transação" : "Editar Transação"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Produto *</Label>
            <Controller
              name="product_code"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCTS.map((p) => (
                      <SelectItem key={p.code} value={p.code}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.product_code && (
              <p className="text-sm text-destructive">{errors.product_code.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome do Cliente *</Label>
              <Input {...register("customer_name")} placeholder="Nome completo" />
              {errors.customer_name && (
                <p className="text-sm text-destructive">{errors.customer_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Email *</Label>
              <Input {...register("customer_email")} type="email" placeholder="email@exemplo.com" />
              {errors.customer_email && (
                <p className="text-sm text-destructive">{errors.customer_email.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input {...register("customer_phone")} placeholder="(00) 00000-0000" />
            </div>

            <div className="space-y-2">
              <Label>Data da Venda *</Label>
              <Controller
                name="sale_date"
                control={control}
                render={({ field }) => (
                  <DatePickerCustom
                    mode="single"
                    selected={field.value}
                    onSelect={(date) => field.onChange(date)}
                    placeholder="Selecione a data"
                  />
                )}
              />
              {errors.sale_date && (
                <p className="text-sm text-destructive">{errors.sale_date.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor Bruto (R$)</Label>
              <Input
                type="number"
                step="0.01"
                {...register("product_price", { valueAsNumber: true })}
                placeholder="0,00"
              />
            </div>

            <div className="space-y-2">
              <Label>Valor Líquido (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                {...register("net_value", { valueAsNumber: true })}
                placeholder="0,00"
              />
              {errors.net_value && (
                <p className="text-sm text-destructive">{errors.net_value.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Parcela</Label>
              <Input
                type="number"
                min="1"
                {...register("installment_number", { valueAsNumber: true })}
              />
            </div>

            <div className="space-y-2">
              <Label>Total Parcelas</Label>
              <Input
                type="number"
                min="1"
                {...register("total_installments", { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Controller
              name="count_in_dashboard"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="count_in_dashboard"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Label htmlFor="count_in_dashboard" className="cursor-pointer">
              Contar no Dashboard
            </Label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}>
              {mode === "create" ? "Criar" : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
