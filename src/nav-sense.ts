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
   * CSS selectors that define boundary elements for scrollable container traversal.
   * When searching for scrollable ancestors, navigation stops at these elements.
   * Prevents traversing beyond layout containers or specific DOM boundaries.
   *
   * @default ['#__layout', 'body']
   *
   * @example
   * boundarySelectors: ['#app', '.modal-container', 'body']
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

  // Check if the element at that point is the element itself or a child of it
  return el === topElement || el.contains(topElement);
};

/**
 * Traverses up the DOM tree to find the nearest scrollable container ancestor of a given element.
 * Skips traversal if it encounters the element with ID "__layout" or the <body> element.
 * @param el The starting element to search from.
 * @returns {HTMLElement | null} The nearest scrollable container element, or null if none found.
 */
export const findScrollableContainer = (el: Element): HTMLElement | null => {
  const boundarySelectors = config.boundarySelectors || ['#__layout', 'body'];
  let parent = el.parentElement;

  debugLog('Finding scrollable container for element:', el);

  while (parent) {
    // Stop if we hit a boundary selector
    const hitBoundary = boundarySelectors.some(selector => {
      try {
        const matches = parent!.matches(selector);
        if (matches) {
          debugLog(`Hit boundary selector '${selector}' at element:`, parent);
        }
        return matches;
      } catch {
        debugLog(`Invalid boundary selector '${selector}' - ignoring`);
        return false;
      }
    });

    if (hitBoundary) {
      break;
    }

    if (isScrollable(parent)) {
      debugLog('Found scrollable container:', parent);
      return parent;
    }

    parent = parent.parentElement;
  }

  debugLog('No scrollable container found for element:', el);
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
  const selectors = config.focusableSelectors || [
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

  debugLog('Getting focusable elements with selectors:', selectors);

  const allElements: Element[] = [];

  try {
    const combinedSelectors = selectors.join(', ');
    const elements = document.querySelectorAll(combinedSelectors);
    allElements.push(...Array.from(elements));
    debugLog(`Found ${elements.length} elements matching combined selectors`);
  } catch (error) {
    console.warn(`nav-sense: Invalid combined selectors "${selectors.join(', ')}"`, error);
    debugLog('Combined selectors failed, falling back to individual selectors');
    // Fallback to individual selector approach if combined fails
    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        allElements.push(...Array.from(elements));
        debugLog(`Selector '${selector}' found ${elements.length} elements`);
      } catch (selectorError) {
        console.warn(`nav-sense: Invalid selector "${selector}"`, selectorError);
        debugLog(`Selector '${selector}' failed:`, selectorError);
      }
    }
  }

  // Remove duplicates
  const uniqueElements = Array.from(new Set(allElements));
  debugLog(`After deduplication: ${uniqueElements.length} unique elements`);

  // Filter to only visible and focusable elements
  const filteredElements = uniqueElements.filter(el => {
    if (!isVisible(el)) {
      debugLog('Element filtered out (not visible):', el);
      return false;
    }

    // If element is unobstructed, it's definitely focusable
    if (isUnobstructed(el)) {
      debugLog('Element included (unobstructed):', el);
      return true;
    }

    // If obstructed, check if it's in an unobstructed scroll container
    const inScrollContainer = isInsideUnobstructedScrollContainer(el);
    if (inScrollContainer) {
      debugLog('Element included (in unobstructed scroll container):', el);
    } else {
      debugLog('Element filtered out (obstructed and not in scroll container):', el);
    }
    return inScrollContainer;
  });

  debugLog(`After visibility/obstruction filtering: ${filteredElements.length} focusable elements`);

  // Apply custom ordering if provided
  const finalElements = config.customOrder ? config.customOrder(filteredElements) : filteredElements;

  if (config.customOrder) {
    debugLog(`After custom ordering: ${finalElements.length} elements`, finalElements);
  }

  debugLog('Final focusable elements:', finalElements);
  return finalElements;
};

/**
 * Sets focus on an element with error handling
 */
