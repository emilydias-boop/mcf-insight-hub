import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

type AppRole = 'admin' | 'manager' | 'viewer' | 'sdr' | 'closer' | 'coordenador';

interface AuthState {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchUserRole = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching user role:', error);
      return null;
    }

    return data?.role as AppRole || null;
  };

  useEffect(() => {
    // Setup auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Defer role fetching and access validation with setTimeout to avoid deadlock
          setTimeout(async () => {
            // Verificar status de acesso para sessões existentes
            const { data: profile } = await supabase
              .from('profiles')
              .select('access_status, blocked_until')
              .eq('id', session.user.id)
              .single();

            if (profile) {
              const isBlocked = profile.access_status === 'bloqueado' || 
                                profile.access_status === 'desativado' ||
                                (profile.blocked_until && new Date(profile.blocked_until) > new Date());
              
              if (isBlocked) {
                await supabase.auth.signOut();
                setUser(null);
                setSession(null);
                setRole(null);
                setLoading(false);
                toast.error('Sua conta foi bloqueada ou desativada.');
                return;
              }
            }

            fetchUserRole(session.user.id).then(role => {
              setRole(role);
              setLoading(false);
            });
          }, 0);
        } else {
          setRole(null);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserRole(session.user.id).then(role => {
          setRole(role);
          setLoading(false);
        });
      } else {
        setLoading(false);
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
      
      toast.success('Login realizado com sucesso!');
      navigate('/');
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
      toast.success('Logout realizado com sucesso!');
      navigate('/auth');
    }
  };

  const hasRole = (requiredRole: AppRole): boolean => {
    if (!role) return false;
    
    // Admin has access to everything
    if (role === 'admin') return true;
    
    // Manager can access viewer permissions too
    if (role === 'manager' && requiredRole === 'viewer') return true;
    
    return role === requiredRole;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        loading,
        signIn,
        signUp,
        signOut,
        hasRole,
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
