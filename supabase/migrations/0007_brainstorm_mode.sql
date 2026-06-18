-- Conversation mode for the AI thought partner. 'open' is the default
-- free-form conversation; 'backward' uses reverse-outlining (start at the ending).

alter table brainstorms
  add column if not exists mode text not null default 'open';
