import { it, expect, vi } from "vitest";
import { useTourAudioPlayer } from "../app/composables/tour/useTourAudioPlayer";
const fixture = vi.hoisted(() => ({
  textForSpeech: "Hello.",
  currentTourRecord: { audio_data: "aGVsbG8=" },
}));
vi.mock("../app/stores/tourStore", () => ({ useTourStore: () => fixture }));
it("reports blocked autoplay without leaving playback active and handles the ended event", async () => {
  let media: any;
  class Audio {
    src = "";
    currentTime = 0;
    duration = 1;
    readyState = 4;
    onended: any;
    onerror: any;
    ontimeupdate: any;
    onloadedmetadata: any;
    play = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("Blocked", "NotAllowedError"))
      .mockResolvedValue(undefined);
    pause = vi.fn();
    load = vi.fn();
    removeAttribute = vi.fn();
    constructor() {
      media = this;
    }
  }
  Object.assign(globalThis, { Audio });
  const ended = vi.fn();
  const player = useTourAudioPlayer({ onEnded: ended });
  expect(await player.playAudio()).toBe(false);
  expect(await player.playAudio()).toBe(true);
  media.onended();
  expect(ended).toHaveBeenCalledOnce();
  player.cleanup();
  expect(media.onended).toBeNull();
  expect(player.currentAudioUrl.value).toBeNull();
});
