
create policy "staff documenti" on storage.objects for all to authenticated
using (bucket_id in ('documenti','contratti') and public.has_any_role(auth.uid(), array['direttivo','segreteria','tesoriere','responsabile_commerciale','ufficio_stampa']::public.app_role[]))
with check (bucket_id in ('documenti','contratti') and public.has_any_role(auth.uid(), array['direttivo','segreteria','tesoriere','responsabile_commerciale','ufficio_stampa']::public.app_role[]));
create policy "segreteria certificati" on storage.objects for all to authenticated
using (bucket_id = 'certificati' and public.has_any_role(auth.uid(), array['segreteria']::public.app_role[]))
with check (bucket_id = 'certificati' and public.has_any_role(auth.uid(), array['segreteria']::public.app_role[]));
create policy "superadmin impostazioni" on public.club_settings for all to authenticated using (public.has_role(auth.uid(),'superadmin')) with check (public.has_role(auth.uid(),'superadmin'));
