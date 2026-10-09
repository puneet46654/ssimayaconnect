/*
 * Continuous, append-only backup of the primary MongoDB database into a
 * separate backup cluster.
 *
 *   1. Opens a change stream on the primary first, so nothing written during
 *      the copy is missed.
 *   2. Copies every existing document and index (the "past" data).
 *   3. Applies every later insert, update and replace (the "future" data) as
 *      it happens, saving its position so a restart resumes where it stopped.
 *
 * The backup never deletes. A document deleted on the primary (admin panel,
 * user side, TTL expiry or a dropped collection) stays in the backup with its
 * last known contents, and the deletion is recorded in `_deletedOnPrimary`.
 * Backup indexes are copied without `unique` and TTL options so retained
 * documents can neither expire nor block new primary documents.
 *
 * Usage:
 *   node scripts/backup-sync.mjs           run continuously (initial copy if needed)
 *   node scripts/backup-sync.mjs --full    copy everything again, then run
 *   node scripts/backup-sync.mjs --verify  check every primary document is backed up
 *
 * Env: MONGODB_URI (primary), BACKUP_MONGODB_URI (backup cluster),
 *      BACKUP_DB_NAME (optional; defaults to the primary database name).
 */
import { MongoClient } from 'mongodb';

const SOURCE_URI = process.env.MONGODB_URI;
const BACKUP_URI = process.env.BACKUP_MONGODB_URI;
const STATE_COLLECTION = '_backupSync';
const DELETION_LOG = '_deletedOnPrimary';
const BATCH_SIZE = 1000;
const RECOPY = 'RECOPY';
const CHANGE_STREAM_HISTORY_LOST = 286;

if (!SOURCE_URI || !BACKUP_URI) {
  console.error('MONGODB_URI and BACKUP_MONGODB_URI must both be set.');
  process.exit(1);
}
if (SOURCE_URI === BACKUP_URI && !process.env.BACKUP_DB_NAME) {
  console.error('The backup must be a different cluster or database from the primary.');
  process.exit(1);
}

const log = (message) => console.log(`[backup-sync ${new Date().toISOString()}] ${message}`);
const isAppCollection = (name) =>
  !name.startsWith('system.') && name !== STATE_COLLECTION && name !== DELETION_LOG;

const source = new MongoClient(SOURCE_URI, { appName: 'ssimaya-backup-sync' });
const backup = new MongoClient(BACKUP_URI, { appName: 'ssimaya-backup-sync', retryWrites: true });

async function main() {
  await Promise.all([source.connect(), backup.connect()]);
  const sourceDb = source.db();
  const backupDb = backup.db(process.env.BACKUP_DB_NAME || sourceDb.databaseName);
  const state = backupDb.collection(STATE_COLLECTION);
  log(`primary "${sourceDb.databaseName}" -> backup "${backupDb.databaseName}" (append-only)`);

  if (process.argv.includes('--verify')) {
    const ok = await verify(sourceDb, backupDb);
    process.exitCode = ok ? 0 : 2;
    return;
  }

  let current = await state.findOne({ _id: 'state' });
  if (process.argv.includes('--full') || !current?.initialCopyDone || !current.resumeToken) {
    current = await fullCopy(sourceDb, backupDb, state);
  }

  for (;;) {
    try {
      await tail(sourceDb, backupDb, state, current.resumeToken);
    } catch (error) {
      if (error?.code === CHANGE_STREAM_HISTORY_LOST || error?.code === RECOPY) {
        log(`${error.message}; copying everything again (nothing is deleted).`);
        current = await fullCopy(sourceDb, backupDb, state);
        continue;
      }
      log(`Change stream stopped (${error?.message || error}); retrying in 5s.`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
      current = (await state.findOne({ _id: 'state' })) || current;
    }
  }
}

async function fullCopy(sourceDb, backupDb, state) {
  log('Full copy started.');
  // Start watching before copying; changes made during the copy replay afterwards.
  const stream = sourceDb.watch([], { fullDocument: 'updateLookup' });
  await stream.tryNext();
  const resumeToken = stream.resumeToken;
  await stream.close();

  const collections = (await sourceDb.listCollections({}, { nameOnly: false }).toArray()).filter(
    (info) => info.type === 'collection' && isAppCollection(info.name),
  );

  const existing = new Set((await backupDb.listCollections({}, { nameOnly: true }).toArray()).map((info) => info.name));
  for (const { name } of collections) {
    const from = sourceDb.collection(name);
    const to = backupDb.collection(name);
    // Empty collections with no indexes would otherwise never appear in the backup.
    if (!existing.has(name)) await backupDb.createCollection(name);
    await copyIndexes(from, to);

    let ops = [];
    let copied = 0;
    for await (const doc of from.find({}, { batchSize: BATCH_SIZE })) {
      ops.push({ replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true } });
      if (ops.length === BATCH_SIZE) {
        await to.bulkWrite(ops, { ordered: false });
        copied += ops.length;
        ops = [];
      }
    }
    if (ops.length) {
      await to.bulkWrite(ops, { ordered: false });
      copied += ops.length;
    }
    log(`  ${name}: ${copied} copied`);
  }

  const next = { _id: 'state', resumeToken, initialCopyDone: true, fullCopyAt: new Date(), lastSyncedAt: new Date() };
  await state.replaceOne({ _id: 'state' }, next, { upsert: true });
  log(`Full copy finished (${collections.length} collections).`);
  return next;
}

