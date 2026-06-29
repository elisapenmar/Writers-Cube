"use server";

import {
  listElements,
  createElement,
  updateElement,
  deleteElement,
  elementChapterMatrix,
  pullElementsFromBrainstorm,
  pullElementsFromProject,
  type StoryItem,
  type ElementMatrix,
} from "@/server/story-element-crud";

export type Place = StoryItem;

export async function listPlaces(): Promise<Place[]> {
  return listElements("places");
}

export async function createPlace(): Promise<Place> {
  return createElement("places", "New place");
}

export async function updatePlace(
  id: string,
  patch: { name?: string; category?: string | null; description?: string },
): Promise<void> {
  return updateElement("places", id, patch);
}

export async function deletePlace(id: string): Promise<void> {
  return deleteElement("places", id);
}

export async function placesChapterMatrix(): Promise<ElementMatrix> {
  return elementChapterMatrix("places");
}

export async function pullPlacesFromBrainstorm() {
  return pullElementsFromBrainstorm("places", "place");
}

export async function pullPlacesFromProject() {
  return pullElementsFromProject("places", "place");
}
