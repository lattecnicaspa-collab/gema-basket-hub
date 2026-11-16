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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      accreditations: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          is_hospitality: boolean | null
          list_type: string
          match_id: string
          organization: string | null
          qr_code: string
          sector_id: string | null
          sponsor_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_hospitality?: boolean | null
          list_type?: string
          match_id: string
          organization?: string | null
          qr_code?: string
          sector_id?: string | null
          sponsor_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_hospitality?: boolean | null
          list_type?: string
          match_id?: string
          organization?: string | null
          qr_code?: string
          sector_id?: string | null
          sponsor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accreditations_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accreditations_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accreditations_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      aed_devices: {
        Row: {
          battery_expiry: string | null
          id: string
          location: string
          notes: string | null
          pads_expiry: string | null
          serial: string | null
        }
        Insert: {
          battery_expiry?: string | null
          id?: string
          location: string
          notes?: string | null
          pads_expiry?: string | null
          serial?: string | null
        }
        Update: {
          battery_expiry?: string | null
          id?: string
          location?: string
          notes?: string | null
          pads_expiry?: string | null
          serial?: string | null
        }
        Relationships: []
      }
      announcements: {
        Row: {
          audience: string | null
          body: string | null
          created_at: string | null
          created_by: string | null
          id: string
          pinned: boolean | null
          title: string
        }
        Insert: {
          audience?: string | null
          body?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          pinned?: boolean | null
          title: string
        }
        Update: {
          audience?: string | null
          body?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          pinned?: boolean | null
          title?: string
        }
        Relationships: []
      }
      assemblies: {
        Row: {
          agenda: string | null
          id: string
          meeting_date: string
          minutes: string | null
          status: string | null
          type: string
        }
        Insert: {
          agenda?: string | null
          id?: string
          meeting_date: string
          minutes?: string | null
          status?: string | null
          type?: string
        }
        Update: {
          agenda?: string | null
          id?: string
          meeting_date?: string
          minutes?: string | null
          status?: string | null
          type?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: number
          new_value: Json | null
          old_value: Json | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: never
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: never
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      cash_shifts: {
        Row: {
          closed_at: string | null
          counted_cash: number | null
          denominations: Json | null
          expected_cash: number | null
          id: string
          match_id: string
          notes: string | null
          opened_at: string | null
          opening_float: number
          operator_id: string | null
          operator_name: string | null
        }
        Insert: {
          closed_at?: string | null
          counted_cash?: number | null
          denominations?: Json | null
          expected_cash?: number | null
          id?: string
          match_id: string
          notes?: string | null
          opened_at?: string | null
          opening_float?: number
          operator_id?: string | null
          operator_name?: string | null
        }
        Update: {
          closed_at?: string | null
          counted_cash?: number | null
          denominations?: Json | null
          expected_cash?: number | null
          id?: string
          match_id?: string
          notes?: string | null
          opened_at?: string | null
          opening_float?: number
          operator_id?: string | null
          operator_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_shifts_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          area: string
          id: string
          sort: number | null
          task: string
        }
        Insert: {
          area: string
          id?: string
          sort?: number | null
          task: string
        }
        Update: {
          area?: string
          id?: string
          sort?: number | null
          task?: string
        }
        Relationships: []
      }
      club_settings: {
        Row: {
          accent_color: string | null
          address: string | null
          commercial_threshold: number
          default_reminder_days: number[]
          fip_code: string | null
          fiscal_tickets: boolean
          footer_text: string | null
          guest_names_hours_before: number
          iban: string | null
          ical_token: string
          id: number
          legal_name: string | null
          legal_rep: string | null
          logo_url: string | null
          name: string
          pec: string | null
          primary_color: string | null
          rasd_number: string | null
          sponsor_budget_target: number
          tax_code: string | null
          updated_at: string | null
          vat_number: string | null
          venue_name: string | null
        }
        Insert: {
          accent_color?: string | null
          address?: string | null
          commercial_threshold?: number
          default_reminder_days?: number[]
          fip_code?: string | null
          fiscal_tickets?: boolean
          footer_text?: string | null
          guest_names_hours_before?: number
          iban?: string | null
          ical_token?: string
          id?: number
          legal_name?: string | null
          legal_rep?: string | null
          logo_url?: string | null
          name?: string
          pec?: string | null
          primary_color?: string | null
          rasd_number?: string | null
          sponsor_budget_target?: number
          tax_code?: string | null
          updated_at?: string | null
          vat_number?: string | null
          venue_name?: string | null
        }
        Update: {
          accent_color?: string | null
          address?: string | null
          commercial_threshold?: number
          default_reminder_days?: number[]
          fip_code?: string | null
          fiscal_tickets?: boolean
          footer_text?: string | null
          guest_names_hours_before?: number
          iban?: string | null
          ical_token?: string
          id?: number
          legal_name?: string | null
          legal_rep?: string | null
          logo_url?: string | null
          name?: string
          pec?: string | null
          primary_color?: string | null
          rasd_number?: string | null
          sponsor_budget_target?: number
          tax_code?: string | null
          updated_at?: string | null
          vat_number?: string | null
          venue_name?: string | null
        }
        Relationships: []
      }
      contract_assets: {
        Row: {
          asset_id: string
          contract_id: string
          id: string
          quantity: number
        }
        Insert: {
          asset_id: string
          contract_id: string
          id?: string
          quantity?: number
        }
        Update: {
          asset_id?: string
          contract_id?: string
          id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "sponsor_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_assets_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "sponsor_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_activities: {
        Row: {
          activity_date: string
          created_at: string | null
          created_by: string | null
          done: boolean | null
          id: string
          notes: string | null
          reminder_date: string | null
          sponsor_id: string
          type: string
        }
        Insert: {
          activity_date?: string
          created_at?: string | null
          created_by?: string | null
          done?: boolean | null
          id?: string
          notes?: string | null
          reminder_date?: string | null
          sponsor_id: string
          type?: string
        }
        Update: {
          activity_date?: string
          created_at?: string | null
          created_by?: string | null
          done?: boolean | null
          id?: string
          notes?: string | null
          reminder_date?: string | null
          sponsor_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      deadline_categories: {
        Row: {
          color: string | null
          description: string | null
          id: string
          name: string
          sort: number | null
        }
        Insert: {
          color?: string | null
          description?: string | null
          id?: string
          name: string
          sort?: number | null
        }
        Update: {
          color?: string | null
          description?: string | null
          id?: string
          name?: string
          sort?: number | null
        }
        Relationships: []
      }
      deadlines: {
        Row: {
          amount: number | null
          attachment_url: string | null
          category: string
          created_at: string | null
          deleted_at: string | null
          done_at: string | null
          due_date: string
          id: string
          link_id: string | null
          link_type: string | null
          notes: string | null
          owner_id: string | null
          recurrence: string
          reminder_days: number[]
          source: string | null
          source_id: string | null
          status: string
          title: string
        }
        Insert: {
          amount?: number | null
          attachment_url?: string | null
          category?: string
          created_at?: string | null
          deleted_at?: string | null
          done_at?: string | null
          due_date: string
          id?: string
          link_id?: string | null
          link_type?: string | null
          notes?: string | null
          owner_id?: string | null
          recurrence?: string
          reminder_days?: number[]
          source?: string | null
          source_id?: string | null
          status?: string
          title: string
        }
        Update: {
          amount?: number | null
          attachment_url?: string | null
          category?: string
          created_at?: string | null
          deleted_at?: string | null
          done_at?: string | null
          due_date?: string
          id?: string
          link_id?: string | null
          link_type?: string | null
          notes?: string | null
          owner_id?: string | null
          recurrence?: string
          reminder_days?: number[]
          source?: string | null
          source_id?: string | null
          status?: string
          title?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          birth_date: string | null
          created_at: string | null
          first_name: string
          id: string
          last_name: string
          notes: string | null
          parent_email: string | null
          parent_name: string | null
          parent_phone: string | null
          requested_team: string | null
          status: string
          tax_code: string | null
        }
        Insert: {
          birth_date?: string | null
          created_at?: string | null
          first_name: string
          id?: string
          last_name: string
          notes?: string | null
          parent_email?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          requested_team?: string | null
          status?: string
          tax_code?: string | null
        }
        Update: {
          birth_date?: string | null
          created_at?: string | null
          first_name?: string
          id?: string
          last_name?: string
          notes?: string | null
          parent_email?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          requested_team?: string | null
          status?: string
          tax_code?: string | null
        }
        Relationships: []
      }
      entries: {
        Row: {
          id: string
          kind: string
          match_id: string
          qr_code: string
          scanned_at: string | null
          scanned_by: string | null
          sector_id: string | null
        }
        Insert: {
          id?: string
          kind: string
          match_id: string
          qr_code: string
          scanned_at?: string | null
          scanned_by?: string | null
          sector_id?: string | null
        }
        Update: {
          id?: string
          kind?: string
          match_id?: string
          qr_code?: string
          scanned_at?: string | null
          scanned_by?: string | null
          sector_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entries_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          id: string
          location: string | null
          notes: string | null
          starts_at: string
          team_id: string | null
          title: string
          type: string
        }
        Insert: {
          id?: string
          location?: string | null
          notes?: string | null
          starts_at: string
          team_id?: string | null
          title: string
          type?: string
        }
        Update: {
          id?: string
          location?: string | null
          notes?: string | null
          starts_at?: string
          team_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      fip_registrations: {
        Row: {
          card_number: string | null
          id: string
          notes: string | null
          person_id: string
          registered_at: string | null
          season_id: string | null
          status: string
          type: string
        }
        Insert: {
          card_number?: string | null
          id?: string
          notes?: string | null
          person_id: string
          registered_at?: string | null
          season_id?: string | null
          status?: string
          type?: string
        }
        Update: {
          card_number?: string | null
          id?: string
          notes?: string | null
          person_id?: string
          registered_at?: string | null
          season_id?: string | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fip_registrations_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fip_registrations_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      hospitality_events: {
        Row: {
          caterer: string | null
          cost: number | null
          guests: number | null
          id: string
          match_id: string
          menu: string | null
          notes: string | null
        }
        Insert: {
          caterer?: string | null
          cost?: number | null
          guests?: number | null
          id?: string
          match_id: string
          menu?: string | null
          notes?: string | null
        }
        Update: {
          caterer?: string | null
          cost?: number | null
          guests?: number | null
          id?: string
          match_id?: string
          menu?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hospitality_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      injuries: {
        Row: {
          created_at: string | null
          description: string | null
          event: string | null
          id: string
          injury_date: string
          person_id: string | null
          return_date: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          event?: string | null
          id?: string
          injury_date?: string
          person_id?: string | null
          return_date?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          event?: string | null
          id?: string
          injury_date?: string
          person_id?: string | null
          return_date?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "injuries_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category: string | null
          id: string
          name: string
          notes: string | null
          size: string | null
          stock: number | null
        }
        Insert: {
          category?: string | null
          id?: string
          name: string
          notes?: string | null
          size?: string | null
          stock?: number | null
        }
        Update: {
          category?: string | null
          id?: string
          name?: string
          notes?: string | null
          size?: string | null
          stock?: number | null
        }
        Relationships: []
      }
      ledger_entries: {
        Row: {
          account: string | null
          amount: number
          area: string
          attachment_url: string | null
          created_at: string | null
          description: string
          direction: string
          entry_date: string
          id: string
          method: string | null
          ref_id: string | null
          source: string | null
          vat_amount: number | null
        }
        Insert: {
          account?: string | null
          amount: number
          area?: string
          attachment_url?: string | null
          created_at?: string | null
          description: string
          direction?: string
          entry_date?: string
          id?: string
          method?: string | null
          ref_id?: string | null
          source?: string | null
          vat_amount?: number | null
        }
        Update: {
          account?: string | null
          amount?: number
          area?: string
          attachment_url?: string | null
          created_at?: string | null
          description?: string
          direction?: string
          entry_date?: string
          id?: string
          method?: string | null
          ref_id?: string | null
          source?: string | null
          vat_amount?: number | null
        }
        Relationships: []
      }
      match_checklist: {
        Row: {
          area: string
          assignee: string | null
          done: boolean
          id: string
          match_id: string
          notes: string | null
          sort: number | null
          task: string
        }
        Insert: {
          area: string
          assignee?: string | null
          done?: boolean
          id?: string
          match_id: string
          notes?: string | null
          sort?: number | null
          task: string
        }
        Update: {
          area?: string
          assignee?: string | null
          done?: boolean
          id?: string
          match_id?: string
          notes?: string | null
          sort?: number | null
          task?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_checklist_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_shifts: {
        Row: {
          end_time: string | null
          id: string
          match_id: string
          notes: string | null
          person_name: string
          role: string
          start_time: string | null
        }
        Insert: {
          end_time?: string | null
          id?: string
          match_id: string
          notes?: string | null
          person_name: string
          role: string
          start_time?: string | null
        }
        Update: {
          end_time?: string | null
          id?: string
          match_id?: string
          notes?: string | null
          person_name?: string
          role?: string
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_shifts_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          aed_checked: boolean
          away_score: number | null
          blsd_operator: string | null
          commissioner: string | null
          competition: string | null
          created_at: string | null
          gates_open: string | null
          home_score: number | null
          id: string
          match_date: string
          notes: string | null
          opponent: string
          presale_url: string | null
          referees: string | null
          round: number | null
          season_id: string | null
          status: string
          tier: string
          tv: string | null
        }
        Insert: {
          aed_checked?: boolean
          away_score?: number | null
          blsd_operator?: string | null
          commissioner?: string | null
          competition?: string | null
          created_at?: string | null
          gates_open?: string | null
          home_score?: number | null
          id?: string
          match_date: string
          notes?: string | null
          opponent: string
          presale_url?: string | null
          referees?: string | null
          round?: number | null
          season_id?: string | null
          status?: string
          tier?: string
          tv?: string | null
        }
        Update: {
          aed_checked?: boolean
          away_score?: number | null
          blsd_operator?: string | null
          commissioner?: string | null
          competition?: string | null
          created_at?: string | null
          gates_open?: string | null
          home_score?: number | null
          id?: string
          match_date?: string
          notes?: string | null
          opponent?: string
          presale_url?: string | null
          referees?: string | null
          round?: number | null
          season_id?: string | null
          status?: string
          tier?: string
          tv?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_certificates: {
        Row: {
          created_at: string | null
          doctor: string | null
          expiry_date: string
          file_url: string | null
          id: string
          person_id: string
          type: string
          verified: boolean | null
          visit_date: string | null
        }
        Insert: {
          created_at?: string | null
          doctor?: string | null
          expiry_date: string
          file_url?: string | null
          id?: string
          person_id: string
          type?: string
          verified?: boolean | null
          visit_date?: string | null
        }
        Update: {
          created_at?: string | null
          doctor?: string | null
          expiry_date?: string
          file_url?: string | null
          id?: string
          person_id?: string
          type?: string
          verified?: boolean | null
          visit_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_certificates_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      persons: {
        Row: {
          address: string | null
          birth_date: string | null
          birth_place: string | null
          citizenship: string | null
          created_at: string | null
          deleted_at: string | null
          email: string | null
          emergency_contact: string | null
          fip_category: string | null
          first_name: string
          id: string
          last_name: string
          medical_notes: string | null
          phone: string | null
          sex: string | null
          size: string | null
          tax_code: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          birth_place?: string | null
          citizenship?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          emergency_contact?: string | null
          fip_category?: string | null
          first_name: string
          id?: string
          last_name: string
          medical_notes?: string | null
          phone?: string | null
          sex?: string | null
          size?: string | null
          tax_code?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          birth_place?: string | null
          citizenship?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          emergency_contact?: string | null
          fip_category?: string | null
          first_name?: string
          id?: string
          last_name?: string
          medical_notes?: string | null
          phone?: string | null
          sex?: string | null
          size?: string | null
          tax_code?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      price_list: {
        Row: {
          id: string
          price: number
          season_id: string | null
          sector_id: string | null
          ticket_type: string
          tier: string
        }
        Insert: {
          id?: string
          price?: number
          season_id?: string | null
          sector_id?: string | null
          ticket_type: string
          tier?: string
        }
        Update: {
          id?: string
          price?: number
          season_id?: string | null
          sector_id?: string | null
          ticket_type?: string
          tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_list_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      seasons: {
        Row: {
          created_at: string | null
          end_date: string
          id: string
          is_active: boolean
          name: string
          start_date: string
        }
        Insert: {
          created_at?: string | null
          end_date: string
          id?: string
          is_active?: boolean
          name: string
          start_date: string
        }
        Update: {
          created_at?: string | null
          end_date?: string
          id?: string
          is_active?: boolean
          name?: string
          start_date?: string
        }
        Relationships: []
      }
      sectors: {
        Row: {
          capacity: number
          id: string
          is_numbered: boolean | null
          kind: string | null
          name: string
          sort: number | null
        }
        Insert: {
          capacity?: number
          id?: string
          is_numbered?: boolean | null
          kind?: string | null
          name: string
          sort?: number | null
        }
        Update: {
          capacity?: number
          id?: string
          is_numbered?: boolean | null
          kind?: string | null
          name?: string
          sort?: number | null
        }
        Relationships: []
      }
      sponsor_assets: {
        Row: {
          category: string
          id: string
          name: string
          notes: string | null
          price: number
          quantity: number
          season_id: string | null
          unit: string | null
        }
        Insert: {
          category: string
          id?: string
          name: string
          notes?: string | null
          price?: number
          quantity?: number
          season_id?: string | null
          unit?: string | null
        }
        Update: {
          category?: string
          id?: string
          name?: string
          notes?: string | null
          price?: number
          quantity?: number
          season_id?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_assets_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_contracts: {
        Row: {
          amount_cash: number
          amount_goods: number
          auto_renew: boolean | null
          created_at: string | null
          end_date: string | null
          hospitality_per_match: number
          id: string
          is_barter: boolean
          led_seconds_per_match: number
          notes: string | null
          pdf_url: string | null
          posts_per_season: number
          season_id: string | null
          signed_at: string | null
          sponsor_id: string
          start_date: string | null
          status: string
          tickets_per_match: number
          title: string | null
        }
        Insert: {
          amount_cash?: number
          amount_goods?: number
          auto_renew?: boolean | null
          created_at?: string | null
          end_date?: string | null
          hospitality_per_match?: number
          id?: string
          is_barter?: boolean
          led_seconds_per_match?: number
          notes?: string | null
          pdf_url?: string | null
          posts_per_season?: number
          season_id?: string | null
          signed_at?: string | null
          sponsor_id: string
          start_date?: string | null
          status?: string
          tickets_per_match?: number
          title?: string | null
        }
        Update: {
          amount_cash?: number
          amount_goods?: number
          auto_renew?: boolean | null
          created_at?: string | null
          end_date?: string | null
          hospitality_per_match?: number
          id?: string
          is_barter?: boolean
          led_seconds_per_match?: number
          notes?: string | null
          pdf_url?: string | null
          posts_per_season?: number
          season_id?: string | null
          signed_at?: string | null
          sponsor_id?: string
          start_date?: string | null
          status?: string
          tickets_per_match?: number
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_contracts_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsor_contracts_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_deliverables: {
        Row: {
          contract_id: string
          created_at: string | null
          delivered: boolean
          delivered_at: string | null
          description: string | null
          due_date: string | null
          id: string
          interactions: number | null
          match_id: string | null
          proof_url: string | null
          type: string
        }
        Insert: {
          contract_id: string
          created_at?: string | null
          delivered?: boolean
          delivered_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          interactions?: number | null
          match_id?: string | null
          proof_url?: string | null
          type: string
        }
        Update: {
          contract_id?: string
          created_at?: string | null
          delivered?: boolean
          delivered_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          interactions?: number | null
          match_id?: string | null
          proof_url?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_deliverables_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "sponsor_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_installments: {
        Row: {
          amount: number
          contract_id: string
          due_date: string
          id: string
          invoice_number: string | null
          invoiced_at: string | null
          notes: string | null
          paid_at: string | null
          vat_rate: number
        }
        Insert: {
          amount: number
          contract_id: string
          due_date: string
          id?: string
          invoice_number?: string | null
          invoiced_at?: string | null
          notes?: string | null
          paid_at?: string | null
          vat_rate?: number
        }
        Update: {
          amount?: number
          contract_id?: string
          due_date?: string
          id?: string
          invoice_number?: string | null
          invoiced_at?: string | null
          notes?: string | null
          paid_at?: string | null
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_installments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "sponsor_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_levels: {
        Row: {
          id: string
          list_price: number | null
          name: string
          sort: number | null
        }
        Insert: {
          id?: string
          list_price?: number | null
          name: string
          sort?: number | null
        }
        Update: {
          id?: string
          list_price?: number | null
          name?: string
          sort?: number | null
        }
        Relationships: []
      }
      sponsors: {
        Row: {
          address: string | null
          contact_name: string | null
          created_at: string | null
          deleted_at: string | null
          email: string | null
          expected_value: number | null
          id: string
          level_id: string | null
          logo_url: string | null
          name: string
          notes: string | null
          phone: string | null
          pipeline_stage: string
          portal_user_id: string | null
          vat_number: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          expected_value?: number | null
          id?: string
          level_id?: string | null
          logo_url?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          pipeline_stage?: string
          portal_user_id?: string | null
          vat_number?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          expected_value?: number | null
          id?: string
          level_id?: string | null
          logo_url?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          pipeline_stage?: string
          portal_user_id?: string | null
          vat_number?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsors_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "sponsor_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      subscribers: {
        Row: {
          created_at: string | null
          email: string | null
          first_name: string
          id: string
          last_name: string
          paid: boolean
          payment_method: string | null
          phone: string | null
          price: number
          qr_code: string
          renewed_from_previous: boolean | null
          season_id: string | null
          seat: string | null
          sector_id: string | null
          sub_type: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          paid?: boolean
          payment_method?: string | null
          phone?: string | null
          price?: number
          qr_code?: string
          renewed_from_previous?: boolean | null
          season_id?: string | null
          seat?: string | null
          sector_id?: string | null
          sub_type?: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          paid?: boolean
          payment_method?: string | null
          phone?: string | null
          price?: number
          qr_code?: string
          renewed_from_previous?: boolean | null
          season_id?: string | null
          seat?: string | null
          sector_id?: string | null
          sub_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscribers_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscribers_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          jersey: number | null
          person_id: string
          role: string
          team_id: string
        }
        Insert: {
          id?: string
          jersey?: number | null
          person_id: string
          role?: string
          team_id: string
        }
        Update: {
          id?: string
          jersey?: number | null
          person_id?: string
          role?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          birth_years: string | null
          category: string
          created_at: string | null
          id: string
          league: string | null
          name: string
          season_id: string | null
        }
        Insert: {
          birth_years?: string | null
          category: string
          created_at?: string | null
          id?: string
          league?: string | null
          name: string
          season_id?: string | null
        }
        Update: {
          birth_years?: string | null
          category?: string
          created_at?: string | null
          id?: string
          league?: string | null
          name?: string
          season_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_sales: {
        Row: {
          channel: string
          created_at: string | null
          id: string
          match_id: string
          payment_method: string
          qr_code: string
          qty: number
          sector_id: string | null
          shift_id: string | null
          ticket_type: string
          total: number
          unit_price: number
        }
        Insert: {
          channel?: string
          created_at?: string | null
          id?: string
          match_id: string
          payment_method?: string
          qr_code?: string
          qty?: number
          sector_id?: string | null
          shift_id?: string | null
          ticket_type?: string
          total?: number
          unit_price?: number
        }
        Update: {
          channel?: string
          created_at?: string | null
          id?: string
          match_id?: string
          payment_method?: string
          qr_code?: string
          qty?: number
          sector_id?: string | null
          shift_id?: string | null
          ticket_type?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "ticket_sales_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_sales_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_sales_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "cash_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          season_id: string | null
          team_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          season_id?: string | null
          team_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          season_id?: string | null
          team_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      complete_deadline: {
        Args: { _attachment?: string; _done?: string; _id: string }
        Returns: string
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff_of: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      match_availability: {
        Args: { _match: string }
        Returns: {
          accreditations: number
          capacity: number
          entered: number
          free: number
          sector_id: string
          sector_name: string
          sold: number
          subscribers: number
        }[]
      }
      register_bordero: { Args: { _match: string }; Returns: number }
      scan_qr: { Args: { _code: string; _match: string }; Returns: Json }
    }
    Enums: {
      app_role:
        | "superadmin"
        | "direttivo"
        | "segreteria"
        | "tesoriere"
        | "direttore_sportivo"
        | "allenatore"
        | "dirigente_accompagnatore"
        | "ufficio_stampa"
        | "responsabile_safeguarding"
        | "responsabile_commerciale"
        | "cassiere"
        | "steward"
        | "genitore"
        | "atleta"
        | "sponsor"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: [
        "superadmin",
        "direttivo",
        "segreteria",
        "tesoriere",
        "direttore_sportivo",
        "allenatore",
        "dirigente_accompagnatore",
        "ufficio_stampa",
        "responsabile_safeguarding",
        "responsabile_commerciale",
        "cassiere",
        "steward",
        "genitore",
        "atleta",
        "sponsor",
      ],
    },
  },
} as const
