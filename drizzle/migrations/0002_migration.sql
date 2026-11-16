
alter table public.club_settings add column ical_token text not null default encode(gen_random_bytes(16),'hex');
