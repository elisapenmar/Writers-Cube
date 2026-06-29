-- Corkboard: a short synopsis for each scene/piece, shown on its index card.
-- Idempotent so re-applying is safe; the orchestrator applies Wave-1 migrations.
alter table scenes add column if not exists synopsis text;
