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
import { supabase } from '@/integrations/supabase/client';
import { 
  Asset, 
  AssetType, 
  ASSET_TYPE_LABELS,
  CreateAssetInput 
} from '@/types/patrimonio';
import { Loader2, Upload } from 'lucide-react';

const assetSchema = z.object({
  tipo: z.enum(['notebook', 'desktop', 'monitor', 'celular', 'tablet', 'impressora', 'outro'] as const),
  marca: z.string().optional(),
  modelo: z.string().optional(),
  numero_serie: z.string().optional(),
  sistema_operacional: z.string().optional(),
  data_compra: z.string().optional(),
  fornecedor: z.string().optional(),
  observacoes: z.string().optional(),
  garantia_inicio: z.string().optional(),
  garantia_fim: z.string().optional(),
  localizacao: z.string().optional(),
  centro_custo: z.string().optional(),
});

type AssetFormData = z.infer<typeof assetSchema>;

interface AssetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset?: Asset; // For edit mode
}

export const AssetFormDialog = ({ open, onOpenChange, asset }: AssetFormDialogProps) => {
  const { createAsset, updateAsset } = useAssetMutations();
  const [notaFiscalFile, setNotaFiscalFile] = useState<File | null>(null);
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
      tipo: asset.tipo,
      marca: asset.marca || '',
      modelo: asset.modelo || '',
      numero_serie: asset.numero_serie || '',
      sistema_operacional: asset.sistema_operacional || '',
      data_compra: asset.data_compra || '',
      fornecedor: asset.fornecedor || '',
      observacoes: asset.observacoes || '',
      garantia_inicio: asset.garantia_inicio || '',
      garantia_fim: asset.garantia_fim || '',
      localizacao: asset.localizacao || '',
      centro_custo: asset.centro_custo || '',
    } : {
      tipo: 'notebook',
    },
  });

  const tipo = watch('tipo');

  const onSubmit = async (data: AssetFormData) => {
    try {
      const cleanData = {
        ...data,
        marca: data.marca || null,
        modelo: data.modelo || null,
        numero_serie: data.numero_serie || null,
        sistema_operacional: data.sistema_operacional || null,
        data_compra: data.data_compra || null,
        fornecedor: data.fornecedor || null,
        observacoes: data.observacoes || null,
        garantia_inicio: data.garantia_inicio || null,
        garantia_fim: data.garantia_fim || null,
        localizacao: data.localizacao || null,
        centro_custo: data.centro_custo || null,
      };

      let result: any;
      if (isEdit) {
        result = await updateAsset.mutateAsync({ id: asset.id, ...cleanData });
      } else {
        result = await createAsset.mutateAsync(cleanData as CreateAssetInput);
      }

      // Upload nota fiscal if selected
      if (notaFiscalFile && result?.id) {
        const filePath = `${result.id}/${notaFiscalFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('asset-invoices')
          .upload(filePath, notaFiscalFile, { upsert: true });
        
        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('asset-invoices')
            .getPublicUrl(filePath);
          
          await supabase.from('assets').update({
            nota_fiscal_path: filePath,
            nota_fiscal_url: urlData.publicUrl,
          }).eq('id', result.id);
        }
      }

      reset();
      setNotaFiscalFile(null);
      onOpenChange(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  const isLoading = createAsset.isPending || updateAsset.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Equipamento' : 'Novo Equipamento'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Atualize os dados do equipamento' : 'Cadastre um novo equipamento de TI. O número de patrimônio será gerado automaticamente.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Show patrimônio number read-only in edit mode */}
          {isEdit && (
            <div className="space-y-2">
              <Label>Número do Patrimônio</Label>
              <Input value={asset.numero_patrimonio} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">Gerado automaticamente. Somente admin pode editar.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
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

            <div className="space-y-2">
              <Label htmlFor="localizacao">Localização</Label>
              <Input {...register('localizacao')} placeholder="Ex: Sala 201, Andar 3" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="centro_custo">Centro de Custo</Label>
              <Input {...register('centro_custo')} placeholder="Ex: TI-001" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="garantia_inicio">Garantia - Início</Label>
              <Input type="date" {...register('garantia_inicio')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="garantia_fim">Garantia - Fim</Label>
              <Input type="date" {...register('garantia_fim')} />
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

          <div className="space-y-2">
            <Label>Nota Fiscal</Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={e => setNotaFiscalFile(e.target.files?.[0] || null)}
                className="file:mr-2 file:rounded file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-sm file:text-primary"
              />
              {notaFiscalFile && (
                <Upload className="h-4 w-4 text-primary" />
              )}
            </div>
            {asset?.nota_fiscal_url && !notaFiscalFile && (
              <p className="text-xs text-muted-foreground">
                Arquivo atual: <a href={asset.nota_fiscal_url} target="_blank" rel="noopener noreferrer" className="underline">Ver nota fiscal</a>
              </p>
            )}
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
