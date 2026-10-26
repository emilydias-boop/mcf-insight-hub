import { useState, useEffect, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Search, Layers, ChevronLeft, ChevronRight, ChevronDown, Star, Plus,
  Store, Users, Building2, Briefcase, Package, Megaphone, Globe, 
  ShoppingCart, Target, Handshake, type LucideIcon
} from 'lucide-react';
import { useCRMOriginsByPipeline } from '@/hooks/useCRMOriginsByPipeline';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { PipelineSelector } from './PipelineSelector';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PipelineContextMenu } from './PipelineContextMenu';
import { PipelineConfigModal } from './PipelineConfigModal';
import { CreatePipelineWizard } from './wizard/CreatePipelineWizard';

interface OriginsSidebarProps {
  pipelineId?: string | null;
  selectedOriginId: string | null;
  onSelectOrigin: (originId: string | null) => void;
  onSelectPipeline: (pipelineId: string | null) => void;
  allowedOriginIds?: string[]; // IDs das origens permitidas pela BU
  allowedGroupIds?: string[];  // IDs dos grupos permitidos pela BU (para filtrar dropdown)
  hideFilters?: boolean; // Esconder seletor de pipeline, busca e botão criar
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

// Mapear ícones baseado no nome do grupo/origem
const getGroupIcon = (name: string): LucideIcon => {
  const lowerName = name.toLowerCase();
  
  if (lowerName.includes('hubla')) return Store;
  if (lowerName.includes('inside') || lowerName.includes('sales')) return Users;
  if (lowerName.includes('capital') || lowerName.includes('mcf')) return Building2;
  if (lowerName.includes('contrato')) return Briefcase;
  if (lowerName.includes('pós venda') || lowerName.includes('pos venda')) return Package;
  if (lowerName.includes('dmg') || lowerName.includes('ads') || lowerName.includes('tráfego')) return Megaphone;
  if (lowerName.includes('bu') || lowerName.includes('produto')) return Globe;
  if (lowerName.includes('parceria') || lowerName.includes('indicação')) return Handshake;
  if (lowerName.includes('lead') || lowerName.includes('captação')) return Target;
  if (lowerName.includes('loja') || lowerName.includes('ecommerce')) return ShoppingCart;
  
  return Layers; // Ícone padrão
};

// Monograma de 2 letras: iniciais das duas primeiras palavras significativas
const MONOGRAM_STOPWORDS = new Set(['PIPELINE', 'DE', 'DA', 'DO', 'DAS', 'DOS', 'E', '-']);
export const getMonogram = (name: string): string => {
  const words = (name || '')
    .split(/[\s\-–—_/]+/)
    .map(w => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(w => w && !MONOGRAM_STOPWORDS.has(w.toUpperCase()));
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
};

const COLLAPSED_STORAGE_KEY = 'crm-origins-sidebar-collapsed';

// Hook para gerenciar favoritos com localStorage
const useFavorites = () => {
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('crm-origin-favorites');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    localStorage.setItem('crm-origin-favorites', JSON.stringify([...favorites]));
  }, [favorites]);

