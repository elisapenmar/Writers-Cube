export type Scene = {
  id: string;
  chapter_id: string;
  title: string;
  position: number;
  content: unknown;
  word_count: number;
  updated_at: string;
  /** Poetry only: which collection (chapbook) this poem is filed under, if any. */
  collection_id?: string | null;
};

/** A poetry collection (chapbook) that groups a project's poems. */
export type Collection = {
  id: string;
  project_id: string;
  title: string;
  description: string;
  position: number;
  updated_at: string;
};

export type Chapter = {
  id: string;
  project_id: string;
  title: string;
  position: number;
  scenes: Scene[];
};

export type ProjectTree = {
  id: string;
  title: string;
  author_name: string | null;
  agent_name: string | null;
  form: string;
  chapters: Chapter[];
};
