import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2, Settings, MessageCircle, Mail, AlertTriangle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AutomationSettingsData {
  business_hours_enabled: boolean;
  business_hours_start: string;
  business_hours_end: string;
  exclude_weekends: boolean;
  max_retries: number;
  retry_delay_minutes: number;
}

export function AutomationSettings() {
  const queryClient = useQueryClient();
  
  const [settings, setSettings] = useState<AutomationSettingsData>({
    business_hours_enabled: true,
    business_hours_start: "09:00",
    business_hours_end: "18:00",
    exclude_weekends: true,
    max_retries: 3,
    retry_delay_minutes: 30,
  });

  const { data: savedSettings, isLoading } = useQuery({
    queryKey: ["automation-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_settings")
        .select("key, value");

      if (error) throw error;
      
      const settingsMap: Record<string, any> = {};
      data?.forEach((item) => {
        settingsMap[item.key] = item.value;
      });
      
      return settingsMap;
    },
  });

  useEffect(() => {
    if (savedSettings) {
      setSettings({
        business_hours_enabled: savedSettings.business_hours_enabled ?? true,
        business_hours_start: savedSettings.business_hours_start ?? "09:00",
        business_hours_end: savedSettings.business_hours_end ?? "18:00",
        exclude_weekends: savedSettings.exclude_weekends ?? true,
        max_retries: savedSettings.max_retries ?? 3,
        retry_delay_minutes: savedSettings.retry_delay_minutes ?? 30,
      });
    }
  }, [savedSettings]);

  const saveMutation = useMutation({
    mutationFn: async (newSettings: AutomationSettingsData) => {
      const entries = Object.entries(newSettings);
      
      for (const [key, value] of entries) {
        const { error } = await supabase
          .from("automation_settings")
          .upsert({
            key,
            value: JSON.stringify(value),
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'key',
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-settings"] });
      toast.success("Configurações salvas!");
    },
    onError: (error) => {
      console.error("Error saving settings:", error);
      toast.error("Erro ao salvar configurações");
    },
  });

  const handleSave = () => {
    saveMutation.mutate(settings);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Configurações Globais</h2>
          <p className="text-sm text-muted-foreground">
            Defina as regras padrão para todas as automações
          </p>
        </div>
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar Configurações
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Business Hours */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Horário Comercial
            </CardTitle>
            <CardDescription>
              Configure quando as mensagens podem ser enviadas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="businessHours">Respeitar horário comercial</Label>
              <Switch
                id="businessHours"
                checked={settings.business_hours_enabled}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({ ...prev, business_hours_enabled: checked }))
                }
              />
            </div>

            {settings.business_hours_enabled && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Início</Label>
                    <Input
                      type="time"
                      value={settings.business_hours_start}
                      onChange={(e) => 
                        setSettings(prev => ({ ...prev, business_hours_start: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fim</Label>
                    <Input
                      type="time"
                      value={settings.business_hours_end}
                      onChange={(e) => 
                        setSettings(prev => ({ ...prev, business_hours_end: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="excludeWeekends">Excluir finais de semana</Label>
                  <Switch
                    id="excludeWeekends"
                    checked={settings.exclude_weekends}
                    onCheckedChange={(checked) => 
                      setSettings(prev => ({ ...prev, exclude_weekends: checked }))
                    }
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Retry Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Tentativas de Reenvio
            </CardTitle>
            <CardDescription>
              Configure as regras de retry para envios com falha
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Máximo de tentativas</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={settings.max_retries}
                onChange={(e) => 
                  setSettings(prev => ({ ...prev, max_retries: parseInt(e.target.value) || 3 }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Número de vezes que o sistema tentará reenviar uma mensagem com falha
              </p>
            </div>

            <div className="space-y-2">
              <Label>Delay entre tentativas (minutos)</Label>
              <Input
                type="number"
                min={5}
                max={120}
                value={settings.retry_delay_minutes}
                onChange={(e) => 
                  setSettings(prev => ({ ...prev, retry_delay_minutes: parseInt(e.target.value) || 30 }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Tempo de espera antes de tentar reenviar
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Integration Status */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Status das Integrações</CardTitle>
            <CardDescription>
              Verifique se as integrações estão configuradas corretamente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <MessageCircle className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="font-medium">Twilio WhatsApp</p>
                    <p className="text-sm text-muted-foreground">
                      API Oficial do WhatsApp Business
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-orange-600 border-orange-600">
                  Aguardando Meta
                </Badge>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Mail className="h-8 w-8 text-blue-600" />
                  <div>
                    <p className="font-medium">ActiveCampaign</p>
                    <p className="text-sm text-muted-foreground">
                      Automação de Email Marketing
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-muted-foreground">
                  Não configurado
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
