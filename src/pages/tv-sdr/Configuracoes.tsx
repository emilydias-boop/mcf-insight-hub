import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { 
  ArrowLeft, Save, Monitor, Palette, Users, LayoutGrid, 
  RefreshCw, Timer, Eye, EyeOff, Tv, Settings 
} from "lucide-react";
import { Link } from "react-router-dom";

interface TVSettings {
  // Layout
  show_ranking: boolean;
  show_funnel: boolean;
  show_novo_lead_card: boolean;
  max_sdrs_display: number;
  columns_count: number;
  // Auto refresh
  refresh_interval_seconds: number;
  auto_rotate_ranking: boolean;
  rotate_interval_seconds: number;
  // Celebrações
  celebrations_enabled: boolean;
  celebration_duration_seconds: number;
  celebration_sound_enabled: boolean;
  // Cores
  primary_color: string;
  accent_color: string;
  background_gradient: string;
}

const DEFAULT_SETTINGS: TVSettings = {
  show_ranking: true,
  show_funnel: true,
  show_novo_lead_card: true,
  max_sdrs_display: 15,
  columns_count: 3,
  refresh_interval_seconds: 30,
  auto_rotate_ranking: false,
  rotate_interval_seconds: 10,
  celebrations_enabled: true,
  celebration_duration_seconds: 5,
  celebration_sound_enabled: true,
  primary_color: "#8B5CF6",
  accent_color: "#10B981",
  background_gradient: "from-background to-muted/50",
};

