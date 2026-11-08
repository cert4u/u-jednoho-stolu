import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const rooms = sqliteTable('rooms', { id: text('id').primaryKey(), data: text('data').notNull(), createdAt: integer('created_at').notNull().default(0), version: integer('version').notNull().default(0) });
export const catalogs = sqliteTable('catalogs', {
  id: text('id').primaryKey(), kind: text('kind').notNull(), enabled: integer('enabled').notNull().default(1),
  revision: integer('revision').notNull().default(1), digest: text('digest').notNull(), payload: text('payload').notNull(),
  source: text('source'), installedAt: text('installed_at').notNull(), checkedAt: text('checked_at'), updatedAt: text('updated_at'),
});
