import { PlaybookDoc, PLAYBOOK_TIPO_LABELS, PLAYBOOK_CATEGORIA_LABELS } from "@/types/playbook";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Pencil, BarChart3, FileText, Link, FileType } from "lucide-react";
import { useTogglePlaybookDocActive } from "@/hooks/usePlaybookDocs";

interface PlaybookDocTableProps {
  docs: PlaybookDoc[];
  onEdit: (doc: PlaybookDoc) => void;
  onViewStats: (doc: PlaybookDoc) => void;
}

export function PlaybookDocTable({ docs, onEdit, onViewStats }: PlaybookDocTableProps) {
  const toggleActive = useTogglePlaybookDocActive();

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
        Nenhum documento cadastrado para este cargo.
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
          <TableRow key={doc.id}>
            <TableCell className="font-medium">{doc.titulo}</TableCell>
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
                  toggleActive.mutate({ id: doc.id, ativo: checked })
                }
              />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(doc)}
                  title="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onViewStats(doc)}
                  title="Ver leitura"
                >
                  <BarChart3 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
