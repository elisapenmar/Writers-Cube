-- Soft-archive flag for projects. NULL = active; timestamp = archived.
alter table projects add column if not exists archived_at timestamptz;
