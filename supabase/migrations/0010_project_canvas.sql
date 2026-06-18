-- Freeform canvas per project. Items are positioned text/image blocks.
-- Shape: { "items": [{ "id", "type": "text"|"image", "x", "y", "width", "height", "content" }, ...] }

alter table projects
  add column if not exists canvas jsonb not null
    default '{"items":[]}'::jsonb;
