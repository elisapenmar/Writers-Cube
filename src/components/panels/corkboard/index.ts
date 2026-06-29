// Stream A (Wave 1): the Corkboard group. Registers ONE tool button + tab into
// the panel spine. Form-agnostic (no `forms`), so any form whose form-config
// `tools` array names "corkboard" gets it. Activated by the append-only import
// in `src/components/panels/index.ts`.

import { registerGroup } from "@/components/panels/registry";
import { CorkboardPanel } from "@/components/panels/corkboard/corkboard-panel";

registerGroup({
  id: "corkboard",
  label: "Corkboard",
  icon: "📇",
  tabs: [{ id: "corkboard", label: "Corkboard", Component: CorkboardPanel }],
});
