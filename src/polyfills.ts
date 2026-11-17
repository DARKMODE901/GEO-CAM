// src/polyfills.ts
// Polyfills para el motor Hermes requeridos por Vercel AI SDK v7

import structuredClonePolyfill from '@ungap/structured-clone';
import {
  TextEncoderStream as TextEncoderStreamPolyfill,
  TextDecoderStream as TextDecoderStreamPolyfill,
} from '@stardazed/streams-text-encoding';

if (typeof (globalThis as any).structuredClone === 'undefined') {
  (globalThis as any).structuredClone = structuredClonePolyfill;
}

if (typeof (globalThis as any).TextEncoderStream === 'undefined') {
  (globalThis as any).TextEncoderStream = TextEncoderStreamPolyfill;
}

if (typeof (globalThis as any).TextDecoderStream === 'undefined') {
  (globalThis as any).TextDecoderStream = TextDecoderStreamPolyfill;
}
