/** Control policy kept separate from the player so it can be checked without media. */
export function isTourButtonBlocked(
  state: string,
  actionBusy: boolean,
  requestBusy: boolean,
) {
  if (state === "RECORD_ACTIVE") return false;
  return (
    requestBusy ||
    actionBusy ||
    state === "LOADING_RECORD" ||
    state === "LOADING_RECORD_WHEN_PAUSED"
  );
}

export function canResumeTourRecord(
  current: object | null | undefined,
  loaded: object | null,
  readyState: number,
  hasSource: boolean,
) {
  return !!current && current === loaded && hasSource && readyState >= 2;
}
