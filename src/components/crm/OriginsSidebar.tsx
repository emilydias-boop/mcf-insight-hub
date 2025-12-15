import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Layers, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { useCRMOriginsByPipeline } from '@/hooks/useCRMOriginsByPipeline';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface OriginsSidebarProps {
  pipelineId?: string | null;
  selectedOriginId: string | null;
  onSelectOrigin: (originId: string | null) => void;
}

interface Group {
  id: string;
  name: string;
  display_name?: string | null;
  children: Origin[];
}

interface Origin {
  id: string;
  name: string;
  display_name?: string | null;
  group_id?: string | null;
  groupId?: string | null;
  contact_count?: number;
  deal_count?: number;
}

// Componente principal do sidebar

export const OriginsSidebar = ({ pipelineId, selectedOriginId, onSelectOrigin }: OriginsSidebarProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  const { data: originData, isLoading } = useCRMOriginsByPipeline(pipelineId);
  
  // Verificar se é uma lista flat (pipeline específico) ou árvore (todos os funis)
  const isGroupedTree = originData && Array.isArray(originData) && originData.length > 0 && 'children' in originData[0];
  
  // Filtrar origens por busca
  const filterBySearch = (items: any[]) => {
    if (!searchTerm) return items;
    
    return items.filter((item: any) => {
      const displayName = item.display_name || item.name;
      const nameMatch = displayName.toLowerCase().includes(searchTerm.toLowerCase());
      
      if ('children' in item && Array.isArray(item.children)) {
        const childMatch = item.children.some((child: Origin) => {
          const childDisplay = child.display_name || child.name;
          return childDisplay.toLowerCase().includes(searchTerm.toLowerCase());
        });
        return nameMatch || childMatch;
      }
      
      return nameMatch;
    });
  };
  
  const filteredData = filterBySearch(originData || []);
  
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
  
  // Renderizar origem individual
  const renderOriginItem = (origin: Origin, indented = false) => {
    const displayName = origin.display_name || origin.name;
    const dealCount = origin.deal_count || 0;
    
    return (
      <Button
        key={origin.id}
        variant={selectedOriginId === origin.id ? "secondary" : "ghost"}
        className={cn(
          "w-full justify-between h-auto py-2 text-left",
          selectedOriginId === origin.id && "bg-primary/10",
          indented && "pl-8"
        )}
        onClick={() => onSelectOrigin(origin.id)}
      >
        <span className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
          <span className="truncate text-xs">{displayName}</span>
        </span>
        {dealCount > 0 && (
          <Badge variant="secondary" className="text-xs ml-2 flex-shrink-0">
            {dealCount}
          </Badge>
        )}
      </Button>
    );
  };
  
  // Renderizar grupo colapsável
  const renderGroup = (group: Group) => {
    const displayName = group.display_name || group.name;
    const isExpanded = expandedGroups.has(group.id);
    const totalDeals = group.children.reduce((sum, c) => sum + (c.deal_count || 0), 0);
    
    return (
      <Collapsible
        key={group.id}
        open={isExpanded}
        onOpenChange={() => toggleGroup(group.id)}
      >
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between h-auto py-2 font-medium"
          >
            <span className="flex items-center gap-2 min-w-0 flex-1">
              <ChevronDown 
                className={cn(
                  "h-3 w-3 transition-transform flex-shrink-0",
                  !isExpanded && "-rotate-90"
                )}
              />
              <Layers className="h-3 w-3 flex-shrink-0" />
              <span className="truncate text-xs">{displayName}</span>
            </span>
            {totalDeals > 0 && (
              <Badge variant="outline" className="text-xs ml-2 flex-shrink-0">
                {totalDeals}
              </Badge>
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-1">
          {group.children.map(child => renderOriginItem(child, true))}
        </CollapsibleContent>
      </Collapsible>
    );
  };
  
  return (
    <div className={cn(
      "border-r bg-muted/10 flex flex-col h-full transition-all duration-300",
      isCollapsed ? "w-12" : "w-64"
    )}>
      {/* Header com toggle */}
      <div className="p-4 border-b flex items-center justify-between">
        {!isCollapsed && (
          <h3 className="font-semibold text-sm uppercase text-muted-foreground">
            Origens
          </h3>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-8 w-8 flex-shrink-0"
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
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar origem..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              <Button
                variant={selectedOriginId === null ? "secondary" : "ghost"}
                className="w-full justify-start mb-2"
                onClick={() => onSelectOrigin(null)}
              >
                <Layers className="h-4 w-4 mr-2" />
                Todas as Origens
              </Button>
              
              {isLoading ? (
                <div className="text-sm text-muted-foreground p-4">Carregando...</div>
              ) : filteredData.length === 0 ? (
                <div className="text-sm text-muted-foreground p-4">
                  {searchTerm ? 'Nenhuma origem encontrada' : 'Nenhuma origem cadastrada'}
                </div>
              ) : isGroupedTree ? (
                // Modo árvore (todos os funis)
                filteredData.map((item: any) => renderGroup(item))
              ) : (
                // Modo lista flat (pipeline específico)
                filteredData.map((item: any) => renderOriginItem(item))
              )}
            </div>
          </ScrollArea>
        </>
      )}
      
      {/* Versão mini quando collapsed */}
      {isCollapsed && (
        <div className="flex flex-col items-center py-2 gap-2">
          <Button
            variant={selectedOriginId === null ? "secondary" : "ghost"}
            size="icon"
            onClick={() => onSelectOrigin(null)}
            title="Todas as Origens"
          >
            <Layers className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};
