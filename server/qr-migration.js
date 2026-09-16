import {
  decryptQrPayload,
  encryptLegacyQrRecord,
} from './qr-crypto.js'

export const ENCRYPTED_QR_NAME = '[encrypted]'
export const ENCRYPTED_QR_TYPE = 'encrypted'

export function isProtectedQrRecord(record) {
  return record?.name === ENCRYPTED_QR_NAME && record?.type === ENCRYPTED_QR_TYPE
}

export async function migrateLockedQrRecords(records, { updateRecord, keyring }) {
  let migrated = 0
  for (const record of records) {
    if (isProtectedQrRecord(record)) {
      // Authentication is checked even for already migrated records before serving.
      decryptQrPayload(record.data, { ...record, keyring })
      continue
    }
    const protectedRecord = encryptLegacyQrRecord(record, keyring)
    await updateRecord(record, {
      name: protectedRecord.name,
      type: protectedRecord.type,
      data: protectedRecord.data,
      style: protectedRecord.style,
    })
    migrated += 1
  }
  return migrated
}

export async function migrateCoordinatedQrRecords({
  readBatch,
  updateRecord,
  keyring,
  batchSize = 100,
}) {
  let checked = 0
  let cursor = 0

  // The complete preflight deliberately occurs before the first write.
  for (;;) {
    const records = await readBatch(cursor, batchSize)
    if (!records.length) break
    for (const record of records) {
      if (isProtectedQrRecord(record)) {
        decryptQrPayload(record.data, { ...record, keyring })
      }
    }
    checked += records.length
    cursor = records.at(-1).id
  }

  let migrated = 0
  cursor = 0
  for (;;) {
    const records = await readBatch(cursor, batchSize)
    if (!records.length) break
    migrated += await migrateLockedQrRecords(records, { updateRecord, keyring })
    cursor = records.at(-1).id
  }
  return { checked, migrated }
}