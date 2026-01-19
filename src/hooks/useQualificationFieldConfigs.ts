import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { QualificationField, QUALIFICATION_FIELDS } from '@/components/crm/qualification/QualificationFields';
import { Json } from '@/integrations/supabase/types';

export interface QualificationFieldConfig {
  id: string;
  scope_type: 'global' | 'group' | 'origin';
  group_id: string | null;
  origin_id: string | null;
  fields: QualificationField[];
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Fetch all configs
export function useQualificationFieldConfigs() {
  return useQuery({
    queryKey: ['qualification-field-configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('qualification_field_configs')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return (data || []).map(config => ({
        ...config,
        fields: (config.fields as unknown as QualificationField[]) || [],
      })) as QualificationFieldConfig[];
    },
  });
}

// Fetch config by scope
export function useQualificationFieldConfigByScope(
  scopeType: 'global' | 'group' | 'origin',
  scopeId?: string | null
) {
  return useQuery({
    queryKey: ['qualification-field-config', scopeType, scopeId],
    queryFn: async () => {
      let query = supabase
        .from('qualification_field_configs')
        .select('*')
        .eq('scope_type', scopeType)
        .eq('is_active', true);

      if (scopeType === 'group' && scopeId) {
        query = query.eq('group_id', scopeId);
      } else if (scopeType === 'origin' && scopeId) {
        query = query.eq('origin_id', scopeId);
      }

      const { data, error } = await query.maybeSingle();

      if (error) throw error;
      
      if (!data) return null;
      
      return {
        ...data,
        fields: (data.fields as unknown as QualificationField[]) || [],
      } as QualificationFieldConfig;
    },
    enabled: scopeType === 'global' || !!scopeId,
  });
}

// Resolve fields for a deal (origin -> group -> global -> default)
export function useResolvedQualificationFields(originId?: string | null, groupId?: string | null) {
  return useQuery({
    queryKey: ['resolved-qualification-fields', originId, groupId],
    queryFn: async () => {
      // 1. Try origin-specific config
      if (originId) {
        const { data: originConfig } = await supabase
          .from('qualification_field_configs')
          .select('*')
          .eq('scope_type', 'origin')
          .eq('origin_id', originId)
          .eq('is_active', true)
          .maybeSingle();

        if (originConfig?.fields && Array.isArray(originConfig.fields) && originConfig.fields.length > 0) {
          return originConfig.fields as unknown as QualificationField[];
        }
      }

      // 2. Try group-specific config
      if (groupId) {
        const { data: groupConfig } = await supabase
          .from('qualification_field_configs')
          .select('*')
          .eq('scope_type', 'group')
          .eq('group_id', groupId)
          .eq('is_active', true)
          .maybeSingle();

        if (groupConfig?.fields && Array.isArray(groupConfig.fields) && groupConfig.fields.length > 0) {
          return groupConfig.fields as unknown as QualificationField[];
        }
      }

      // 3. Try global config
      const { data: globalConfig } = await supabase
        .from('qualification_field_configs')
        .select('*')
        .eq('scope_type', 'global')
        .eq('is_active', true)
        .maybeSingle();

      if (globalConfig?.fields && Array.isArray(globalConfig.fields) && globalConfig.fields.length > 0) {
        return globalConfig.fields as unknown as QualificationField[];
      }

      // 4. Fall back to default fields
      return QUALIFICATION_FIELDS;
    },
  });
}

// Save/update config
export function useSaveQualificationFieldConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      scopeType,
      groupId,
      originId,
      fields,
    }: {
      scopeType: 'global' | 'group' | 'origin';
      groupId?: string | null;
      originId?: string | null;
      fields: QualificationField[];
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      // Check if config already exists
      let query = supabase
        .from('qualification_field_configs')
        .select('id')
        .eq('scope_type', scopeType);

      if (scopeType === 'group' && groupId) {
        query = query.eq('group_id', groupId);
      } else if (scopeType === 'origin' && originId) {
        query = query.eq('origin_id', originId);
      }

      const { data: existing } = await query.maybeSingle();

      if (existing) {
        // Update
        const { data, error } = await supabase
          .from('qualification_field_configs')
          .update({
            fields: fields as unknown as Json,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Insert
        const { data, error } = await supabase
          .from('qualification_field_configs')
          .insert({
            scope_type: scopeType,
            group_id: scopeType === 'group' ? groupId : null,
            origin_id: scopeType === 'origin' ? originId : null,
            fields: fields as unknown as Json,
            created_by: userData?.user?.id || null,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qualification-field-configs'] });
      queryClient.invalidateQueries({ queryKey: ['qualification-field-config'] });
      queryClient.invalidateQueries({ queryKey: ['resolved-qualification-fields'] });
    },
  });
}

// Delete config
export function useDeleteQualificationFieldConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (configId: string) => {
      const { error } = await supabase
        .from('qualification_field_configs')
        .delete()
        .eq('id', configId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qualification-field-configs'] });
      queryClient.invalidateQueries({ queryKey: ['qualification-field-config'] });
      queryClient.invalidateQueries({ queryKey: ['resolved-qualification-fields'] });
    },
  });
}
