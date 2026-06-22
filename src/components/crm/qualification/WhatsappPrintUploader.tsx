import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Image as ImageIcon, Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  dealId: string;
  value: string | null;
  onChange: (path: string | null) => void;
  disabled?: boolean;
}

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = 'image/png,image/jpeg,image/webp';

export function WhatsappPrintUploader({ dealId, value, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  async function loadPreview(path: string) {
    const { data } = await supabase.storage
      .from('qualification-attachments')
      .createSignedUrl(path, 3600);
    if (data?.signedUrl) setPreviewUrl(data.signedUrl);
  }

  if (value && !previewUrl) loadPreview(value);

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Envie uma imagem (PNG, JPG ou WEBP)');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('Arquivo muito grande (máx. 5 MB)');
      return;
    }
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? 'anon';
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = `${dealId}/${userId}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('qualification-attachments')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      onChange(path);
      setPreviewUrl(null);
      await loadPreview(path);
      toast.success('Print anexado');
    } catch (err: any) {
      console.error('[WhatsappPrintUploader] upload error', err);
      toast.error(`Falha ao enviar: ${err.message || 'erro desconhecido'}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium flex items-center gap-2">
        <ImageIcon className="h-4 w-4" />
        Print da conversa do WhatsApp <span className="text-destructive">*</span>
      </Label>
      <p className="text-xs text-muted-foreground">
        Anexe o print contendo as respostas da qualificação (PNG/JPG/WEBP, máx. 5 MB).
      </p>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />

      {value ? (
        <div className="relative rounded-md border border-border bg-background p-2">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Print do WhatsApp"
              className="max-h-64 mx-auto rounded"
            />
          ) : (
            <div className="h-32 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}
          <div className="flex gap-2 mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || uploading}
              className="flex-1"
            >
              <Upload className="h-3.5 w-3.5 mr-1" /> Trocar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange(null);
                setPreviewUrl(null);
              }}
              disabled={disabled || uploading}
            >
              <X className="h-3.5 w-3.5 mr-1" /> Remover
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
          className="w-full"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          {uploading ? 'Enviando...' : 'Selecionar print'}
        </Button>
      )}
    </div>
  );
}