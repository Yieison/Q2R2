import test from 'node:test'
import assert from 'node:assert/strict'
import {
  generateEmailString,
  generatePhoneString,
  generateWifiString,
  parseEmailString,
  parsePhoneValue,
  parseWifiString,
} from '../src/lib/qr-input-values.js'
import { clearQrDraft, getQrDraft, saveQrDraft } from '../src/lib/qr-draft.js'

const draftStore = new Map()
globalThis.sessionStorage = {
  getItem: (key) => draftStore.get(key) || null,
  setItem: (key, value) => draftStore.set(key, String(value)),
  removeItem: (key) => draftStore.delete(key),
}

test('WiFi serialization escapes delimiters and parsing preserves them', () => {
  const source = { ssid: 'Café; red', password: 'a:b,c\\d', encryption: 'WPA', hidden: true }
  assert.deepEqual(parseWifiString(generateWifiString(source)), source)
})

test('email parsing decodes mailto recipient and query fields', () => {
  const source = { email: 'hola+qr@ejemplo.co', subject: 'Menú & café', body: 'Hola mundo' }
  assert.deepEqual(parseEmailString(generateEmailString(source)), source)
})

test('phone parsing separates the longest matching dial code', () => {
  const countries = [{ code: 'CO', dialCode: '+57' }, { code: 'EC', dialCode: '+593' }]
  assert.deepEqual(parsePhoneValue(generatePhoneString('+593991234567'), countries), {
    country: countries[1],
    digits: '991234567',
  })
})

test('reading a save draft is non-consuming across the auth handoff', () => {
  clearQrDraft()
  const draft = {
    name: 'QR de prueba',
    type: 'wifi',
    data: 'WIFI:T:WPA;S:Red\\;demo;P:clave\\:temporal\\;123;H:false;',
    style: { logo: { src: 'data:image/png;base64,AA==', renderSrc: 'temporary-preview' } },
  }
  assert.equal(saveQrDraft(draft), true)
  const firstRead = getQrDraft()
  const secondRead = getQrDraft()
  assert.equal(firstRead.data, draft.data)
  assert.equal(secondRead.data, draft.data)
  assert.equal(secondRead.name, draft.name)
  assert.equal(secondRead.style.logo.renderSrc, undefined)
  clearQrDraft()
  assert.equal(getQrDraft(), null)
})