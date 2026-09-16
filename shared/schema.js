import { pgTable, serial, text, varchar, jsonb, json, timestamp, integer, index } from 'drizzle-orm/pg-core'

export const session = pgTable(
  'session',
  {
    sid: varchar('sid').primaryKey(),
    sess: json('sess').notNull(),
    expire: timestamp('expire', { precision: 6 }).notNull(),
  },
  (table) => ({
    expireIdx: index('IDX_session_expire').on(table.expire),
  }),
)

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  password: text('password').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const qrCodes = pgTable('qr_codes', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(),
  data: text('data').notNull(),
  style: jsonb('style').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
