// The kind of work a project holds. Drives vocabulary, nav layout, and
// (later) export formatting, without changing the underlying chapter/scene model.

export type ProjectForm = "novel" | "short_story" | "poetry" | "essay";

export type FormTerms = {
  label: string; // human name of the form
  /** Two-level (chapters → scenes) or a flat list of pieces. */
  flat: boolean;
  groupSingular: string; // e.g. "Chapter" / "Section"
  groupPlural: string; // e.g. "Chapters"
  pieceSingular: string; // e.g. "Scene" / "Poem" / "Story"
  piecePlural: string; // e.g. "Scenes" / "Poems"
  /** What the flat list is called in the nav header. */
  flatHeader: string;
  hint: string;
};

export const PROJECT_FORMS: ProjectForm[] = ["novel", "short_story", "poetry", "essay"];

export const FORM_TERMS: Record<ProjectForm, FormTerms> = {
  novel: {
    label: "Novel",
    flat: false,
    groupSingular: "Chapter",
    groupPlural: "Chapters",
    pieceSingular: "Scene",
    piecePlural: "Scenes",
    flatHeader: "Chapters",
    hint: "Chapters and scenes",
  },
  short_story: {
    label: "Short story",
    flat: true,
    groupSingular: "Part",
    groupPlural: "Parts",
    pieceSingular: "Story",
    piecePlural: "Stories",
    flatHeader: "Stories",
    hint: "A piece or a collection",
  },
  poetry: {
    label: "Poetry",
    flat: true,
    groupSingular: "Section",
    groupPlural: "Sections",
    pieceSingular: "Poem",
    piecePlural: "Poems",
    flatHeader: "Poems",
    hint: "Poems, kept as a collection",
  },
  essay: {
    label: "Essay",
    flat: true,
    groupSingular: "Section",
    groupPlural: "Sections",
    pieceSingular: "Section",
    piecePlural: "Sections",
    flatHeader: "Sections",
    hint: "An essay or a set of them",
  },
};

export function asForm(value: unknown): ProjectForm {
  return PROJECT_FORMS.includes(value as ProjectForm) ? (value as ProjectForm) : "novel";
}

export function termsFor(form: unknown): FormTerms {
  return FORM_TERMS[asForm(form)];
}
