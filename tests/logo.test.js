import test from 'node:test'
import assert from 'node:assert/strict'
import { fitLogoDimensions, MAX_LOGO_BYTES, MAX_LOGO_FILE_BYTES } from '../src/lib/optimize-logo.js'

test('logo resizing preserves ratio, caps dimensions, and does not upscale', () => {
  assert.deepEqual(fitLogoDimensions(1200, 600), { width: 384, height: 192 })
  assert.deepEqual(fitLogoDimensions(600, 1200), { width: 192, height: 384 })
  assert.deepEqual(fitLogoDimensions(64, 32), { width: 64, height: 32 })
  assert.deepEqual(fitLogoDimensions(1, 8000), { width: 1, height: 384 })
})

test('logo dimensions reject invalid data and storage limits remain bounded', () => {
  for (const width of [0, -1, NaN, Infinity]) assert.throws(() => fitLogoDimensions(width, 100))
  assert.equal(MAX_LOGO_BYTES, 48 * 1024)
  assert.equal(MAX_LOGO_FILE_BYTES, 4 * 1024 * 1024)
})