
-- ========== RUOLI ==========
create type public.app_role as enum ('superadmin','direttivo','segreteria','tesoriere','direttore_sportivo','allenatore','dirigente_accompagnatore','ufficio_stampa','responsabile_safeguarding','responsabile_commerciale','cassiere','steward','genitore','atleta','sponsor');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text, full_name text, created_at timestamptz not null default now()
);
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  team_id uuid, season_id uuid,
  created_at timestamptz not null default now(),
  unique (user_id, role, team_id)
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
grant select, insert, update, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
create or replace function public.has_any_role(_user_id uuid, _roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and (role = any(_roles) or role = 'superadmin'))
$$;
create or replace function public.is_staff_of(_user_id uuid, _team_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('allenatore','dirigente_accompagnatore') and (team_id = _team_id or team_id is null))
$$;

create policy "profili lettura" on public.profiles for select to authenticated using (true);
create policy "profilo proprio" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "ruoli propri" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'superadmin'));
create policy "ruoli gestione" on public.user_roles for all to authenticated using (public.has_role(auth.uid(),'superadmin')) with check (public.has_role(auth.uid(),'superadmin'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id,email,full_name) values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  if not exists (select 1 from public.user_roles where role='superadmin') then
    insert into public.user_roles(user_id, role) values (new.id, 'superadmin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ========== AUDIT ==========
create table public.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid, table_name text not null, action text not null, record_id text,
  old_value jsonb, new_value jsonb, created_at timestamptz not null default now()
);
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
create policy "audit lettura" on public.audit_log for select to authenticated using (public.has_any_role(auth.uid(), array['direttivo']::public.app_role[]));

create or replace function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log(user_id,table_name,action,record_id,old_value,new_value)
  values (auth.uid(), tg_table_name, tg_op,
    coalesce(case when tg_op<>'DELETE' then to_jsonb(new)->>'id' end, to_jsonb(old)->>'id'),
    case when tg_op<>'INSERT' then to_jsonb(old) end,
    case when tg_op<>'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

-- ========== STRUTTURA ==========
create table public.club_settings (
  id int primary key default 1 check (id = 1),
  name text not null default 'La T Tecnica Gema Montecatini',
  legal_name text, tax_code text, vat_number text, rasd_number text, fip_code text,
  address text, pec text, iban text, legal_rep text, logo_url text,
  primary_color text default '#0B2A5B', accent_color text default '#C8102E',
  footer_text text default 'Main sponsor La T Tecnica S.p.A.',
  venue_name text default 'PalaTerme',
  fiscal_tickets boolean not null default false,
  sponsor_budget_target numeric not null default 900000,
  commercial_threshold numeric not null default 400000,
  default_reminder_days int[] not null default '{30,15,7,1}',
  guest_names_hours_before int not null default 48,
  updated_at timestamptz default now()
);
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null unique, start_date date not null, end_date date not null,
  is_active boolean not null default false, created_at timestamptz default now()
);
create table public.deadline_categories (
  id uuid primary key default gen_random_uuid(), name text not null unique, color text default '#0B2A5B', sort int default 0, description text
);
create table public.deadlines (
  id uuid primary key default gen_random_uuid(),
  title text not null, category text not null default 'Personalizzate',
  due_date date not null,
  recurrence text not null default 'una_volta' check (recurrence in ('una_volta','mensile','trimestrale','annuale','stagione')),
  amount numeric, owner_id uuid,
  link_type text, link_id uuid, source text, source_id uuid,
  status text not null default 'da_fare' check (status in ('da_fare','in_corso','fatto','annullato')),
  done_at date, attachment_url text, notes text,
  reminder_days int[] not null default '{30,15,7,1}',
  created_at timestamptz default now(), deleted_at timestamptz
);
create index on public.deadlines(due_date);

-- ========== SPONSOR ==========
create table public.sponsor_levels (
  id uuid primary key default gen_random_uuid(), name text not null unique, list_price numeric default 0, sort int default 0
);
create table public.sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null, level_id uuid references public.sponsor_levels(id),
  contact_name text, email text, phone text, vat_number text, address text, website text, logo_url text,
  pipeline_stage text not null default 'contatto' check (pipeline_stage in ('contatto','proposta','trattativa','firmato','rinnovo','perso')),
  expected_value numeric, notes text, portal_user_id uuid,
  created_at timestamptz default now(), deleted_at timestamptz
);
create table public.sponsor_assets (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references public.seasons(id), name text not null, category text not null,
  unit text default 'stagione', quantity int not null default 1, price numeric not null default 0, notes text
);
create table public.sponsor_contracts (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.sponsors(id) on delete cascade,
  season_id uuid references public.seasons(id),
  title text, amount_cash numeric not null default 0, amount_goods numeric not null default 0,
  is_barter boolean not null default false, start_date date, end_date date,
  auto_renew boolean default false, status text not null default 'attivo' check (status in ('bozza','attivo','scaduto','annullato')),
  signed_at date, tickets_per_match int not null default 0, hospitality_per_match int not null default 0,
  led_seconds_per_match int not null default 0, posts_per_season int not null default 0,
  pdf_url text, notes text, created_at timestamptz default now()
);
create table public.contract_assets (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.sponsor_contracts(id) on delete cascade,
  asset_id uuid not null references public.sponsor_assets(id) on delete cascade,
  quantity int not null default 1
);
create table public.sponsor_installments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.sponsor_contracts(id) on delete cascade,
  due_date date not null, amount numeric not null, vat_rate numeric not null default 22,
  invoice_number text, invoiced_at date, paid_at date, notes text
);
create table public.sponsor_deliverables (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.sponsor_contracts(id) on delete cascade,
  match_id uuid, type text not null, description text, due_date date,
  delivered boolean not null default false, delivered_at date, proof_url text, interactions int, created_at timestamptz default now()
);
create table public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.sponsors(id) on delete cascade,
  type text not null default 'chiamata', activity_date date not null default current_date,
  notes text, reminder_date date, done boolean default false, created_by uuid, created_at timestamptz default now()
);

