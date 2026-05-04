import { describe, expect, it } from "vitest";
import {
  applyFollowTranscript,
  createFollowProgressState,
  findFollowIndex,
  normalizeSpeech,
  settleInterimProgress,
} from "@/lib/speech-follow";

const scriptWords = normalizeSpeech(`
  Welcome everyone to the show. Today we are going to walk through the product roadmap
  and talk about the features shipping this quarter. After that we will answer a few questions
  from the team before we wrap up for the day.
`);

describe("findFollowIndex", () => {
  it("advances naturally on a clean phrase match", () => {
    const nextIndex = findFollowIndex({
      scriptWords,
      heardText: "today we are going to walk through the product roadmap",
      cursor: 0,
      mode: "final",
    });

    expect(nextIndex).toBeGreaterThan(scriptWords.indexOf("roadmap"));
  });

  it("handles skipped script words without losing the place", () => {
    const nextIndex = findFollowIndex({
      scriptWords,
      heardText: "today we walk through product roadmap",
      cursor: 0,
      mode: "final",
    });

    expect(nextIndex).toBeGreaterThan(scriptWords.indexOf("roadmap"));
  });

  it("ignores filler words and still follows the spoken phrase", () => {
    const nextIndex = findFollowIndex({
      scriptWords,
      heardText: "today we are basically going to walk through like the product roadmap",
      cursor: 0,
      mode: "final",
    });

    expect(nextIndex).toBeGreaterThan(scriptWords.indexOf("roadmap"));
  });

  it("can resync farther ahead after missed lines", () => {
    const nextIndex = findFollowIndex({
      scriptWords,
      heardText: "after that we will answer a few questions from the team",
      cursor: scriptWords.indexOf("today"),
      mode: "final",
    });

    expect(nextIndex).toBeGreaterThan(scriptWords.indexOf("team"));
  });

  it("stays put when the phrase is too weak to trust", () => {
    const nextIndex = findFollowIndex({
      scriptWords,
      heardText: "the and to",
      cursor: 0,
      mode: "interim",
    });

    expect(nextIndex).toBeNull();
  });

  it("does not run past the last strongly matched spoken word", () => {
    const nextIndex = findFollowIndex({
      scriptWords,
      heardText: "today we are going to walk through the product roadmap",
      cursor: 0,
      mode: "final",
    });

    expect(nextIndex).toBe(scriptWords.indexOf("roadmap") + 1);
  });
});

describe("applyFollowTranscript", () => {
  it("does not advance interim preview on the first tentative match", () => {
    const nextState = applyFollowTranscript({
      state: createFollowProgressState(),
      scriptWords,
      heardText: "today we are going to walk through the product roadmap",
      mode: "interim",
    });

    expect(nextState.committedCursor).toBe(0);
    expect(nextState.visibleCursor).toBe(0);
    expect(nextState.pendingInterimCursor).toBeGreaterThan(0);
  });

  it("only advances interim preview after repeated confirmation and limits the lead", () => {
    const firstState = applyFollowTranscript({
      state: createFollowProgressState(),
      scriptWords,
      heardText: "today we are going to walk through the product roadmap",
      mode: "interim",
    });
    const secondState = applyFollowTranscript({
      state: firstState,
      scriptWords,
      heardText: "today we are going to walk through the product roadmap",
      mode: "interim",
    });

    expect(secondState.visibleCursor).toBeGreaterThan(0);
    expect(secondState.visibleCursor).toBeLessThanOrEqual(10);
    expect(secondState.committedCursor).toBe(0);
  });

  it("settles interim preview back to the committed cursor when speech tails off", () => {
    const firstState = applyFollowTranscript({
      state: createFollowProgressState(),
      scriptWords,
      heardText: "today we are going to walk through the product roadmap",
      mode: "interim",
    });
    const secondState = applyFollowTranscript({
      state: firstState,
      scriptWords,
      heardText: "today we are going to walk through the product roadmap",
      mode: "interim",
    });
    const settledState = settleInterimProgress(secondState);

    expect(secondState.visibleCursor).toBeGreaterThan(0);
    expect(settledState.visibleCursor).toBe(settledState.committedCursor);
    expect(settledState.pendingInterimCursor).toBeNull();
  });
});
