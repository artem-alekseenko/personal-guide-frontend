/**
 * Options for throttle function behavior
 */
interface ThrottleOptions {
  /** Execute on the leading edge (immediately on first call) */
  leading?: boolean;
  /** Execute on the trailing edge (after delay when calls stop) */
  trailing?: boolean;
}

/**
 * Throttled function with cancel method
 */
interface ThrottledFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void;
  cancel(): void;
}

/**
 * Debounced function with cancel method
 */
interface DebouncedFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void;
  cancel(): void;
}

/**
 * Creates a throttled version of a function that only executes at most once per delay period
 * @param func - The function to throttle
 * @param delay - The delay in milliseconds
 * @param options - Throttle behavior options
 * @returns Throttled function with cancel method
 * 
 * @example
 * ```typescript
 * // Basic usage with default options (leading: true, trailing: true)
 * const throttledSave = throttle(saveToLocalStorage, 300);
 * throttledSave(data); // Executes immediately
 * throttledSave(data); // Throttled
 * throttledSave(data); // Will execute after 300ms
 * 
 * // Leading only - execute immediately, ignore subsequent calls
 * const leadingThrottle = throttle(onClick, 1000, { leading: true, trailing: false });
 * 
 * // Trailing only - execute only after calls stop
 * const trailingThrottle = throttle(onScroll, 100, { leading: false, trailing: true });
 * 
 * // Manual cleanup
 * throttledSave.cancel();
 * ```
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  delay: number,
  options: ThrottleOptions = {}
): ThrottledFunction<T> => {
  const { leading = true, trailing = true } = options;
  
  let lastCallTime = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | undefined;

  const executeFunction = (args: Parameters<T>) => {
    lastCallTime = Date.now();
    func(...args);
  };

  const throttled = (...args: Parameters<T>): void => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;
    
    // Store latest arguments for potential trailing execution
    lastArgs = args;

    if (timeSinceLastCall >= delay) {
      // Execute immediately if enough time has passed and leading is enabled
      if (leading) {
        executeFunction(args);
        lastArgs = undefined; // Clear since we've executed
      } else {
        // Leading disabled, schedule for trailing if enabled
        if (trailing) {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          timeoutId = setTimeout(() => {
            if (lastArgs) {
              executeFunction(lastArgs);
              lastArgs = undefined;
            }
            timeoutId = null;
          }, delay);
        }
      }
    } else {
      // Not enough time has passed
      if (trailing) {
        // Clear any existing timeout and schedule new one
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        timeoutId = setTimeout(() => {
          if (lastArgs) {
            executeFunction(lastArgs);
            lastArgs = undefined;
          }
          timeoutId = null;
        }, delay - timeSinceLastCall);
      }
    }
  };

  throttled.cancel = (): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    lastArgs = undefined;
    lastCallTime = 0;
  };

  return throttled;
};

/**
 * Creates a debounced version of a function that delays execution until after delay has elapsed
 * @param func - The function to debounce
 * @param delay - The delay in milliseconds
 * @returns Debounced function with cancel method
 * 
 * @example
 * ```typescript
 * // Search input debouncing
 * const debouncedSearch = debounce(performSearch, 300);
 * debouncedSearch('query1'); // Cancelled
 * debouncedSearch('query2'); // Cancelled
 * debouncedSearch('query3'); // Will execute after 300ms
 * 
 * // Form validation
 * const debouncedValidate = debounce(validateForm, 500);
 * 
 * // Manual cleanup (e.g., on component unmount)
 * debouncedSearch.cancel();
 * ```
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number,
): DebouncedFunction<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, delay);
  };

  debounced.cancel = (): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
};

/**
 * Utility to create throttle with leading-only behavior
 * @param func - The function to throttle
 * @param delay - The delay in milliseconds
 * @returns Throttled function that only executes on leading edge
 * 
 * @example
 * ```typescript
 * // Button click protection - execute immediately, ignore rapid clicks
 * const protectedSubmit = throttleLeading(submitForm, 2000);
 * protectedSubmit(); // Executes immediately
 * protectedSubmit(); // Ignored
 * protectedSubmit(); // Ignored
 * // After 2000ms, next call will execute immediately again
 * ```
 */
export const throttleLeading = <T extends (...args: any[]) => any>(
  func: T,
  delay: number,
): ThrottledFunction<T> => {
  return throttle(func, delay, { leading: true, trailing: false });
};

/**
 * Utility to create throttle with trailing-only behavior
 * @param func - The function to throttle
 * @param delay - The delay in milliseconds
 * @returns Throttled function that only executes on trailing edge
 * 
 * @example
 * ```typescript
 * // Window resize handler - execute only after resizing stops
 * const handleResize = throttleTrailing(updateLayout, 250);
 * window.addEventListener('resize', handleResize);
 * 
 * // Scroll position save - save only when scrolling stops
 * const saveScrollPosition = throttleTrailing(savePosition, 100);
 * ```
 */
export const throttleTrailing = <T extends (...args: any[]) => any>(
  func: T,
  delay: number,
): ThrottledFunction<T> => {
  return throttle(func, delay, { leading: false, trailing: true });
};

/**
 * Cleanup multiple throttled/debounced functions at once
 * @param functions - Array of throttled/debounced functions to cancel
 * 
 * @example
 * ```typescript
 * const throttled1 = throttle(func1, 300);
 * const throttled2 = throttle(func2, 500);
 * const debounced1 = debounce(func3, 200);
 * 
 * // Cancel all at once
 * cancelAll([throttled1, throttled2, debounced1]);
 * 
 * // Useful for cleanup in Vue components:
 * onUnmounted(() => {
 *   cancelAll([throttled1, throttled2, debounced1]);
 * });
 * ```
 */
export const cancelAll = (
  functions: Array<ThrottledFunction<any> | DebouncedFunction<any>>
): void => {
  functions.forEach(fn => fn.cancel());
};

/**
 * Vue composable for automatic cleanup of throttled/debounced functions
 * @param functions - Array of throttled/debounced functions to auto-cleanup
 * 
 * @example
 * ```typescript
 * // In Vue component
 * const throttledSave = throttle(saveData, 300);
 * const debouncedSearch = debounce(search, 500);
 * 
 * // Automatic cleanup on component unmount
 * useThrottleDebounceCleanup([throttledSave, debouncedSearch]);
 * 
 * // Alternative manual approach:
 * onUnmounted(() => {
 *   throttledSave.cancel();
 *   debouncedSearch.cancel();
 * });
 * ```
 */
export const useThrottleDebounceCleanup = (
  functions: Array<ThrottledFunction<any> | DebouncedFunction<any>>
): void => {
  // Check if onUnmounted is available and is a function (for Vue environment)
  if (typeof onUnmounted === 'function') {
    onUnmounted(() => {
      cancelAll(functions);
    });
  }
}; 