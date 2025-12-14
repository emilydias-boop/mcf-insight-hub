import { PLAYBOOK_TIPO_LABELS, PLAYBOOK_CATEGORIA_LABELS } from "@/types/playbook";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Pencil, FileText, Link, FileType, ExternalLink } from "lucide-react";
import { useToggleNotionPlaybookActive, NotionPlaybookDoc } from "@/hooks/useNotionPlaybook";

interface PlaybookDocTableProps {
  docs: NotionPlaybookDoc[];
  onEdit: (doc: NotionPlaybookDoc) => void;
}

export function PlaybookDocTable({ docs, onEdit }: PlaybookDocTableProps) {
  const toggleActive = useToggleNotionPlaybookActive();

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'arquivo':
        return <FileText className="h-4 w-4" />;
      case 'link':
        return <Link className="h-4 w-4" />;
      case 'texto':
        return <FileType className="h-4 w-4" />;
      default:
        return null;
    }
  };

  if (docs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum documento cadastrado para este cargo no Notion.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Título</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Categoria</TableHead>
          <TableHead>Obrigatório</TableHead>
          <TableHead>Versão</TableHead>
          <TableHead>Ativo</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {docs.map((doc) => (
          <TableRow key={doc.notion_page_id}>
            <TableCell className="font-medium">
              <div className="flex items-center gap-2">
                {doc.titulo}
                {doc.notion_url && (
                  <a href={doc.notion_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                {getTipoIcon(doc.tipo_conteudo)}
                <span>{PLAYBOOK_TIPO_LABELS[doc.tipo_conteudo]}</span>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="outline">
                {PLAYBOOK_CATEGORIA_LABELS[doc.categoria]}
              </Badge>
            </TableCell>
            <TableCell>
              {doc.obrigatorio ? (
                <Badge variant="destructive">Sim</Badge>
              ) : (
                <Badge variant="secondary">Não</Badge>
              )}
            </TableCell>
            <TableCell>{doc.versao}</TableCell>
            <TableCell>
              <Switch
                checked={doc.ativo}
                onCheckedChange={(checked) => 
                  toggleActive.mutate({ pageId: doc.notion_page_id, ativo: checked })
                }
              />
            </TableCell>
            <TableCell className="text-right">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(doc)}
              >
                <Pencil className="h-4 w-4 mr-1" />
                Editar
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
