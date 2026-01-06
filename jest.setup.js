import 'fake-indexeddb/auto';
import '@testing-library/jest-dom'

// Polyfill for the Web Crypto API in Node.js environment for Jest
const crypto = require('crypto');
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: crypto.webcrypto.subtle,
    getRandomValues: (arr) => crypto.randomBytes(arr.length)
  },
});

// Mock localStorage for the Jest environment
const localStorageMock = (() => {
  let store = {};
  return {
    getItem(key) {
      return store[key] || null;
    },
    setItem(key, value) {
      store[key] = value.toString();
    },
    removeItem(key) {
      delete store[key];
    },
    clear() {
      store = {};
    },
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});
