import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface GroupDetails {
  grupo: string;
  participantesEmpresa: number;
  valorContemplado: number;
  totalCredito: number;
  totalCotas: number;
}

export function useGroupDetails(grupo: string | null) {
  return useQuery({
    queryKey: ['group-details', grupo],
    queryFn: async (): Promise<GroupDetails | null> => {
      if (!grupo) return null;

      // Fetch all cards in the same group
      const { data: cards, error } = await supabase
        .from('consortium_cards')
        .select('id, valor_credito, status')
        .eq('grupo', grupo);

      if (error) throw error;

      if (!cards || cards.length === 0) {
        return {
          grupo,
          participantesEmpresa: 0,
          valorContemplado: 0,
          totalCredito: 0,
          totalCotas: 0,
        };
      }

      // Calculate group statistics
      const totalCotas = cards.length;
      const totalCredito = cards.reduce((acc, c) => acc + Number(c.valor_credito), 0);
      const valorContemplado = cards
        .filter(c => c.status === 'contemplado')
        .reduce((acc, c) => acc + Number(c.valor_credito), 0);

      return {
        grupo,
        participantesEmpresa: totalCotas,
        valorContemplado,
        totalCredito,
        totalCotas,
      };
    },
    enabled: !!grupo,
  });
}
