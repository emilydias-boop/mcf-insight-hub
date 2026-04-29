import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, Sparkles, Eye } from "lucide-react";
import { toast } from "sonner";

const MODE_INFO: Record<string, { icon: typeof Sparkles; title: string; desc: string }> = {
  suggest: {
    icon: Sparkles,
    title: "Sugerir (IA aconselha, humano decide)",
    desc: "A IA dá um parecer (✓/⚠/✗). Se discordar, o usuário precisa justificar — mas pode confirmar.",
  },
  block: {
    icon: ShieldCheck,
    title: "Bloquear (IA decide)",
    desc: "Se a IA disser que NÃO é no-show, a marcação é impedida. SDR/Closer precisa reagendar.",
  },
  audit: {
    icon: Eye,
    title: "Auditar (silencioso)",
    desc: "O print é exigido e a IA roda em background. Nenhum bloqueio na hora — só fica registrado.",
  },
};

export function NoShowAISettingsCard() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["no_show_ai_settings_admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("no_show_ai_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [mode, setMode] = useState<string>("suggest");
  const [requireEvidence, setRequireEvidence] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setMode(data.mode);
      setRequireEvidence(data.require_evidence);
    }
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("no_show_ai_settings")
      .update({
        mode,
        require_evidence: requireEvidence,
        updated_by: u?.user?.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success("Configuração de No-Show + IA atualizada");
    qc.invalidateQueries({ queryKey: ["no_show_ai_settings"] });
    qc.invalidateQueries({ queryKey: ["no_show_ai_settings_admin"] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" /> Validação de No-Show com IA
        </CardTitle>
        <CardDescription>
          Define como o sistema reage quando um SDR ou Closer marca No-Show. A evidência é sempre
          guardada para auditoria.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label className="text-sm font-medium">Exigir print da conversa</Label>
            <p className="text-xs text-muted-foreground">
              Quando ligado, SDR/Closer precisa anexar print para marcar No-Show.
            </p>
          </div>
          <Switch checked={requireEvidence} onCheckedChange={setRequireEvidence} />
        </div>

        <div>
          <Label className="text-sm font-medium mb-3 block">Modo de operação da IA</Label>
          <RadioGroup value={mode} onValueChange={setMode} className="space-y-2">
            {Object.entries(MODE_INFO).map(([key, info]) => {
              const Icon = info.icon;
              return (
                <label
                  key={key}
                  htmlFor={`mode-${key}`}
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    mode === key ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                >
                  <RadioGroupItem value={key} id={`mode-${key}`} className="mt-1" />
                  <Icon className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{info.title}</div>
                    <div className="text-xs text-muted-foreground">{info.desc}</div>
                  </div>
                </label>
              );
            })}
          </RadioGroup>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}