export default function TVSdrConfiguracoes() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<TVSettings>(DEFAULT_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);

  // Buscar SDRs visíveis na TV
  const { data: tvSdrs, isLoading: loadingSdrs } = useQuery({
    queryKey: ["tv-sdrs-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, show_on_tv")
        .not("email", "is", null)
        .ilike("email", "%@minhacasafinanciada%")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  // Buscar configurações salvas do localStorage
  useEffect(() => {
    const saved = localStorage.getItem("tv-sdr-settings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      } catch (e) {
        console.error("Failed to parse TV settings:", e);
      }
    }
  }, []);

  // Salvar configurações
  const handleSave = () => {
    localStorage.setItem("tv-sdr-settings", JSON.stringify(settings));
    setHasChanges(false);
    toast.success("Configurações da TV salvas com sucesso!");
  };

  // Reset para padrões
  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    setHasChanges(true);
  };

  // Atualizar visibilidade de SDR
  const updateSdrVisibility = useMutation({
    mutationFn: async ({ userId, showOnTv }: { userId: string; showOnTv: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ show_on_tv: showOnTv })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tv-sdrs-config"] });
      queryClient.invalidateQueries({ queryKey: ["tv-sdr-data"] });
      toast.success("Visibilidade atualizada!");
    },
    onError: () => {
      toast.error("Erro ao atualizar visibilidade");
    },
  });

  const updateSetting = <K extends keyof TVSettings>(key: K, value: TVSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const visibleCount = tvSdrs?.filter(s => s.show_on_tv).length || 0;
  const totalCount = tvSdrs?.length || 0;

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/tv-sdr">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Configurações da TV SDR</h1>
            <p className="text-muted-foreground">
              Personalize o layout, cores e filtros da tela de performance
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleReset}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Restaurar Padrões
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges}>
            <Save className="h-4 w-4 mr-2" />
            Salvar Alterações
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Seção: Layout */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-primary" />
              <CardTitle>Layout</CardTitle>
            </div>
            <CardDescription>Configure quais elementos aparecem na TV</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Mostrar Ranking de SDRs</Label>
                <p className="text-xs text-muted-foreground">Tabela com performance individual</p>
              </div>
              <Switch
                checked={settings.show_ranking}
                onCheckedChange={(v) => updateSetting("show_ranking", v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Mostrar Funil de Conversão</Label>
                <p className="text-xs text-muted-foreground">Gauges com métricas de pipeline</p>
              </div>
              <Switch
                checked={settings.show_funnel}
                onCheckedChange={(v) => updateSetting("show_funnel", v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Mostrar Card Novo Lead</Label>
                <p className="text-xs text-muted-foreground">Total de novos leads do dia</p>
              </div>
              <Switch
                checked={settings.show_novo_lead_card}
                onCheckedChange={(v) => updateSetting("show_novo_lead_card", v)}
              />
            </div>

            <Separator />

            <div className="space-y-3">
              <Label>Máximo de SDRs no Ranking: {settings.max_sdrs_display}</Label>
              <Slider
                value={[settings.max_sdrs_display]}
                onValueChange={([v]) => updateSetting("max_sdrs_display", v)}
                min={5}
                max={30}
                step={1}
              />
              <p className="text-xs text-muted-foreground">
                Limita quantos SDRs aparecem na tabela
              </p>
            </div>

            <div className="space-y-3">
              <Label>Colunas no Grid de Gauges</Label>
              <Select
                value={String(settings.columns_count)}
                onValueChange={(v) => updateSetting("columns_count", Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 colunas</SelectItem>
                  <SelectItem value="3">3 colunas</SelectItem>
                  <SelectItem value="4">4 colunas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Seção: Atualização Automática */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Timer className="h-5 w-5 text-primary" />
              <CardTitle>Atualização Automática</CardTitle>
            </div>
            <CardDescription>Configure os intervalos de refresh</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Intervalo de Atualização: {settings.refresh_interval_seconds}s</Label>
              <Slider
                value={[settings.refresh_interval_seconds]}
                onValueChange={([v]) => updateSetting("refresh_interval_seconds", v)}
                min={10}
                max={120}
                step={5}
              />
              <p className="text-xs text-muted-foreground">
                A cada quantos segundos os dados são atualizados
              </p>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Rotação Automática do Ranking</Label>
                <p className="text-xs text-muted-foreground">
                  Alterna entre páginas do ranking automaticamente
                </p>
              </div>
              <Switch
                checked={settings.auto_rotate_ranking}
                onCheckedChange={(v) => updateSetting("auto_rotate_ranking", v)}
              />
            </div>

            {settings.auto_rotate_ranking && (
              <div className="space-y-3">
                <Label>Intervalo de Rotação: {settings.rotate_interval_seconds}s</Label>
                <Slider
                  value={[settings.rotate_interval_seconds]}
                  onValueChange={([v]) => updateSetting("rotate_interval_seconds", v)}
                  min={5}
                  max={30}
                  step={1}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Seção: Celebrações */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Tv className="h-5 w-5 text-primary" />
              <CardTitle>Celebrações</CardTitle>
            </div>
            <CardDescription>Configure as animações de venda</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Celebrações Ativadas</Label>
                <p className="text-xs text-muted-foreground">
                  Animação de confetti quando há uma venda
                </p>
              </div>
              <Switch
                checked={settings.celebrations_enabled}
                onCheckedChange={(v) => updateSetting("celebrations_enabled", v)}
              />
            </div>

            {settings.celebrations_enabled && (
              <>
                <div className="space-y-3">
                  <Label>Duração da Celebração: {settings.celebration_duration_seconds}s</Label>
                  <Slider
                    value={[settings.celebration_duration_seconds]}
                    onValueChange={([v]) => updateSetting("celebration_duration_seconds", v)}
                    min={3}
                    max={15}
                    step={1}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Som de Celebração</Label>
                    <p className="text-xs text-muted-foreground">
                      Toca som de aplausos durante a animação
                    </p>
                  </div>
                  <Switch
                    checked={settings.celebration_sound_enabled}
                    onCheckedChange={(v) => updateSetting("celebration_sound_enabled", v)}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Seção: Cores */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              <CardTitle>Cores</CardTitle>
            </div>
            <CardDescription>Personalize as cores da interface</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cor Primária</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={settings.primary_color}
                    onChange={(e) => updateSetting("primary_color", e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={settings.primary_color}
                    onChange={(e) => updateSetting("primary_color", e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Cor de Destaque</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={settings.accent_color}
                    onChange={(e) => updateSetting("accent_color", e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={settings.accent_color}
                    onChange={(e) => updateSetting("accent_color", e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Gradiente de Fundo</Label>
              <Select
                value={settings.background_gradient}
                onValueChange={(v) => updateSetting("background_gradient", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="from-background to-muted/50">Padrão (Escuro)</SelectItem>
                  <SelectItem value="from-slate-900 to-slate-800">Slate Dark</SelectItem>
                  <SelectItem value="from-zinc-900 to-zinc-800">Zinc Dark</SelectItem>
                  <SelectItem value="from-neutral-900 to-neutral-800">Neutral Dark</SelectItem>
                  <SelectItem value="from-purple-900/20 to-background">Purple Accent</SelectItem>
                  <SelectItem value="from-blue-900/20 to-background">Blue Accent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 rounded-lg bg-gradient-to-br border" 
              style={{ 
                background: `linear-gradient(to bottom right, ${settings.primary_color}20, ${settings.accent_color}10)` 
              }}
            >
              <p className="text-sm text-center text-muted-foreground">
                Pré-visualização do gradiente
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Seção: SDRs Visíveis */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle>SDRs Visíveis na TV</CardTitle>
            </div>
            <Badge variant="outline">
              {visibleCount} de {totalCount} visíveis
            </Badge>
          </div>
          <CardDescription>
            Selecione quais SDRs devem aparecer no ranking da TV
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingSdrs ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {tvSdrs?.map((sdr) => (
                  <div
                    key={sdr.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      sdr.show_on_tv 
                        ? "bg-primary/5 border-primary/20" 
                        : "bg-muted/30 border-border opacity-60"
                    }`}
                  >
                    <Checkbox
                      checked={sdr.show_on_tv ?? true}
                      onCheckedChange={(checked) => 
                        updateSdrVisibility.mutate({ 
                          userId: sdr.id, 
                          showOnTv: checked === true 
                        })
                      }
                    />
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {sdr.full_name?.[0]?.toUpperCase() || sdr.email?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {sdr.full_name || "Sem nome"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {sdr.email}
                      </p>
                    </div>
                    {sdr.show_on_tv ? (
                      <Eye className="h-4 w-4 text-primary" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
