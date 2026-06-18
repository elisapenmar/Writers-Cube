export type BrainstormMode = "open" | "backward";

export const BRAINSTORM_MODES: Record<
  BrainstormMode,
  { name: string; description: string; openers: string[] }
> = {
  open: {
    name: "Open",
    description: "Wander freely. The partner follows your lead.",
    openers: [
      "Tell me the seed — the moment, image, or what-if that won't leave you alone.",
      "What's the world or feeling this story lives in?",
      "Who is at the heart of it?",
    ],
  },
  backward: {
    name: "From the ending",
    description: "Start at the last scene and work backward toward the beginning.",
    openers: [
      "Picture the very last scene. What's the final image the reader closes the book on?",
      "Who is your protagonist in that closing moment — what's changed in them?",
      "What's the emotional landing point you want the reader to feel?",
    ],
  },
};