-- ========== MATCH DAY ==========
create table public.sectors (
  id uuid primary key default gen_random_uuid(), name text not null unique, capacity int not null default 0,
  is_numbered boolean default false, sort int default 0, kind text default 'pubblico'
);
create table public.price_list (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references public.seasons(id), sector_id uuid references public.sectors(id) on delete cascade,
  ticket_type text not null, tier text not null default 'normale' check (tier in ('normale','cartello','playoff','abbonamento')),
  price numeric not null default 0
);
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references public.seasons(id), round int, opponent text not null,
  match_date timestamptz not null, gates_open time default '17:00', tier text not null default 'normale',
  competition text default 'Serie A2', tv text, referees text, commissioner text, presale_url text,
  aed_checked boolean not null default false, blsd_operator text, status text not null default 'programmata',
  home_score int, away_score int, notes text, created_at timestamptz default now()
);
create table public.subscribers (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references public.seasons(id), first_name text not null, last_name text not null,
  email text, phone text, sector_id uuid references public.sectors(id), seat text,
  sub_type text not null default 'intero', price numeric not null default 0,
  paid boolean not null default false, payment_method text, renewed_from_previous boolean default false,
  qr_code text not null unique default ('ABB-' || upper(substr(md5(random()::text),1,10))),
  created_at timestamptz default now()
);
create table public.accreditations (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  list_type text not null default 'sponsor', sponsor_id uuid references public.sponsors(id) on delete set null,
  full_name text not null, organization text, email text, sector_id uuid references public.sectors(id),
  is_hospitality boolean default false,
  qr_code text not null unique default ('ACC-' || upper(substr(md5(random()::text),1,10))),
  created_at timestamptz default now()
);
create table public.cash_shifts (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  operator_id uuid, operator_name text, opening_float numeric not null default 0,
  opened_at timestamptz default now(), closed_at timestamptz,
  counted_cash numeric, denominations jsonb, expected_cash numeric, notes text
);
create table public.ticket_sales (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  shift_id uuid references public.cash_shifts(id) on delete set null,
  sector_id uuid references public.sectors(id), ticket_type text not null default 'intero',
  qty int not null default 1, unit_price numeric not null default 0, total numeric not null default 0,
  payment_method text not null default 'contanti', channel text not null default 'botteghino',
  qr_code text not null unique default ('BIG-' || upper(substr(md5(random()::text),1,10))),
  created_at timestamptz default now()
);
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  qr_code text not null, kind text not null, sector_id uuid references public.sectors(id),
  scanned_by uuid, scanned_at timestamptz default now()
);
create index on public.entries(match_id, qr_code);
create table public.checklist_templates (
  id uuid primary key default gen_random_uuid(), area text not null, task text not null, sort int default 0
);
create table public.match_checklist (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  area text not null, task text not null, assignee text, done boolean not null default false, notes text, sort int default 0
);
create table public.match_shifts (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  role text not null, person_name text not null, start_time time, end_time time, notes text
);
create table public.hospitality_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  caterer text, guests int default 0, cost numeric default 0, menu text, notes text
);

