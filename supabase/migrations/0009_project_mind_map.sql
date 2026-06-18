-- Persistent mind map per project. Nodes + manual position overrides.
-- Shape:
--   { "nodes": [{ "id", "label", "parent?" }, ...],
--     "positions": { "<nodeId>": { "x": number, "y": number } } }
-- positions is sparse — nodes without a saved position fall back to auto-layout.

alter table projects
  add column if not exists mind_map jsonb not null
    default '{"nodes":[],"positions":{}}'::jsonb;
