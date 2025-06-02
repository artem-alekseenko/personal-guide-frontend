const BUTTON_TEXT = {
  GET_TOUR_ROUTE: "Get the tour route",
  GETTING_ROUTE: "Getting the route...",
  APPROVE_ROUTE: "Approve route",
  APPROVING_TOUR: "Approving tour...",
};

const getButtonDefaultText = (): string => BUTTON_TEXT.GET_TOUR_ROUTE;

export const getMainButtonText = (state: string): string => {
  const stateTextMap: Record<string, string> = {
    INITIAL: BUTTON_TEXT.GET_TOUR_ROUTE,
    DATA_ENTRY_COMPLETED: BUTTON_TEXT.GET_TOUR_ROUTE,
    ROUTE_REQUESTING: BUTTON_TEXT.GETTING_ROUTE,
    ROUTE_RECEIVED: BUTTON_TEXT.APPROVE_ROUTE,
    TOUR_APPROVING: BUTTON_TEXT.APPROVING_TOUR,
  };

  return stateTextMap[state] || getButtonDefaultText();
};