-- ========== ECONOMIA ==========
create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null default current_date, description text not null,
  amount numeric not null, direction text not null default 'entrata' check (direction in ('entrata','uscita')),
  account text default 'Varie', area text not null default 'istituzionale' check (area in ('istituzionale','commerciale')),
  method text default 'banca', source text, ref_id uuid, vat_amount numeric default 0, attachment_url text,
  created_at timestamptz default now()
);

-- ========== ANAGRAFICA / SPORT ==========
create table public.persons (
  id uuid primary key default gen_random_uuid(),
  first_name text not null, last_name text not null, sex text, birth_date date, birth_place text,
  tax_code text unique, citizenship text default 'ITA', fip_category text default 'I',
  address text, email text, phone text, emergency_contact text, size text, medical_notes text,
  user_id uuid, created_at timestamptz default now(), deleted_at timestamptz
);
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references public.seasons(id), name text not null, category text not null,
  league text, birth_years text, created_at timestamptz default now()
);
create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  person_id uuid not null references public.persons(id) on delete cascade,
  role text not null default 'atleta', jersey int
);
create table public.medical_certificates (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id) on delete cascade,
  type text not null default 'agonistico', visit_date date, expiry_date date not null,
  doctor text, file_url text, verified boolean default false, created_at timestamptz default now()
);
create table public.fip_registrations (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id) on delete cascade,
  season_id uuid references public.seasons(id), type text not null default 'atleta',
  card_number text, status text not null default 'da_fare', registered_at date, notes text
);
create table public.injuries (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references public.persons(id) on delete cascade,
  injury_date date not null default current_date, event text, description text,
  status text default 'aperto', return_date date, created_at timestamptz default now()
);
create table public.aed_devices (
  id uuid primary key default gen_random_uuid(),
  location text not null, serial text, pads_expiry date, battery_expiry date, notes text
);
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null, body text, audience text default 'tutti', pinned boolean default false,
  created_by uuid, created_at timestamptz default now()
);
create table public.events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete cascade,
  type text not null default 'allenamento', title text not null, starts_at timestamptz not null,
  location text, notes text
);
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null, category text, size text, stock int default 0, notes text
);
create table public.assemblies (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'assemblea', meeting_date date not null, agenda text, minutes text, status text default 'convocata'
);
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  first_name text not null, last_name text not null, birth_date date, tax_code text,
  parent_name text, parent_email text, parent_phone text, requested_team text,
  status text not null default 'in_attesa', notes text, created_at timestamptz default now()
);

-- ========== GRANT + RLS GENERICHE ==========
do $$
declare r record;
  staff text := '{direttivo,segreteria,tesoriere,direttore_sportivo,responsabile_commerciale,ufficio_stampa}';
