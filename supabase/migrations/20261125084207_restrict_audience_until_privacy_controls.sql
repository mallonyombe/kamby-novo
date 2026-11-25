-- Pause audience ingestion while the app has no measurement preference.
revoke execute on function public.kg_record_app_session(uuid,uuid) from public, anon, authenticated;
revoke execute on function public.kg_admin_audience(integer) from public, anon;
