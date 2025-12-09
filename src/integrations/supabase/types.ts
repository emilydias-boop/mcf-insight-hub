export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      a010_sales: {
        Row: {
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          id: string
          net_value: number
          sale_date: string
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          id?: string
          net_value?: number
          sale_date: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          id?: string
          net_value?: number
          sale_date?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      alert_rules: {
        Row: {
          alert_level: Database["public"]["Enums"]["alert_level"]
          condition: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          alert_level: Database["public"]["Enums"]["alert_level"]
          condition: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          alert_level?: Database["public"]["Enums"]["alert_level"]
          condition?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      alertas: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          lido: boolean
          metadata: Json | null
          resolvido: boolean
          tipo: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          lido?: boolean
          metadata?: Json | null
          resolvido?: boolean
          tipo: string
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          lido?: boolean
          metadata?: Json | null
          resolvido?: boolean
          tipo?: string
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      alerts: {
        Row: {
          created_at: string | null
          description: string
          id: string
          is_resolved: boolean | null
          level: Database["public"]["Enums"]["alert_level"]
          resolved_at: string | null
          resolved_by: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          is_resolved?: boolean | null
          level: Database["public"]["Enums"]["alert_level"]
          resolved_at?: string | null
          resolved_by?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          is_resolved?: boolean | null
          level?: Database["public"]["Enums"]["alert_level"]
          resolved_at?: string | null
          resolved_by?: string | null
          title?: string
        }
        Relationships: []
      }
      auction_bids: {
        Row: {
          auction_id: string
          bid_amount: number
          bidder_name: string
          created_at: string | null
          id: string
        }
        Insert: {
          auction_id: string
          bid_amount: number
          bidder_name: string
          created_at?: string | null
          id?: string
        }
        Update: {
          auction_id?: string
          bid_amount?: number
          bidder_name?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auction_bids_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      auctions: {
        Row: {
          address: string
          created_at: string | null
          created_by: string | null
          current_bid: number | null
          end_date: string
          id: string
          image_url: string | null
          initial_value: number
          property_name: string
          start_date: string
          status: Database["public"]["Enums"]["auction_status"] | null
          updated_at: string | null
        }
        Insert: {
          address: string
          created_at?: string | null
          created_by?: string | null
          current_bid?: number | null
          end_date: string
          id?: string
          image_url?: string | null
          initial_value: number
          property_name: string
          start_date: string
          status?: Database["public"]["Enums"]["auction_status"] | null
          updated_at?: string | null
        }
        Update: {
          address?: string
          created_at?: string | null
          created_by?: string | null
          current_bid?: number | null
          end_date?: string
          id?: string
          image_url?: string | null
          initial_value?: number
          property_name?: string
          start_date?: string
          status?: Database["public"]["Enums"]["auction_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: unknown
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          type: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          type?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          type?: string | null
        }
        Relationships: []
      }
      channels: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      closer_commissions: {
        Row: {
          closer_name: string
          commission_rate: number
          created_at: string | null
          fixed_salary: number | null
          id: string
          lead_type: string
          level: number
          quantity_leads: number | null
          updated_at: string | null
        }
        Insert: {
          closer_name: string
          commission_rate: number
          created_at?: string | null
          fixed_salary?: number | null
          id?: string
          lead_type: string
          level: number
          quantity_leads?: number | null
          updated_at?: string | null
        }
        Update: {
          closer_name?: string
          commission_rate?: number
          created_at?: string | null
          fixed_salary?: number | null
          id?: string
          lead_type?: string
          level?: number
          quantity_leads?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      consortium_payments: {
        Row: {
          consorciado: string
          contrato: string | null
          created_at: string | null
          data_interface: string | null
          id: string
          parcela: number | null
          status: string | null
          updated_at: string | null
          valor_comissao: number | null
        }
        Insert: {
          consorciado: string
          contrato?: string | null
          created_at?: string | null
          data_interface?: string | null
          id?: string
          parcela?: number | null
          status?: string | null
          updated_at?: string | null
          valor_comissao?: number | null
        }
        Update: {
          consorciado?: string
          contrato?: string | null
          created_at?: string | null
          data_interface?: string | null
          id?: string
          parcela?: number | null
          status?: string | null
          updated_at?: string | null
          valor_comissao?: number | null
        }
        Relationships: []
      }
      credit_clients: {
        Row: {
          cpf: string
          created_at: string | null
          credit_score: number | null
          email: string | null
          full_name: string
          id: string
          phone: string | null
          status: string | null
          total_credit: number | null
          total_debt: number | null
          updated_at: string | null
        }
        Insert: {
          cpf: string
          created_at?: string | null
          credit_score?: number | null
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          status?: string | null
          total_credit?: number | null
          total_debt?: number | null
          updated_at?: string | null
        }
        Update: {
          cpf?: string
          created_at?: string | null
          credit_score?: number | null
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          status?: string | null
          total_credit?: number | null
          total_debt?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      credit_history: {
        Row: {
          amount: number
          client_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          type: string | null
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          type?: string | null
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "credit_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contacts: {
        Row: {
          clint_id: string
          created_at: string | null
          custom_fields: Json | null
          email: string | null
          id: string
          name: string
          organization_name: string | null
          origin_id: string | null
          phone: string | null
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          clint_id: string
          created_at?: string | null
          custom_fields?: Json | null
          email?: string | null
          id?: string
          name: string
          organization_name?: string | null
          origin_id?: string | null
          phone?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          clint_id?: string
          created_at?: string | null
          custom_fields?: Json | null
          email?: string | null
          id?: string
          name?: string
          organization_name?: string | null
          origin_id?: string | null
          phone?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_contacts_origin_id_fkey"
            columns: ["origin_id"]
            isOneToOne: false
            referencedRelation: "crm_origins"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deals: {
        Row: {
          clint_id: string
          contact_id: string | null
          created_at: string | null
          custom_fields: Json | null
          data_source: string | null
          expected_close_date: string | null
          id: string
          name: string
          origin_id: string | null
          owner_id: string | null
          probability: number | null
          stage_id: string | null
          tags: string[] | null
          updated_at: string | null
          value: number | null
        }
        Insert: {
          clint_id: string
          contact_id?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          data_source?: string | null
          expected_close_date?: string | null
          id?: string
          name: string
          origin_id?: string | null
          owner_id?: string | null
          probability?: number | null
          stage_id?: string | null
          tags?: string[] | null
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          clint_id?: string
          contact_id?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          data_source?: string | null
          expected_close_date?: string | null
          id?: string
          name?: string
          origin_id?: string | null
          owner_id?: string | null
          probability?: number | null
          stage_id?: string | null
          tags?: string[] | null
          updated_at?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_origin_id_fkey"
            columns: ["origin_id"]
            isOneToOne: false
            referencedRelation: "crm_origins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_groups: {
        Row: {
          clint_id: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          clint_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          clint_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      crm_origins: {
        Row: {
          clint_id: string
          contact_count: number | null
          created_at: string | null
          description: string | null
          group_id: string | null
          id: string
          name: string
          parent_id: string | null
          updated_at: string | null
        }
        Insert: {
          clint_id: string
          contact_count?: number | null
          created_at?: string | null
          description?: string | null
          group_id?: string | null
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string | null
        }
        Update: {
          clint_id?: string
          contact_count?: number | null
          created_at?: string | null
          description?: string | null
          group_id?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_origins_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "crm_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_origins_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "crm_origins"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_stages: {
        Row: {
          clint_id: string
          color: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          origin_id: string | null
          stage_name: string
          stage_order: number
          updated_at: string | null
        }
        Insert: {
          clint_id: string
          color?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          origin_id?: string | null
          stage_name: string
          stage_order: number
          updated_at?: string | null
        }
        Update: {
          clint_id?: string
          color?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          origin_id?: string | null
          stage_name?: string
          stage_order?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_stages_origin_id_fkey"
            columns: ["origin_id"]
            isOneToOne: false
            referencedRelation: "crm_origins"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_costs: {
        Row: {
          amount: number
          campaign_name: string | null
          cost_type: string
          created_at: string | null
          date: string
          id: string
          metadata: Json | null
          source: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number
          campaign_name?: string | null
          cost_type?: string
          created_at?: string | null
          date: string
          id?: string
          metadata?: Json | null
          source?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          campaign_name?: string | null
          cost_type?: string
          created_at?: string | null
          date?: string
          id?: string
          metadata?: Json | null
          source?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      dashboard_preferences: {
        Row: {
          auto_refresh: boolean
          created_at: string
          default_canal: string
          default_period: string
          id: string
          refresh_interval: number
          updated_at: string
          user_id: string
          visible_widgets: string[]
          widgets_order: string[]
        }
        Insert: {
          auto_refresh?: boolean
          created_at?: string
          default_canal?: string
          default_period?: string
          id?: string
          refresh_interval?: number
          updated_at?: string
          user_id: string
          visible_widgets?: string[]
          widgets_order?: string[]
        }
        Update: {
          auto_refresh?: boolean
          created_at?: string
          default_canal?: string
          default_period?: string
          id?: string
          refresh_interval?: number
          updated_at?: string
          user_id?: string
          visible_widgets?: string[]
          widgets_order?: string[]
        }
        Relationships: []
      }
      deal_activities: {
        Row: {
          activity_type: string
          created_at: string | null
          deal_id: string
          description: string | null
          from_stage: string | null
          id: string
          metadata: Json | null
          to_stage: string | null
          user_id: string | null
        }
        Insert: {
          activity_type: string
          created_at?: string | null
          deal_id: string
          description?: string | null
          from_stage?: string | null
          id?: string
          metadata?: Json | null
          to_stage?: string | null
          user_id?: string | null
        }
        Update: {
          activity_type?: string
          created_at?: string | null
          deal_id?: string
          description?: string | null
          from_stage?: string | null
          id?: string
          metadata?: Json | null
          to_stage?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      deal_stages: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          stage_id: string
          stage_name: string
          stage_order: number
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          stage_id: string
          stage_name: string
          stage_order: number
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          stage_id?: string
          stage_name?: string
          stage_order?: number
        }
        Relationships: []
      }
      funnel_data: {
        Row: {
          conversion_rate: number | null
          created_at: string | null
          date: string
          id: string
          leads_count: number
          stage_id: string
          updated_at: string | null
        }
        Insert: {
          conversion_rate?: number | null
          created_at?: string | null
          date: string
          id?: string
          leads_count?: number
          stage_id: string
          updated_at?: string | null
        }
        Update: {
          conversion_rate?: number | null
          created_at?: string | null
          date?: string
          id?: string
          leads_count?: number
          stage_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funnel_data_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_stages: {
        Row: {
          created_at: string | null
          funnel_id: string
          id: string
          name: string
          stage_number: number
          target_conversion_rate: number | null
        }
        Insert: {
          created_at?: string | null
          funnel_id: string
          id?: string
          name: string
          stage_number: number
          target_conversion_rate?: number | null
        }
        Update: {
          created_at?: string | null
          funnel_id?: string
          id?: string
          name?: string
          stage_number?: number
          target_conversion_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "funnel_stages_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
        ]
      }
      funnels: {
        Row: {
          channel_id: string | null
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          channel_id?: string | null
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          channel_id?: string | null
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnels_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      hubla_transactions: {
        Row: {
          created_at: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          event_type: string
          hubla_id: string
          id: string
          installment_fee_cents: number | null
          installment_number: number | null
          is_offer: boolean | null
          net_value: number | null
          payment_method: string | null
          product_category: string | null
          product_code: string | null
          product_name: string
          product_price: number | null
          product_type: string | null
          raw_data: Json | null
          sale_date: string
          sale_status: string | null
          source: string | null
          subtotal_cents: number | null
          total_installments: number | null
          updated_at: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          event_type: string
          hubla_id: string
          id?: string
          installment_fee_cents?: number | null
          installment_number?: number | null
          is_offer?: boolean | null
          net_value?: number | null
          payment_method?: string | null
          product_category?: string | null
          product_code?: string | null
          product_name: string
          product_price?: number | null
          product_type?: string | null
          raw_data?: Json | null
          sale_date: string
          sale_status?: string | null
          source?: string | null
          subtotal_cents?: number | null
          total_installments?: number | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          event_type?: string
          hubla_id?: string
          id?: string
          installment_fee_cents?: number | null
          installment_number?: number | null
          is_offer?: boolean | null
          net_value?: number | null
          payment_method?: string | null
          product_category?: string | null
          product_code?: string | null
          product_name?: string
          product_price?: number | null
          product_type?: string | null
          raw_data?: Json | null
          sale_date?: string
          sale_status?: string | null
          source?: string | null
          subtotal_cents?: number | null
          total_installments?: number | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
      hubla_webhook_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_data: Json
          event_type: string
          id: string
          processed_at: string | null
          processing_time_ms: number | null
          status: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_data: Json
          event_type: string
          id?: string
          processed_at?: string | null
          processing_time_ms?: number | null
          status?: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_data?: Json
          event_type?: string
          id?: string
          processed_at?: string | null
          processing_time_ms?: number | null
          status?: string
        }
        Relationships: []
      }
      incorporator_goals: {
        Row: {
          created_at: string | null
          efeito_alavanca: number | null
          id: string
          meta: number | null
          month: string
          resultado: number | null
          supermeta: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          efeito_alavanca?: number | null
          id?: string
          meta?: number | null
          month: string
          resultado?: number | null
          supermeta?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          efeito_alavanca?: number | null
          id?: string
          meta?: number | null
          month?: string
          resultado?: number | null
          supermeta?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      integrations: {
        Row: {
          config: Json | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          last_sync: string | null
          name: string
          type: string
          updated_at: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          last_sync?: string | null
          name: string
          type: string
          updated_at?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          last_sync?: string | null
          name?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      lead_assignments: {
        Row: {
          assigned_date: string
          created_at: string | null
          id: string
          lead_id: string | null
          sdr_name: string
        }
        Insert: {
          assigned_date: string
          created_at?: string | null
          id?: string
          lead_id?: string | null
          sdr_name: string
        }
        Update: {
          assigned_date?: string
          created_at?: string | null
          id?: string
          lead_id?: string | null
          sdr_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_assignments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tracking: {
        Row: {
          closer: string | null
          created_at: string | null
          dias_compra: number | null
          id: string
          lead_id: string | null
          perfil: string | null
          produto_final: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          closer?: string | null
          created_at?: string | null
          dias_compra?: number | null
          id?: string
          lead_id?: string | null
          perfil?: string | null
          produto_final?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          closer?: string | null
          created_at?: string | null
          dias_compra?: number | null
          id?: string
          lead_id?: string | null
          perfil?: string | null
          produto_final?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_tracking_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          lead_date: string
          name: string
          origin: string | null
          phone: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          lead_date: string
          name: string
          origin?: string | null
          phone?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          lead_date?: string
          name?: string
          origin?: string | null
          phone?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      operational_costs: {
        Row: {
          amount: number
          cost_type: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_recurring: boolean | null
          month: string
          updated_at: string | null
        }
        Insert: {
          amount?: number
          cost_type: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_recurring?: boolean | null
          month: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          cost_type?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_recurring?: boolean | null
          month?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      playbook_docs: {
        Row: {
          ativo: boolean
          categoria: Database["public"]["Enums"]["playbook_categoria"]
          conteudo_rico: string | null
          created_at: string
          criado_por: string | null
          data_publicacao: string
          descricao: string | null
          id: string
          link_url: string | null
          obrigatorio: boolean
          role: Database["public"]["Enums"]["playbook_role"]
          storage_path: string | null
          storage_url: string | null
          tipo_conteudo: Database["public"]["Enums"]["playbook_tipo_conteudo"]
          titulo: string
          updated_at: string
          versao: string
        }
        Insert: {
          ativo?: boolean
          categoria?: Database["public"]["Enums"]["playbook_categoria"]
          conteudo_rico?: string | null
          created_at?: string
          criado_por?: string | null
          data_publicacao?: string
          descricao?: string | null
          id?: string
          link_url?: string | null
          obrigatorio?: boolean
          role: Database["public"]["Enums"]["playbook_role"]
          storage_path?: string | null
          storage_url?: string | null
          tipo_conteudo: Database["public"]["Enums"]["playbook_tipo_conteudo"]
          titulo: string
          updated_at?: string
          versao?: string
        }
        Update: {
          ativo?: boolean
          categoria?: Database["public"]["Enums"]["playbook_categoria"]
          conteudo_rico?: string | null
          created_at?: string
          criado_por?: string | null
          data_publicacao?: string
          descricao?: string | null
          id?: string
          link_url?: string | null
          obrigatorio?: boolean
          role?: Database["public"]["Enums"]["playbook_role"]
          storage_path?: string | null
          storage_url?: string | null
          tipo_conteudo?: Database["public"]["Enums"]["playbook_tipo_conteudo"]
          titulo?: string
          updated_at?: string
          versao?: string
        }
        Relationships: []
      }
      playbook_reads: {
        Row: {
          confirmado_em: string | null
          created_at: string
          id: string
          lido_em: string | null
          notion_page_id: string | null
          playbook_doc_id: string
          status: Database["public"]["Enums"]["playbook_read_status"]
          ultima_acao_em: string
          updated_at: string
          user_id: string
          visualizacoes_qtd: number
        }
        Insert: {
          confirmado_em?: string | null
          created_at?: string
          id?: string
          lido_em?: string | null
          notion_page_id?: string | null
          playbook_doc_id: string
          status?: Database["public"]["Enums"]["playbook_read_status"]
          ultima_acao_em?: string
          updated_at?: string
          user_id: string
          visualizacoes_qtd?: number
        }
        Update: {
          confirmado_em?: string | null
          created_at?: string
          id?: string
          lido_em?: string | null
          notion_page_id?: string | null
          playbook_doc_id?: string
          status?: Database["public"]["Enums"]["playbook_read_status"]
          ultima_acao_em?: string
          updated_at?: string
          user_id?: string
          visualizacoes_qtd?: number
        }
        Relationships: [
          {
            foreignKeyName: "playbook_reads_playbook_doc_id_fkey"
            columns: ["playbook_doc_id"]
            isOneToOne: false
            referencedRelation: "playbook_docs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      project_comments: {
        Row: {
          comment: string
          created_at: string | null
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string | null
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string | null
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          name: string
          progress: number | null
          responsible_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          progress?: number | null
          responsible_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          progress?: number | null
          responsible_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string | null
          created_by: string | null
          data: Json | null
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          data?: Json | null
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          type: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          data?: Json | null
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          type?: string
        }
        Relationships: []
      }
      sdr: {
        Row: {
          active: boolean | null
          aprovado_em: string | null
          aprovado_por: string | null
          created_at: string | null
          criado_por: string | null
          email: string | null
          id: string
          meta_diaria: number | null
          name: string
          nivel: number | null
          observacao: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string | null
          criado_por?: string | null
          email?: string | null
          id?: string
          meta_diaria?: number | null
          name: string
          nivel?: number | null
          observacao?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string | null
          criado_por?: string | null
          email?: string | null
          id?: string
          meta_diaria?: number | null
          name?: string
          nivel?: number | null
          observacao?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      sdr_comp_plan: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          created_at: string | null
          criado_por: string | null
          dias_uteis: number | null
          fixo_valor: number
          id: string
          ifood_mensal: number | null
          ifood_ultrameta: number | null
          meta_no_show_pct: number | null
          meta_organizacao: number | null
          meta_reunioes_agendadas: number | null
          meta_reunioes_realizadas: number | null
          meta_tentativas: number | null
          ote_total: number
          sdr_id: string
          status: string | null
          updated_at: string | null
          valor_docs_reuniao: number
          valor_meta_rpg: number
          valor_organizacao: number
          valor_tentativas: number
          variavel_total: number
          vigencia_fim: string | null
          vigencia_inicio: string
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string | null
          criado_por?: string | null
          dias_uteis?: number | null
          fixo_valor?: number
          id?: string
          ifood_mensal?: number | null
          ifood_ultrameta?: number | null
          meta_no_show_pct?: number | null
          meta_organizacao?: number | null
          meta_reunioes_agendadas?: number | null
          meta_reunioes_realizadas?: number | null
          meta_tentativas?: number | null
          ote_total?: number
          sdr_id: string
          status?: string | null
          updated_at?: string | null
          valor_docs_reuniao?: number
          valor_meta_rpg?: number
          valor_organizacao?: number
          valor_tentativas?: number
          variavel_total?: number
          vigencia_fim?: string | null
          vigencia_inicio: string
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string | null
          criado_por?: string | null
          dias_uteis?: number | null
          fixo_valor?: number
          id?: string
          ifood_mensal?: number | null
          ifood_ultrameta?: number | null
          meta_no_show_pct?: number | null
          meta_organizacao?: number | null
          meta_reunioes_agendadas?: number | null
          meta_reunioes_realizadas?: number | null
          meta_tentativas?: number | null
          ote_total?: number
          sdr_id?: string
          status?: string | null
          updated_at?: string | null
          valor_docs_reuniao?: number
          valor_meta_rpg?: number
          valor_organizacao?: number
          valor_tentativas?: number
          variavel_total?: number
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Relationships: [
          {
            foreignKeyName: "sdr_comp_plan_sdr_id_fkey"
            columns: ["sdr_id"]
            isOneToOne: false
            referencedRelation: "sdr"
            referencedColumns: ["id"]
          },
        ]
      }
      sdr_intermediacoes: {
        Row: {
          ano_mes: string
          created_at: string | null
          created_by: string | null
          hubla_transaction_id: string | null
          id: string
          observacao: string | null
          produto_nome: string | null
          sdr_id: string
          valor_venda: number | null
        }
        Insert: {
          ano_mes: string
          created_at?: string | null
          created_by?: string | null
          hubla_transaction_id?: string | null
          id?: string
          observacao?: string | null
          produto_nome?: string | null
          sdr_id: string
          valor_venda?: number | null
        }
        Update: {
          ano_mes?: string
          created_at?: string | null
          created_by?: string | null
          hubla_transaction_id?: string | null
          id?: string
          observacao?: string | null
          produto_nome?: string | null
          sdr_id?: string
          valor_venda?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sdr_intermediacoes_hubla_transaction_id_fkey"
            columns: ["hubla_transaction_id"]
            isOneToOne: false
            referencedRelation: "hubla_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_intermediacoes_sdr_id_fkey"
            columns: ["sdr_id"]
            isOneToOne: false
            referencedRelation: "sdr"
            referencedColumns: ["id"]
          },
        ]
      }
      sdr_levels: {
        Row: {
          description: string | null
          fixo_valor: number
          level: number
        }
        Insert: {
          description?: string | null
          fixo_valor: number
          level: number
        }
        Update: {
          description?: string | null
          fixo_valor?: number
          level?: number
        }
        Relationships: []
      }
      sdr_month_kpi: {
        Row: {
          ano_mes: string
          created_at: string | null
          id: string
          intermediacoes_contrato: number | null
          no_shows: number | null
          reunioes_agendadas: number | null
          reunioes_realizadas: number | null
          score_organizacao: number | null
          sdr_id: string
          taxa_no_show: number | null
          tentativas_ligacoes: number | null
          updated_at: string | null
        }
        Insert: {
          ano_mes: string
          created_at?: string | null
          id?: string
          intermediacoes_contrato?: number | null
          no_shows?: number | null
          reunioes_agendadas?: number | null
          reunioes_realizadas?: number | null
          score_organizacao?: number | null
          sdr_id: string
          taxa_no_show?: number | null
          tentativas_ligacoes?: number | null
          updated_at?: string | null
        }
        Update: {
          ano_mes?: string
          created_at?: string | null
          id?: string
          intermediacoes_contrato?: number | null
          no_shows?: number | null
          reunioes_agendadas?: number | null
          reunioes_realizadas?: number | null
          score_organizacao?: number | null
          sdr_id?: string
          taxa_no_show?: number | null
          tentativas_ligacoes?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sdr_month_kpi_sdr_id_fkey"
            columns: ["sdr_id"]
            isOneToOne: false
            referencedRelation: "sdr"
            referencedColumns: ["id"]
          },
        ]
      }
      sdr_month_payout: {
        Row: {
          ajustes_json: Json | null
          ano_mes: string
          aprovado_em: string | null
          aprovado_por: string | null
          created_at: string | null
          id: string
          ifood_mensal: number | null
          ifood_ultrameta: number | null
          ifood_ultrameta_autorizado: boolean | null
          ifood_ultrameta_autorizado_em: string | null
          ifood_ultrameta_autorizado_por: string | null
          mult_organizacao: number | null
          mult_reunioes_agendadas: number | null
          mult_reunioes_realizadas: number | null
          mult_tentativas: number | null
          pct_organizacao: number | null
          pct_reunioes_agendadas: number | null
          pct_reunioes_realizadas: number | null
          pct_tentativas: number | null
          sdr_id: string
          status: string | null
          total_conta: number | null
          total_ifood: number | null
          updated_at: string | null
          valor_fixo: number | null
          valor_organizacao: number | null
          valor_reunioes_agendadas: number | null
          valor_reunioes_realizadas: number | null
          valor_tentativas: number | null
          valor_variavel_total: number | null
        }
        Insert: {
          ajustes_json?: Json | null
          ano_mes: string
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string | null
          id?: string
          ifood_mensal?: number | null
          ifood_ultrameta?: number | null
          ifood_ultrameta_autorizado?: boolean | null
          ifood_ultrameta_autorizado_em?: string | null
          ifood_ultrameta_autorizado_por?: string | null
          mult_organizacao?: number | null
          mult_reunioes_agendadas?: number | null
          mult_reunioes_realizadas?: number | null
          mult_tentativas?: number | null
          pct_organizacao?: number | null
          pct_reunioes_agendadas?: number | null
          pct_reunioes_realizadas?: number | null
          pct_tentativas?: number | null
          sdr_id: string
          status?: string | null
          total_conta?: number | null
          total_ifood?: number | null
          updated_at?: string | null
          valor_fixo?: number | null
          valor_organizacao?: number | null
          valor_reunioes_agendadas?: number | null
          valor_reunioes_realizadas?: number | null
          valor_tentativas?: number | null
          valor_variavel_total?: number | null
        }
        Update: {
          ajustes_json?: Json | null
          ano_mes?: string
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string | null
          id?: string
          ifood_mensal?: number | null
          ifood_ultrameta?: number | null
          ifood_ultrameta_autorizado?: boolean | null
          ifood_ultrameta_autorizado_em?: string | null
          ifood_ultrameta_autorizado_por?: string | null
          mult_organizacao?: number | null
          mult_reunioes_agendadas?: number | null
          mult_reunioes_realizadas?: number | null
          mult_tentativas?: number | null
          pct_organizacao?: number | null
          pct_reunioes_agendadas?: number | null
          pct_reunioes_realizadas?: number | null
          pct_tentativas?: number | null
          sdr_id?: string
          status?: string | null
          total_conta?: number | null
          total_ifood?: number | null
          updated_at?: string | null
          valor_fixo?: number | null
          valor_organizacao?: number | null
          valor_reunioes_agendadas?: number | null
          valor_reunioes_realizadas?: number | null
          valor_tentativas?: number | null
          valor_variavel_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sdr_month_payout_sdr_id_fkey"
            columns: ["sdr_id"]
            isOneToOne: false
            referencedRelation: "sdr"
            referencedColumns: ["id"]
          },
        ]
      }
      sdr_payout_audit_log: {
        Row: {
          campo: string
          created_at: string | null
          id: string
          motivo: string | null
          payout_id: string
          user_id: string | null
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          campo: string
          created_at?: string | null
          id?: string
          motivo?: string | null
          payout_id: string
          user_id?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          campo?: string
          created_at?: string | null
          id?: string
          motivo?: string | null
          payout_id?: string
          user_id?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sdr_payout_audit_log_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "sdr_month_payout"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      stage_permissions: {
        Row: {
          can_edit: boolean | null
          can_move_from: boolean | null
          can_move_to: boolean | null
          can_view: boolean | null
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          stage_id: string
        }
        Insert: {
          can_edit?: boolean | null
          can_move_from?: boolean | null
          can_move_to?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          stage_id: string
        }
        Update: {
          can_edit?: boolean | null
          can_move_from?: boolean | null
          can_move_to?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_permissions_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "deal_stages"
            referencedColumns: ["stage_id"]
          },
        ]
      }
      sync_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          job_type: string
          last_page: number | null
          metadata: Json | null
          started_at: string | null
          status: string
          total_processed: number | null
          total_skipped: number | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          job_type: string
          last_page?: number | null
          metadata?: Json | null
          started_at?: string | null
          status?: string
          total_processed?: number | null
          total_skipped?: number | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          job_type?: string
          last_page?: number | null
          metadata?: Json | null
          started_at?: string | null
          status?: string
          total_processed?: number | null
          total_skipped?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      team_targets: {
        Row: {
          created_at: string | null
          created_by: string | null
          current_value: number | null
          id: string
          origin_id: string | null
          reference_id: string | null
          target_name: string
          target_type: string
          target_value: number
          updated_at: string | null
          week_end: string
          week_start: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          current_value?: number | null
          id?: string
          origin_id?: string | null
          reference_id?: string | null
          target_name: string
          target_type: string
          target_value?: number
          updated_at?: string | null
          week_end: string
          week_start: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          current_value?: number | null
          id?: string
          origin_id?: string | null
          reference_id?: string | null
          target_name?: string
          target_type?: string
          target_value?: number
          updated_at?: string | null
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_targets_origin_id_fkey"
            columns: ["origin_id"]
            isOneToOne: false
            referencedRelation: "crm_origins"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category_id: string | null
          channel_id: string | null
          created_at: string | null
          created_by: string | null
          date: string
          description: string
          id: string
          status: Database["public"]["Enums"]["transaction_status"] | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string | null
        }
        Insert: {
          amount: number
          category_id?: string | null
          channel_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date: string
          description: string
          id?: string
          status?: Database["public"]["Enums"]["transaction_status"] | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string | null
        }
        Update: {
          amount?: number
          category_id?: string | null
          channel_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          description?: string
          id?: string
          status?: Database["public"]["Enums"]["transaction_status"] | null
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      user_employment_data: {
        Row: {
          commission_rate: number | null
          created_at: string | null
          department: string | null
          fixed_salary: number | null
          hire_date: string | null
          id: string
          is_active: boolean | null
          ote: number | null
          position: string | null
          status: Database["public"]["Enums"]["user_status"]
          termination_date: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          commission_rate?: number | null
          created_at?: string | null
          department?: string | null
          fixed_salary?: number | null
          hire_date?: string | null
          id?: string
          is_active?: boolean | null
          ote?: number | null
          position?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          termination_date?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          commission_rate?: number | null
          created_at?: string | null
          department?: string | null
          fixed_salary?: number | null
          hire_date?: string | null
          id?: string
          is_active?: boolean | null
          ote?: number | null
          position?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          termination_date?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_files: {
        Row: {
          categoria_cargo: string | null
          created_at: string | null
          data_upload: string
          descricao: string | null
          file_name: string
          file_size: number | null
          id: string
          storage_path: string
          storage_url: string
          tipo: Database["public"]["Enums"]["user_file_type"]
          titulo: string
          updated_at: string | null
          uploaded_by: string
          user_id: string
          visivel_para_usuario: boolean
        }
        Insert: {
          categoria_cargo?: string | null
          created_at?: string | null
          data_upload?: string
          descricao?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          storage_path: string
          storage_url: string
          tipo: Database["public"]["Enums"]["user_file_type"]
          titulo: string
          updated_at?: string | null
          uploaded_by: string
          user_id: string
          visivel_para_usuario?: boolean
        }
        Update: {
          categoria_cargo?: string | null
          created_at?: string | null
          data_upload?: string
          descricao?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          storage_path?: string
          storage_url?: string
          tipo?: Database["public"]["Enums"]["user_file_type"]
          titulo?: string
          updated_at?: string | null
          uploaded_by?: string
          user_id?: string
          visivel_para_usuario?: boolean
        }
        Relationships: []
      }
      user_flags: {
        Row: {
          category: Database["public"]["Enums"]["flag_category"]
          created_at: string | null
          created_by: string | null
          description: string | null
          flag_type: Database["public"]["Enums"]["flag_type"]
          id: string
          is_resolved: boolean | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: number | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["flag_category"]
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          flag_type: Database["public"]["Enums"]["flag_type"]
          id?: string
          is_resolved?: boolean | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: number | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["flag_category"]
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          flag_type?: Database["public"]["Enums"]["flag_type"]
          id?: string
          is_resolved?: boolean | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: number | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_observations: {
        Row: {
          category: string | null
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          is_important: boolean | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_important?: boolean | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_important?: boolean | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string | null
          id: string
          permission_level: Database["public"]["Enums"]["permission_level"]
          resource: Database["public"]["Enums"]["resource_type"]
          restrictions: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          permission_level?: Database["public"]["Enums"]["permission_level"]
          resource: Database["public"]["Enums"]["resource_type"]
          restrictions?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          permission_level?: Database["public"]["Enums"]["permission_level"]
          resource?: Database["public"]["Enums"]["resource_type"]
          restrictions?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_targets: {
        Row: {
          created_at: string | null
          current_value: number | null
          end_date: string
          id: string
          is_achieved: boolean | null
          name: string
          period: Database["public"]["Enums"]["target_period"]
          start_date: string
          target_value: number
          type: Database["public"]["Enums"]["target_type"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_value?: number | null
          end_date: string
          id?: string
          is_achieved?: boolean | null
          name: string
          period: Database["public"]["Enums"]["target_period"]
          start_date: string
          target_value: number
          type: Database["public"]["Enums"]["target_type"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_value?: number | null
          end_date?: string
          id?: string
          is_achieved?: boolean | null
          name?: string
          period?: Database["public"]["Enums"]["target_period"]
          start_date?: string
          target_value?: number
          type?: Database["public"]["Enums"]["target_type"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_data: Json
          event_type: string
          id: string
          processed_at: string | null
          processing_time_ms: number | null
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_data: Json
          event_type: string
          id?: string
          processed_at?: string | null
          processing_time_ms?: number | null
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_data?: Json
          event_type?: string
          id?: string
          processed_at?: string | null
          processing_time_ms?: number | null
          status?: string
        }
        Relationships: []
      }
      weekly_metrics: {
        Row: {
          a010_revenue: number | null
          a010_sales: number | null
          ads_cost: number | null
          captacao_revenue: number | null
          captacao_sales: number | null
          cir: number | null
          clint_revenue: number | null
          clube_arremate_revenue: number | null
          clube_arremate_sales: number | null
          contract_revenue: number | null
          contract_sales: number | null
          cpl: number | null
          cplr: number | null
          created_at: string | null
          custo_real: number | null
          efeito_alavanca_revenue: number | null
          efeito_alavanca_sales: number | null
          end_date: string
          faturamento_clint: number | null
          faturamento_total: number | null
          formacao_revenue: number | null
          formacao_sales: number | null
          id: string
          imersao_revenue: number | null
          imersao_sales: number | null
          imersao_socios_revenue: number | null
          imersao_socios_sales: number | null
          incorporador_50k: number | null
          mentoria_caixa_revenue: number | null
          mentoria_caixa_sales: number | null
          mentoria_grupo_caixa_revenue: number | null
          mentoria_grupo_caixa_sales: number | null
          ob_construir: number | null
          ob_construir_alugar_revenue: number | null
          ob_construir_alugar_sales: number | null
          ob_construir_revenue: number | null
          ob_construir_sales: number | null
          ob_evento_revenue: number | null
          ob_evento_sales: number | null
          ob_vitalicio: number | null
          ob_vitalicio_revenue: number | null
          ob_vitalicio_sales: number | null
          office_cost: number | null
          operating_cost: number | null
          operating_profit: number | null
          outros_revenue: number | null
          outros_sales: number | null
          p2_revenue: number | null
          p2_sales: number | null
          parceria_revenue: number | null
          parceria_sales: number | null
          projetos_revenue: number | null
          projetos_sales: number | null
          real_cost: number | null
          renovacao_revenue: number | null
          renovacao_sales: number | null
          roas: number | null
          roi: number | null
          sdr_ia_ig: number | null
          socios_revenue: number | null
          socios_sales: number | null
          stage_01_actual: number | null
          stage_01_rate: number | null
          stage_01_target: number | null
          stage_02_actual: number | null
          stage_02_rate: number | null
          stage_02_target: number | null
          stage_03_actual: number | null
          stage_03_rate: number | null
          stage_03_target: number | null
          stage_04_actual: number | null
          stage_04_rate: number | null
          stage_04_target: number | null
          stage_05_actual: number | null
          stage_05_rate: number | null
          stage_05_target: number | null
          stage_06_actual: number | null
          stage_06_rate: number | null
          stage_06_target: number | null
          stage_07_actual: number | null
          stage_07_rate: number | null
          stage_07_target: number | null
          stage_08_actual: number | null
          stage_08_rate: number | null
          stage_08_target: number | null
          start_date: string
          team_cost: number | null
          total_cost: number | null
          total_revenue: number | null
          ultrameta_clint: number | null
          ultrameta_liquido: number | null
          updated_at: string | null
          week_label: string
        }
        Insert: {
          a010_revenue?: number | null
          a010_sales?: number | null
          ads_cost?: number | null
          captacao_revenue?: number | null
          captacao_sales?: number | null
          cir?: number | null
          clint_revenue?: number | null
          clube_arremate_revenue?: number | null
          clube_arremate_sales?: number | null
          contract_revenue?: number | null
          contract_sales?: number | null
          cpl?: number | null
          cplr?: number | null
          created_at?: string | null
          custo_real?: number | null
          efeito_alavanca_revenue?: number | null
          efeito_alavanca_sales?: number | null
          end_date: string
          faturamento_clint?: number | null
          faturamento_total?: number | null
          formacao_revenue?: number | null
          formacao_sales?: number | null
          id?: string
          imersao_revenue?: number | null
          imersao_sales?: number | null
          imersao_socios_revenue?: number | null
          imersao_socios_sales?: number | null
          incorporador_50k?: number | null
          mentoria_caixa_revenue?: number | null
          mentoria_caixa_sales?: number | null
          mentoria_grupo_caixa_revenue?: number | null
          mentoria_grupo_caixa_sales?: number | null
          ob_construir?: number | null
          ob_construir_alugar_revenue?: number | null
          ob_construir_alugar_sales?: number | null
          ob_construir_revenue?: number | null
          ob_construir_sales?: number | null
          ob_evento_revenue?: number | null
          ob_evento_sales?: number | null
          ob_vitalicio?: number | null
          ob_vitalicio_revenue?: number | null
          ob_vitalicio_sales?: number | null
          office_cost?: number | null
          operating_cost?: number | null
          operating_profit?: number | null
          outros_revenue?: number | null
          outros_sales?: number | null
          p2_revenue?: number | null
          p2_sales?: number | null
          parceria_revenue?: number | null
          parceria_sales?: number | null
          projetos_revenue?: number | null
          projetos_sales?: number | null
          real_cost?: number | null
          renovacao_revenue?: number | null
          renovacao_sales?: number | null
          roas?: number | null
          roi?: number | null
          sdr_ia_ig?: number | null
          socios_revenue?: number | null
          socios_sales?: number | null
          stage_01_actual?: number | null
          stage_01_rate?: number | null
          stage_01_target?: number | null
          stage_02_actual?: number | null
          stage_02_rate?: number | null
          stage_02_target?: number | null
          stage_03_actual?: number | null
          stage_03_rate?: number | null
          stage_03_target?: number | null
          stage_04_actual?: number | null
          stage_04_rate?: number | null
          stage_04_target?: number | null
          stage_05_actual?: number | null
          stage_05_rate?: number | null
          stage_05_target?: number | null
          stage_06_actual?: number | null
          stage_06_rate?: number | null
          stage_06_target?: number | null
          stage_07_actual?: number | null
          stage_07_rate?: number | null
          stage_07_target?: number | null
          stage_08_actual?: number | null
          stage_08_rate?: number | null
          stage_08_target?: number | null
          start_date: string
          team_cost?: number | null
          total_cost?: number | null
          total_revenue?: number | null
          ultrameta_clint?: number | null
          ultrameta_liquido?: number | null
          updated_at?: string | null
          week_label: string
        }
        Update: {
          a010_revenue?: number | null
          a010_sales?: number | null
          ads_cost?: number | null
          captacao_revenue?: number | null
          captacao_sales?: number | null
          cir?: number | null
          clint_revenue?: number | null
          clube_arremate_revenue?: number | null
          clube_arremate_sales?: number | null
          contract_revenue?: number | null
          contract_sales?: number | null
          cpl?: number | null
          cplr?: number | null
          created_at?: string | null
          custo_real?: number | null
          efeito_alavanca_revenue?: number | null
          efeito_alavanca_sales?: number | null
          end_date?: string
          faturamento_clint?: number | null
          faturamento_total?: number | null
          formacao_revenue?: number | null
          formacao_sales?: number | null
          id?: string
          imersao_revenue?: number | null
          imersao_sales?: number | null
          imersao_socios_revenue?: number | null
          imersao_socios_sales?: number | null
          incorporador_50k?: number | null
          mentoria_caixa_revenue?: number | null
          mentoria_caixa_sales?: number | null
          mentoria_grupo_caixa_revenue?: number | null
          mentoria_grupo_caixa_sales?: number | null
          ob_construir?: number | null
          ob_construir_alugar_revenue?: number | null
          ob_construir_alugar_sales?: number | null
          ob_construir_revenue?: number | null
          ob_construir_sales?: number | null
          ob_evento_revenue?: number | null
          ob_evento_sales?: number | null
          ob_vitalicio?: number | null
          ob_vitalicio_revenue?: number | null
          ob_vitalicio_sales?: number | null
          office_cost?: number | null
          operating_cost?: number | null
          operating_profit?: number | null
          outros_revenue?: number | null
          outros_sales?: number | null
          p2_revenue?: number | null
          p2_sales?: number | null
          parceria_revenue?: number | null
          parceria_sales?: number | null
          projetos_revenue?: number | null
          projetos_sales?: number | null
          real_cost?: number | null
          renovacao_revenue?: number | null
          renovacao_sales?: number | null
          roas?: number | null
          roi?: number | null
          sdr_ia_ig?: number | null
          socios_revenue?: number | null
          socios_sales?: number | null
          stage_01_actual?: number | null
          stage_01_rate?: number | null
          stage_01_target?: number | null
          stage_02_actual?: number | null
          stage_02_rate?: number | null
          stage_02_target?: number | null
          stage_03_actual?: number | null
          stage_03_rate?: number | null
          stage_03_target?: number | null
          stage_04_actual?: number | null
          stage_04_rate?: number | null
          stage_04_target?: number | null
          stage_05_actual?: number | null
          stage_05_rate?: number | null
          stage_05_target?: number | null
          stage_06_actual?: number | null
          stage_06_rate?: number | null
          stage_06_target?: number | null
          stage_07_actual?: number | null
          stage_07_rate?: number | null
          stage_07_target?: number | null
          stage_08_actual?: number | null
          stage_08_rate?: number | null
          stage_08_target?: number | null
          start_date?: string
          team_cost?: number | null
          total_cost?: number | null
          total_revenue?: number | null
          ultrameta_clint?: number | null
          ultrameta_liquido?: number | null
          updated_at?: string | null
          week_label?: string
        }
        Relationships: []
      }
      working_days_calendar: {
        Row: {
          ano_mes: string
          created_at: string | null
          dias_uteis_base: number
          dias_uteis_final: number
          feriados_nacionais: Json | null
          id: string
          ifood_mensal_calculado: number | null
          ifood_valor_dia: number
          observacoes: string | null
          paradas_empresa: Json | null
          updated_at: string | null
        }
        Insert: {
          ano_mes: string
          created_at?: string | null
          dias_uteis_base?: number
          dias_uteis_final?: number
          feriados_nacionais?: Json | null
          id?: string
          ifood_mensal_calculado?: number | null
          ifood_valor_dia?: number
          observacoes?: string | null
          paradas_empresa?: Json | null
          updated_at?: string | null
        }
        Update: {
          ano_mes?: string
          created_at?: string | null
          dias_uteis_base?: number
          dias_uteis_final?: number
          feriados_nacionais?: Json | null
          id?: string
          ifood_mensal_calculado?: number | null
          ifood_valor_dia?: number
          observacoes?: string | null
          paradas_empresa?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      user_performance_summary: {
        Row: {
          avg_performance_3m: number | null
          email: string | null
          fixed_salary: number | null
          full_name: string | null
          hire_date: string | null
          is_active: boolean | null
          ote: number | null
          position: string | null
          red_flags_count: number | null
          role: Database["public"]["Enums"]["app_role"] | null
          status: Database["public"]["Enums"]["user_status"] | null
          targets_achieved: number | null
          total_targets: number | null
          user_id: string | null
          yellow_flags_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_tv_funnel_metrics: { Args: { target_date: string }; Returns: Json }
      get_tv_sdr_metrics: { Args: { target_date: string }; Returns: Json }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_own_sdr: { Args: { _sdr_id: string }; Returns: boolean }
      link_contacts_to_origins_via_deals: { Args: never; Returns: number }
      upsert_deals_smart: { Args: { deals_data: Json }; Returns: undefined }
      user_has_permission: {
        Args: {
          _required_level: Database["public"]["Enums"]["permission_level"]
          _resource: Database["public"]["Enums"]["resource_type"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      alert_level: "info" | "warning" | "critical"
      app_role:
        | "admin"
        | "manager"
        | "viewer"
        | "sdr"
        | "closer"
        | "coordenador"
      auction_status: "ativo" | "encerrado" | "cancelado"
      flag_category:
        | "desempenho"
        | "comportamento"
        | "frequencia"
        | "financeiro"
        | "compliance"
        | "outros"
      flag_type: "red" | "yellow" | "green"
      permission_level: "none" | "view" | "edit" | "full"
      playbook_categoria:
        | "onboarding"
        | "processo"
        | "politica"
        | "script"
        | "treinamento"
        | "outro"
      playbook_read_status: "nao_lido" | "lido" | "confirmado"
      playbook_role:
        | "sdr"
        | "closer"
        | "coordenador"
        | "gestor_sdr"
        | "gestor_closer"
        | "master"
        | "admin"
        | "manager"
        | "viewer"
      playbook_tipo_conteudo: "arquivo" | "link" | "texto"
      project_status: "a_fazer" | "em_andamento" | "concluido" | "cancelado"
      resource_type:
        | "dashboard"
        | "receita"
        | "custos"
        | "projetos"
        | "credito"
        | "leilao"
        | "alertas"
        | "relatorios"
        | "configuracoes"
        | "efeito_alavanca"
        | "crm"
        | "fechamento_sdr"
        | "tv_sdr"
        | "usuarios"
      target_period: "mensal" | "trimestral" | "anual"
      target_type: "receita" | "vendas" | "leads" | "conversao" | "custom"
      transaction_status: "pago" | "pendente" | "cancelado"
      transaction_type: "receita" | "custo"
      user_file_type:
        | "contrato_trabalho"
        | "politica_comissao"
        | "metas"
        | "outro"
      user_status: "ativo" | "ferias" | "inativo" | "pendente_aprovacao"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      alert_level: ["info", "warning", "critical"],
      app_role: ["admin", "manager", "viewer", "sdr", "closer", "coordenador"],
      auction_status: ["ativo", "encerrado", "cancelado"],
      flag_category: [
        "desempenho",
        "comportamento",
        "frequencia",
        "financeiro",
        "compliance",
        "outros",
      ],
      flag_type: ["red", "yellow", "green"],
      permission_level: ["none", "view", "edit", "full"],
      playbook_categoria: [
        "onboarding",
        "processo",
        "politica",
        "script",
        "treinamento",
        "outro",
      ],
      playbook_read_status: ["nao_lido", "lido", "confirmado"],
      playbook_role: [
        "sdr",
        "closer",
        "coordenador",
        "gestor_sdr",
        "gestor_closer",
        "master",
        "admin",
        "manager",
        "viewer",
      ],
      playbook_tipo_conteudo: ["arquivo", "link", "texto"],
      project_status: ["a_fazer", "em_andamento", "concluido", "cancelado"],
      resource_type: [
        "dashboard",
        "receita",
        "custos",
        "projetos",
        "credito",
        "leilao",
        "alertas",
        "relatorios",
        "configuracoes",
        "efeito_alavanca",
        "crm",
        "fechamento_sdr",
        "tv_sdr",
        "usuarios",
      ],
      target_period: ["mensal", "trimestral", "anual"],
      target_type: ["receita", "vendas", "leads", "conversao", "custom"],
      transaction_status: ["pago", "pendente", "cancelado"],
      transaction_type: ["receita", "custo"],
      user_file_type: [
        "contrato_trabalho",
        "politica_comissao",
        "metas",
        "outro",
      ],
      user_status: ["ativo", "ferias", "inativo", "pendente_aprovacao"],
    },
  },
} as const
