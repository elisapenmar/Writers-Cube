"use client";

import { ElementTab } from "@/components/element-tab";
import { listPlaces, createPlace, updatePlace, deletePlace } from "@/server/places";
import { useOrganize } from "@/store/organize-store";

export function PlacesTab() {
  const focusId = useOrganize((s) => s.focusPlaceId);
  const setFocusId = useOrganize((s) => s.setFocusPlaceId);
  return (
    <ElementTab
      noun="place"
      emptyHint="No places yet. Add the locations and settings in your story so they light up in the manuscript."
      load={listPlaces}
      create={createPlace}
      update={updatePlace}
      remove={deletePlace}
      focusId={focusId}
      clearFocus={() => setFocusId(null)}
    />
  );
}
