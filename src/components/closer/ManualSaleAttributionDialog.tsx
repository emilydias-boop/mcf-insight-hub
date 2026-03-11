import { useState } from "react";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { DollarSign, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ManualSaleAttributionDialogProps {
  closerId: string;
  closerName: string;
  onSuccess: () => void;
}

interface FormData {
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  contract_paid_at: string;
  notes: string;
}

const ALLOWED_ROLES = ["admin", "manager", "coordenador"];

export function ManualSaleAttributionDialog({
  closerId,
  closerName,
  onSuccess,
}: ManualSaleAttributionDialogProps) {
  const { role, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      contact_name: "",
      contact_email: "",
      contact_phone: "",
      contract_paid_at: format(new Date(), "yyyy-MM-dd"),
      notes: "",
    },
  });

  if (!role || !ALLOWED_ROLES.includes(role)) {
    return null;
  }

  const onSubmit = async (data: FormData) => {
    if (!user) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("manual_sale_attributions" as any)
        .insert({
          closer_id: closerId,
          contact_name: data.contact_name,
          contact_email: data.contact_email || null,
          contact_phone: data.contact_phone || null,
          contract_paid_at: new Date(data.contract_paid_at + "T12:00:00").toISOString(),
          notes: data.notes || null,
          created_by: user.id,
        } as any);

      if (error) throw error;

      toast.success("Venda manual atribuída com sucesso!");
      reset();
      setOpen(false);
      onSuccess();
    } catch (err: any) {
      console.error("Error creating manual attribution:", err);
      toast.error("Erro ao atribuir venda manual: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Atribuir Venda Manual
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-amber-400" />
            Atribuir Venda Manual
          </DialogTitle>
          <DialogDescription>
            Atribua uma venda ao closer <strong>{closerName}</strong> que não possui registro de reunião no sistema.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contact_name">Nome do contato *</Label>
            <Input
              id="contact_name"
              placeholder="Ex: Flávio Mário"
              {...register("contact_name", { required: "Nome é obrigatório" })}
            />
            {errors.contact_name && (
              <p className="text-xs text-destructive">{errors.contact_name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_email">Email</Label>
            <Input
              id="contact_email"
              type="email"
              placeholder="email@exemplo.com"
              {...register("contact_email")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_phone">Telefone</Label>
            <Input
              id="contact_phone"
              placeholder="(11) 99999-9999"
              {...register("contact_phone")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contract_paid_at">Data do contrato pago *</Label>
            <Input
              id="contract_paid_at"
              type="date"
              {...register("contract_paid_at", { required: "Data é obrigatória" })}
            />
            {errors.contract_paid_at && (
              <p className="text-xs text-destructive">{errors.contract_paid_at.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              placeholder="Ex: Reunião realizada em dezembro, antes do sistema"
              {...register("notes")}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Atribuir Venda"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
