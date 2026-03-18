import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RefreshCw, Link2, Plus } from 'lucide-react';

// Mapeamento departamento → squad
const DEPT_TO_SQUAD: Record<string, string> = {
  'BU - Incorporador 50K': 'incorporador',
  'BU - Incorporador MCF': 'incorporador',
  'BU - Consórcio': 'consorcio',
  'BU - Consorcio': 'consorcio',
  'BU - Crédito': 'credito',
  'BU - Credito': 'credito',
  'Inside': 'incorporador',
};

interface LinkSdrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: {
    id: string;
    nome_completo: string;
    departamento: string | null;
    email_pessoal?: string | null;
  } | null;
}

export const LinkSdrDialog = ({ open, onOpenChange, employee }: LinkSdrDialogProps) => {
  const [selectedSdrId, setSelectedSdrId] = useState<string>('');
  const queryClient = useQueryClient();

  // Query: SDRs ativos disponíveis
  const { data: availableSdrs, isLoading: sdrsLoading } = useQuery({
    queryKey: ['available-sdrs-for-link'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sdr')
        .select('id, name, email, squad, role_type')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Vincular SDR existente
  const linkSdrMutation = useMutation({
    mutationFn: async ({ employeeId, sdrId }: { employeeId: string; sdrId: string }) => {
      const { error } = await supabase
        .from('employees')
        .update({ sdr_id: sdrId })
        .eq('id', employeeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees-with-cargo'] });
      queryClient.invalidateQueries({ queryKey: ['sdrs-meta-diaria'] });
      toast.success('SDR vinculado com sucesso!');
      onOpenChange(false);
      setSelectedSdrId('');
    },
    onError: (error: any) => {
      toast.error(`Erro ao vincular: ${error.message}`);
    },
  });

  // Criar novo SDR + vincular
  const createAndLinkMutation = useMutation({
    mutationFn: async (emp: NonNullable<LinkSdrDialogProps['employee']>) => {
      const squad = emp.departamento ? (DEPT_TO_SQUAD[emp.departamento] || 'incorporador') : 'incorporador';

      const { data: newSdr, error: insertError } = await supabase
        .from('sdr')
        .insert({
          name: emp.nome_completo,
          email: emp.email_pessoal || null,
          squad,
          role_type: 'sdr',
          active: true,
          meta_diaria: 7,
        })
        .select('id')
        .single();
      if (insertError) throw insertError;

      const { error: linkError } = await supabase
        .from('employees')
        .update({ sdr_id: newSdr.id })
        .eq('id', emp.id);
      if (linkError) throw linkError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees-with-cargo'] });
      queryClient.invalidateQueries({ queryKey: ['sdrs-meta-diaria'] });
      queryClient.invalidateQueries({ queryKey: ['available-sdrs-for-link'] });
      toast.success('SDR criado e vinculado com sucesso!');
      onOpenChange(false);
      setSelectedSdrId('');
    },
    onError: (error: any) => {
      toast.error(`Erro ao criar SDR: ${error.message}`);
    },
  });

  if (!employee) return null;

  const isPending = linkSdrMutation.isPending || createAndLinkMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Vincular SDR
          </DialogTitle>
          <DialogDescription>
            Vincule <strong>{employee.nome_completo}</strong> a um registro SDR existente ou crie um novo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Opção 1: Selecionar SDR existente */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Selecionar SDR existente</label>
            <Select value={selectedSdrId} onValueChange={setSelectedSdrId} disabled={isPending}>
              <SelectTrigger>
                <SelectValue placeholder={sdrsLoading ? 'Carregando...' : 'Selecione um SDR'} />
              </SelectTrigger>
              <SelectContent>
                {availableSdrs?.map(sdr => (
                  <SelectItem key={sdr.id} value={sdr.id}>
                    <span className="flex items-center gap-2">
                      {sdr.name}
                      {sdr.squad && (
                        <Badge variant="outline" className="text-[10px] ml-1">
                          {sdr.squad}
                        </Badge>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="w-full"
              disabled={!selectedSdrId || isPending}
              onClick={() => linkSdrMutation.mutate({ employeeId: employee.id, sdrId: selectedSdrId })}
            >
              {linkSdrMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4 mr-2" />
              )}
              Vincular Selecionado
            </Button>
          </div>

          {/* Separador */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">ou</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Opção 2: Criar novo */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Criar novo registro SDR</label>
            <p className="text-xs text-muted-foreground">
              Será criado com os dados: <strong>{employee.nome_completo}</strong>
              {employee.departamento && <>, squad: <strong>{DEPT_TO_SQUAD[employee.departamento] || employee.departamento}</strong></>}
            </p>
            <Button
              variant="outline"
              className="w-full"
              disabled={isPending}
              onClick={() => createAndLinkMutation.mutate(employee)}
            >
              {createAndLinkMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Criar e Vincular Novo SDR
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
