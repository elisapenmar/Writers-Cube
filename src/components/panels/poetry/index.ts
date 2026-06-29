// Stream C: poetry language sidebar. Registers the "language" group (one tool
// button in the poetry side-nav) with three tabs: word lookup, poetic-form
// templates, and collection grouping. Poetry's form-config already lists the
// `language` tool, so this registration is all the side-nav needs to show it.

import { registerGroup } from "@/components/panels/registry";
import { LookupTab } from "@/components/panels/poetry/lookup-tab";
import { FormsTab } from "@/components/panels/poetry/forms-tab";
import { CollectionsTab } from "@/components/panels/poetry/collections-tab";

registerGroup({
  id: "language",
  label: "Language",
  icon: "🪶",
  forms: ["poetry"],
  tabs: [
    { id: "lookup", label: "Lookup", Component: LookupTab },
    { id: "forms", label: "Forms", Component: FormsTab },
    { id: "collections", label: "Collections", Component: CollectionsTab },
  ],
});
