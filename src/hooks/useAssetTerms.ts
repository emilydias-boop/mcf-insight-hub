import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AssetTerm } from '@/types/patrimonio';
import { toast } from 'sonner';

// Fetch terms for an employee
export const useAssetTerms = (employeeId: string | undefined) => {
  return useQuery({
    queryKey: ['asset-terms', employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      
      const { data, error } = await supabase
        .from('asset_terms')
        .select(`
          *,
          asset:assets(numero_patrimonio, tipo, marca, modelo)
        `)
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!employeeId,
  });
};

// Fetch all terms (for admin view)
export const useAllTerms = () => {
  return useQuery({
    queryKey: ['all-asset-terms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('asset_terms')
        .select(`
          *,
          asset:assets(numero_patrimonio, tipo, marca, modelo),
          employee:employees(nome_completo, email_pessoal)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
};

// Term mutations
export const useTermMutations = () => {
  const queryClient = useQueryClient();

  // Create term
  const createTerm = useMutation({
    mutationFn: async ({
      assignmentId,
      assetId,
      employeeId,
      conteudo,
    }: {
      assignmentId: string;
      assetId: string;
      employeeId: string;
      conteudo: string;
    }) => {
      const { data, error } = await supabase
        .from('asset_terms')
        .insert({
          assignment_id: assignmentId,
          asset_id: assetId,
          employee_id: employeeId,
          termo_conteudo: conteudo,
          aceito: false,
          bloqueado: false,
        })
        .select()
        .single();

      if (error) throw error;

      // Update assignment with term id
      await supabase
        .from('asset_assignments')
        .update({ termo_id: data.id })
        .eq('id', assignmentId);

      return data as AssetTerm;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-terms'] });
      queryClient.invalidateQueries({ queryKey: ['asset-assignments'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar termo: ${error.message}`);
    },
  });

  // Accept term with audit trail
  const acceptTerm = useMutation({
    mutationFn: async ({
      termId,
      assinaturaDigital,
    }: {
      termId: string;
      assinaturaDigital?: string;
    }) => {
      // Capture user agent
      const userAgent = navigator.userAgent;

      // Capture IP (best effort)
      let ipAddress: string | null = null;
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipRes.json();
        ipAddress = ipData.ip;
      } catch {
        // IP capture failed, continue without it
      }

      // Get current max version for this term's asset
      const { data: termData } = await supabase
        .from('asset_terms')
        .select('asset_id')
        .eq('id', termId)
        .single();

      let versao = 1;
      if (termData) {
        const { count } = await supabase
          .from('asset_terms')
          .select('*', { count: 'exact', head: true })
          .eq('asset_id', termData.asset_id)
          .eq('aceito', true);
        versao = (count || 0) + 1;
      }

      const { data, error } = await supabase
        .from('asset_terms')
        .update({
          aceito: true,
          data_aceite: new Date().toISOString(),
          assinatura_digital: assinaturaDigital,
          bloqueado: true,
          ip_aceite: ipAddress,
          user_agent: userAgent,
          versao,
        } as any)
        .eq('id', termId)
        .eq('bloqueado', false)
        .select()
        .single();

      if (error) throw error;
      return data as AssetTerm;
    },
    onSuccess: async (data) => {
      // Save term as file in user_files
      try {
        // Get employee's profile_id
        const { data: empData } = await supabase
          .from('employees')
          .select('profile_id, nome_completo')
          .eq('id', data.employee_id)
          .single();

        if (empData?.profile_id) {
          // Get asset info for filename
          const { data: assetData } = await supabase
            .from('assets')
            .select('numero_patrimonio')
            .eq('id', data.asset_id)
            .single();

          const numPatrimonio = assetData?.numero_patrimonio || 'unknown';
          const fileName = `termo-responsabilidade-${numPatrimonio}.md`;
          const storagePath = `${empData.profile_id}/termos/${fileName}`;

          // Upload to storage
          const blob = new Blob([data.termo_conteudo], { type: 'text/markdown' });
          await supabase.storage
            .from('user-files')
            .upload(storagePath, blob, { upsert: true });

          const { data: urlData } = supabase.storage
            .from('user-files')
            .getPublicUrl(storagePath);

          // Create user_files record
          await (supabase as any)
            .from('user_files')
            .insert({
              user_id: empData.profile_id,
              uploaded_by: empData.profile_id,
              tipo: 'termo_responsabilidade',
              titulo: `Termo de Responsabilidade - ${numPatrimonio}`,
              descricao: `Termo de responsabilidade aceito em ${new Date().toLocaleDateString('pt-BR')}`,
              file_name: fileName,
              storage_path: storagePath,
              storage_url: urlData?.publicUrl || storagePath,
              visivel_para_usuario: true,
            });
        }
      } catch (err) {
        console.error('Erro ao salvar termo em arquivos:', err);
      }

      queryClient.invalidateQueries({ queryKey: ['asset-terms'] });
      queryClient.invalidateQueries({ queryKey: ['asset-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['my-files'] });
      queryClient.invalidateQueries({ queryKey: ['user-files'] });
      toast.success('Termo aceito com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao aceitar termo: ${error.message}`);
    },
  });

  return {
    createTerm,
    acceptTerm,
  };
};

// Generate term content
export const generateTermContent = (
  asset: { numero_patrimonio: string; tipo: string; marca?: string | null; modelo?: string | null },
  employee: { nome_completo: string; cargo?: string | null; departamento?: string | null },
  items: { item_tipo: string; descricao?: string | null }[],
  dataLiberacao: string
): string => {
  const itemsList = items.map(i => `- ${i.item_tipo}${i.descricao ? ` (${i.descricao})` : ''}`).join('\n');
  
  return `
# TERMO DE RESPONSABILIDADE - EQUIPAMENTO DE TI

## IDENTIFICAÇÃO

**Colaborador:** ${employee.nome_completo}
**Cargo:** ${employee.cargo || 'Não informado'}
**Setor:** ${employee.departamento || 'Não informado'}
**Data de Liberação:** ${new Date(dataLiberacao).toLocaleDateString('pt-BR')}

## EQUIPAMENTO

**Número do Patrimônio:** ${asset.numero_patrimonio}
**Tipo:** ${asset.tipo}
**Marca/Modelo:** ${asset.marca || ''} ${asset.modelo || ''}

## ITENS ENTREGUES

${itemsList || 'Nenhum item adicional'}

## TERMOS E CONDIÇÕES

Declaro, para os devidos fins, que recebi o equipamento acima descrito em perfeitas condições de uso, responsabilizando-me por:

1. Utilizar o equipamento exclusivamente para fins profissionais relacionados às minhas atividades na empresa;
2. Zelar pela conservação, guarda e manutenção do equipamento;
3. Não realizar alterações físicas ou lógicas não autorizadas;
4. Comunicar imediatamente ao setor de TI qualquer problema, defeito ou necessidade de manutenção;
5. Devolver o equipamento nas mesmas condições em que foi recebido, quando solicitado ou ao término do vínculo empregatício;
6. Responder por danos causados por mau uso, negligência ou extravio.

Estou ciente de que o descumprimento das condições acima pode acarretar sanções administrativas e o ressarcimento de eventuais prejuízos.
`.trim();
};