begin
  for r in select * from (values
    ('club_settings', '{direttivo,segreteria,tesoriere,direttore_sportivo,responsabile_commerciale,ufficio_stampa,cassiere,steward,allenatore,dirigente_accompagnatore,genitore,atleta,sponsor,responsabile_safeguarding}', '{}'),
    ('seasons', '{direttivo,segreteria,tesoriere,direttore_sportivo,responsabile_commerciale,ufficio_stampa,cassiere,steward,allenatore,dirigente_accompagnatore,genitore,atleta,sponsor}', '{segreteria}'),
    ('deadline_categories', staff, '{segreteria}'),
    ('deadlines', staff, '{direttivo,segreteria,tesoriere,responsabile_commerciale}'),
    ('sponsor_levels', staff, '{direttivo,responsabile_commerciale}'),
    ('sponsors', staff, '{direttivo,responsabile_commerciale}'),
    ('sponsor_assets', staff, '{direttivo,responsabile_commerciale}'),
    ('sponsor_contracts', staff, '{direttivo,responsabile_commerciale}'),
    ('contract_assets', staff, '{direttivo,responsabile_commerciale}'),
    ('sponsor_installments', staff, '{direttivo,responsabile_commerciale,tesoriere}'),
    ('sponsor_deliverables', staff, '{direttivo,responsabile_commerciale,ufficio_stampa}'),
    ('crm_activities', staff, '{direttivo,responsabile_commerciale}'),
    ('sectors', '{direttivo,segreteria,tesoriere,direttore_sportivo,responsabile_commerciale,ufficio_stampa,cassiere,steward,sponsor}', '{segreteria,tesoriere}'),
    ('price_list', '{direttivo,segreteria,tesoriere,responsabile_commerciale,cassiere}', '{segreteria,tesoriere}'),
    ('matches', '{direttivo,segreteria,tesoriere,direttore_sportivo,responsabile_commerciale,ufficio_stampa,cassiere,steward,allenatore,dirigente_accompagnatore,sponsor,genitore,atleta}', '{direttivo,segreteria}'),
    ('subscribers', '{direttivo,segreteria,tesoriere,responsabile_commerciale}', '{segreteria,tesoriere}'),
    ('accreditations', '{direttivo,segreteria,tesoriere,responsabile_commerciale,ufficio_stampa,cassiere}', '{segreteria,responsabile_commerciale,ufficio_stampa}'),
    ('cash_shifts', '{direttivo,segreteria,tesoriere,cassiere}', '{tesoriere,cassiere}'),
    ('ticket_sales', '{direttivo,segreteria,tesoriere,cassiere,responsabile_commerciale}', '{tesoriere,cassiere,segreteria}'),
    ('entries', '{direttivo,segreteria,tesoriere,responsabile_commerciale,steward}', '{}'),
    ('checklist_templates', staff, '{direttivo,segreteria}'),
    ('match_checklist', staff, '{direttivo,segreteria,ufficio_stampa}'),
    ('match_shifts', staff, '{direttivo,segreteria}'),
    ('hospitality_events', staff, '{direttivo,segreteria,responsabile_commerciale}'),
    ('ledger_entries', '{direttivo,tesoriere}', '{tesoriere}'),
    ('persons', '{direttivo,segreteria,direttore_sportivo,allenatore,dirigente_accompagnatore,tesoriere}', '{segreteria}'),
    ('teams', '{direttivo,segreteria,tesoriere,direttore_sportivo,allenatore,dirigente_accompagnatore,genitore,atleta}', '{segreteria,direttore_sportivo}'),
    ('team_members', '{direttivo,segreteria,direttore_sportivo,allenatore,dirigente_accompagnatore}', '{segreteria,direttore_sportivo}'),
    ('medical_certificates', '{direttivo,segreteria,direttore_sportivo}', '{segreteria}'),
    ('fip_registrations', '{direttivo,segreteria,direttore_sportivo,allenatore}', '{segreteria}'),
    ('injuries', '{direttivo,segreteria,direttore_sportivo,allenatore,dirigente_accompagnatore}', '{segreteria,direttore_sportivo,allenatore}'),
    ('aed_devices', staff, '{segreteria}'),
    ('announcements', '{direttivo,segreteria,tesoriere,direttore_sportivo,responsabile_commerciale,ufficio_stampa,allenatore,dirigente_accompagnatore,genitore,atleta,cassiere,steward}', '{segreteria,ufficio_stampa,direttivo}'),
    ('events', '{direttivo,segreteria,direttore_sportivo,allenatore,dirigente_accompagnatore,genitore,atleta}', '{segreteria,direttore_sportivo,allenatore}'),
    ('inventory_items', '{direttivo,segreteria}', '{segreteria}'),
    ('assemblies', '{direttivo,segreteria,tesoriere}', '{direttivo,segreteria}'),
    ('enrollments', '{direttivo,segreteria}', '{segreteria}')
  ) t(tbl, rd, wr)
  loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', r.tbl);
    execute format('grant all on public.%I to service_role', r.tbl);
    execute format('alter table public.%I enable row level security', r.tbl);
    execute format('create policy "lettura" on public.%I for select to authenticated using (public.has_any_role(auth.uid(), %L::public.app_role[]))', r.tbl, r.rd);
    execute format('create policy "scrittura" on public.%I for all to authenticated using (public.has_any_role(auth.uid(), %L::public.app_role[])) with check (public.has_any_role(auth.uid(), %L::public.app_role[]))', r.tbl, r.wr, r.wr);
  end loop;
