import { supabase } from "@/integrations/supabase/client";
// Client non tipizzato per le pagine generiche (CRUD configurabili).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db: any = supabase;
