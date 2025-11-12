import { ref, watch } from 'vue';

export type PositionMode = 'gps' | 'manual';

const STORAGE_KEY = 'tour-position-mode';
const DEFAULT_MODE: PositionMode = 'gps';

/**
 * Composable for managing position mode state with persistence
 * - 'gps': Real geolocation mode using user's actual GPS position
 * - 'manual': Simulation mode using draggable marker for position testing
 * @returns Position mode state and utilities
 */
export const usePositionMode = () => {
  // Load initial mode from localStorage or use default
  const loadInitialMode = (): PositionMode => {
    if (typeof window === 'undefined') return DEFAULT_MODE;
    
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'gps' || saved === 'manual') {
        return saved;
      }
    } catch (error) {
      console.warn('Failed to load position mode from localStorage:', error);
    }
    
    return DEFAULT_MODE;
  };

  // Reactive position mode state
  const positionMode = ref<PositionMode>(loadInitialMode());

  // Computed for easy toggle binding (manual mode = simulation mode)
  const isManualMode = computed({
    get: () => positionMode.value === 'manual',
    set: (value: boolean) => {
      positionMode.value = value ? 'manual' : 'gps';
    }
  });

  // Save mode to localStorage when it changes
  watch(positionMode, (newMode) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, newMode);
      } catch (error) {
        console.warn('Failed to save position mode to localStorage:', error);
      }
    }
  });

  // Utility functions
  const setGpsMode = () => {
    positionMode.value = 'gps';
  };

  const setSimulationMode = () => {
    positionMode.value = 'manual';
  };

  const toggleMode = () => {
    positionMode.value = positionMode.value === 'gps' ? 'manual' : 'gps';
  };

  // Legacy alias for backward compatibility
  const setManualMode = setSimulationMode;

  return {
    // State
    positionMode: readonly(positionMode),
    isManualMode,
    
    // Utilities
    setGpsMode,
    setSimulationMode,
    setManualMode, // Legacy alias
    toggleMode,
  };
}; 