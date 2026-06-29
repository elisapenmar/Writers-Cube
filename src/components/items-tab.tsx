"use client";

import { ElementTab } from "@/components/element-tab";
import { listItems, createItem, updateItem, deleteItem } from "@/server/items";
import { useOrganize } from "@/store/organize-store";

export function ItemsTab() {
  const focusId = useOrganize((s) => s.focusItemId);
  const setFocusId = useOrganize((s) => s.setFocusItemId);
  return (
    <ElementTab
      noun="item"
      emptyHint="No items yet. Add the objects and artifacts in your story so they light up in the manuscript."
      load={listItems}
      create={createItem}
      update={updateItem}
      remove={deleteItem}
      focusId={focusId}
      clearFocus={() => setFocusId(null)}
    />
  );
}
