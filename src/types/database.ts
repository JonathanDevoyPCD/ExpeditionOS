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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      adventure_invitations: {
        Row: {
          adventure_id: string
          created_at: string
          id: string
          invited_by: string
          invitee_email: string
          responded_at: string | null
          role: string
          status: string
        }
        Insert: {
          adventure_id: string
          created_at?: string
          id?: string
          invited_by: string
          invitee_email: string
          responded_at?: string | null
          role?: string
          status?: string
        }
        Update: {
          adventure_id?: string
          created_at?: string
          id?: string
          invited_by?: string
          invitee_email?: string
          responded_at?: string | null
          role?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "adventure_invitations_adventure_id_fkey"
            columns: ["adventure_id"]
            isOneToOne: false
            referencedRelation: "adventures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adventure_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      adventure_members: {
        Row: {
          added_by: string | null
          adventure_id: string
          created_at: string
          role: string
          share_emergency_profile: boolean
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          adventure_id: string
          created_at?: string
          role: string
          share_emergency_profile?: boolean
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          adventure_id?: string
          created_at?: string
          role?: string
          share_emergency_profile?: boolean
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "adventure_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adventure_members_adventure_id_fkey"
            columns: ["adventure_id"]
            isOneToOne: false
            referencedRelation: "adventures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adventure_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      adventures: {
        Row: {
          anchors: Json
          blueprint: Json | null
          created_at: string
          days: number
          description: string
          departure_time: string
          id: string
          name: string
          owner_id: string
          preferences: Json | null
          route: Json
          source: string
          starts_on: string | null
          updated_at: string
          visibility: string
        }
        Insert: {
          anchors?: Json
          blueprint?: Json | null
          created_at?: string
          days?: number
          description?: string
          departure_time?: string
          id: string
          name: string
          owner_id: string
          preferences?: Json | null
          route: Json
          source: string
          starts_on?: string | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          anchors?: Json
          blueprint?: Json | null
          created_at?: string
          days?: number
          description?: string
          departure_time?: string
          id?: string
          name?: string
          owner_id?: string
          preferences?: Json | null
          route?: Json
          source?: string
          starts_on?: string | null
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "adventures_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_emergency_details: {
        Row: {
          additional_information: string | null
          allergies: string | null
          blood_type: string | null
          created_at: string
          doctor_name: string | null
          doctor_phone: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          medical_aid_name: string | null
          medical_aid_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          additional_information?: string | null
          allergies?: string | null
          blood_type?: string | null
          created_at?: string
          doctor_name?: string | null
          doctor_phone?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          medical_aid_name?: string | null
          medical_aid_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          additional_information?: string | null
          allergies?: string | null
          blood_type?: string | null
          created_at?: string
          doctor_name?: string | null
          doctor_phone?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          medical_aid_name?: string | null
          medical_aid_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_emergency_details_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_private_details: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          country: string
          created_at: string
          date_of_birth: string | null
          email: string | null
          gender: string | null
          gender_description: string | null
          phone: string | null
          phone_verified: boolean
          preferred_otp_channel: string
          province: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          country?: string
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          gender?: string | null
          gender_description?: string | null
          phone?: string | null
          phone_verified?: boolean
          preferred_otp_channel?: string
          province?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          country?: string
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          gender?: string | null
          gender_description?: string | null
          phone?: string | null
          phone_verified?: boolean
          preferred_otp_channel?: string
          province?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_private_details_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_travel_documents: {
        Row: {
          created_at: string
          passport_number: string | null
          sa_id_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          passport_number?: string | null
          sa_id_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          passport_number?: string | null
          sa_id_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_travel_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          first_name: string
          id: string
          last_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          first_name?: string
          id: string
          last_name?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          first_name?: string
          id?: string
          last_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      strava_activities: {
        Row: {
          achievement_count: number
          activity_id: number
          athlete_id: number
          average_heartrate: number | null
          average_speed_mps: number | null
          average_watts: number | null
          aerobic_decoupling_pct: number | null
          commute: boolean
          distance_m: number
          elapsed_time_s: number
          imported_at: string
          kilojoules: number | null
          kudos_count: number
          manual: boolean
          max_heartrate: number | null
          max_speed_mps: number | null
          moving_time_s: number
          name: string
          private: boolean
          sport_type: string
          start_date: string
          start_date_local: string | null
          stream_analyzed_at: string | null
          stream_sample_count: number
          suffer_score: number | null
          timezone: string | null
          total_elevation_gain_m: number
          trainer: boolean
          updated_at: string
          user_id: string
          weighted_average_watts: number | null
          heart_rate_drift_pct: number | null
          power_fade_pct: number | null
        }
        Insert: {
          achievement_count?: number
          activity_id: number
          athlete_id: number
          average_heartrate?: number | null
          average_speed_mps?: number | null
          average_watts?: number | null
          aerobic_decoupling_pct?: number | null
          commute?: boolean
          distance_m?: number
          elapsed_time_s?: number
          imported_at?: string
          kilojoules?: number | null
          kudos_count?: number
          manual?: boolean
          max_heartrate?: number | null
          max_speed_mps?: number | null
          moving_time_s?: number
          name: string
          private?: boolean
          sport_type: string
          start_date: string
          start_date_local?: string | null
          stream_analyzed_at?: string | null
          stream_sample_count?: number
          suffer_score?: number | null
          timezone?: string | null
          total_elevation_gain_m?: number
          trainer?: boolean
          updated_at?: string
          user_id: string
          weighted_average_watts?: number | null
          heart_rate_drift_pct?: number | null
          power_fade_pct?: number | null
        }
        Update: {
          achievement_count?: number
          activity_id?: number
          athlete_id?: number
          average_heartrate?: number | null
          average_speed_mps?: number | null
          average_watts?: number | null
          aerobic_decoupling_pct?: number | null
          commute?: boolean
          distance_m?: number
          elapsed_time_s?: number
          imported_at?: string
          kilojoules?: number | null
          kudos_count?: number
          manual?: boolean
          max_heartrate?: number | null
          max_speed_mps?: number | null
          moving_time_s?: number
          name?: string
          private?: boolean
          sport_type?: string
          start_date?: string
          start_date_local?: string | null
          stream_analyzed_at?: string | null
          stream_sample_count?: number
          suffer_score?: number | null
          timezone?: string | null
          total_elevation_gain_m?: number
          trainer?: boolean
          updated_at?: string
          user_id?: string
          weighted_average_watts?: number | null
          heart_rate_drift_pct?: number | null
          power_fade_pct?: number | null
        }
        Relationships: []
      }
      strava_connections: {
        Row: {
          access_token_ciphertext: string
          access_token_expires_at: string
          athlete_avatar_url: string | null
          athlete_id: number
          athlete_name: string
          created_at: string
          last_sync_error: string | null
          last_sync_status: string
          last_synced_at: string | null
          rate_limit_15m_limit: number | null
          rate_limit_15m_used: number | null
          rate_limit_daily_limit: number | null
          rate_limit_daily_used: number | null
          refresh_token_ciphertext: string
          scopes: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_ciphertext: string
          access_token_expires_at: string
          athlete_avatar_url?: string | null
          athlete_id: number
          athlete_name?: string
          created_at?: string
          last_sync_error?: string | null
          last_sync_status?: string
          last_synced_at?: string | null
          rate_limit_15m_limit?: number | null
          rate_limit_15m_used?: number | null
          rate_limit_daily_limit?: number | null
          rate_limit_daily_used?: number | null
          refresh_token_ciphertext: string
          scopes?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_ciphertext?: string
          access_token_expires_at?: string
          athlete_avatar_url?: string | null
          athlete_id?: number
          athlete_name?: string
          created_at?: string
          last_sync_error?: string | null
          last_sync_status?: string
          last_synced_at?: string | null
          rate_limit_15m_limit?: number | null
          rate_limit_15m_used?: number | null
          rate_limit_daily_limit?: number | null
          rate_limit_daily_used?: number | null
          refresh_token_ciphertext?: string
          scopes?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      invite_adventure_member: {
        Args: {
          target_adventure_id: string
          target_email: string
          target_role?: string
        }
        Returns: string
      }
      remove_adventure_member: {
        Args: { target_adventure_id: string; target_user_id: string }
        Returns: undefined
      }
      respond_to_adventure_invitation: {
        Args: { accept_invitation: boolean; target_invitation_id: string }
        Returns: string
      }
      set_adventure_member_role: {
        Args: {
          target_adventure_id: string
          target_role: string
          target_user_id: string
        }
        Returns: undefined
      }
      set_adventure_visibility: {
        Args: { target_adventure_id: string; target_visibility: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