end $$;

-- policy specifiche
create policy "le mie scadenze" on public.deadlines for select to authenticated using (owner_id = auth.uid());
create policy "le mie scadenze agg" on public.deadlines for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "sponsor proprio" on public.sponsors for select to authenticated using (portal_user_id = auth.uid());
create policy "contratti propri" on public.sponsor_contracts for select to authenticated using (exists (select 1 from public.sponsors s where s.id = sponsor_id and s.portal_user_id = auth.uid()));
create policy "controprestazioni proprie" on public.sponsor_deliverables for select to authenticated using (exists (select 1 from public.sponsor_contracts c join public.sponsors s on s.id=c.sponsor_id where c.id = contract_id and s.portal_user_id = auth.uid()));
create policy "ospiti propri lettura" on public.accreditations for select to authenticated using (exists (select 1 from public.sponsors s where s.id = sponsor_id and s.portal_user_id = auth.uid()));
create policy "ospiti propri inserimento" on public.accreditations for insert to authenticated with check (list_type='sponsor' and exists (select 1 from public.sponsors s where s.id = sponsor_id and s.portal_user_id = auth.uid()));
create policy "ospiti propri elimina" on public.accreditations for delete to authenticated using (exists (select 1 from public.sponsors s where s.id = sponsor_id and s.portal_user_id = auth.uid()));
create policy "iscrizione pubblica" on public.enrollments for insert to anon, authenticated with check (status = 'in_attesa');
grant insert on public.enrollments to anon;

-- audit
create trigger audit_deadlines after insert or update or delete on public.deadlines for each row execute function public.audit_trigger();
create trigger audit_sponsors after insert or update or delete on public.sponsors for each row execute function public.audit_trigger();
create trigger audit_contracts after insert or update or delete on public.sponsor_contracts for each row execute function public.audit_trigger();
create trigger audit_installments after insert or update or delete on public.sponsor_installments for each row execute function public.audit_trigger();
create trigger audit_ledger after insert or update or delete on public.ledger_entries for each row execute function public.audit_trigger();
create trigger audit_persons after insert or update or delete on public.persons for each row execute function public.audit_trigger();
create trigger audit_roles after insert or update or delete on public.user_roles for each row execute function public.audit_trigger();
create trigger audit_cash after insert or update or delete on public.cash_shifts for each row execute function public.audit_trigger();
create trigger audit_certs after insert or update or delete on public.medical_certificates for each row execute function public.audit_trigger();

