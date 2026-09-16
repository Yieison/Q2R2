import session from 'express-session'
import connectPg from 'connect-pg-simple'
import { eq, desc, asc, and, gt, sql } from 'drizzle-orm'
import { db, pool } from './db.js'
import { users, qrCodes } from '../shared/schema.js'
import {
  decryptQrPayload,
  encryptQrPayload,
  getQrKeyring,
} from './qr-crypto.js'
import {
  ENCRYPTED_QR_NAME,
  ENCRYPTED_QR_TYPE,
  isProtectedQrRecord,
  migrateCoordinatedQrRecords,
} from './qr-migration.js'

const PostgresSessionStore = connectPg(session)
const ENCRYPTED_STYLE = {}
const QR_MIGRATION_LOCK = 1432845981

async function acquireQrWriteLock(tx) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock_shared(${QR_MIGRATION_LOCK})`)
}

function publicQr(record, payload) {
  return {
    id: record.id,
    userId: record.userId,
    name: payload.name,
    type: payload.type,
    data: payload.data,
    style: payload.style,
    createdAt: record.createdAt,
  }
}

function readProtectedQr(record) {
  if (!isProtectedQrRecord(record)) {
    throw new Error('QR storage migration is incomplete')
  }
  return publicQr(record, decryptQrPayload(record.data, record))
}

class DatabaseStorage {
  constructor() {
    this.sessionStore = new PostgresSessionStore({ pool, createTableIfMissing: true })
  }

  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id))
    return user
  }

  async getUserByUsername(username) {
    const [user] = await db.select().from(users).where(eq(users.username, username))
    return user
  }

  async createUser(insertUser) {
    const [user] = await db.insert(users).values(insertUser).returning()
    return user
  }

  async migrateAllQrCodes({ batchSize = 100 } = {}) {
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) {
      throw new Error('Invalid QR migration batch size')
    }
    const keyring = getQrKeyring()
    return db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${QR_MIGRATION_LOCK})`)
      return migrateCoordinatedQrRecords({
        keyring,
        batchSize,
        readBatch: (cursor, limit) =>
          tx
            .select()
            .from(qrCodes)
            .where(gt(qrCodes.id, cursor))
            .orderBy(asc(qrCodes.id))
            .limit(limit)
            .for('update'),
        updateRecord: (record, values) =>
          tx
            .update(qrCodes)
            .set(values)
            .where(and(eq(qrCodes.id, record.id), eq(qrCodes.userId, record.userId))),
      })
    })
  }

  async getQrCodes(userId) {
    const records = await db
      .select()
      .from(qrCodes)
      .where(eq(qrCodes.userId, userId))
      .orderBy(desc(qrCodes.createdAt))
    return records.map(readProtectedQr)
  }

  async getQrCode(id, userId) {
    const [record] = await db
      .select()
      .from(qrCodes)
      .where(and(eq(qrCodes.id, id), eq(qrCodes.userId, userId)))
    return record ? readProtectedQr(record) : undefined
  }

  async createQrCode(userId, payload) {
    return db.transaction(async (tx) => {
      await acquireQrWriteLock(tx)
      const [record] = await tx
        .insert(qrCodes)
        .values({
          userId,
          name: ENCRYPTED_QR_NAME,
          type: ENCRYPTED_QR_TYPE,
          data: '',
          style: ENCRYPTED_STYLE,
        })
        .returning()
      const envelope = encryptQrPayload(payload, record)
      await tx
        .update(qrCodes)
        .set({ data: envelope })
        .where(and(eq(qrCodes.id, record.id), eq(qrCodes.userId, userId)))
      return publicQr(record, payload)
    })
  }

  async updateQrCode(id, userId, payload) {
    return db.transaction(async (tx) => {
      await acquireQrWriteLock(tx)
      const [record] = await tx
        .select()
        .from(qrCodes)
        .where(and(eq(qrCodes.id, id), eq(qrCodes.userId, userId)))
        .for('update')
      if (!record) return undefined
      if (!isProtectedQrRecord(record)) throw new Error('QR storage migration is incomplete')
      const envelope = encryptQrPayload(payload, record)
      await tx
        .update(qrCodes)
        .set({
          name: ENCRYPTED_QR_NAME,
          type: ENCRYPTED_QR_TYPE,
          data: envelope,
          style: ENCRYPTED_STYLE,
        })
        .where(and(eq(qrCodes.id, id), eq(qrCodes.userId, userId)))
      return publicQr(record, payload)
    })
  }

  async deleteQrCode(id, userId) {
    return db.transaction(async (tx) => {
      await acquireQrWriteLock(tx)
      const result = await tx
        .delete(qrCodes)
        .where(and(eq(qrCodes.id, id), eq(qrCodes.userId, userId)))
        .returning()
      return result.length > 0
    })
  }
}

export const storage = new DatabaseStorage()