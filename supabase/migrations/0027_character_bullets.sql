-- Per-bullet citations for a character: an array of
-- { text, sceneId, chapterId } aligned with the character's description bullets,
-- produced by the "Cite from manuscript" action. `description` stays the
-- editable source of truth; `bullets` is an auxiliary citation map.
alter table characters add column if not exists bullets jsonb;