-- ========== LOGICA ==========
-- asset non vendibile due volte
create or replace function public.check_asset_overlap()
returns trigger language plpgsql security definer set search_path = public as $$
declare _qty int; _sold int;
begin
  select quantity into _qty from public.sponsor_assets where id = new.asset_id;
  select coalesce(sum(ca.quantity),0) into _sold from public.contract_assets ca
    join public.sponsor_contracts c on c.id = ca.contract_id
    where ca.asset_id = new.asset_id and c.status <> 'annullato' and ca.id <> new.id;
  if _sold + new.quantity > _qty then
    raise exception 'Sovrapposizione: lo spazio è già venduto per questa stagione (disponibili %, richiesti %)', _qty - _sold, new.quantity;
  end if;
  return new;
end $$;
create trigger trg_asset_overlap before insert or update on public.contract_assets for each row execute function public.check_asset_overlap();

-- rate sponsor -> scadenzario + prima nota
create or replace function public.installment_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare _sp text; _cid uuid;
begin
  select s.name, c.id into _sp, _cid from public.sponsor_contracts c join public.sponsors s on s.id=c.sponsor_id where c.id = new.contract_id;
  if tg_op = 'INSERT' then
    insert into public.deadlines(title,category,due_date,amount,link_type,link_id,source,source_id,status,done_at)
    values ('Fatturare rata sponsor – '||_sp, 'Sponsor', new.due_date - 10, new.amount, 'sponsor_contract', _cid, 'rata_fatturazione', new.id,
            case when new.invoiced_at is not null then 'fatto' else 'da_fare' end, new.invoiced_at),
           ('Incassare rata sponsor – '||_sp, 'Sponsor', new.due_date, round(new.amount*(1+new.vat_rate/100),2), 'sponsor_contract', _cid, 'rata_incasso', new.id,
            case when new.paid_at is not null then 'fatto' else 'da_fare' end, new.paid_at);
  else
    update public.deadlines set due_date = new.due_date - 10, amount = new.amount,
      status = case when new.invoiced_at is not null then 'fatto' else 'da_fare' end, done_at = new.invoiced_at
      where source='rata_fatturazione' and source_id = new.id;
    update public.deadlines set due_date = new.due_date, amount = round(new.amount*(1+new.vat_rate/100),2),
      status = case when new.paid_at is not null then 'fatto' else 'da_fare' end, done_at = new.paid_at
      where source='rata_incasso' and source_id = new.id;
  end if;
  delete from public.ledger_entries where source='sponsor' and ref_id = new.id;
  if new.paid_at is not null then
    insert into public.ledger_entries(entry_date,description,amount,direction,account,area,method,source,ref_id,vat_amount)
    values (new.paid_at, 'Incasso sponsor '||_sp||coalesce(' – fatt. '||new.invoice_number,''), round(new.amount*(1+new.vat_rate/100),2), 'entrata', 'Sponsorizzazioni', 'commerciale', 'banca', 'sponsor', new.id, round(new.amount*new.vat_rate/100,2));
  end if;
  return new;
end $$;
create trigger trg_installment_sync after insert or update on public.sponsor_installments for each row execute function public.installment_sync();
create or replace function public.installment_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.deadlines where source_id = old.id and source in ('rata_fatturazione','rata_incasso');
  delete from public.ledger_entries where source='sponsor' and ref_id = old.id;
  return old;
end $$;
create trigger trg_installment_delete after delete on public.sponsor_installments for each row execute function public.installment_delete();

