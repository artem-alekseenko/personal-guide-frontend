/**
 * Composable for managing tour state with persistence
 * Saves tour state to localStorage to maintain progress across navigation
 */

export type TourState = 
  | "INITIAL"
  | "LOADING_RECORD" 
  | "LOADING_RECORD_WHEN_PAUSED"
  | "RECORD_RECEIVED"
  | "RECORD_ACTIVE"
  | "RECORD_PAUSED"
  | "RECORD_FINISHED"
  | "TOUR_FINISHED"
  | "ERROR";

interface TourStateData {
  state: TourState;
  tourId: string;
  hasContent: boolean; // Whether there's text content to resume
  lastUpdated: number; // Timestamp for expiration
  audioPosition?: number; // Current audio playback position in seconds
}

const STORAGE_KEY_PREFIX = 'tour-state-';
const STATE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Composable for persistent tour state management
 * @param tourId - Current tour ID
 * @returns Tour state management utilities
 */
export const useTourState = (tourId: string) => {
  const storageKey = `${STORAGE_KEY_PREFIX}${tourId}`;
  
  // Load initial state from localStorage or default to INITIAL
  const loadInitialState = (): TourState => {
    if (typeof window === 'undefined') return 'INITIAL';
    
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return 'INITIAL';
      
      const data: TourStateData = JSON.parse(saved);
      
      // Check if data is expired
      if (Date.now() - data.lastUpdated > STATE_EXPIRY_MS) {
        localStorage.removeItem(storageKey);
        return 'INITIAL';
      }
      
      // Validate tour ID matches
      if (data.tourId !== tourId) {
        return 'INITIAL';
      }
      
      // Don't restore transient states - convert them to appropriate states
      if (data.state === 'LOADING_RECORD' || data.state === 'LOADING_RECORD_WHEN_PAUSED') {
        return data.hasContent ? 'RECORD_PAUSED' : 'INITIAL';
      }
      
      // Don't restore error state
      if (data.state === 'ERROR') {
        return data.hasContent ? 'RECORD_PAUSED' : 'INITIAL';
      }
      
      // Don't restore finished states
      if (data.state === 'RECORD_FINISHED' || data.state === 'TOUR_FINISHED') {
        return 'INITIAL';
      }
      
      return data.state;
    } catch (error) {
      console.warn('Failed to load tour state from localStorage:', error);
      return 'INITIAL';
    }
  };
  
  // Reactive state - writable
  const state = ref<TourState>(loadInitialState());
  
  // Save state to localStorage
  const saveState = (newState: TourState, hasContent: boolean = false, audioPosition?: number): void => {
    if (typeof window === 'undefined') return;
    
    try {
      const data: TourStateData = {
        state: newState,
        tourId,
        hasContent,
        lastUpdated: Date.now(),
        audioPosition,
      };
      
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save tour state to localStorage:', error);
    }
  };
  
  // Update state and save to storage
  const setState = (newState: TourState, hasContent?: boolean, audioPosition?: number): void => {
    state.value = newState;
    
    // Determine if there's content based on store or parameter
    const shouldHaveContent = hasContent ?? (typeof window !== 'undefined' && !!useTourStore().textForDisplay);
    
    saveState(newState, shouldHaveContent, audioPosition);
  };
  
  // Clear saved state (on tour completion, etc.)
  const clearSavedState = (): void => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.warn('Failed to clear tour state from localStorage:', error);
    }
  };
  
  // Check if state should be restored based on tour store content
  const shouldRestoreState = computed((): boolean => {
    const tourStore = useTourStore();
    return !!(tourStore.textForDisplay && state.value !== 'INITIAL');
  });
  
  // Get saved audio position
  const getSavedAudioPosition = (): number | null => {
    if (typeof window === 'undefined') return null;
    
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return null;
      
      const data: TourStateData = JSON.parse(saved);
      return data.audioPosition ?? null;
    } catch (error) {
      console.warn('Failed to get saved audio position:', error);
      return null;
    }
  };
  
  return {
    // State - writable ref
    state,
    shouldRestoreState,
    
    // Actions
    setState,
    clearSavedState,
    getSavedAudioPosition,
  };
}; 