// Writer's Cube — seed prompt corpus.
// Authored exemplars; the production engine may also generate prompts with the
// LLM using these as few-shot examples (see HANDOFF §3).

export type PromptFocus =
  | "character"
  | "setting"
  | "plot"
  | "voice"
  | "dialogue"
  | "sensory";

export type PromptFormat = "exercise" | "seed";
export type PromptMode = "new" | "existing" | "both";
export type PromptDepth = "warmup" | "deep" | "any";

export type PromptObject = {
  id: string;
  format: PromptFormat;
  focus: PromptFocus;
  mode: PromptMode;
  depth: PromptDepth;
  /** May contain {{slots}}: {{character}}, {{character2}}, {{place}}, {{thread}}, {{object}}. */
  text: string;
  /** Seeds only — the open craft question. */
  question?: string;
  /** Exercises only — the explicit rule. */
  constraint?: string;
  /** The "Go deeper" escalation (may contain slots). */
  deeper: string;
  /** Optional craft lineage shown as a tag. */
  source?: string;
};

export const FOCUS_META: Record<
  PromptFocus,
  { label: string; pips: number; blurb: string }
> = {
  character: { label: "Character", pips: 1, blurb: "Interiority, motive, contradiction" },
  setting: { label: "Setting & world", pips: 2, blurb: "Place, atmosphere, the built world" },
  plot: { label: "Plot & structure", pips: 3, blurb: "Cause, consequence, escalation" },
  voice: { label: "Voice & POV", pips: 4, blurb: "Narration, distance, sensibility" },
  dialogue: { label: "Dialogue", pips: 5, blurb: "Subtext, rhythm, power" },
  sensory: { label: "Sensory detail", pips: 6, blurb: "The concrete, the felt, the specific" },
};

