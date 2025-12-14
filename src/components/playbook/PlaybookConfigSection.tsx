import { useState } from "react";
import { PlaybookRole, PLAYBOOK_ROLE_LABELS } from "@/types/playbook";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNotionPlaybookDocs, NotionPlaybookDoc } from "@/hooks/useNotionPlaybook";
import { PlaybookDocTable } from "./PlaybookDocTable";
import { PlaybookDocForm } from "./PlaybookDocForm";
import { PlaybookDocEditor } from "./PlaybookDocEditor";
import { Plus, Loader2 } from "lucide-react";

export function PlaybookConfigSection() {
  const [selectedRole, setSelectedRole] = useState<PlaybookRole>('sdr');
  const [formOpen, setFormOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<NotionPlaybookDoc | null>(null);

  const { data: docs, isLoading } = useNotionPlaybookDocs(selectedRole);

  const handleNew = () => {
    setFormOpen(true);
  };

  const displayRoles: PlaybookRole[] = ['sdr', 'closer', 'coordenador', 'admin', 'manager'];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Playbook por Cargo</CardTitle>
        <CardDescription>
          Gerencie os documentos no Notion por cargo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <Tabs value={selectedRole} onValueChange={(v) => setSelectedRole(v as PlaybookRole)}>
            <TabsList>
              {displayRoles.map((role) => (
                <TabsTrigger key={role} value={role}>
                  {PLAYBOOK_ROLE_LABELS[role]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <Button onClick={handleNew}>
            <Plus className="mr-2 h-4 w-4" />
            Novo documento
          </Button>
        </div>

        <div>
          <h3 className="text-lg font-semibold">
            Playbook do cargo {PLAYBOOK_ROLE_LABELS[selectedRole]}
          </h3>
          <p className="text-sm text-muted-foreground">
            {docs?.length || 0} documento(s) no Notion
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <PlaybookDocTable
            docs={docs || []}
            onEdit={setEditingDoc}
          />
        )}

        {/* Form para criar novo documento */}
        <PlaybookDocForm
          open={formOpen}
          onOpenChange={setFormOpen}
          defaultRole={selectedRole}
        />

        {/* Editor unificado com Tabs (Conteúdo, Configurações, Estatísticas) */}
        <PlaybookDocEditor
          open={!!editingDoc}
          onOpenChange={(open) => !open && setEditingDoc(null)}
          doc={editingDoc}
        />
      </CardContent>
    </Card>
  );
}
