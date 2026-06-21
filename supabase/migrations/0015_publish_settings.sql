-- Per-project publication-preparation settings (metadata + formatting choices).
alter table projects add column if not exists publish_settings jsonb;