export const PROMPT_LIBRARY: PromptObject[] = [
  // ---------- Dialogue ----------
  {
    id: "dialogue-subtext-exercise",
    format: "exercise",
    focus: "dialogue",
    mode: "both",
    depth: "warmup",
    text: "Write an argument in which neither person says what the fight is really about.",
    constraint: "No dialogue tags and no action beats — pure speech, nothing else.",
    deeper: "Now let the real subject be {{thread}}, surfacing only in what they refuse to say.",
    source: "indirect characterization",
  },
  {
    id: "dialogue-subtext-seed",
    format: "seed",
    focus: "dialogue",
    mode: "both",
    depth: "warmup",
    text: "{{character}} and {{character2}} are arguing in {{place}}, and people nearby are starting to stare.",
    question:
      "How does their dialogue prove — without either saying so — that neither really knows what they're fighting about?",
    deeper: "Reveal mid-scene that the argument is a proxy for {{thread}}, and neither will name it.",
    source: "dialogue subtext",
  },
  {
    id: "dialogue-power-seed",
    format: "seed",
    focus: "dialogue",
    mode: "both",
    depth: "deep",
    text: "{{character}} needs something from {{character2}}, who holds all the power, and they both know it.",
    question:
      "How does the balance of power shift, line by line, until it has quietly reversed by the end?",
    deeper: "Have the reversal cost {{character}} the very thing they came to protect.",
    source: "status transactions",
  },

  // ---------- Character ----------
  {
    id: "character-contradiction-exercise",
    format: "exercise",
    focus: "character",
    mode: "both",
    depth: "warmup",
    text: "Show a character doing something that contradicts what they just told someone they believe.",
    constraint: "Never explain the contradiction. Let the action stand alone.",
    deeper: "Make the contradiction the hinge the whole character turns on — and still don't explain it.",
    source: "showing vs. telling",
  },
  {
    id: "character-want-vs-need-seed",
    format: "seed",
    focus: "character",
    mode: "existing",
    depth: "deep",
    text: "{{character}} finally gets the thing they've wanted since the start — {{object}} — but in this scene it's the wrong thing.",
    question:
      "How does getting what they wanted reveal what they actually needed instead?",
    deeper: "Let {{character2}} be the one who sees it first, and say nothing.",
    source: "want vs. need",
  },
  {
    id: "character-interiority-exercise",
    format: "exercise",
    focus: "character",
    mode: "existing",
    depth: "deep",
    text: "Write two pages of pure interior monologue for {{character}} while they do something utterly mundane.",
    constraint: "Nothing dramatic happens externally. The drama is all inside.",
    deeper: "Let a buried memory of {{thread}} intrude and refuse to leave.",
    source: "interiority",
  },
  {
    id: "character-mask-seed",
    format: "seed",
    focus: "character",
    mode: "both",
    depth: "warmup",
    text: "{{character}} is performing being fine for {{character2}}, and almost pulling it off.",
    question: "What single small detail gives them away to the reader but not to {{character2}}?",
    deeper: "Have {{character2}} notice too — and choose to let the performance continue.",
    source: "dramatic irony",
  },

  // ---------- Setting ----------
  {
    id: "setting-mood-exercise",
    format: "exercise",
    focus: "setting",
    mode: "both",
    depth: "warmup",
    text: "Describe a place so that the description carries an emotion the character won't admit to.",
    constraint: "Don't name the emotion anywhere. Let the place hold it.",
    deeper: "Now describe the same place again after {{thread}} has changed everything.",
    source: "objective correlative",
  },
  {
    id: "setting-throughcharacter-seed",
    format: "seed",
    focus: "setting",
    mode: "existing",
    depth: "warmup",
    text: "{{character}} returns to {{place}} after a long time away.",
    question:
      "How does the way they notice the place tell us who they've become since they left?",
    deeper: "Let one thing be exactly as they left it, and let that be the hardest part.",
    source: "place as character",
  },
  {
    id: "setting-world-rule-exercise",
    format: "exercise",
    focus: "setting",
    mode: "both",
    depth: "deep",
    text: "Establish one concrete rule of your world by showing its consequence, never by stating the rule.",
    constraint: "No exposition. The reader must infer the rule from a single event.",
    deeper: "Now break the rule, and let the breaking cost someone dearly.",
    source: "show-don't-tell worldbuilding",
  },

  // ---------- Plot ----------
  {
    id: "plot-reversal-exercise",
    format: "exercise",
    focus: "plot",
    mode: "both",
    depth: "warmup",
    text: "Write a scene that ends in the opposite emotional place from where it began.",
    constraint: "The turn must come from a decision a character makes, not from luck or coincidence.",
    deeper: "Make the decision irreversible, and make the character know it as they make it.",
    source: "scene turns",
  },
  {
    id: "plot-unresolved-seed",
    format: "seed",
    focus: "plot",
    mode: "existing",
    depth: "deep",
    text: "Pick up the thread you've left dangling — {{thread}} — and force it into the open.",
    question:
      "What scene would make it impossible for {{character}} to keep avoiding this?",
    deeper: "Make the confrontation arrive a beat too early, before {{character}} is ready.",
    source: "raising the stakes",
  },
  {
    id: "plot-ticking-clock-seed",
    format: "seed",
    focus: "plot",
    mode: "both",
    depth: "warmup",
    text: "{{character}} has until the end of this scene to do one thing, and {{character2}} is trying to stop them.",
    question: "How does the pressure of the deadline change what {{character}} is willing to do?",
    deeper: "Let {{character}} succeed at the task and lose {{character2}} in the process.",
    source: "tension under constraint",
  },

  // ---------- Voice ----------
  {
    id: "voice-unreliable-exercise",
    format: "exercise",
    focus: "voice",
    mode: "both",
    depth: "deep",
    text: "Narrate a scene in first person where the narrator is wrong about what's happening.",
    constraint: "The narrator never realizes it. The reader must.",
    deeper: "Let the reader catch the truth one paragraph before the narrator almost does — then doesn't.",
    source: "unreliable narration",
  },
  {
    id: "voice-distance-exercise",
    format: "exercise",
    focus: "voice",
    mode: "existing",
    depth: "warmup",
    text: "Write a paragraph about {{character}} in close third, then rewrite it in distant, cool third.",
    constraint: "Same events, same facts. Only the narrative distance changes.",
    deeper: "Now find the one sentence that only works in close, and decide what you lose without it.",
    source: "psychic distance",
  },
  {
    id: "voice-constraint-seed",
    format: "seed",
    focus: "voice",
    mode: "new",
    depth: "warmup",
    text: "A narrator describes an ordinary morning, but they are grieving and trying very hard not to.",
    question: "How does the grief leak into the syntax — the rhythm, the things they linger on?",
    deeper: "Never let them cry. Let one short sentence do what the crying would.",
    source: "voice under pressure",
  },

  // ---------- Sensory ----------
  {
    id: "sensory-singlesense-exercise",
    format: "exercise",
    focus: "sensory",
    mode: "both",
    depth: "warmup",
    text: "Render a charged moment using only sound and smell — no sight at all.",
    constraint: "Not one visual detail. If you can see it, cut it.",
    deeper: "Now add a single visual detail at the very end, and make it land like a gut-punch.",
    source: "sensory specificity",
  },
  {
    id: "sensory-object-seed",
    format: "seed",
    focus: "sensory",
    mode: "existing",
    depth: "warmup",
    text: "{{object}} appears in a scene with {{character}}, who has strong feelings about it.",
    question:
      "How can the physical, sensory details of {{object}} carry the whole weight of those feelings?",
    deeper: "Let {{object}} change hands by the end, and let the sensory description change with it.",
    source: "telling objects",
  },
  {
    id: "sensory-body-exercise",
    format: "exercise",
    focus: "sensory",
    mode: "both",
    depth: "deep",
    text: "Write an emotional turn entirely through bodily sensation — what the character feels in their body.",
    constraint: "Name no emotions. Only the body.",
    deeper: "Now let the body betray what the character is saying out loud.",
    source: "embodied emotion",
  },

  // ---------- Cross-focus warmups ----------
  {
    id: "character-first-line-seed",
    format: "seed",
    focus: "character",
    mode: "new",
    depth: "warmup",
    text: "A stranger sits down across from your protagonist and says, 'I know what you did.'",
    question: "Who is the stranger, what did the protagonist do, and how do they give themselves away?",
    deeper: "Make the stranger wrong about the specifics but right about the guilt.",
    source: "in medias res",
  },
  {
    id: "dialogue-monosyllable-exercise",
    format: "exercise",
    focus: "dialogue",
    mode: "new",
    depth: "warmup",
    text: "Write a tense exchange between two people where one of them can only answer in one word at a time.",
    constraint: "One speaker is limited to single words. The other can say anything.",
    deeper: "Reveal why they can only manage one word at a time, without stating it outright.",
    source: "constraint dialogue",
  },
  {
    id: "setting-weather-exercise",
    format: "exercise",
    focus: "setting",
    mode: "new",
    depth: "warmup",
    text: "Open a scene with weather, but make the weather do real narrative work.",
    constraint: "The weather must foreshadow or contradict what's coming. No decorative weather.",
    deeper: "Let the weather break exactly when the character's resolve does.",
    source: "pathetic fallacy, used deliberately",
  },
];

export function promptsForFilters(opts: {
  focuses: PromptFocus[];
  format: PromptFormat | null; // null = any
  depth: PromptDepth; // "any" = both
  mode: "new" | "existing";
}): PromptObject[] {
  return PROMPT_LIBRARY.filter((p) => {
    if (opts.focuses.length > 0 && !opts.focuses.includes(p.focus)) return false;
    if (opts.format && p.format !== opts.format) return false;
    if (opts.depth !== "any" && p.depth !== "any" && p.depth !== opts.depth) return false;
    if (opts.mode === "new" && p.mode === "existing") return false;
    if (opts.mode === "existing" && p.mode === "new") return false;
    return true;
  });
}
