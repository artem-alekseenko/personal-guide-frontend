import { useI18n } from '#imports';

export const getMainButtonText = (state: string): string => {
  const { t } = useI18n();
  
  const stateTextMap: Record<string, string> = {
    INITIAL: t('buttons.getTourRoute'),
    DATA_ENTRY_COMPLETED: t('buttons.getTourRoute'),
    ROUTE_REQUESTING: t('buttons.gettingRoute'),
    ROUTE_RECEIVED: t('buttons.approveRoute'),
    TOUR_APPROVING: t('buttons.approvingTour'),
  };

  return stateTextMap[state] || t('buttons.getTourRoute');
};
