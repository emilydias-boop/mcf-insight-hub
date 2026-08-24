import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWaConversations, useUpdateWaConversation, useWaResponsaveis, WaConversation, WaScope } from '@/hooks/wa/useWaConversations';
import { useWaMessages, WaSendError } from '@/hooks/wa/useWaMessages';
import { useWaNotificacoes } from '@/hooks/wa/useWaNotificacoes';
import { ConversationList } from '@/components/checkin/ConversationList';
import { ConversationThread } from '@/components/checkin/ConversationThread';
import { MessageComposer } from '@/components/checkin/MessageComposer';
import { ContactPanel } from '@/components/checkin/ContactPanel';
import { NovaConversaDialog } from '@/components/checkin/NovaConversaDialog';
import { useNow } from '@/hooks/wa/useNow';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ArrowLeft, Megaphone, MessageSquarePlus, User } from 'lucide-react';

import { toast } from 'sonner';

export default function CheckinInbox() {
  const { hasAnyRole } = useAuth();
  const canSeeAll = hasAnyRole('admin', 'manager');

  const [scope, setScope] = useState<WaScope>('mine');
  /** Filtro por responsável, só usado no escopo "Todas". */
  const [responsavelId, setResponsavelId] = useState<string | null>(null);
  const { data: responsaveis = [] } = useWaResponsaveis();
  const [novaConversaAberto, setNovaConversaAberto] = useState(false);
  const { data: conversations = [], isLoading, isFetching, refetch } = useWaConversations(
    scope,
    scope === 'all' ? responsavelId : null,
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchParams, setSearchParams] = useSearchParams();
  /** Conversa pedida por deep link (?conversa=), ex. vinda de um disparo. */
  const [alvoDeepLink, setAlvoDeepLink] = useState<string | null>(
    () => searchParams.get('conversa'),
  );

  /**
   * Conta quantas vezes o efeito do deep link já avaliou o alvo atual sem
   * encontrar a conversa. A invalidação do react-query é assíncrona, então
   * pode haver uma janela em que o refetch ainda nem começou e o efeito roda
   * com dados velhos. Zera sempre que o alvo muda.
   */
  const tentativasDeepLink = useRef(0);
  useEffect(() => {
    tentativasDeepLink.current = 0;
  }, [alvoDeepLink]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return conversations.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (!term) return true;
      return (
        c.contact_name?.toLowerCase().includes(term) ||
        c.phone_e164?.toLowerCase().includes(term)
      );
    });
  }, [conversations, search, statusFilter]);

  // Sem seleção automática: ao abrir o inbox nenhuma conversa fica selecionada,
  // como no WhatsApp Web. Assim o badge de não lidas sobrevive até alguém clicar.
  // Quando a conversa selecionada sai da lista por filtro, apenas desselecionar.
  useEffect(() => {
    if (alvoDeepLink) return; // o deep link decide a seleção até ser resolvido
    if (selectedId && !filtered.some((c) => c.id === selectedId)) {
      setSelectedId(null);
    }
  }, [filtered, selectedId, alvoDeepLink]);

  /**
   * Resolve o ?conversa=: se a conversa não aparece na lista atual, ajusta o
   * escopo e limpa filtros até conseguir mostrá-la. Cair na conversa errada é
   * pior que não navegar.
   *
   * Enquanto há busca em andamento (isLoading ou isFetching) não concluímos que
   * a conversa não existe — o cache pode estar velho e o refetch pode trazer
   * a conversa recém-criada. Só declaramos "não disponível" após a segunda
   * avaliação com dados em paz, para cobrir a janela em que a invalidação
   * assíncrona ainda não disparou o refetch.
   */
  useEffect(() => {
    if (!alvoDeepLink || isLoading || isFetching) return;

    const naLista = conversations.some((c) => c.id === alvoDeepLink);
    if (!naLista) {
      // O filtro por responsável pode estar escondendo a conversa do deep link.
      if (responsavelId) {
        setResponsavelId(null);
        return;
      }
      // A troca automática para escopo "all" tem prioridade sobre o retry.
      if (scope !== 'all' && canSeeAll) {
        setScope('all');
        return;
      }

      // Sem permissão de ver tudo: dá uma segunda chance (refetch) antes de
      // desistir — cobre a janela entre a invalidação assíncrona e o refetch.
      if (tentativasDeepLink.current === 0) {
        tentativasDeepLink.current += 1;
        refetch();
        return;
      }
      toast.error('Não foi possível abrir essa conversa — ela não está disponível para você.');
      setAlvoDeepLink(null);
      searchParams.delete('conversa');
      setSearchParams(searchParams, { replace: true });
      return;
    }

    if (!filtered.some((c) => c.id === alvoDeepLink)) {
      // está no escopo, mas escondida pelos filtros da lista
      if (statusFilter !== 'all') setStatusFilter('all');
      if (search) setSearch('');
      return;
    }

    tentativasDeepLink.current = 0;
    setSelectedId(alvoDeepLink);
    setAlvoDeepLink(null);
    searchParams.delete('conversa');
    setSearchParams(searchParams, { replace: true });
  }, [
    alvoDeepLink,
    isLoading,
    isFetching,
    conversations,
    filtered,
    scope,
    canSeeAll,
    statusFilter,
    search,
    searchParams,
    setSearchParams,
    refetch,
  ]);

  const selected = filtered.find((c) => c.id === selectedId) ?? null;

  // Avisos de mensagem recebida: bipe, notificação do navegador e contador na aba.
  useWaNotificacoes({
    conversas: conversations,
    conversaSelecionadaId: selectedId,
    onAbrirConversa: (id) => setAlvoDeepLink(id),
  });

  return (
    // overflow-x-hidden é rede de segurança: nada aqui dentro empurra a página
    // para fora da viewport, mesmo com zoom do navegador acima de 100%.
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-3 overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">MCF - Atendimento</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => setNovaConversaAberto(true)}>
            <MessageSquarePlus className="mr-2 h-4 w-4" /> Nova conversa
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/checkin/disparos">
              <Megaphone className="mr-2 h-4 w-4" /> Disparos por template
            </Link>
          </Button>
        </div>
      </div>

      <NovaConversaDialog
        open={novaConversaAberto}
        onOpenChange={setNovaConversaAberto}
        onCreated={(id) => setAlvoDeepLink(id)}
      />

      <div className="flex min-h-0 min-w-0 flex-1 gap-3">
        {/* Abaixo de md alternamos lista x conversa: só cabe uma coluna. */}
        <ConversationList
          className={selected ? 'hidden md:flex' : 'flex'}
          conversations={filtered}
          isLoading={isLoading}
          selectedId={selectedId}
          onSelect={setSelectedId}
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          scope={scope}
          onScopeChange={setScope}
          canSeeAll={canSeeAll}
        />

        {/* min-h-0 é obrigatório: sem ele este wrapper flex cresce com o conteúdo
            do painel lateral e a rolagem interna do ContactPanel nunca ativa. */}
        <div
          className={`min-h-0 min-w-0 flex-1 gap-3 ${selected ? 'flex' : 'hidden md:flex'}`}
        >
          {selected ? (
            <>
              <ConversationPane
                conversation={selected}
                onVoltar={() => setSelectedId(null)}
              />
              <ContactPanel conversation={selected} />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Selecione uma conversa para começar
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


function ConversationPane({
  conversation,
  onVoltar,
}: {
  conversation: WaConversation;
  onVoltar: () => void;
}) {
  const [painelContatoAberto, setPainelContatoAberto] = useState(false);

  const { data: messages = [], sendMessage, sendMedia, markRead } = useWaMessages(conversation.id);
  const updateConversation = useUpdateWaConversation();
  const [forceTemplateMode, setForceTemplateMode] = useState(false);
  const now = useNow(60_000);

  useEffect(() => {
    // Só marca como lida se a aba estiver visível — se o SDR trocou de aba com a
    // conversa aberta, a mensagem recebida precisa sobreviver até ele voltar.
    if (document.visibilityState === 'visible') markRead.mutate();
    setForceTemplateMode(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  const handleSendFree = async (body: string): Promise<boolean> => {
    try {
      await sendMessage.mutateAsync({ body });
      return true;
    } catch (err) {
      if (err instanceof WaSendError && err.code === 'janela_fechada') {
        setForceTemplateMode(true);
      }
      return false;
    }
  };

  const handleSendTemplate = async (
    template_sid: string,
    template_variables: Record<string, string>,
  ): Promise<boolean> => {
    try {
      await sendMessage.mutateAsync({ template_sid, template_variables });
      setForceTemplateMode(false);
      return true;
    } catch {
      return false;
    }
  };

  const handleSendMedia = async (input: {
    file: File | Blob;
    filename?: string;
    mediaType?: string;
    caption?: string;
    durationSeconds?: number;
  }): Promise<boolean> => {
    try {
      await sendMedia.mutateAsync(input);
      return true;
    } catch (err) {
      if (err instanceof WaSendError && err.code === 'janela_fechada') {
        setForceTemplateMode(true);
      }
      return false;
    }
  };

  return (
    <ConversationThread
      conversation={conversation}
      messages={messages}
      now={now}
      onStatusChange={(status) =>
        updateConversation.mutate({ id: conversation.id, patch: { status } })
      }
      acaoVoltar={
        // Só em tela pequena, onde a lista dá lugar à conversa.
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 md:hidden"
          onClick={onVoltar}
          aria-label="Voltar para a lista de conversas"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      }
      acoesCabecalho={
        // Abaixo de xl o painel do contato sai do fluxo; aqui está o acesso a ele.
        <Sheet open={painelContatoAberto} onOpenChange={setPainelContatoAberto}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0 xl:hidden"
              aria-label="Abrir painel do contato"
            >
              <User className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="flex w-full flex-col gap-3 sm:max-w-md"
          >
            <SheetHeader>
              <SheetTitle>Dados do contato</SheetTitle>
            </SheetHeader>
            <ContactPanel conversation={conversation} variante="painel" />
          </SheetContent>
        </Sheet>
      }
    >

      <MessageComposer
        conversation={conversation}
        now={now}
        sending={sendMessage.isPending || sendMedia.isPending}
        forceTemplateMode={forceTemplateMode}
        onSendFree={handleSendFree}
        onSendTemplate={handleSendTemplate}
        onSendMedia={handleSendMedia}
      />
    </ConversationThread>
  );
}