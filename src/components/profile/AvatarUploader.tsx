import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface AvatarUploaderProps {
  userId: string;
  nome: string;
  avatarUrl?: string | null;
  onChange?: (url: string | null) => void;
  size?: number;
}

const BUCKET = "avatars";

export function iniciais(nome: string): string {
  const partes = (nome || "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "U";
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

async function recortarQuadrado512(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Não foi possível ler a imagem."));
      i.src = url;
    });
    const lado = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - lado) / 2;
    const sy = (img.naturalHeight - lado) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponível.");
    ctx.drawImage(img, sx, sy, lado, lado, 0, 0, 512, 512);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar a imagem."))), "image/jpeg", 0.86)
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function limparPasta(userId: string, manter?: string) {
  try {
    const { data } = await supabase.storage.from(BUCKET).list(userId);
    const paths = (data || [])
      .map((f) => `${userId}/${f.name}`)
      .filter((p) => p !== manter);
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  } catch {
    // ignorado de propósito
  }
}

export function AvatarUploader({ userId, nome, avatarUrl, onChange, size = 64 }: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [atual, setAtual] = useState<string | null>(avatarUrl ?? null);
  const [ultimaProp, setUltimaProp] = useState(avatarUrl);
  if (avatarUrl !== ultimaProp) {
    setUltimaProp(avatarUrl);
    setAtual(avatarUrl ?? null);
  }

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ["users"] });
    queryClient.invalidateQueries({ queryKey: ["user-details", userId] });
    queryClient.invalidateQueries({ queryKey: ["my-avatar", userId] });
    queryClient.invalidateQueries({ queryKey: ["profile"] });
  };

  const salvarUrl = async (url: string | null) => {
    const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
    if (error) throw error;
    setAtual(url);
    onChange?.(url);
    invalidar();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Use uma imagem JPG, PNG ou WEBP.");
      return;
    }
    setLoading(true);
    try {
      const blob = await recortarQuadrado512(file);
      const path = `${userId}/avatar-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { upsert: false, contentType: "image/jpeg" });
      if (upErr) throw upErr;
      const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      await salvarUrl(publicUrl);
      toast.success("Foto atualizada");
      await limparPasta(userId, path);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao enviar a foto.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemover = async () => {
    setLoading(true);
    try {
      await salvarUrl(null);
      toast.success("Foto removida");
      await limparPasta(userId);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao remover a foto.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar className="border-2 border-border" style={{ width: size, height: size }}>
        {atual && <AvatarImage src={atual} alt={nome} className="object-cover" />}
        <AvatarFallback className="bg-primary/10 text-primary font-semibold" style={{ fontSize: size / 3 }}>
          {iniciais(nome)}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFile}
        />
        <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => inputRef.current?.click()}>
          {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Camera className="h-4 w-4 mr-1" />}
          Trocar foto
        </Button>
        {atual && (
          <Button type="button" size="sm" variant="ghost" disabled={loading} onClick={handleRemover}>
            <Trash2 className="h-4 w-4 mr-1" />
            Remover
          </Button>
        )}
      </div>
    </div>
  );
}
