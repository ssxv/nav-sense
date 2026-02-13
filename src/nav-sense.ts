/**
 * nav-sense - Simple Keyboard Navigation Library
 */

// Simple configuration interface
export interface NavSenseConfig {
  /**
   * CSS selectors used to identify focusable elements in the DOM.
   * These selectors determine which elements can receive keyboard focus.
   *
   * @default [
   *   'button:not([disabled])',
   *   'input:not([disabled]):not([tabindex="-1"])',
   *   '[tabindex="0"]:not([disabled])',
   *   'textarea:not([disabled])',
   *   'select:not([disabled])',
   *   'a[href]:not([disabled])',
   *   '[contenteditable]:not([disabled])',
   *   '[role="button"]:not([disabled])',
   *   '[role="link"]:not([disabled])',
   *   '[role="textbox"]:not([disabled])'
   * ]
   *
   * @example
   * focusableSelectors: [
   *   'button:not([disabled])',
   *   'input:not([disabled])',
   *   '.custom-focusable'
   * ]
   */
  readonly focusableSelectors?: string[];

  /**
   * Element IDs that define boundary elements for scrollable container traversal.
   * When searching for scrollable ancestors, navigation stops at these elements.
   * Prevents traversing beyond layout containers or specific DOM boundaries.
   *
   * **Important: Only provide element IDs (without '#' prefix). Classes and tag selectors are not supported.**
   *
   * @default ['__layout']
   *
   * @example
   * boundarySelectors: ['app', 'modal-container', 'main-content']
   */
  readonly boundarySelectors?: string[];

  /**
   * Callback function invoked when physical keyboard detection changes.
   * Useful for showing/hiding virtual keyboards or adapting UI for touch vs keyboard input.
   * Triggered on first keydown (keyboard detected) or touchstart (touch detected).
   *
   * @param hasPhysicalKeyboard - True when physical keyboard is detected, false for touch input
   *
   * @example
   * onKeyboardToggle: (hasKeyboard) => {
   *   if (hasKeyboard) {
   *     console.log('Physical keyboard detected');
   *     hideVirtualKeyboard();
   *   } else {
   *     console.log('Touch input detected');
   *     showVirtualKeyboard();
   *   }
   * }
   */
  readonly onKeyboardToggle?: (hasPhysicalKeyboard: boolean) => void;

  /**
   * Callback function invoked whenever focus changes to a new element.
   * Called after focus has been successfully set on an element via Tab, Shift+Tab, or Enter.
   * Receives null when no element could be focused.
   *
   * @param element - The newly focused element, or null if focus failed
   *
   * @example
   * onFocusChange: (element) => {
   *   if (element) {
   *     console.log('Focused:', element.id || element.tagName);
   *     element.scrollIntoView({ behavior: 'smooth', block: 'center' });
   *   }
   * }
   */
  readonly onFocusChange?: (element: Element | null) => void;

  /**
   * Callback function invoked when Enter key is pressed.
   * Called after the currently focused element has been clicked (if possible).
   * Receives the element that was clicked, or null if no element was focused or clickable.
   *
   * @param element - The element that was clicked, or null if no click occurred
   *
   * @example
   * onEnter: (element) => {
   *   if (element) {
   *     console.log('Enter pressed on:', element.id || element.tagName);
   *     // Custom enter handling logic
   *   }
   * }
   */
  readonly onEnter?: (element: Element | null) => void;

  /**
   * Custom function to order focusable elements.
   * Called after filtering but before returning the final element list.
   * Allows complete control over element ordering logic.
   *
   * @param elements - Array of filtered focusable elements to order
   * @returns Final ordered array of focusable elements
   *
   * @example
   * customOrder: (elements) => {
   *   // Put buttons first, then inputs, everything else last
   *   const buttons = elements.filter(el => el.tagName === 'BUTTON');
   *   const inputs = elements.filter(el => el.tagName === 'INPUT');
   *   const others = elements.filter(el => !['BUTTON', 'INPUT'].includes(el.tagName));
   *   return [...buttons, ...inputs, ...others];
   * }
   */
  readonly customOrder?: (elements: Element[]) => Element[];

  /**
   * Enable debug logging for troubleshooting and development.
   * When enabled, nav-sense will log detailed information about:
   * - Initialization and destruction
   * - Focusable element detection and filtering
   * - Navigation events (Tab, Shift+Tab, Enter)
   * - Focus changes and failures
   * - DOM mutations and updates
   *
   * @default false
   *
   * @example
   * debug: true // Enable detailed console logging
   */
  readonly debug?: boolean;

