import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface WhatsAppInstance {
  id: string;
  instance_id: string;
  token: string;
  client_token: string | null;
  name: string;
  status: string;
  phone_number: string | null;
  connected_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useWhatsAppInstance() {
  const [instance, setInstance] = useState<WhatsAppInstance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Fetch instance
  const fetchInstance = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setInstance(data);
    } catch (error) {
      console.error('Error fetching instance:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check status
  const checkStatus = useCallback(async () => {
    try {
      setIsConnecting(true);
      const { data, error } = await supabase.functions.invoke('zapi-status', {
        body: {},
      });

      if (error) throw error;

      if (data?.connected) {
        toast.success('WhatsApp conectado!');
        fetchInstance();
      }

      return data;
    } catch (error) {
      console.error('Error checking status:', error);
      toast.error('Erro ao verificar status');
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, [fetchInstance]);

  // Get QR Code
  const getQrCode = useCallback(async () => {
    try {
      setIsConnecting(true);
      const { data, error } = await supabase.functions.invoke('zapi-status?action=qrcode', {
        body: {},
      });

      if (error) throw error;

      if (data?.imageUrl) {
        setQrCode(data.imageUrl);
      } else if (data?.base64) {
        setQrCode(`data:image/png;base64,${data.base64}`);
      }

      return data;
    } catch (error) {
      console.error('Error getting QR code:', error);
      toast.error('Erro ao obter QR Code');
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // Disconnect
  const disconnect = useCallback(async () => {
    try {
      setIsConnecting(true);
      const { error } = await supabase.functions.invoke('zapi-status?action=disconnect', {
        body: {},
      });

      if (error) throw error;

      toast.success('WhatsApp desconectado');
      setInstance(prev => prev ? { ...prev, status: 'disconnected', connected_at: null } : null);
      setQrCode(null);
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast.error('Erro ao desconectar');
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // Restart
  const restart = useCallback(async () => {
    try {
      setIsConnecting(true);
      const { error } = await supabase.functions.invoke('zapi-status?action=restart', {
        body: {},
      });

      if (error) throw error;

      toast.success('Instância reiniciada');
      setTimeout(checkStatus, 3000);
    } catch (error) {
      console.error('Error restarting:', error);
      toast.error('Erro ao reiniciar');
    } finally {
      setIsConnecting(false);
    }
  }, [checkStatus]);

  // Initial fetch
  useEffect(() => {
    fetchInstance();
  }, [fetchInstance]);

  // Auto-check status periodically when connecting
  useEffect(() => {
    if (!qrCode) return;

    const interval = setInterval(async () => {
      const status = await checkStatus();
      if (status?.connected) {
        setQrCode(null);
        clearInterval(interval);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [qrCode, checkStatus]);

  return {
    instance,
    isLoading,
    isConnecting,
    qrCode,
    isConnected: instance?.status === 'connected',
    checkStatus,
    getQrCode,
    disconnect,
    restart,
    refetch: fetchInstance,
  };
}