-- certificati -> scadenzario
create or replace function public.certificate_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare _n text;
begin
  select first_name||' '||last_name into _n from public.persons where id = new.person_id;
  delete from public.deadlines where source='certificato' and source_id = new.id;
  insert into public.deadlines(title,category,due_date,link_type,link_id,source,source_id,reminder_days)
  values ('Certificato medico '||new.type||' – '||_n, 'Sanità e sicurezza', new.expiry_date, 'persona', new.person_id, 'certificato', new.id, '{60,30,15,7,0}');
  return new;
end $$;
create trigger trg_certificate_sync after insert or update of expiry_date on public.medical_certificates for each row execute function public.certificate_sync();

-- partite -> scadenzario + checklist
create or replace function public.match_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare _d date := (new.match_date at time zone 'Europe/Rome')::date; _h int;
begin
  select guest_names_hours_before into _h from public.club_settings where id=1;
  if tg_op = 'INSERT' then
    insert into public.deadlines(title,category,due_date,link_type,link_id,source,source_id) values
      ('Tassa gara FIP/Lega – vs '||new.opponent, 'FIP/Lega', _d - 7, 'partita', new.id, 'partita', new.id),
      ('Comunicazione Questura/Comune e piano sicurezza – vs '||new.opponent, 'Impianto PalaTerme', _d - 10, 'partita', new.id, 'partita', new.id),
      ('Nominativi ospiti sponsor – vs '||new.opponent, 'Sponsor', _d - ceil(coalesce(_h,48)/24.0)::int, 'partita', new.id, 'partita', new.id),
      ('Borderò e chiusura casse – vs '||new.opponent, 'Fiscale/contabile', _d + 1, 'partita', new.id, 'partita', new.id);
    insert into public.match_checklist(match_id, area, task, sort)
      select new.id, area, task, sort from public.checklist_templates;
  else
    update public.deadlines set title = regexp_replace(title, ' – vs .*$', ' – vs '||new.opponent)
      where source='partita' and source_id = new.id;
  end if;
  return new;
end $$;
create trigger trg_match_sync after insert or update of opponent on public.matches for each row execute function public.match_sync();