  /**
   * Custom key handler that allows intercepting keyboard events before nav-sense processes them.
   * This enables conditional behavior based on application state (e.g., virtual keyboard shown).
   * Return true to allow nav-sense to handle the event normally, false to skip nav-sense processing.
   *
   * @param event - The keyboard event (Tab, Shift+Tab, Enter)
   * @returns boolean - true to allow nav-sense handling, false to skip and handle externally
   *
   * @example
   * shouldHandleKey: (event) => {
   *   // Skip nav-sense when virtual keyboard is shown
   *   if (keyboardShown.value) {
   *     if (event.key === 'Tab' && event.shiftKey) {
   *       navigateScreenKeyboard('left');
   *     } else if (event.key === 'Tab') {
   *       navigateScreenKeyboard('right');
   *     } else if (event.key === 'Enter') {
   *       performKeyPress();
   *     }
   *     return false; // Skip nav-sense processing
   *   }
   *   return true; // Let nav-sense handle normally
   * }
   */
  readonly shouldHandleKey?: (event: KeyboardEvent) => boolean;
}

// Global state (similar to original implementation)
let focusableElements: Element[] = [];
let hasPhysicalKeyboard = false;
let config: NavSenseConfig = {};
const defaultSelectors = [
  'button:not([disabled])',
  'input:not([disabled]):not([tabindex="-1"])',
  '[tabindex="0"]:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  'a[href]:not([disabled])',
  '[contenteditable]:not([disabled])',
  '[role="button"]:not([disabled])',
  '[role="link"]:not([disabled])',
  '[role="textbox"]:not([disabled])'
];
let combinedSelectors: string = defaultSelectors.join(', ');
let boundaryIds = ['__layout'];

/**
 * Debug logging helper - only logs when debug mode is enabled
 */
const debugLog = (message: string, ...args: any[]) => {
  if (config.debug) {
    console.log(`[nav-sense] ${message}`, ...args);
  }
};

/**
 * Determines whether an element is visible on the screen.
 * @param el The element to check.
 * @returns {boolean} True if the element is visible, otherwise false.
 */
export const isVisible = (el: Element): boolean => {
  const rect = el.getBoundingClientRect();
  const computedStyle = getComputedStyle(el);

  if (
    rect.width === 0 ||
    rect.height === 0 ||
    computedStyle.visibility === 'hidden' ||
    computedStyle.display === 'none'
  ) {
    return false;
  }
  return true;
};

/**
 * Determines whether an element is scrollable.
 * An element is considered scrollable if it has scrollable overflow
 * in either the horizontal or vertical direction.
 *
 * @param el The element to check.
 * @returns {boolean} True if the element is scrollable, otherwise false.
 */
export const isScrollable = (el: Element): boolean => {
  const computedStyle = getComputedStyle(el);
  return (
    computedStyle.overflowY === 'auto' ||
    computedStyle.overflowY === 'scroll' ||
    computedStyle.overflowX === 'auto' ||
    computedStyle.overflowX === 'scroll'
  );
};

/**
 * Determines whether an element is unobstructed from view as seen on client.
 * @param el the element to check
 * @returns {boolean} True if the element is unobstructed, otherwise false.
 */
export const isUnobstructed = (el: Element): boolean => {
  const rect = el.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const topElement = document.elementFromPoint(centerX, centerY);

  // If topElement is null, assume obstructed
  if (!topElement) {
    return false;
  }
  const containsTop = el.contains(topElement);
  if (el !== topElement && !containsTop) {
    return false;
  }

  if (containsTop && !isScrollable(el)) {
    const topRect = topElement.getBoundingClientRect();
    // topElement is visually larger than el
    if (topRect.width > rect.width || topRect.height > rect.height) {
      return false;
    }
  }

  return true;
};

/**
 * Traverses up the DOM tree to find the nearest scrollable container ancestor of a given element.
 * Skips traversal if it encounters the element with ID "__layout" or the <body> element.
 * @param el The starting element to search from.
 * @returns {HTMLElement | null} The nearest scrollable container element, or null if none found.
 */
export const findScrollableContainer = (el: Element): HTMLElement | null => {
  let parent = el.parentElement;

  while (parent) {
    if (boundaryIds.includes(parent.id) || parent.tagName.toLowerCase() === 'body') {
      break;
    }

    if (isScrollable(parent)) {
      return parent;
    }

    parent = parent.parentElement;
  }

  return null;
};

/**
 * Determines whether an element is inside a scrollable container that is not obstructed from view as seen on client.
 * @param el the element to check
 * @returns {boolean} True if the element is part of an unobstructed scroll container, otherwise false.
 */
