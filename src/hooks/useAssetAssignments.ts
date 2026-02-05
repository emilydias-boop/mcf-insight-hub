import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  AssetAssignment, 
  AssetAssignmentWithDetails,
  CreateAssignmentInput,
  ReturnAssignmentInput,
} from '@/types/patrimonio';
import { toast } from 'sonner';

// Fetch assignments for an asset
export const useAssetAssignments = (assetId: string | undefined) => {
  return useQuery({
    queryKey: ['asset-assignments', assetId],
    queryFn: async () => {
      if (!assetId) return [];
      
      const { data, error } = await supabase
        .from('asset_assignments')
        .select(`
          *,
          employee:employees(id, nome_completo, email_pessoal, departamento, cargo),
          items:asset_assignment_items(*),
          termo:asset_terms(*)
        `)
        .eq('asset_id', assetId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as AssetAssignmentWithDetails[];
    },
    enabled: !!assetId,
  });
};

// Fetch assignments for an employee (for "Meu RH" view)
export const useMyAssets = (employeeId: string | undefined) => {
  return useQuery({
    queryKey: ['my-assets', employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      
      const { data, error } = await supabase
        .from('asset_assignments')
        .select(`
          *,
          asset:assets(*),
          items:asset_assignment_items(*)
        `)
        .eq('employee_id', employeeId)
        .eq('status', 'ativo')
        .order('data_liberacao', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!employeeId,
  });
};

// Assignment mutations
export const useAssignmentMutations = () => {
  const queryClient = useQueryClient();

  // Assign asset to employee
  const assignAsset = useMutation({
    mutationFn: async (input: CreateAssignmentInput) => {
      const { data: userData } = await supabase.auth.getUser();
      
      // Get employee details for setor/cargo
      const { data: employee } = await supabase
        .from('employees')
        .select('departamento, cargo')
        .eq('id', input.employee_id)
        .single();

      // Create assignment
      const { data: assignment, error: assignError } = await supabase
        .from('asset_assignments')
        .insert({
          asset_id: input.asset_id,
          employee_id: input.employee_id,
          setor: employee?.departamento,
          cargo: employee?.cargo,
          data_liberacao: input.data_liberacao,
          data_prevista_devolucao: input.data_prevista_devolucao,
          status: 'ativo',
          created_by: userData.user?.id,
        })
        .select()
        .single();

      if (assignError) throw assignError;

      // Create checklist items
      if (input.items.length > 0) {
        const { error: itemsError } = await supabase
          .from('asset_assignment_items')
          .insert(
            input.items.map(item => ({
              assignment_id: assignment.id,
              item_tipo: item.item_tipo,
              descricao: item.descricao,
            }))
          );

        if (itemsError) throw itemsError;
      }

      // Update asset status
      await supabase
        .from('assets')
        .update({ status: 'em_uso' })
        .eq('id', input.asset_id);

      // Register history
      await supabase.from('asset_history').insert({
        asset_id: input.asset_id,
        tipo_evento: 'liberado',
        descricao: `Equipamento liberado para colaborador`,
        dados_novos: assignment,
        created_by: userData.user?.id,
      });

      return assignment as AssetAssignment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset'] });
      queryClient.invalidateQueries({ queryKey: ['asset-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['asset-stats'] });
      toast.success('Equipamento liberado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao liberar: ${error.message}`);
    },
  });

  // Return asset
  const returnAsset = useMutation({
    mutationFn: async (input: ReturnAssignmentInput) => {
      const { data: userData } = await supabase.auth.getUser();
      
      // Get current assignment to find asset_id
      const { data: assignment } = await supabase
        .from('asset_assignments')
        .select('asset_id')
        .eq('id', input.assignment_id)
        .single();

      if (!assignment) throw new Error('Assignment não encontrado');

      // Update checklist items
      for (const item of input.items_conferidos) {
        await supabase
          .from('asset_assignment_items')
          .update({
            conferido_devolucao: item.conferido,
            observacao_devolucao: item.observacao,
          })
          .eq('id', item.item_id);
      }

      // Update assignment
      const { error: assignError } = await supabase
        .from('asset_assignments')
        .update({
          status: 'devolvido',
          data_devolucao_real: new Date().toISOString().split('T')[0],
        })
        .eq('id', input.assignment_id);

      if (assignError) throw assignError;

      // Update asset status
      await supabase
        .from('assets')
        .update({ status: input.novo_status })
        .eq('id', assignment.asset_id);

      // Register history
      await supabase.from('asset_history').insert({
        asset_id: assignment.asset_id,
        tipo_evento: 'devolucao',
        descricao: `Equipamento devolvido`,
        created_by: userData.user?.id,
      });

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset'] });
      queryClient.invalidateQueries({ queryKey: ['asset-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['asset-stats'] });
      queryClient.invalidateQueries({ queryKey: ['my-assets'] });
      toast.success('Equipamento devolvido com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro na devolução: ${error.message}`);
    },
  });

  // Transfer asset to another employee
  const transferAsset = useMutation({
    mutationFn: async ({ 
      currentAssignmentId, 
      newInput 
    }: { 
      currentAssignmentId: string; 
      newInput: CreateAssignmentInput 
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      // Finalize current assignment
      await supabase
        .from('asset_assignments')
        .update({
          status: 'transferido',
          data_devolucao_real: new Date().toISOString().split('T')[0],
        })
        .eq('id', currentAssignmentId);

      // Get employee details
      const { data: employee } = await supabase
        .from('employees')
        .select('departamento, cargo')
        .eq('id', newInput.employee_id)
        .single();

      // Create new assignment
      const { data: assignment, error } = await supabase
        .from('asset_assignments')
        .insert({
          asset_id: newInput.asset_id,
          employee_id: newInput.employee_id,
          setor: employee?.departamento,
          cargo: employee?.cargo,
          data_liberacao: newInput.data_liberacao,
          data_prevista_devolucao: newInput.data_prevista_devolucao,
          status: 'ativo',
          created_by: userData.user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Create checklist items
      if (newInput.items.length > 0) {
        await supabase.from('asset_assignment_items').insert(
          newInput.items.map(item => ({
            assignment_id: assignment.id,
            item_tipo: item.item_tipo,
            descricao: item.descricao,
          }))
        );
      }

      // Register history
      await supabase.from('asset_history').insert({
        asset_id: newInput.asset_id,
        tipo_evento: 'transferido',
        descricao: `Equipamento transferido para novo colaborador`,
        dados_novos: assignment,
        created_by: userData.user?.id,
      });

      return assignment as AssetAssignment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset'] });
      queryClient.invalidateQueries({ queryKey: ['asset-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['my-assets'] });
      toast.success('Equipamento transferido com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro na transferência: ${error.message}`);
    },
  });

  return {
    assignAsset,
    returnAsset,
    transferAsset,
  };
};
