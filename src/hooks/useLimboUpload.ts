import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LimboRow } from '@/hooks/useLimboLeads';

export interface LimboUploadRecord {
  id: string;
  file_name: string;
  storage_path: string;
  uploaded_by: string;
  uploaded_by_name: string | null;
  uploaded_at: string;
  row_count: number;
  column_mapping: Record<string, string> | null;
  comparison_results: LimboRow[] | null;
  status: string;
}

// Fetch the latest compared upload
export function useLatestLimboUpload() {
  return useQuery({
    queryKey: ['limbo-upload-latest'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('limbo_uploads')
        .select('*')
        .eq('status', 'compared')
        .order('uploaded_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        column_mapping: data.column_mapping as any,
        comparison_results: data.comparison_results as any,
      } as LimboUploadRecord;
    },
    staleTime: 2 * 60 * 1000,
  });
}

// Save upload + comparison results
export function useSaveLimboUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      columnMapping,
      comparisonResults,
      rowCount,
    }: {
      file: File;
      columnMapping: Record<string, string>;
      comparisonResults: LimboRow[];
      rowCount: number;
    }) => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Get user name from profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();

      // Upload file to storage
      const filePath = `limbo/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('limbo-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Insert record
      const { data, error } = await supabase
        .from('limbo_uploads')
        .insert({
          file_name: file.name,
          storage_path: filePath,
          uploaded_by: user.id,
          uploaded_by_name: profile?.full_name || user.email || 'Desconhecido',
          row_count: rowCount,
          column_mapping: columnMapping as any,
          comparison_results: comparisonResults as any,
          status: 'compared',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['limbo-upload-latest'] });
    },
  });
}
