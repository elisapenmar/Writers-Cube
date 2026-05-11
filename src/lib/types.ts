export type Scene = {
  id: string;
  chapter_id: string;
  title: string;
  position: number;
  content: unknown;
  word_count: number;
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
  chapters: Chapter[];
};
