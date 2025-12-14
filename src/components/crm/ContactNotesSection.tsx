import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface ContactNotesSectionProps {
  contactId: string;
  initialNotes?: string | null;
}

export function ContactNotesSection({ contactId, initialNotes }: ContactNotesSectionProps) {
  const [notes, setNotes] = useState(initialNotes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const queryClient = useQueryClient();

  const handleNotesChange = (value: string) => {
    setNotes(value);
    setHasChanges(value !== (initialNotes || ''));
  };

  const handleSave = async () => {
    if (!hasChanges) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('crm_contacts')
        .update({ 
          notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', contactId);

      if (error) throw error;

      toast.success('Observações salvas!');
      setHasChanges(false);
      
      // Invalidate contacts cache
      queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
    } catch (error) {
      console.error('Error saving notes:', error);
      toast.error('Erro ao salvar observações');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Observações do Contato
        </h3>
        {hasChanges && (
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="h-7"
          >
            {isSaving ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <Save className="h-3 w-3 mr-1" />
            )}
            Salvar
          </Button>
        )}
      </div>
      
      <Textarea
        value={notes}
        onChange={(e) => handleNotesChange(e.target.value)}
        placeholder="Adicione observações sobre este contato..."
        className="min-h-[100px] resize-none bg-background"
      />
      
      <p className="text-xs text-muted-foreground">
        Use este campo para registrar informações importantes sobre o contato que serão úteis em futuras interações.
      </p>
    </div>
  );
}
