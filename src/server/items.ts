"use server";

import {
  listElements,
  createElement,
  updateElement,
  deleteElement,
  type StoryItem,
} from "@/server/story-element-crud";

export type Item = StoryItem;

export async function listItems(): Promise<Item[]> {
  return listElements("items");
}

export async function createItem(): Promise<Item> {
  return createElement("items", "New item");
}

export async function updateItem(
  id: string,
  patch: { name?: string; category?: string | null; description?: string },
): Promise<void> {
  return updateElement("items", id, patch);
}

export async function deleteItem(id: string): Promise<void> {
  return deleteElement("items", id);
}
