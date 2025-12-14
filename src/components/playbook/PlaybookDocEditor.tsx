import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Save, Pencil, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { 
  NotionPlaybookDoc, 
  useNotionPlaybookContent, 
  useUpdateNotionPlaybook, 
  useUpdateNotionPlaybookContent 
} from "@/hooks/useNotionPlaybook";
import { PlaybookReadStats } from "./PlaybookReadStats";
import { 
  PLAYBOOK_ROLES_LIST, 
  PLAYBOOK_ROLE_LABELS, 
  PLAYBOOK_CATEGORIAS_LIST, 
  PLAYBOOK_CATEGORIA_LABELS,
  PlaybookRole,
  PlaybookCategoria,
  PlaybookTipoConteudo
} from "@/types/playbook";

interface PlaybookDocEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: NotionPlaybookDoc | null;
}

export function PlaybookDocEditor({ open, onOpenChange, doc }: PlaybookDocEditorProps) {
  const [activeTab, setActiveTab] = useState("conteudo");
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editContent, setEditContent] = useState("");
  
  // Config form state
  const [configData, setConfigData] = useState({
    role: "" as PlaybookRole,
    categoria: "" as PlaybookCategoria,
    titulo: "",
    tipo_conteudo: "texto" as PlaybookTipoConteudo,
    link_url: "",
    versao: "1.0",
    ativo: true,
    obrigatorio: false,
  });

  const { data: contentData, isLoading: loadingContent } = useNotionPlaybookContent(
    doc?.notion_page_id || null
  );
  
  const updatePlaybook = useUpdateNotionPlaybook();
  const updateContent = useUpdateNotionPlaybookContent();

  // Sync config form when doc changes
  useEffect(() => {
    if (doc) {
      setConfigData({
        role: doc.role as PlaybookRole,
        categoria: doc.categoria as PlaybookCategoria,
        titulo: doc.titulo,
        tipo_conteudo: doc.tipo_conteudo as PlaybookTipoConteudo,
        link_url: doc.link_url || "",
        versao: doc.versao,
        ativo: doc.ativo,
        obrigatorio: doc.obrigatorio,
      });
    }
  }, [doc]);

  // Sync edit content when content loads
  useEffect(() => {
    if (contentData?.content) {
      setEditContent(contentData.content);
    }
  }, [contentData?.content]);

  // Reset state when closing
  useEffect(() => {
    if (!open) {
      setActiveTab("conteudo");
      setIsEditingContent(false);
    }
  }, [open]);

  const handleSaveContent = async () => {
    if (!doc?.notion_page_id) return;
    
    try {
      await updateContent.mutateAsync({
        pageId: doc.notion_page_id,
        content: editContent,
      });
      setIsEditingContent(false);
      toast.success("Conteúdo salvo!");
    } catch (error) {
      console.error("Erro ao salvar:", error);
    }
  };

  const handleSaveConfig = async () => {
    if (!doc) return;
    
    try {
      await updatePlaybook.mutateAsync({
        pageId: doc.notion_page_id,
        ...configData,
      });
      toast.success("Configurações salvas!");
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
    }
  };

  if (!doc) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-3xl w-full p-0 flex flex-col">
        <SheetHeader className="p-6 pb-0">
          <SheetTitle className="text-lg font-semibold truncate">
            {doc.titulo}
          </SheetTitle>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 mt-4 grid w-auto grid-cols-3">
            <TabsTrigger value="conteudo">Conteúdo</TabsTrigger>
            <TabsTrigger value="config">Configurações</TabsTrigger>
            <TabsTrigger value="stats">Estatísticas</TabsTrigger>
          </TabsList>

          {/* Tab: Conteúdo */}
          <TabsContent value="conteudo" className="flex-1 overflow-hidden m-0 p-6 pt-4">
            <div className="h-full flex flex-col">
              {/* Actions */}
              <div className="flex justify-end gap-2 mb-4">
                {doc.tipo_conteudo === "texto" && !isEditingContent && (
                  <Button variant="outline" size="sm" onClick={() => setIsEditingContent(true)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                )}
                {isEditingContent && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setIsEditingContent(false)}>
                      <X className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={handleSaveContent} disabled={updateContent.isPending}>
                      {updateContent.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Salvar
                    </Button>
                  </>
                )}
                {doc.tipo_conteudo === "link" && doc.link_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={doc.link_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir Link
                    </a>
                  </Button>
                )}
              </div>

              {/* Content area */}
              <ScrollArea className="flex-1 border rounded-md">
                {loadingContent ? (
                  <div className="flex items-center justify-center h-48">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : isEditingContent ? (
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="min-h-[400px] border-0 resize-none focus-visible:ring-0"
                    placeholder="Digite o conteúdo aqui..."
                  />
                ) : (
                  <div className="p-4 prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                    {contentData?.content || (
                      <p className="text-muted-foreground italic">Sem conteúdo</p>
                    )}
                  </div>
                )}
              </ScrollArea>
            </div>
          </TabsContent>

          {/* Tab: Configurações */}
          <TabsContent value="config" className="flex-1 overflow-hidden m-0">
            <ScrollArea className="h-full p-6 pt-4">
              <div className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label>Cargo</Label>
                  <Select 
                    value={configData.role} 
                    onValueChange={(v) => setConfigData(prev => ({ ...prev, role: v as PlaybookRole }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cargo" />
                    </SelectTrigger>
                    <SelectContent>
                      {PLAYBOOK_ROLES_LIST.map((role) => (
                        <SelectItem key={role} value={role}>
                          {PLAYBOOK_ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select 
                    value={configData.categoria} 
                    onValueChange={(v) => setConfigData(prev => ({ ...prev, categoria: v as PlaybookCategoria }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {PLAYBOOK_CATEGORIAS_LIST.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {PLAYBOOK_CATEGORIA_LABELS[cat]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input
                    value={configData.titulo}
                    onChange={(e) => setConfigData(prev => ({ ...prev, titulo: e.target.value }))}
                    placeholder="Título do documento"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tipo de Conteúdo</Label>
                  <Select 
                    value={configData.tipo_conteudo} 
                    onValueChange={(v) => setConfigData(prev => ({ ...prev, tipo_conteudo: v as PlaybookTipoConteudo }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="texto">Texto</SelectItem>
                      <SelectItem value="link">Link</SelectItem>
                      <SelectItem value="arquivo">Arquivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {configData.tipo_conteudo === "link" && (
                  <div className="space-y-2">
                    <Label>URL do Link</Label>
                    <Input
                      value={configData.link_url}
                      onChange={(e) => setConfigData(prev => ({ ...prev, link_url: e.target.value }))}
                      placeholder="https://..."
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Versão</Label>
                  <Input
                    value={configData.versao}
                    onChange={(e) => setConfigData(prev => ({ ...prev, versao: e.target.value }))}
                    placeholder="1.0"
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <Label>Ativo</Label>
                  <Switch
                    checked={configData.ativo}
                    onCheckedChange={(v) => setConfigData(prev => ({ ...prev, ativo: v }))}
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <Label>Obrigatório</Label>
                  <Switch
                    checked={configData.obrigatorio}
                    onCheckedChange={(v) => setConfigData(prev => ({ ...prev, obrigatorio: v }))}
                  />
                </div>

                <Button 
                  onClick={handleSaveConfig} 
                  disabled={updatePlaybook.isPending}
                  className="w-full mt-4"
                >
                  {updatePlaybook.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar Configurações
                </Button>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Tab: Estatísticas */}
          <TabsContent value="stats" className="flex-1 overflow-hidden m-0 p-6 pt-4">
            <ScrollArea className="h-full">
              <PlaybookReadStats 
                open={true} 
                onOpenChange={() => {}} 
                doc={doc}
                embedded
              />
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
