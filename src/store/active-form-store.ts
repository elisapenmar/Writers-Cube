"use client";

// The active project's form, set by the side-nav (which has `project.form`) and
// read by the organize panel so it can filter Story-Bible tabs per form without
// threading the form through props. Global UI state, not persisted.

import { create } from "zustand";
import { asForm, type ProjectForm } from "@/lib/project-forms";

type ActiveFormState = {
  form: ProjectForm;
  setForm: (form: unknown) => void;
};

export const useActiveForm = create<ActiveFormState>((set) => ({
  form: "novel",
  setForm: (form) => set({ form: asForm(form) }),
}));