export const isInsideUnobstructedScrollContainer = (el: Element): boolean => {
  const scrollableContainer = findScrollableContainer(el);
  return scrollableContainer ? isUnobstructed(scrollableContainer) : false;
};

/**
 * Gets all focusable elements from the DOM
 */
const getFocusableElements = (): Element[] => {
  // Use pre-validated combined selectors and remove duplicates in one step
  const uniqueVisibleElements = [...new Set([...document.querySelectorAll(combinedSelectors)].filter(isVisible))];

  const unobstructedSet = new Set<Element>();
  const obstructedSet = new Set<Element>();
  for (const el of uniqueVisibleElements) {
    if (isUnobstructed(el)) {
      unobstructedSet.add(el);
    } else {
      obstructedSet.add(el);
    }
  }

  const scrollContainerSet = new Set<Element>();
  for (const el of obstructedSet) {
    if (isInsideUnobstructedScrollContainer(el)) {
      scrollContainerSet.add(el);
    }
  }

  const filteredElements = uniqueVisibleElements.filter(el => unobstructedSet.has(el) || scrollContainerSet.has(el));

  // Apply custom ordering if provided
  const finalElements = config.customOrder ? config.customOrder(filteredElements) : filteredElements;

  return finalElements;
};

/**
 * Sets focus on an element with error handling
 */
export const setFocus = (el: Element): boolean => {
  try {
    if (el && typeof (el as HTMLElement).focus === 'function') {
      (el as HTMLElement).focus();
      const success = document.activeElement === el;
      if (success) {
        config.onFocusChange?.(el);
      }
      return success;
    }
    return false;
  } catch (error) {
    console.warn('nav-sense: Failed to set focus on element', el, error);
    return false;
  }
};

/**
 * Focuses on the next focusable element
 */
export const focusOnTheNextFocusableElement = (currentElement: HTMLElement): boolean => {
  const currentIndex = focusableElements.indexOf(currentElement);
  const nextIndex = currentIndex + 1;

  if (nextIndex < focusableElements.length) {
    return setFocus(focusableElements[nextIndex]);
  } else if (focusableElements.length > 0) {
    // Loop back to first element
    return setFocus(focusableElements[0]);
  }

  return false;
};

/**
 * Simulates tab navigation
 */
export const simulateTab = (): Element | null => {
  if (!focusableElements.length) {
    updateFocusableElements();
  }

  const activeElement = document.activeElement;

  if (!activeElement) {
    // No current focus, focus first element
    if (focusableElements.length > 0) {
      setFocus(focusableElements[0]);
      debugLog(
        `Tab: null -> ${(focusableElements[0] as HTMLElement).tagName}#${(focusableElements[0] as HTMLElement).id || 'no-id'}`
      );
      return focusableElements[0];
    }
    return null;
  }

  const currentIndex = focusableElements.indexOf(activeElement);
  let nextIndex;

  if (currentIndex === -1) {
    // Current element not in our list, focus first
    nextIndex = 0;
  } else {
    // Move to next element
    nextIndex = currentIndex + 1;
    if (nextIndex >= focusableElements.length) {
      nextIndex = 0; // Loop back to first
    }
  }

  if (nextIndex < focusableElements.length) {
    const targetElement = focusableElements[nextIndex];
    setFocus(targetElement);
    const fromEl = activeElement as HTMLElement;
    const toEl = targetElement as HTMLElement;
    debugLog(`Tab: ${fromEl.tagName}#${fromEl.id || 'no-id'} -> ${toEl.tagName}#${toEl.id || 'no-id'}`);
    return targetElement;
  }

  return null;
};

/**
 * Simulates shift+tab navigation
 */
export const simulateShiftTab = (): Element | null => {
  if (!focusableElements.length) {
    updateFocusableElements();
  }

  const activeElement = document.activeElement;

  if (!activeElement) {
    // No current focus, focus last element
    if (focusableElements.length > 0) {
      const lastIndex = focusableElements.length - 1;
      setFocus(focusableElements[lastIndex]);
      debugLog(
        `Shift+Tab: null -> ${(focusableElements[lastIndex] as HTMLElement).tagName}#${(focusableElements[lastIndex] as HTMLElement).id || 'no-id'}`
      );
      return focusableElements[lastIndex];
    }
    return null;
  }

  const currentIndex = focusableElements.indexOf(activeElement);
  let prevIndex;

  if (currentIndex === -1) {
    // Current element not in our list, focus last
    prevIndex = focusableElements.length - 1;
  } else {
    // Move to previous element
    prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
      prevIndex = focusableElements.length - 1; // Loop to last
    }
  }

  if (prevIndex >= 0 && prevIndex < focusableElements.length) {
    const targetElement = focusableElements[prevIndex];
    setFocus(targetElement);
    const fromEl = activeElement as HTMLElement;
    const toEl = targetElement as HTMLElement;
    debugLog(`Shift+Tab: ${fromEl.tagName}#${fromEl.id || 'no-id'} -> ${toEl.tagName}#${toEl.id || 'no-id'}`);
    return targetElement;
  }

  return null;
};

