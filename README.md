# nav-sense

Simple keyboard navigation library for web applications, enhancing accessibility and user experience.

## Features

- 🎯 **Smart Element Detection** - Intelligent visibility and obstruction detection
- 🚫 **Obstruction Handling** - Advanced visibility checking that handles overlays and obscured elements
- ⌨️ **Physical Keyboard Detection** - Automatic detection between physical and virtual keyboards
- 🎛️ **Conditional Key Handling** - Skip navigation based on application state (e.g., virtual keyboards)
- 🔄 **Custom Element Ordering** - Full control over focus order with custom sorting functions
- 📊 **Debug Mode** - Comprehensive logging with performance tracking
- 🎨 **Configurable Selectors** - Customize which elements are considered focusable
- 🔔 **Event Callbacks** - React to focus changes, enter events, and keyboard detection
- 🔄 **DOM Monitoring** - Automatic updates when DOM structure changes
- 📦 **Zero Dependencies** - Pure JavaScript with no external dependencies
- 🏗️ **Framework Agnostic** - Works with any framework or vanilla JavaScript
- 📘 **TypeScript Support** - Full type definitions included

## Installation

```bash
npm install nav-sense
```

## Quick Start

```javascript
import { init, destroy } from 'nav-sense';

// Initialize with basic callbacks
init({
  onKeyboardToggle: hasPhysicalKeyboard => {
    console.log('Physical keyboard:', hasPhysicalKeyboard);
  },
  onFocusChange: element => {
    if (element) {
      console.log('Focused:', element.id || element.tagName);
    }
  },
  onEnter: element => {
    console.log('Enter pressed on:', element);
  }
});

// The library automatically handles Tab, Shift+Tab, and Enter keys

// Clean up when done
destroy();
```

## Advanced Configuration

```javascript
import { init } from 'nav-sense';

init({
  // Enable debug logging with performance tracking
  debug: true,

  // Custom element ordering
  customOrder: elements => {
    const buttons = elements.filter(el => el.tagName === 'BUTTON');
    const inputs = elements.filter(el => el.tagName === 'INPUT');
    const others = elements.filter(el => !['BUTTON', 'INPUT'].includes(el.tagName));
    return [...buttons, ...inputs, ...others];
  },

  // Conditional key handling
  shouldHandleKey: event => {
    // Skip nav-sense when virtual keyboard is shown
    if (virtualKeyboardVisible) {
      if (event.key === 'Tab' && event.shiftKey) {
        navigateVirtualKeyboard('left');
      } else if (event.key === 'Tab') {
        navigateVirtualKeyboard('right');
      } else if (event.key === 'Enter') {
        pressVirtualKey();
      }
      return false; // Skip nav-sense processing
    }
    return true; // Let nav-sense handle normally
  },

  // Custom focusable selectors
  focusableSelectors: ['button:not([disabled])', 'input:not([disabled])', '.custom-focusable'],

  // Custom boundary selectors for scrollable containers
  boundarySelectors: ['#app', '.modal-container', 'body']
});
```

## Core Functions

```javascript
import { simulateTab, simulateShiftTab, simulateEnter, updateFocusableElements } from 'nav-sense';

// Manual navigation
simulateTab(); // Navigate to next element
simulateShiftTab(); // Navigate to previous element
simulateEnter(); // Activate current element

// Force refresh of focusable elements
updateFocusableElements();
```

## Utility Functions

```javascript
import { isVisible, isUnobstructed, setFocus } from 'nav-sense';

// Check element visibility and accessibility
if (isVisible(element) && isUnobstructed(element)) {
  setFocus(element);
}
```

## Browser Support

Modern browsers (Chrome 70+, Firefox 65+, Safari 12+, Edge 79+)

## License

MIT License

---

📖 **Detailed documentation available in the [Wiki](../../wiki)**
