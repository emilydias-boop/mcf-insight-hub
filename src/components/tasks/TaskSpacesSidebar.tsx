import { useState, useMemo } from "react";
import {
  Building2,
  Folder,
  ListTodo,
  Plus,
  Search,
  ChevronRight,
  Lock,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { TaskSpace, TaskSpaceType, useTaskSpacesTree } from "@/hooks/useTaskSpaces";
import { CreateSpaceDialog } from "./CreateSpaceDialog";
import { SpaceContextMenu } from "./SpaceContextMenu";

interface TaskSpacesSidebarProps {
  selectedSpaceId: string | null;
  onSelectSpace: (spaceId: string | null) => void;
}

const typeIcons = {
  setor: Building2,
  pasta: Folder,
  lista: ListTodo,
};

const typeColors = {
  setor: "bg-emerald-100 text-emerald-700",
  pasta: "bg-amber-100 text-amber-700",
  lista: "bg-blue-100 text-blue-700",
};

export function TaskSpacesSidebar({
  selectedSpaceId,
  onSelectSpace,
}: TaskSpacesSidebarProps) {
  const { data: tree, isLoading } = useTaskSpacesTree();
  const [expandedSpaces, setExpandedSpaces] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [createDialog, setCreateDialog] = useState<{
    open: boolean;
    parentId: string | null;
    parentType: TaskSpaceType | null;
    defaultType: TaskSpaceType;
  }>({
    open: false,
    parentId: null,
    parentType: null,
    defaultType: "setor",
  });

  const toggleExpanded = (id: string) => {
    setExpandedSpaces((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const openCreateDialog = (
    parentId: string | null,
    parentType: TaskSpaceType | null,
    defaultType: TaskSpaceType
  ) => {
    setCreateDialog({ open: true, parentId, parentType, defaultType });
  };

  // Filter tree based on search
  const filteredTree = useMemo(() => {
    if (!searchTerm.trim()) return tree;

    const searchLower = searchTerm.toLowerCase();

    const filterNode = (node: TaskSpace): TaskSpace | null => {
      const matches = node.name.toLowerCase().includes(searchLower);
      const filteredChildren = node.children
        ?.map(filterNode)
        .filter(Boolean) as TaskSpace[];

      if (matches || filteredChildren?.length) {
        return { ...node, children: filteredChildren };
      }
      return null;
    };

    return tree.map(filterNode).filter(Boolean) as TaskSpace[];
  }, [tree, searchTerm]);

  const renderSpaceItem = (space: TaskSpace, depth: number = 0) => {
    const Icon = typeIcons[space.type];
    const hasChildren = space.children && space.children.length > 0;
    const isExpanded = expandedSpaces.has(space.id);
    const isSelected = selectedSpaceId === space.id;
    const canExpand = space.type !== "lista" || hasChildren;

    return (
      <div key={space.id}>
        <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(space.id)}>
          <div
            className={cn(
              "group flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
              isSelected
                ? "bg-primary/10 text-primary"
                : "hover:bg-muted"
            )}
            style={{ paddingLeft: `${8 + depth * 16}px` }}
          >
            {/* Expand/Collapse button */}
            {canExpand && hasChildren ? (
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 p-0 hover:bg-transparent"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 transition-transform",
                      isExpanded && "rotate-90"
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
            ) : (
              <div className="w-5" />
            )}

            {/* Main clickable area */}
            <div
              className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden"
              onClick={() => onSelectSpace(space.id)}
            >
              <div
                className={cn(
                  "p-1 rounded flex-shrink-0",
                  space.color ? "" : typeColors[space.type]
                )}
                style={space.color ? { backgroundColor: `${space.color}20`, color: space.color } : undefined}
              >
                <Icon className="h-4 w-4" />
              </div>
              <span className="truncate text-sm font-medium">{space.name}</span>
              {space.is_private && (
                <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              )}
            </div>

            {/* Actions - always visible with flex-shrink-0 */}
            <div className="flex items-center gap-0.5 flex-shrink-0 ml-1">
              <SpaceContextMenu
                space={space}
                onAddChild={(type) => openCreateDialog(space.id, space.type, type)}
              />
              {(space.type === "setor" || space.type === "pasta") && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    openCreateDialog(
                      space.id,
                      space.type,
                      space.type === "setor" ? "pasta" : "lista"
                    );
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {hasChildren && (
            <CollapsibleContent>
              {space.children!.map((child) => renderSpaceItem(child, depth + 1))}
            </CollapsibleContent>
          )}
        </Collapsible>
      </div>
    );
  };

  return (
    <div className="w-72 border-r bg-card flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between">
        <h2 className="font-semibold text-sm">Espaços</h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setShowSearch(!showSearch)}
          >
            <Search className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => openCreateDialog(null, null, "setor")}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      {showSearch && (
        <div className="p-2 border-b">
          <Input
            placeholder="Buscar espaços..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8"
          />
        </div>
      )}

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {/* "Tudo" option */}
          <div
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors mb-2",
              selectedSpaceId === null
                ? "bg-primary/10 text-primary"
                : "hover:bg-muted"
            )}
            onClick={() => onSelectSpace(null)}
          >
            <div className="p-1 rounded bg-muted">
              <Settings className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium">Tudo</span>
          </div>

          {/* Tree */}
          {isLoading ? (
            <div className="text-sm text-muted-foreground p-2">Carregando...</div>
          ) : filteredTree.length === 0 ? (
            <div className="text-sm text-muted-foreground p-2 text-center">
              {searchTerm ? "Nenhum resultado" : "Nenhum setor criado"}
            </div>
          ) : (
            filteredTree.map((space) => renderSpaceItem(space))
          )}
        </div>
      </ScrollArea>

      {/* Create Dialog */}
      <CreateSpaceDialog
        open={createDialog.open}
        onOpenChange={(open) => setCreateDialog((prev) => ({ ...prev, open }))}
        parentId={createDialog.parentId}
        parentType={createDialog.parentType}
        defaultType={createDialog.defaultType}
      />
    </div>
  );
}
