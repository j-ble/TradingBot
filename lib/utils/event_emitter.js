/**
 * Event Emitter Utility
 * Wrapper around eventemitter3 for typed event handling
 */

import EventEmitter from 'eventemitter3';

/**
 * Create a typed event emitter
 * @returns {EventEmitter} Event emitter instance
 */
export function createEventEmitter() {
  return new EventEmitter();
}

/**
 * TypedEventEmitter class for better type hints
 * Extends eventemitter3 with additional utility methods
 */
export class TypedEventEmitter extends EventEmitter {
  constructor() {
    super();
    this._eventCounts = {};
  }

  /**
   * Emit an event and track count
   * @param {string} event - Event name
   * @param {...any} args - Event arguments
   * @returns {boolean} True if event had listeners
   */
  emit(event, ...args) {
    this._eventCounts[event] = (this._eventCounts[event] || 0) + 1;
    return super.emit(event, ...args);
  }

  /**
   * Get count of times an event was emitted
   * @param {string} event - Event name
   * @returns {number} Emission count
   */
  getEventCount(event) {
    return this._eventCounts[event] || 0;
  }

  /**
   * Reset event counts
   */
  resetEventCounts() {
    this._eventCounts = {};
  }

  /**
   * Wait for an event to be emitted
   * @param {string} event - Event name
   * @param {number} [timeout] - Optional timeout in ms
   * @returns {Promise<any>} Resolves with event data
   */
  waitFor(event, timeout = 0) {
    return new Promise((resolve, reject) => {
      let timeoutId;

      const handler = (...args) => {
        if (timeoutId) clearTimeout(timeoutId);
        resolve(args.length === 1 ? args[0] : args);
      };

      this.once(event, handler);

      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          this.off(event, handler);
          reject(new Error(`Timeout waiting for event: ${event}`));
        }, timeout);
      }
    });
  }

  /**
   * Remove all listeners and reset state
   */
  destroy() {
    this.removeAllListeners();
    this._eventCounts = {};
  }
}

export default TypedEventEmitter;