async function copyIndexes(from, to) {
  const specs = (await from.indexes())
    .filter((index) => index.name !== '_id_')
    .map((index) => {
      const spec = { ...index };
      // Backup keeps deleted/expired documents, so it must not enforce these.
      for (const key of ['v', 'ns', 'unique', 'expireAfterSeconds']) delete spec[key];
      return spec;
    });
  if (!specs.length) return;
  try {
    await to.createIndexes(specs);
  } catch (error) {
    // An index whose options changed is rebuilt. This drops indexes only, never documents.
    log(`  rebuilding indexes for ${to.collectionName} (${error.message})`);
    await to.dropIndexes();
    await to.createIndexes(specs);
  }
}

async function tail(sourceDb, backupDb, state, resumeToken) {
  const stream = sourceDb.watch([], { fullDocument: 'updateLookup', resumeAfter: resumeToken });
  log('Live sync running.');
  let pending = 0;
  let lastSaved = Date.now();

  const saveToken = async () => {
    await state.updateOne(
      { _id: 'state' },
      { $set: { resumeToken: stream.resumeToken, lastSyncedAt: new Date() } },
    );
    pending = 0;
    lastSaved = Date.now();
  };

  const shutdown = async () => {
    log('Stopping; saving position.');
    await saveToken().catch(() => {});
    await stream.close().catch(() => {});
    await Promise.all([source.close(), backup.close()]);
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  try {
    for (;;) {
      const change = await stream.tryNext();
      if (change) {
        await applyChange(backupDb, change);
        pending += 1;
      }
      // Persist the position often enough that a restart replays very little.
      if ((pending && (pending >= 100 || Date.now() - lastSaved > 2000)) || Date.now() - lastSaved > 60000) {
        await saveToken();
      }
    }
  } finally {
    process.off('SIGINT', shutdown);
    process.off('SIGTERM', shutdown);
    await stream.close().catch(() => {});
  }
}

async function applyChange(backupDb, change) {
  const name = change.ns?.coll;
  if (name && !isAppCollection(name)) return;

  switch (change.operationType) {
    case 'insert':
    case 'update':
    case 'replace':
      // updateLookup gives the latest document; null means it was deleted since,
      // so the backup keeps the version it already has.
      if (change.fullDocument) {
        await backupDb
          .collection(name)
          .replaceOne({ _id: change.documentKey._id }, change.fullDocument, { upsert: true });
      }
      break;
    case 'delete':
      // Never delete from the backup; only record that the primary deleted it.
      await backupDb.collection(DELETION_LOG).updateOne(
        { collection: name, documentId: change.documentKey._id },
        { $setOnInsert: { deletedAt: change.wallTime || new Date() } },
        { upsert: true },
      );
      break;
    case 'drop':
      log(`Primary dropped "${name}"; the backup copy is kept.`);
      break;
    case 'rename':
      // The renamed collection's documents arrive through a fresh additive copy.
      throw Object.assign(new Error(`primary renamed "${name}"`), { code: RECOPY });
    case 'dropDatabase':
    case 'invalidate':
      throw Object.assign(new Error(`primary ${change.operationType}`), { code: RECOPY });
    default:
      break;
  }
}

async function verify(sourceDb, backupDb) {
  const names = (await sourceDb.listCollections({}, { nameOnly: true }).toArray())
    .map((info) => info.name)
    .filter(isAppCollection)
    .sort();
  let ok = true;
  for (const name of names) {
    const from = sourceDb.collection(name);
    const to = backupDb.collection(name);
    let primary = 0;
    let missing = 0;
    let ids = [];
    const check = async () => {
      const found = await to.countDocuments({ _id: { $in: ids } });
      missing += ids.length - found;
      ids = [];
    };
    for await (const { _id } of from.find({}, { projection: { _id: 1 }, batchSize: BATCH_SIZE })) {
      primary += 1;
      ids.push(_id);
      if (ids.length === BATCH_SIZE) await check();
    }
    if (ids.length) await check();
    const backedUp = await to.countDocuments();
    if (missing) ok = false;
    log(`${missing ? 'MISSING' : 'OK     '} ${name}: primary ${primary}, backup ${backedUp} (${missing} missing, ${Math.max(0, backedUp - primary + missing)} kept after primary delete)`);
  }
  const state = await backupDb.collection(STATE_COLLECTION).findOne({ _id: 'state' });
  log(`Last synced: ${state?.lastSyncedAt?.toISOString() || 'never'}`);
  await Promise.all([source.close(), backup.close()]);
  return ok;
}

main().catch(async (error) => {
  console.error('[backup-sync] fatal:', error);
  await Promise.all([source.close(), backup.close()]).catch(() => {});
  process.exit(1);
});