-- completa scadenza + ricorrenza
create or replace function public.complete_deadline(_id uuid, _done date default current_date, _attachment text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare d public.deadlines; _next date; _new uuid;
begin
  select * into d from public.deadlines where id = _id;
  if d.id is null then raise exception 'Scadenza non trovata'; end if;
  if not (public.has_any_role(auth.uid(), array['direttivo','segreteria','tesoriere','responsabile_commerciale']::public.app_role[]) or d.owner_id = auth.uid()) then
    raise exception 'Permesso negato';
  end if;
  update public.deadlines set status='fatto', done_at=_done, attachment_url=coalesce(_attachment, attachment_url) where id=_id;
  _next := case d.recurrence when 'mensile' then d.due_date + interval '1 month' when 'trimestrale' then d.due_date + interval '3 months'
    when 'annuale' then d.due_date + interval '1 year' when 'stagione' then d.due_date + interval '1 year' else null end;
  if _next is not null then
    insert into public.deadlines(title,category,due_date,recurrence,amount,owner_id,link_type,link_id,notes,reminder_days)
    values (d.title,d.category,_next,d.recurrence,d.amount,d.owner_id,d.link_type,d.link_id,d.notes,d.reminder_days) returning id into _new;
  end if;
  return _new;
end $$;

-- disponibilità posti
create or replace function public.match_availability(_match uuid)
returns table(sector_id uuid, sector_name text, capacity int, subscribers bigint, accreditations bigint, sold bigint, free bigint, entered bigint)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, s.capacity,
    (select count(*) from public.subscribers b where b.sector_id=s.id and b.season_id=(select season_id from public.matches where id=_match)),
    (select count(*) from public.accreditations a where a.sector_id=s.id and a.match_id=_match),
    (select coalesce(sum(t.qty),0) from public.ticket_sales t where t.sector_id=s.id and t.match_id=_match),
    s.capacity
      - (select count(*) from public.subscribers b where b.sector_id=s.id and b.season_id=(select season_id from public.matches where id=_match))
      - (select count(*) from public.accreditations a where a.sector_id=s.id and a.match_id=_match)
      - (select coalesce(sum(t.qty),0) from public.ticket_sales t where t.sector_id=s.id and t.match_id=_match),
    (select count(*) from public.entries e where e.sector_id=s.id and e.match_id=_match)
  from public.sectors s
  where public.has_any_role(auth.uid(), array['direttivo','segreteria','tesoriere','responsabile_commerciale','cassiere','steward','ufficio_stampa','direttore_sportivo']::public.app_role[])
  order by s.sort
$$;

-- scansione QR
create or replace function public.scan_qr(_match uuid, _code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _season uuid; _kind text; _sector uuid; _label text; _qty int := 1; _used int; _last timestamptz; _sname text;
begin
  if not public.has_any_role(auth.uid(), array['steward','segreteria','direttivo']::public.app_role[]) then
    return jsonb_build_object('ok',false,'reason','Permesso negato');
  end if;
  _code := upper(trim(_code));
  select season_id into _season from public.matches where id=_match;
  select 'abbonato', sector_id, first_name||' '||last_name into _kind, _sector, _label from public.subscribers where qr_code=_code and season_id=_season and paid;
  if _kind is null then
    select case when is_hospitality then 'hospitality' else 'accredito' end, sector_id, full_name||coalesce(' ('||organization||')','') into _kind, _sector, _label from public.accreditations where qr_code=_code and match_id=_match;
  end if;
  if _kind is null then
    select 'biglietto', sector_id, ticket_type||' x'||qty, qty into _kind, _sector, _label, _qty from public.ticket_sales where qr_code=_code and match_id=_match;
  end if;
  if _kind is null then
    return jsonb_build_object('ok',false,'reason','QR non valido per questa partita (o abbonamento non pagato)');
  end if;
  select count(*), max(scanned_at) into _used, _last from public.entries where match_id=_match and qr_code=_code;
  select name into _sname from public.sectors where id=_sector;
  if _used >= _qty then
    return jsonb_build_object('ok',false,'reason','GIÀ ENTRATO alle '||to_char(_last at time zone 'Europe/Rome','HH24:MI'),'kind',_kind,'label',_label,'sector',_sname);
  end if;
  insert into public.entries(match_id,qr_code,kind,sector_id,scanned_by) values (_match,_code,_kind,_sector,auth.uid());
  return jsonb_build_object('ok',true,'kind',_kind,'label',_label,'sector',_sname,'remaining',_qty-_used-1);
end $$;

-- borderò -> prima nota
create or replace function public.register_bordero(_match uuid)
returns int language plpgsql security definer set search_path = public as $$
declare m public.matches; _n int;
begin
  if auth.uid() is not null and not public.has_any_role(auth.uid(), array['tesoriere','direttivo']::public.app_role[]) then
    raise exception 'Permesso negato';
  end if;
  select * into m from public.matches where id=_match;
  delete from public.ledger_entries where source='bordero' and ref_id=_match;
  insert into public.ledger_entries(entry_date,description,amount,direction,account,area,method,source,ref_id)
  select (m.match_date at time zone 'Europe/Rome')::date,
    'Borderò vs '||m.opponent||' – '||case when channel='online' then 'prevendita online' else 'botteghino '||payment_method end,
    sum(total), 'entrata', 'Biglietteria', 'commerciale',
    case when payment_method='contanti' then 'cassa' else 'banca' end, 'bordero', _match
  from public.ticket_sales where match_id=_match and total > 0
  group by channel, payment_method;
  get diagnostics _n = row_count;
  update public.matches set status='chiusa' where id=_match and match_date < now();
  return _n;
end $$;

grant execute on function public.complete_deadline(uuid,date,text) to authenticated;
grant execute on function public.match_availability(uuid) to authenticated;
grant execute on function public.scan_qr(uuid,text) to authenticated;
grant execute on function public.register_bordero(uuid) to authenticated;
