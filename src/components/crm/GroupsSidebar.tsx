import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Layers, ChevronLeft, ChevronRight, ChevronDown, Star } from 'lucide-react';
import { useCRMGroupsForSidebar, useToggleGroupFavorite, CRMGroup, CRMGroupOrigin } from '@/hooks/useCRMGroupsForSidebar';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface GroupsSidebarProps {
  selectedGroupId: string | null;
  selectedOriginId: string | null;
  onSelectGroup: (groupId: string | null) => void;
  onSelectOrigin: (originId: string | null) => void;
}

export const GroupsSidebar = ({ 
  selectedGroupId, 
  selectedOriginId, 
  onSelectGroup, 
  onSelectOrigin 
}: GroupsSidebarProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  const { data: groups, isLoading } = useCRMGroupsForSidebar();
  const toggleFavorite = useToggleGroupFavorite();
  
  // Filtrar grupos por busca
  const filteredGroups = (groups || []).filter(group => {
    if (!searchTerm) return true;
    
    const displayName = group.display_name || group.name;
    const nameMatch = displayName.toLowerCase().includes(searchTerm.toLowerCase());
    const originMatch = group.origins.some(o => {
      const originDisplay = o.display_name || o.name;
      return originDisplay.toLowerCase().includes(searchTerm.toLowerCase());
    });
    
    return nameMatch || originMatch;
  });
  
  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };
  
  const handleToggleFavorite = (e: React.MouseEvent, group: CRMGroup) => {
    e.stopPropagation();
    if (group.id === '__ungrouped__') return;
    toggleFavorite.mutate({ groupId: group.id, isFavorite: !group.is_favorite });
  };
  
  const handleSelectGroup = (groupId: string) => {
    onSelectGroup(groupId);
    onSelectOrigin(null);
  };
  
  const handleSelectOrigin = (originId: string) => {
    onSelectOrigin(originId);
    onSelectGroup(null);
  };
  
  // Renderizar origem individual
  const renderOriginItem = (origin: CRMGroupOrigin) => {
    const displayName = origin.display_name || origin.name;
    
    return (
      <Button
        key={origin.id}
        variant={selectedOriginId === origin.id ? "secondary" : "ghost"}
        className={cn(
          "w-full justify-between h-auto py-1.5 text-left pl-8",
          selectedOriginId === origin.id && "bg-primary/10"
        )}
        onClick={() => handleSelectOrigin(origin.id)}
      >
        <span className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 flex-shrink-0" />
          <span className="truncate text-xs">{displayName}</span>
        </span>
        {origin.deal_count > 0 && (
          <Badge variant="secondary" className="text-[10px] ml-1 flex-shrink-0 h-4 px-1">
            {origin.deal_count}
          </Badge>
        )}
      </Button>
    );
  };
  
  // Renderizar grupo colapsável
  const renderGroup = (group: CRMGroup) => {
    const displayName = group.display_name || group.name;
    const isExpanded = expandedGroups.has(group.id);
    const isSelected = selectedGroupId === group.id;
    const isUngrouped = group.id === '__ungrouped__';
    
    return (
      <Collapsible
        key={group.id}
        open={isExpanded}
        onOpenChange={() => toggleGroup(group.id)}
      >
        <div className="flex items-center gap-1">
          <CollapsibleTrigger asChild>
            <Button
              variant={isSelected ? "secondary" : "ghost"}
              className={cn(
                "flex-1 justify-between h-auto py-2 font-medium",
                isSelected && "bg-primary/10"
              )}
              onClick={(e) => {
                e.preventDefault();
                handleSelectGroup(group.id);
              }}
            >
              <span className="flex items-center gap-2 min-w-0 flex-1">
                <ChevronDown 
                  className={cn(
                    "h-3 w-3 transition-transform flex-shrink-0",
                    !isExpanded && "-rotate-90"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleGroup(group.id);
                  }}
                />
                <Layers className="h-3 w-3 flex-shrink-0" />
                <span className="truncate text-xs">{displayName}</span>
              </span>
              {group.deal_count > 0 && (
                <Badge variant="outline" className="text-[10px] ml-1 flex-shrink-0 h-4 px-1">
                  {group.deal_count}
                </Badge>
              )}
            </Button>
          </CollapsibleTrigger>
          
          {!isUngrouped && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0"
              onClick={(e) => handleToggleFavorite(e, group)}
            >
              <Star 
                className={cn(
                  "h-3 w-3",
                  group.is_favorite ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"
                )} 
              />
            </Button>
          )}
        </div>
        
        {group.origins.length > 0 && (
          <CollapsibleContent className="space-y-0.5 mt-1">
            {group.origins.map(origin => renderOriginItem(origin))}
          </CollapsibleContent>
        )}
      </Collapsible>
    );
  };
  
  return (
    <div className={cn(
      "border-r bg-muted/10 flex flex-col transition-all duration-300 flex-shrink-0",
      isCollapsed ? "w-12" : "w-56"
    )}>
      {/* Header com toggle */}
      <div className="p-3 border-b flex items-center justify-between">
        {!isCollapsed && (
          <h3 className="font-semibold text-xs uppercase text-muted-foreground">
            Grupos
          </h3>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-7 w-7 flex-shrink-0"
          title={isCollapsed ? "Expandir sidebar" : "Colapsar sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      {/* Conteúdo (esconder quando collapsed) */}
      {!isCollapsed && (
        <>
          {/* Busca */}
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder="Buscar grupo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-7 h-7 text-xs"
              />
            </div>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-0.5">
              <Button
                variant={selectedGroupId === null && selectedOriginId === null ? "secondary" : "ghost"}
                className="w-full justify-start h-8 mb-1"
                onClick={() => {
                  onSelectGroup(null);
                  onSelectOrigin(null);
                }}
              >
                <Layers className="h-3 w-3 mr-2" />
                <span className="text-xs">Todos os Negócios</span>
              </Button>
              
              {isLoading ? (
                <div className="text-xs text-muted-foreground p-3">Carregando...</div>
              ) : filteredGroups.length === 0 ? (
                <div className="text-xs text-muted-foreground p-3">
                  {searchTerm ? 'Nenhum grupo encontrado' : 'Nenhum grupo cadastrado'}
                </div>
              ) : (
                filteredGroups.map(group => renderGroup(group))
              )}
            </div>
          </ScrollArea>
        </>
      )}
      
      {/* Versão mini quando collapsed */}
      {isCollapsed && (
        <div className="flex flex-col items-center py-2 gap-1">
          <Button
            variant={selectedGroupId === null && selectedOriginId === null ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              onSelectGroup(null);
              onSelectOrigin(null);
            }}
            title="Todos os Negócios"
          >
            <Layers className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};
