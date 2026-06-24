-- Rich-text content for a story kernel, edited in the word processor on its
-- detail page. The dashboard card keeps the quick plain `body` note; `content`
-- holds the developed Tiptap doc (seeded from `body` when first opened).
alter table story_kernels add column if not exists content jsonb;
