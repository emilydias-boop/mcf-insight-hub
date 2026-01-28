import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

type AppRole = 'admin' | 'manager' | 'viewer' | 'sdr' | 'closer' | 'coordenador' | 'closer_sombra' | 'financeiro' | 'rh';

// Prioridade de roles: menor número = maior prioridade
const ROLE_PRIORITY: Record<string, number> = {
  admin: 1,
  manager: 2,
  coordenador: 3,
  closer: 4,
  closer_sombra: 5,
  financeiro: 6,
  rh: 7,
  sdr: 8,
  viewer: 9,
};

interface AuthState {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  allRoles: AppRole[];
  loading: boolean;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (...roles: AppRole[]) => boolean;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [allRoles, setAllRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  
  // Anti-race: versão incremental para evitar respostas stale
  const roleLoadVersion = useRef(0);
  // Flag para evitar processamento duplo
  const initialSessionHandled = useRef(false);

  const fetchUserRoles = async (userId: string): Promise<{ primaryRole: AppRole | null; roles: AppRole[] }> => {
    // Buscar TODAS as roles do usuário (sem .single())
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching user roles:', error);
      return { primaryRole: null, roles: [] };
    }

    if (!data || data.length === 0) {
      return { primaryRole: null, roles: [] };
    }

    // Mapear todas as roles
    const roles = data.map(r => r.role as AppRole);
    
    // Ordenar por prioridade (menor = maior prioridade)
    const sortedRoles = [...roles].sort((a, b) => 
      (ROLE_PRIORITY[a] || 99) - (ROLE_PRIORITY[b] || 99)
    );
    
    // Role principal = maior prioridade
    return { primaryRole: sortedRoles[0], roles };
  };

  // Função unificada para processar sessão - evita corrida
  const handleSession = async (newSession: Session | null) => {
    // Incrementa versão para invalidar chamadas anteriores
    const myVersion = ++roleLoadVersion.current;
    
    if (!newSession?.user) {
      // Usuário deslogado
      setSession(null);
      setUser(null);
      setRole(null);
      setAllRoles([]);
      setLoading(false);
      return;
    }

    // Atualiza sessão e usuário imediatamente
    setSession(newSession);
    setUser(newSession.user);

    try {
      // Verificar status de acesso
      const { data: profile } = await supabase
        .from('profiles')
        .select('access_status, blocked_until')
        .eq('id', newSession.user.id)
        .single();

      // Verifica se ainda é a versão mais recente antes de continuar
      if (myVersion !== roleLoadVersion.current) {
        return; // Outra chamada mais recente já está processando
      }

      if (profile) {
        const isBlocked = profile.access_status === 'bloqueado' || 
                         profile.access_status === 'desativado' ||
                         (profile.blocked_until && new Date(profile.blocked_until) > new Date());
        
        if (isBlocked) {
          await supabase.auth.signOut();
          setUser(null);
          setSession(null);
          setRole(null);
          setAllRoles([]);
          setLoading(false);
          toast.error('Sua conta foi bloqueada ou desativada.');
          return;
        }
      }

      // Buscar roles
      const { primaryRole, roles } = await fetchUserRoles(newSession.user.id);
      
      // Verifica novamente se ainda é a versão mais recente
      if (myVersion !== roleLoadVersion.current) {
        return; // Outra chamada mais recente já está processando
      }

      // Aplica o estado com fallback para viewer se não houver roles
      if (roles.length === 0) {
        setRole('viewer');
        setAllRoles(['viewer']);
      } else {
        setRole(primaryRole);
        setAllRoles(roles);
      }
    } catch (error) {
      console.error('Error handling session:', error);
      // Em caso de erro, verifica versão e aplica fallback
      if (myVersion === roleLoadVersion.current) {
        setRole('viewer');
        setAllRoles(['viewer']);
      }
    } finally {
      // Só atualiza loading se ainda for a versão correta
      if (myVersion === roleLoadVersion.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    // Setup auth state listener - ÚNICA FONTE DE VERDADE
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        // Para INITIAL_SESSION, só processa se ainda não foi tratado
        if (event === 'INITIAL_SESSION') {
          if (initialSessionHandled.current) {
            return; // Já foi tratado pelo getSession
          }
          initialSessionHandled.current = true;
        }
        
        // Para outros eventos (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED),
        // sempre processa
        handleSession(newSession);
      }
    );

    // Busca sessão inicial - caso onAuthStateChange demore
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      // Só processa se INITIAL_SESSION ainda não foi tratado
      if (!initialSessionHandled.current) {
        initialSessionHandled.current = true;
        handleSession(existingSession);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      // Verificar access_status e blocked_until antes de permitir acesso
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('access_status, blocked_until')
        .eq('id', authData.user.id)
        .single();

      if (!profileError && profile) {
        // Verificar se conta está bloqueada
        if (profile.access_status === 'bloqueado') {
          await supabase.auth.signOut();
          throw new Error('Sua conta está bloqueada. Entre em contato com o administrador.');
        }
        
        // Verificar se conta está desativada
        if (profile.access_status === 'desativado') {
          await supabase.auth.signOut();
          throw new Error('Sua conta foi desativada.');
        }
        
        // Verificar bloqueio temporário
        if (profile.blocked_until && new Date(profile.blocked_until) > new Date()) {
          await supabase.auth.signOut();
          const blockedDate = new Date(profile.blocked_until).toLocaleString('pt-BR');
          throw new Error(`Sua conta está temporariamente bloqueada até ${blockedDate}.`);
        }
      }

      // Atualizar last_login_at
      await supabase
        .from('profiles')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', authData.user.id);
      
      // Buscar role do usuário para redirect condicional
      const { primaryRole: userRole, roles } = await fetchUserRoles(authData.user.id);
      setAllRoles(roles.length > 0 ? roles : ['viewer']);
      
      toast.success('Login realizado com sucesso!');
      
      // SDR redireciona para Minhas Reuniões
      if (userRole === 'sdr') {
        navigate('/sdr/minhas-reunioes');
      } else {
        navigate('/');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao fazer login');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    setLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) throw error;
      
      toast.success('Conta criada com sucesso! Verifique seu email para confirmar.');
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar conta');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      // Ignora erro de sessão não encontrada - significa que já está deslogado
      if (error && !error.message.includes('session missing') && 
          !error.message.includes('session_not_found')) {
        console.warn('Logout warning:', error.message);
      }
    } catch (error: any) {
      console.warn('Logout error (ignored):', error.message);
    } finally {
      // SEMPRE limpa estado local e redireciona
      setUser(null);
      setSession(null);
      setRole(null);
      setAllRoles([]);
      toast.success('Logout realizado com sucesso!');
      navigate('/auth');
    }
  };

  const hasRole = (requiredRole: AppRole): boolean => {
    // Verificar em TODAS as roles do usuário
    if (allRoles.length === 0) return false;
    
    // Admin has access to everything
    if (allRoles.includes('admin')) return true;
    
    // Manager can access viewer permissions too
    if (allRoles.includes('manager') && requiredRole === 'viewer') return true;
    
    // Verificar se o usuário tem a role requerida em qualquer uma das suas roles
    return allRoles.includes(requiredRole);
  };

  const hasAnyRole = (...roles: AppRole[]): boolean => {
    if (allRoles.length === 0) return false;
    if (allRoles.includes('admin')) return true;
    return roles.some(r => allRoles.includes(r));
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      
      if (error) throw error;
      
      toast.success('Email de recuperação enviado! Verifique sua caixa de entrada.');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar email de recuperação');
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        allRoles,
        loading,
        signIn,
        signUp,
        signOut,
        hasRole,
        hasAnyRole,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
