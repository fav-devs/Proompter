import { describe, expect, it } from "vitest";
import { advanceWordByWord, normalizeSpeech, wordSimilarity } from "@/lib/speech-follow";

const script = normalizeSpeech(`
  Welcome everyone to the show. Today we are going to walk through the product roadmap
  and talk about the features shipping this quarter. After that we will answer a few questions
  from the team before we wrap up for the day.
`);

// Helper: find the cursor position right AFTER a known word
const after = (word: string) => {
  const i = script.indexOf(word);
  if (i === -1) throw new Error(`word "${word}" not in script`);
  return i + 1;
};

describe("wordSimilarity", () => {
  it("exact match → 1", () => expect(wordSimilarity("roadmap", "roadmap")).toBe(1));
  it("close mis-recognition → high similarity", () => expect(wordSimilarity("features", "fetures")).toBeGreaterThan(0.7));
  it("short stop words only match exactly", () => {
    expect(wordSimilarity("to", "do")).toBe(0);
    expect(wordSimilarity("to", "to")).toBe(1);
  });
  it("unrelated words → 0", () => expect(wordSimilarity("roadmap", "elephant")).toBe(0));
});

describe("advanceWordByWord", () => {
  it("advances word-by-word on a clean sentence", () => {
    const cursor = advanceWordByWord(script, 0, normalizeSpeech("today we are going to walk"));
    expect(cursor).toBe(after("walk"));
  });

  it("lands on roadmap when that is the last spoken word", () => {
    const cursor = advanceWordByWord(script, 0, normalizeSpeech("today we are going to walk through the product roadmap"));
    expect(cursor).toBe(after("roadmap"));
  });

  it("skips a missed script word and keeps tracking", () => {
    // "are" omitted — should still reach "walk"
    const cursor = advanceWordByWord(script, 0, normalizeSpeech("today we going to walk"));
    expect(cursor).toBe(after("walk"));
  });

  it("ignores inserted filler words", () => {
    const cursor = advanceWordByWord(script, 0, normalizeSpeech("today we basically going to walk"));
    // "basically" is a filler — cursor still ends at after "walk"
    expect(cursor).toBe(after("walk"));
  });

  it("handles a STT mis-recognition via fuzzy match", () => {
    // "roadmep" close enough to "roadmap"
    const cursor = advanceWordByWord(script, 0, normalizeSpeech("today we are going to walk through the product roadmep"));
    expect(cursor).toBe(after("roadmap"));
  });

  it("never goes backward", () => {
    const start  = after("roadmap");
    const cursor = advanceWordByWord(script, start, normalizeSpeech("today we are"));
    // words already passed — should not retreat
    expect(cursor).toBeGreaterThanOrEqual(start);
  });

  it("can resync after jumping ahead (missed lines)", () => {
    const cursor = advanceWordByWord(
      script,
      after("today"),
      normalizeSpeech("after that we will answer a few questions from the team"),
    );
    expect(cursor).toBe(after("team"));
  });

  it("stop words only match in-place and do not skip ahead", () => {
    // cursor is at "to" in script; spoken "to" should advance by 1 only
    const toIdx  = script.indexOf("to");
    const cursor = advanceWordByWord(script, toIdx, ["to"]);
    expect(cursor).toBe(toIdx + 1);
  });

  it("advances incrementally — each final adds exactly the words just spoken", () => {
    let cursor = 0;
    cursor = advanceWordByWord(script, cursor, normalizeSpeech("welcome everyone"));
    expect(cursor).toBe(after("everyone"));
    cursor = advanceWordByWord(script, cursor, normalizeSpeech("to the show today"));
    expect(cursor).toBe(after("today"));
  });
});