/**
 * Simulates enter key press on the currently focused element
 */
export const simulateEnter = (): Element | null => {
  const activeElement = document.activeElement;

  if (activeElement && typeof (activeElement as HTMLElement).click === 'function') {
    try {
      (activeElement as HTMLElement).click();
      return activeElement;
    } catch (error) {
      console.warn('nav-sense: Failed to click active element', activeElement, error);
    }
  }

  return null;
};

/**
 * Updates the focusable elements list
 */
export const updateFocusableElements = (): void => {
  if (config.debug) {
    const oldCount = focusableElements.length;
    const start = performance.now();
    focusableElements = getFocusableElements();
    const end = performance.now();

    debugLog(
      `Focusable elements updated: ${oldCount} -> ${focusableElements.length}`,
      focusableElements,
      `Execution time: ${(end - start).toFixed(2)} ms`
    );
  } else {
    focusableElements = getFocusableElements();
  }
};

/**
 * Resets the focusable elements list
 */
export const resetFocusableElements = (): void => {
  focusableElements = [];
};

/**
 * Gets the current list of focusable elements
 */
export const getFocusableElementsList = (): readonly Element[] => {
  return [...focusableElements];
};

/**
 * Keyboard event handler
 */
const onKeyDown = (event: KeyboardEvent) => {
  if (!hasPhysicalKeyboard) {
    debugLog('Physical keyboard detected on first keydown');
  }
  hasPhysicalKeyboard = true;
  config.onKeyboardToggle?.(true);

  // Allow user to conditionally override key handling
  if (config.shouldHandleKey && !config.shouldHandleKey(event)) {
    return;
  }

  if (event.key === 'Tab' && event.shiftKey) {
    event.preventDefault();
    simulateShiftTab();
    return;
  }

  if (event.key === 'Tab') {
    event.preventDefault();
    simulateTab();
    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    const activeElement = simulateEnter();
    config.onFocusChange?.(activeElement);
    config.onEnter?.(activeElement);
  }
};

/**
 * Touch event handler
 */
const onTouchStart = () => {
  hasPhysicalKeyboard = false;
  config.onKeyboardToggle?.(false);
};

/**
 * Mutation observer for DOM changes
 */
let observer: MutationObserver | null = null;

/**
 * Initialize nav-sense with optional configuration
 */
export const init = (userConfig: NavSenseConfig = {}): void => {
  debugLog('Initializing nav-sense with config:', userConfig);

  // Merge config
  config = { ...config, ...userConfig };
  debugLog('Merged config:', config);

  // Set boundary IDs from config or use defaults
  boundaryIds = config.boundarySelectors || ['__layout'];

  // Get selectors from config or use defaults
  const selectors = config.focusableSelectors || defaultSelectors;
  combinedSelectors = selectors.join(', ');
  try {
    // Test the combined selectors
    document.querySelector(combinedSelectors);
  } catch (error) {
    console.error('nav-sense: Invalid selectors provided, falling back to defaults:', error);
    combinedSelectors = defaultSelectors.join(', ');
  }

  // Set up event listeners
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('touchstart', onTouchStart, true);
  debugLog('Event listeners attached');

  // Set up mutation observer
  if (observer) {
    debugLog('Disconnecting existing mutation observer');
    observer.disconnect();
  }

  observer = new MutationObserver(() => {
    resetFocusableElements();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  debugLog('Mutation observer started');

  debugLog('nav-sense initialization complete');
};

/**
 * Destroy nav-sense and clean up event listeners
 */
export const destroy = (): void => {
  debugLog('Destroying nav-sense');

  document.removeEventListener('keydown', onKeyDown, true);
  document.removeEventListener('touchstart', onTouchStart, true);
  debugLog('Event listeners removed');

  if (observer) {
    observer.disconnect();
    observer = null;
    debugLog('Mutation observer disconnected');
  }

  resetFocusableElements();
  hasPhysicalKeyboard = false;
  debugLog('nav-sense destroyed and state reset');
};

/**
 * Check if physical keyboard is detected
 */
export const getHasPhysicalKeyboard = (): boolean => {
  return hasPhysicalKeyboard;
};
