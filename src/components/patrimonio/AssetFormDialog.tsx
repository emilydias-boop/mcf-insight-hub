import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAssetMutations } from '@/hooks/useAssets';
import { 
  Asset, 
  AssetType, 
  ASSET_TYPE_LABELS,
  CreateAssetInput 
} from '@/types/patrimonio';
import { Loader2 } from 'lucide-react';

const assetSchema = z.object({
  numero_patrimonio: z.string().min(1, 'Número do patrimônio é obrigatório'),
  tipo: z.enum(['notebook', 'desktop', 'monitor', 'celular', 'tablet', 'impressora', 'outro'] as const),
  marca: z.string().optional(),
  modelo: z.string().optional(),
  numero_serie: z.string().optional(),
  sistema_operacional: z.string().optional(),
  data_compra: z.string().optional(),
  fornecedor: z.string().optional(),
  observacoes: z.string().optional(),
});

type AssetFormData = z.infer<typeof assetSchema>;

interface AssetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset?: Asset; // For edit mode
}

export const AssetFormDialog = ({ open, onOpenChange, asset }: AssetFormDialogProps) => {
  const { createAsset, updateAsset } = useAssetMutations();
  const isEdit = !!asset;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<AssetFormData>({
    resolver: zodResolver(assetSchema),
    defaultValues: asset ? {
      numero_patrimonio: asset.numero_patrimonio,
      tipo: asset.tipo,
      marca: asset.marca || '',
      modelo: asset.modelo || '',
      numero_serie: asset.numero_serie || '',
      sistema_operacional: asset.sistema_operacional || '',
      data_compra: asset.data_compra || '',
      fornecedor: asset.fornecedor || '',
      observacoes: asset.observacoes || '',
    } : {
      tipo: 'notebook',
    },
  });

  const tipo = watch('tipo');

  const onSubmit = async (data: AssetFormData) => {
    try {
      if (isEdit) {
        await updateAsset.mutateAsync({ id: asset.id, ...data });
      } else {
        await createAsset.mutateAsync(data as CreateAssetInput);
      }
      reset();
      onOpenChange(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  const isLoading = createAsset.isPending || updateAsset.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Equipamento' : 'Novo Equipamento'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Atualize os dados do equipamento' : 'Cadastre um novo equipamento de TI'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numero_patrimonio">Número do Patrimônio *</Label>
              <Input
                id="numero_patrimonio"
                {...register('numero_patrimonio')}
                placeholder="Ex: TI-001"
                disabled={isEdit}
              />
              {errors.numero_patrimonio && (
                <p className="text-sm text-destructive">{errors.numero_patrimonio.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo *</Label>
              <Select value={tipo} onValueChange={(v) => setValue('tipo', v as AssetType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ASSET_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="marca">Marca</Label>
              <Input {...register('marca')} placeholder="Ex: Dell, Lenovo, Apple" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="modelo">Modelo</Label>
              <Input {...register('modelo')} placeholder="Ex: Latitude 5520" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="numero_serie">Número de Série</Label>
              <Input {...register('numero_serie')} placeholder="Serial number" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sistema_operacional">Sistema Operacional</Label>
              <Input {...register('sistema_operacional')} placeholder="Ex: Windows 11, macOS" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_compra">Data de Compra</Label>
              <Input type="date" {...register('data_compra')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fornecedor">Fornecedor</Label>
              <Input {...register('fornecedor')} placeholder="Nome do fornecedor" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              {...register('observacoes')}
              placeholder="Notas adicionais sobre o equipamento"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
