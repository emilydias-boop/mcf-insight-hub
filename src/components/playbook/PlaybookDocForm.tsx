import { useState, useEffect } from "react";
import { PlaybookRole, PlaybookCategoria, PlaybookTipoConteudo, PLAYBOOK_ROLE_LABELS, PLAYBOOK_CATEGORIA_LABELS, PLAYBOOK_ROLES_LIST, PLAYBOOK_CATEGORIAS_LIST } from "@/types/playbook";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCreateNotionPlaybook, useUpdateNotionPlaybook, NotionPlaybookDoc } from "@/hooks/useNotionPlaybook";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PlaybookDocFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc?: NotionPlaybookDoc | null;
  defaultRole?: PlaybookRole;
}

export function PlaybookDocForm({ open, onOpenChange, doc, defaultRole }: PlaybookDocFormProps) {
  const isEditing = !!doc;
  const createDoc = useCreateNotionPlaybook();
  const updateDoc = useUpdateNotionPlaybook();

  const [formData, setFormData] = useState({
    role: defaultRole || 'sdr' as PlaybookRole,
    titulo: '',
    tipo_conteudo: 'texto' as PlaybookTipoConteudo,
    link_url: '',
    conteudo_rico: '',
    obrigatorio: false,
    categoria: 'outro' as PlaybookCategoria,
    versao: 'v1',
    ativo: true,
  });

  useEffect(() => {
    if (doc) {
      setFormData({
        role: doc.role,
        titulo: doc.titulo,
        tipo_conteudo: doc.tipo_conteudo,
        link_url: doc.link_url || '',
        conteudo_rico: '',
        obrigatorio: doc.obrigatorio,
        categoria: doc.categoria,
        versao: doc.versao,
        ativo: doc.ativo,
      });
    } else {
      setFormData({
        role: defaultRole || 'sdr',
        titulo: '',
        tipo_conteudo: 'texto',
        link_url: '',
        conteudo_rico: '',
        obrigatorio: false,
        categoria: 'outro',
        versao: 'v1',
        ativo: true,
      });
    }
  }, [doc, defaultRole, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (isEditing && doc) {
        await updateDoc.mutateAsync({
          pageId: doc.notion_page_id,
          titulo: formData.titulo,
          role: formData.role,
          categoria: formData.categoria,
          tipo_conteudo: formData.tipo_conteudo,
          obrigatorio: formData.obrigatorio,
          ativo: formData.ativo,
          link_url: formData.tipo_conteudo === 'link' ? formData.link_url : undefined,
          versao: formData.versao,
        });
      } else {
        await createDoc.mutateAsync({
          titulo: formData.titulo,
          role: formData.role,
          categoria: formData.categoria,
          tipo_conteudo: formData.tipo_conteudo,
          obrigatorio: formData.obrigatorio,
          ativo: formData.ativo,
          link_url: formData.tipo_conteudo === 'link' ? formData.link_url : undefined,
          versao: formData.versao,
          conteudo_rico: formData.tipo_conteudo === 'texto' ? formData.conteudo_rico : undefined,
        });
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar documento:', error);
      toast.error('Erro ao salvar documento');
    }
  };

  const isLoading = createDoc.isPending || updateDoc.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Documento' : 'Novo Documento'}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Os documentos são salvos diretamente no Notion
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="role">Cargo</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value as PlaybookRole })}
              >
                <SelectTrigger>
                  <SelectValue />
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
              <Label htmlFor="categoria">Categoria</Label>
              <Select
                value={formData.categoria}
                onValueChange={(value) => setFormData({ ...formData, categoria: value as PlaybookCategoria })}
              >
                <SelectTrigger>
                  <SelectValue />
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo_conteudo">Tipo de Conteúdo</Label>
            <Select
              value={formData.tipo_conteudo}
              onValueChange={(value) => setFormData({ ...formData, tipo_conteudo: value as PlaybookTipoConteudo })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="texto">Texto (conteúdo no Notion)</SelectItem>
                <SelectItem value="link">Link externo</SelectItem>
                <SelectItem value="arquivo">Arquivo (anexo no Notion)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.tipo_conteudo === 'link' && (
            <div className="space-y-2">
              <Label htmlFor="link_url">URL do Link</Label>
              <Input
                id="link_url"
                type="url"
                value={formData.link_url}
                onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
          )}

          {formData.tipo_conteudo === 'texto' && !isEditing && (
            <div className="space-y-2">
              <Label htmlFor="conteudo_rico">Conteúdo inicial (opcional)</Label>
              <Textarea
                id="conteudo_rico"
                value={formData.conteudo_rico}
                onChange={(e) => setFormData({ ...formData, conteudo_rico: e.target.value })}
                rows={6}
                placeholder="Digite o conteúdo inicial... (pode ser editado depois no Notion)"
              />
              <p className="text-xs text-muted-foreground">
                Após criar, você pode editar o conteúdo diretamente no Notion
              </p>
            </div>
          )}

          {formData.tipo_conteudo === 'arquivo' && (
            <div className="p-4 border rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">
                Para documentos do tipo arquivo, adicione os arquivos diretamente na página do Notion após criar o documento.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="versao">Versão</Label>
              <Input
                id="versao"
                value={formData.versao}
                onChange={(e) => setFormData({ ...formData, versao: e.target.value })}
                placeholder="v1"
              />
            </div>

            <div className="flex items-center justify-between pt-6">
              <Label htmlFor="obrigatorio">Obrigatório</Label>
              <Switch
                id="obrigatorio"
                checked={formData.obrigatorio}
                onCheckedChange={(checked) => setFormData({ ...formData, obrigatorio: checked })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="ativo">Documento ativo</Label>
            <Switch
              id="ativo"
              checked={formData.ativo}
              onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
