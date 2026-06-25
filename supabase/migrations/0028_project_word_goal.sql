-- Optional target word count for a project, for the writing-goal progress meter.
alter table projects add column if not exists word_goal integer;