  const toggleFavorite = (id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isFavorite = (id: string) => favorites.has(id);

  return { favorites, toggleFavorite, isFavorite };
};

export const OriginsSidebar = ({ pipelineId, selectedOriginId, onSelectOrigin, onSelectPipeline, allowedOriginIds, allowedGroupIds, hideFilters }: OriginsSidebarProps) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, String(isCollapsed));
    } catch {
      // ignore
    }
  }, [isCollapsed]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  const [configTarget, setConfigTarget] = useState<{ type: 'origin' | 'group'; id: string; name: string } | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  
  const { data: originData, isLoading } = useCRMOriginsByPipeline(pipelineId);
  
  // Filtrar dados por BU (se allowedOriginIds estiver definido)
  const hasBUFilter = allowedOriginIds && allowedOriginIds.length > 0;
  
  const filteredByBU = useMemo(() => {
    if (!originData || !hasBUFilter) return originData;
    
    // Verificar se é uma lista flat ou árvore
    if (Array.isArray(originData) && originData.length > 0 && 'children' in originData[0]) {
      // É árvore (grupos com children)
      return (originData as Group[])
        .map(group => {
          // Verificar se o grupo inteiro está permitido
          if (allowedOriginIds!.includes(group.id)) {
            return group;
          }
          // Filtrar apenas origens permitidas dentro do grupo
          // CORREÇÃO: verificar também se o group_id da origem está na lista permitida
          const filteredChildren = group.children.filter(child => 
            allowedOriginIds!.includes(child.id) ||
            (child.group_id && allowedOriginIds!.includes(child.group_id))
          );
          if (filteredChildren.length === 0) return null;
          return { ...group, children: filteredChildren };
        })
        .filter(Boolean) as Group[];
    } else {
      // É lista flat - CORREÇÃO: verificar também se o group_id está na lista permitida
      return (originData as Origin[]).filter(origin => 
        allowedOriginIds!.includes(origin.id) ||
        (origin.group_id && allowedOriginIds!.includes(origin.group_id))
      );
    }
  }, [originData, allowedOriginIds, hasBUFilter]);
  
  // Se tem filtro de BU, não deduplicar (para manter IDs mapeados)
  const skipDedup = hasBUFilter;
  
  // Usar dados filtrados por BU
  const dataToUse = filteredByBU || originData;
  
  // Verificar se é uma lista flat (pipeline específico) ou árvore (todos os funis)
  const isGroupedTree = dataToUse && Array.isArray(dataToUse) && dataToUse.length > 0 && 'children' in dataToUse[0];
  
  // Auto-expandir grupos quando há poucas origens (≤ 10)
  useEffect(() => {
    if (!dataToUse || !isGroupedTree) return;
    const groups = dataToUse as Group[];
    const totalOrigins = groups.reduce((sum, g) => sum + g.children.length, 0);
    if (totalOrigins <= 10) {
      setExpandedGroups(new Set(groups.map(g => g.id)));
    }
  }, [dataToUse, isGroupedTree]);
  
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
  
  const filteredData = filterBySearch(dataToUse || []);
  
  // Obter lista flat de todas as origens para favoritos
  const getAllOrigins = (): Origin[] => {
    if (!dataToUse) return [];
    
    if (isGroupedTree) {
      return (dataToUse as Group[]).flatMap(group => group.children);
    }
    return dataToUse as Origin[];
  };
  
  // Origens favoritas
  const favoriteOrigins = getAllOrigins().filter(origin => isFavorite(origin.id));
  
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
  const renderOriginItem = (origin: Origin, indented = false, showFavorite = true) => {
    const displayName = origin.display_name || origin.name;
    const dealCount = origin.deal_count || 0;
    const favorited = isFavorite(origin.id);
    
    return (
      <div 
        key={origin.id} 
        className={cn(
          "group flex items-center gap-1 min-w-0",
          indented && "pl-4"
        )}
      >
        {/* Menu de 3 pontos - PRIMEIRO (sempre visível à esquerda) */}
        <span onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
          <PipelineContextMenu
            targetType="origin"
            targetId={origin.id}
            targetName={displayName}
            onConfigure={() => setConfigTarget({ type: 'origin', id: origin.id, name: displayName })}
            onSelect={() => onSelectOrigin(origin.id)}
          />
        </span>
        
        {/* Botão de favorito - SEGUNDO */}
        {showFavorite && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-6 w-6 flex-shrink-0 transition-opacity",
              favorited ? "opacity-100" : "opacity-0 group-hover:opacity-70"
            )}
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(origin.id);
            }}
            title={favorited ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          >
            <Star 
              className={cn(
                "h-3 w-3",
                favorited 
                  ? "fill-yellow-400 text-yellow-400" 
                  : "text-muted-foreground"
              )}
            />
          </Button>
        )}
        
        {/* Botão principal com nome e badge */}
        <Button
          variant={selectedOriginId === origin.id ? "secondary" : "ghost"}
          className={cn(
            "flex-1 min-w-0 justify-between h-auto py-2 text-left overflow-hidden",
            selectedOriginId === origin.id && "bg-primary/10"
          )}
          onClick={() => onSelectOrigin(origin.id)}
        >
          <span className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
            <span className="truncate text-xs">{displayName}</span>
          </span>
          {dealCount > 0 && (
            <Badge variant="secondary" className="text-xs ml-1 flex-shrink-0">
              {dealCount}
            </Badge>
          )}
        </Button>
      </div>
    );
  };
  
  // Renderizar grupo colapsável
  const renderGroup = (group: Group) => {
    const displayName = group.display_name || group.name;
    const isExpanded = expandedGroups.has(group.id);
    const totalDeals = group.children.reduce((sum, c) => sum + (c.deal_count || 0), 0);
    const Icon = getGroupIcon(group.name);
    
    return (
      <Collapsible
        key={group.id}
        open={isExpanded}
        onOpenChange={() => toggleGroup(group.id)}
      >
        <div className="group flex items-center gap-1">
          {/* Menu de 3 pontos - PRIMEIRO (sempre visível à esquerda) */}
          <span onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
            <PipelineContextMenu
              targetType="group"
              targetId={group.id}
              targetName={displayName}
              onConfigure={() => setConfigTarget({ type: 'group', id: group.id, name: displayName })}
              onSelect={() => {
                setExpandedGroups(prev => new Set([...prev, group.id]));
              }}
            />
          </span>
          
          {/* Botão do grupo (CollapsibleTrigger) */}
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="flex-1 justify-between h-auto py-2 font-medium"
            >
              <span className="flex items-center gap-2 min-w-0 flex-1">
                <ChevronDown 
                  className={cn(
                    "h-3 w-3 transition-transform flex-shrink-0",
                    !isExpanded && "-rotate-90"
                  )}
                />
                <Icon className="h-3 w-3 flex-shrink-0" />
                <span className="truncate text-xs">{displayName}</span>
              </span>
              {totalDeals > 0 && (
                <Badge variant="outline" className="text-xs ml-1 flex-shrink-0">
                  {totalDeals}
                </Badge>
              )}
            </Button>
          </CollapsibleTrigger>
        </div>
        
        <CollapsibleContent className="space-y-1">
          {group.children.map(child => renderOriginItem(child, true))}
        </CollapsibleContent>
      </Collapsible>
    );
  };
  
  const renderMonogram = (item: { key: string; name: string; total: number; active: boolean; favorite?: boolean; onClick: () => void }) => (
    <Tooltip key={item.key}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={item.onClick}
          aria-label={item.name}
          className={cn(
            "relative flex h-9 w-9 items-center justify-center rounded-md text-xs font-semibold transition-colors",
            item.active
              ? "bg-primary/15 text-primary ring-1 ring-primary/40"
              : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          {getMonogram(item.name)}
          {item.favorite && (
            <Star className="h-2.5 w-2.5 absolute -top-0.5 -right-0.5 fill-yellow-400 text-yellow-400" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p className="font-medium">{item.name}</p>
        <p className="text-xs text-muted-foreground">
          {item.total.toLocaleString('pt-BR')} negócio{item.total !== 1 ? 's' : ''}
        </p>
      </TooltipContent>
    </Tooltip>
  );

  return (
    <div className={cn(
      "border-r bg-muted/10 flex flex-col h-full transition-all duration-300",
      isCollapsed ? "w-14" : "w-72"
    )}>
      {/* Header com toggle */}
      <div className="p-4 border-b flex items-center justify-between">
        {!isCollapsed && (
          <div className="flex items-center gap-1">
            <h3 className="font-semibold text-sm uppercase text-muted-foreground">
              Pipelines
            </h3>
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Criar pipeline"
                    onClick={() => setWizardOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Criar pipeline</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
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
      
      {/* Conteúdo expandido */}
      {!isCollapsed && (
        <>
          {/* Seletor de Pipeline - oculto quando hideFilters */}
          {!hideFilters && (
            <div className="p-3 border-b">
              <PipelineSelector
                selectedPipelineId={pipelineId || null}
                onSelectPipeline={onSelectPipeline}
                allowedGroupIds={allowedGroupIds}
              />
            </div>
          )}

          {/* Busca - oculta quando hideFilters */}
          {!hideFilters && (
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar origem..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
            </div>
          )}
          
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {/* Seção de favoritos */}
              {favoriteOrigins.length > 0 && !searchTerm && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-muted-foreground mb-2 px-2 flex items-center gap-1">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    Favoritos
                  </h4>
                  <div className="space-y-1">
                    {favoriteOrigins.map(origin => renderOriginItem(origin, false, true))}
                  </div>
                  <div className="border-b my-3" />
                </div>
              )}
              
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
      
      {/* Versão mini quando collapsed - monogramas dos mesmos itens do modo expandido */}
      {isCollapsed && (
        <ScrollArea className="flex-1">
          <TooltipProvider delayDuration={100}>
            <div className="flex flex-col items-center py-2 gap-1.5">
              {favoriteOrigins.length > 0 && (
                <>
                  {favoriteOrigins.map(origin => renderMonogram({
                    key: `fav-${origin.id}`,
                    name: origin.display_name || origin.name,
                    total: origin.deal_count || 0,
                    active: selectedOriginId === origin.id,
                    favorite: true,
                    onClick: () => onSelectOrigin(origin.id),
                  }))}
                  <div className="w-6 border-b my-1" />
                </>
              )}

              {isGroupedTree
                ? (dataToUse as Group[]).map(group => renderMonogram({
                    key: group.id,
                    name: group.display_name || group.name,
                    total: group.children.reduce((sum, c) => sum + (c.deal_count || 0), 0),
                    active: !!selectedOriginId && (group.id === selectedOriginId || group.children.some(c => c.id === selectedOriginId)),
                    onClick: () => {
                      setExpandedGroups(prev => new Set([...prev, group.id]));
                      setIsCollapsed(false);
                    },
                  }))
                : ((dataToUse as Origin[]) || []).map(origin => renderMonogram({
                    key: origin.id,
                    name: origin.display_name || origin.name,
                    total: origin.deal_count || 0,
                    active: selectedOriginId === origin.id,
                    onClick: () => onSelectOrigin(origin.id),
                  }))}
            </div>
          </TooltipProvider>
        </ScrollArea>
      )}

      {/* Modal de configurações */}
      {configTarget && (
        <PipelineConfigModal
          open={!!configTarget}
          onOpenChange={(open) => !open && setConfigTarget(null)}
          targetType={configTarget.type}
          targetId={configTarget.id}
        />
      )}

      {/* Wizard de criação de pipeline */}
      <CreatePipelineWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onSuccess={(result) => {
          if (result.originId) {
            onSelectOrigin(result.originId);
          }
        }}
      />
    </div>
  );
};
