import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OwnerOption {
  value: string;
  label: string;
  roleLabel?: string;
  isInactive?: boolean;
}

interface Deal {
  owner_profile_id?: string | null;
  owner_id?: string | null;
}

/**
 * Hook que deriva a lista de owners a partir dos deals carregados,
 * buscando nomes/roles em batch para os UUIDs encontrados.
 * Isso evita depender de joins profiles->user_roles que podem falhar por RLS.
 */
export function useDealOwnerOptions(deals: Deal[] | null | undefined) {
  // Extrair owners únicos dos deals
  const ownerKeys = useMemo(() => {
    const profileIds = new Set<string>();
    const emailOnlyOwners = new Set<string>();
    
    (deals || []).forEach((deal) => {
      if (deal.owner_profile_id) {
        profileIds.add(deal.owner_profile_id);
      } else if (deal.owner_id) {
        // Deal legado: só tem email, não tem UUID
        emailOnlyOwners.add(deal.owner_id);
      }
    });
    
    return {
      profileIds: Array.from(profileIds),
      emailOnlyOwners: Array.from(emailOnlyOwners),
    };
  }, [deals]);

  // Buscar profiles em batch para os UUIDs encontrados
  const { data: profilesData } = useQuery({
    queryKey: ['deal-owner-profiles', ownerKeys.profileIds],
    queryFn: async () => {
      if (ownerKeys.profileIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, access_status')
        .in('id', ownerKeys.profileIds);
      
      if (error) {
        console.warn('Erro ao buscar profiles para owners:', error);
        return [];
      }
      return data || [];
    },
    enabled: ownerKeys.profileIds.length > 0,
    staleTime: 60_000, // Cache por 1 minuto
  });

  // Buscar roles separadamente (sem join) para os mesmos UUIDs
  const { data: rolesData } = useQuery({
    queryKey: ['deal-owner-roles', ownerKeys.profileIds],
    queryFn: async () => {
      if (ownerKeys.profileIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', ownerKeys.profileIds);
      
      if (error) {
        console.warn('Erro ao buscar roles para owners:', error);
        return [];
      }
      return data || [];
    },
    enabled: ownerKeys.profileIds.length > 0,
    staleTime: 60_000,
  });

  // Montar lista final de opções
  const ownerOptions = useMemo<OwnerOption[]>(() => {
    const options: OwnerOption[] = [];
    const rolesMap = new Map<string, string>();
    
    // Mapear roles por user_id
    (rolesData || []).forEach((r) => {
      if (r.user_id && r.role) {
        // Pegar a primeira role encontrada (ou a mais "importante")
        if (!rolesMap.has(r.user_id)) {
          rolesMap.set(r.user_id, r.role);
        }
      }
    });
    
    // Adicionar owners com UUID (profiles)
    (profilesData || []).forEach((profile) => {
      const role = rolesMap.get(profile.id);
      const isInactive = profile.access_status === 'desativado';
      
      options.push({
        value: profile.id,
        label: profile.full_name || profile.email?.split('@')[0] || 'Sem nome',
        roleLabel: role?.toUpperCase(),
        isInactive,
      });
    });
    
    // Adicionar owners legados (só email, sem UUID no deal)
    ownerKeys.emailOnlyOwners.forEach((email) => {
      // Verificar se já não temos esse email nos profiles
      const alreadyHas = (profilesData || []).some(
        (p) => p.email?.toLowerCase() === email.toLowerCase()
      );
      if (!alreadyHas) {
        options.push({
          value: `email:${email}`,
          label: email.split('@')[0],
          isInactive: true, // Provavelmente legado
        });
      }
    });
    
    // Ordenar: ativos primeiro, depois por nome
    options.sort((a, b) => {
      if (a.isInactive !== b.isInactive) {
        return a.isInactive ? 1 : -1;
      }
      return a.label.localeCompare(b.label);
    });
    
    return options;
  }, [profilesData, rolesData, ownerKeys.emailOnlyOwners]);

  return { ownerOptions };
}
