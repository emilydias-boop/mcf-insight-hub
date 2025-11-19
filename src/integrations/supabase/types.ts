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
          termination_date?: string | null
          updated_at?: string | null
          user_id?: string
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
          targets_achieved: number | null
          total_targets: number | null
          user_id: string | null
          yellow_flags_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
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
      link_contacts_to_origins_via_deals: { Args: never; Returns: number }
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
      app_role: "admin" | "manager" | "viewer" | "sdr" | "closer"
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
      target_period: "mensal" | "trimestral" | "anual"
      target_type: "receita" | "vendas" | "leads" | "conversao" | "custom"
      transaction_status: "pago" | "pendente" | "cancelado"
      transaction_type: "receita" | "custo"
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
      app_role: ["admin", "manager", "viewer", "sdr", "closer"],
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
      ],
      target_period: ["mensal", "trimestral", "anual"],
      target_type: ["receita", "vendas", "leads", "conversao", "custom"],
      transaction_status: ["pago", "pendente", "cancelado"],
      transaction_type: ["receita", "custo"],
    },
  },
} as const