export const setFocus = (el: Element): boolean => {
  try {
    if (el && typeof (el as HTMLElement).focus === 'function') {
      debugLog('Attempting to focus element:', el);
      (el as HTMLElement).focus();
      const success = document.activeElement === el;
      if (success) {
        debugLog('Successfully focused element:', el);
        config.onFocusChange?.(el);
      } else {
        debugLog('Failed to focus element (activeElement mismatch):', el, 'activeElement:', document.activeElement);
      }
      return success;
    }
    debugLog('Cannot focus element (no focus method):', el);
    return false;
  } catch (error) {
    console.warn('nav-sense: Failed to set focus on element', el, error);
    debugLog('Focus attempt threw error:', error);
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
  debugLog('Simulating Tab navigation');

  if (!focusableElements.length) {
    debugLog('No focusable elements cached, updating list');
    updateFocusableElements();
  }

  const activeElement = document.activeElement;
  debugLog('Current active element:', activeElement);

  if (!activeElement) {
    // No current focus, focus first element
    if (focusableElements.length > 0) {
      debugLog('No active element, focusing first element:', focusableElements[0]);
      setFocus(focusableElements[0]);
      return focusableElements[0];
    }
    debugLog('No focusable elements available');
    return null;
  }

  const currentIndex = focusableElements.indexOf(activeElement);
  let nextIndex;

  if (currentIndex === -1) {
    // Current element not in our list, focus first
    debugLog('Active element not in focusable list, focusing first element');
    nextIndex = 0;
  } else {
    // Move to next element
    nextIndex = currentIndex + 1;
    if (nextIndex >= focusableElements.length) {
      nextIndex = 0; // Loop back to first
      debugLog(`Reached end of list (${focusableElements.length}), looping to first`);
    } else {
      debugLog(`Moving from index ${currentIndex} to ${nextIndex}`);
    }
  }

  if (nextIndex < focusableElements.length) {
    const targetElement = focusableElements[nextIndex];
    debugLog('Focusing next element:', targetElement);
    setFocus(targetElement);
    return targetElement;
  }

  debugLog('Tab navigation failed - no valid next element');
  return null;
};

/**
 * Simulates shift+tab navigation
 */
export const simulateShiftTab = (): Element | null => {
  debugLog('Simulating Shift+Tab navigation');

  if (!focusableElements.length) {
    debugLog('No focusable elements cached, updating list');
    updateFocusableElements();
  }

  const activeElement = document.activeElement;
  debugLog('Current active element:', activeElement);

  if (!activeElement) {
    // No current focus, focus last element
    if (focusableElements.length > 0) {
      const lastIndex = focusableElements.length - 1;
      debugLog('No active element, focusing last element:', focusableElements[lastIndex]);
      setFocus(focusableElements[lastIndex]);
      return focusableElements[lastIndex];
    }
    debugLog('No focusable elements available');
    return null;
  }

  const currentIndex = focusableElements.indexOf(activeElement);
  let prevIndex;

  if (currentIndex === -1) {
    // Current element not in our list, focus last
    debugLog('Active element not in focusable list, focusing last element');
    prevIndex = focusableElements.length - 1;
  } else {
    // Move to previous element
    prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
      prevIndex = focusableElements.length - 1; // Loop to last
      debugLog(`Reached beginning of list, looping to last (index ${prevIndex})`);
    } else {
      debugLog(`Moving from index ${currentIndex} to ${prevIndex}`);
    }
  }

  if (prevIndex >= 0 && prevIndex < focusableElements.length) {
    const targetElement = focusableElements[prevIndex];
    debugLog('Focusing previous element:', targetElement);
    setFocus(targetElement);
    return targetElement;
  }

  debugLog('Shift+Tab navigation failed - no valid previous element');
  return null;
};

/**
 * Simulates enter key press on the currently focused element
 */
export const simulateEnter = (): Element | null => {
  const activeElement = document.activeElement;
  debugLog('Simulating Enter key on active element:', activeElement);

  if (activeElement && typeof (activeElement as HTMLElement).click === 'function') {
    try {
      debugLog('Clicking active element:', activeElement);
      (activeElement as HTMLElement).click();
      return activeElement;
    } catch (error) {
      console.warn('nav-sense: Failed to click active element', activeElement, error);
      debugLog('Click failed with error:', error);
    }
  } else {
    debugLog('Cannot click - no active element or no click method');
  }

  return null;
};

/**
 * Updates the focusable elements list
 */
export const updateFocusableElements = (): void => {
  debugLog('Updating focusable elements list');
  const oldCount = focusableElements.length;

  const start = performance.now();
  focusableElements = getFocusableElements();
  const end = performance.now();

  debugLog(
    `Focusable elements updated: ${oldCount} -> ${focusableElements.length}`,
    focusableElements,
    `Execution time: ${(end - start).toFixed(2)} ms`
  );
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
    debugLog('Key handling skipped by shouldHandleKey callback:', event.key);
    return;
  }

  if (event.key === 'Tab' && event.shiftKey) {
    debugLog('Shift+Tab key pressed');
    event.preventDefault();
    simulateShiftTab();
    return;
  }

  if (event.key === 'Tab') {
    debugLog('Tab key pressed');
    event.preventDefault();
    simulateTab();
    return;
  }

  if (event.key === 'Enter') {
    debugLog('Enter key pressed');
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
  if (hasPhysicalKeyboard) {
    debugLog('Touch input detected - switching from physical keyboard mode');
  }
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

  // Initial setup
  // updateFocusableElements();

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
    debugLog('DOM mutations detected, resetting focusable elements');
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
