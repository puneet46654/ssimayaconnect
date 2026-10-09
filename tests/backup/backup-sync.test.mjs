/*
 * End-to-end tests for scripts/backup-sync.mjs.
 *
 * Starts two disposable single-node replica sets (primary + backup) in temp
 * directories, runs the real backup script as a child process and checks every
 * behaviour: initial copy, live sync, append-only deletes, TTL, drops, renames,
 * restarts, outages, transactions, --full and --verify.
 *
 * Never touches a real database. Needs a mongod binary: set MONGOD_BIN, or keep
 * the mongodb-memory-server cache at ~/.cache/mongodb-binaries.
 *
 *   npm run test:backup
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Binary, Decimal128, Long, MongoClient, ObjectId } from 'mongodb';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = path.join(ROOT, 'scripts', 'backup-sync.mjs');
const DB = 'backup_sync_test';
const PRIMARY_PORT = 27041;
const BACKUP_PORT = 27042;
const PRIMARY_URI = `mongodb://127.0.0.1:${PRIMARY_PORT}/${DB}?replicaSet=bsPrimary`;
const BACKUP_URI = `mongodb://127.0.0.1:${BACKUP_PORT}/${DB}?replicaSet=bsBackup`;
const HISTORY_PORT = 27043;
const HISTORY_URI = `mongodb://127.0.0.1:${HISTORY_PORT}/${DB}?replicaSet=bsHistory`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findMongod() {
  if (process.env.MONGOD_BIN) return process.env.MONGOD_BIN;
  const cache = path.join(homedir(), '.cache', 'mongodb-binaries');
  const found = existsSync(cache) && readdirSync(cache).find((file) => file.startsWith('mongod'));
  if (!found) throw new Error('No mongod binary. Set MONGOD_BIN.');
  return path.join(cache, found);
}

async function waitUntil(check, { timeout = 30000, interval = 200, message = 'condition' } = {}) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    try {
      last = await check();
      if (last) return last;
    } catch (error) {
      last = error;
    }
    await sleep(interval);
  }
  throw new Error(`Timed out waiting for ${message} (last: ${last?.message ?? JSON.stringify(last)})`);
}

/* ---------- disposable replica sets ---------- */

const servers = {};

async function startServer(name, port, dbpath, extraArgs = []) {
  const proc = spawn(
    findMongod(),
    ['--replSet', name, '--port', String(port), '--bind_ip', '127.0.0.1', '--dbpath', dbpath,
      '--setParameter', 'ttlMonitorSleepSecs=1', '--quiet', ...extraArgs],
    { stdio: 'ignore' },
  );
  servers[name] = { proc, port, dbpath };
  const admin = new MongoClient(`mongodb://127.0.0.1:${port}/?directConnection=true`, { serverSelectionTimeoutMS: 2000 });
  await waitUntil(() => admin.connect().then(() => true), { message: `${name} to start` });
  try {
    await admin.db('admin').command({ replSetInitiate: { _id: name, members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
  } catch (error) {
    if (error.codeName !== 'AlreadyInitialized') throw error;
  }
  await waitUntil(async () => (await admin.db('admin').command({ hello: 1 })).isWritablePrimary, { message: `${name} primary` });
  await admin.close();
}

async function stopServer(name) {
  const server = servers[name];
  if (!server || server.proc.exitCode !== null) return;
  const exited = new Promise((resolve) => server.proc.once('exit', resolve));
  server.proc.kill();
  await exited;
}

/* ---------- backup-sync child process ---------- */

const syncs = new Set();

function runSync(args = [], env = {}) {
  const child = spawn(process.execPath, [SCRIPT, ...args], {
    env: { ...process.env, MONGODB_URI: PRIMARY_URI, BACKUP_MONGODB_URI: BACKUP_URI, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const exit = new Promise((resolve) => child.once('exit', (code) => resolve(code)));
  const handle = {
    child,
    exit,
    get output() { return output; },
    waitFor: (pattern, timeout = 30000) =>
      waitUntil(() => pattern.test(output), { timeout, message: `output ${pattern}` }).catch((error) => {
        throw new Error(`${error.message}\n--- sync output ---\n${output}`);
      }),
    async kill() {
      if (child.exitCode === null) {
        child.kill();
        await exit;
      }
      syncs.delete(handle);
    },
  };
  syncs.add(handle);
  return handle;
}

/** Waits until the running sync has saved a position that includes everything written so far. */
async function waitForSaved(backupDb, since) {
  await waitUntil(async () => {
    const state = await backupDb.collection('_backupSync').findOne({ _id: 'state' });
    return state?.lastSyncedAt > since;
  }, { message: 'sync position saved' });
}

/* ---------- suite ---------- */

describe('backup-sync', { concurrency: false }, () => {
  let dirs;
  let primary;
  let backup;
  let pdb;
  let bdb;

  const connectClients = async () => {
    primary = new MongoClient(PRIMARY_URI);
    backup = new MongoClient(BACKUP_URI);
    await Promise.all([primary.connect(), backup.connect()]);
    pdb = primary.db(DB);
    bdb = backup.db(DB);
  };

  before(async () => {
    dirs = [mkdtempSync(path.join(tmpdir(), 'bs-primary-')), mkdtempSync(path.join(tmpdir(), 'bs-backup-'))];
    await Promise.all([
      startServer('bsPrimary', PRIMARY_PORT, dirs[0]),
      startServer('bsBackup', BACKUP_PORT, dirs[1]),
    ]);
    await connectClients();
  });

  after(async () => {
    for (const sync of [...syncs]) await sync.kill();
    await Promise.all([primary?.close(), backup?.close()]).catch(() => {});
    await Promise.all([stopServer('bsPrimary'), stopServer('bsBackup')]);
    for (const dir of dirs ?? []) rmSync(dir, { recursive: true, force: true });
  });

  /* --- startup guards --- */

  test('refuses to start without MONGODB_URI or BACKUP_MONGODB_URI', async () => {
    const run = runSync([], { BACKUP_MONGODB_URI: '' });
    assert.equal(await run.exit, 1);
    assert.match(run.output, /must both be set/);
  });

  test('refuses to back up a database onto itself', async () => {
    const run = runSync([], { BACKUP_MONGODB_URI: PRIMARY_URI });
    assert.equal(await run.exit, 1);
    assert.match(run.output, /different cluster or database/);
  });

  /* --- initial copy --- */

  const sample = {
    _id: new ObjectId(),
    name: 'Types',
    when: new Date('2026-10-09T10:00:00Z'),
    price: Decimal128.fromString('1234.56'),
    big: Long.fromString('9007199254740993'),
    bytes: new Binary(Buffer.from('backup')),
    nested: { a: [1, { b: 'c' }], empty: {} },
    nothing: null,
  };

  test('initial copy: every document, every BSON type, and indexes without unique/TTL', async () => {
    await pdb.collection('events').insertMany(
      Array.from({ length: 2500 }, (_, i) => ({ title: `Event ${i}`, slug: `event-${i}`, seq: i })),
    );
    await pdb.collection('events').createIndex({ slug: 1 }, { unique: true });
    await pdb.collection('events').createIndex({ seq: 1, title: -1 }, { name: 'seq_title' });
    await pdb.collection('events').createIndex({ seq: 1 }, { partialFilterExpression: { seq: { $gt: 100 } }, name: 'seq_partial' });
    await pdb.collection('sessions').createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 });
    await pdb.collection('sessions').insertOne({ createdAt: new Date(), user: 'u1' });
    await pdb.collection('types').insertOne(sample);
    await pdb.createCollection('emptyone');
    await pdb.createCollection('eventsView', { viewOn: 'events', pipeline: [{ $match: { seq: { $lt: 5 } } }] });

    const run = runSync();
    await run.waitFor(/Live sync running/);

    assert.equal(await bdb.collection('events').countDocuments(), 2500);
    assert.equal(await bdb.collection('sessions').countDocuments(), 1);
    assert.deepEqual(await bdb.collection('types').findOne({ _id: sample._id }), await pdb.collection('types').findOne({ _id: sample._id }));

    const names = (await bdb.listCollections().toArray()).map((c) => c.name).sort();
    assert.ok(names.includes('emptyone'), 'empty collection created with indexes path');
    assert.ok(!names.includes('eventsView'), 'views are not copied as data');

    const eventIdx = await bdb.collection('events').indexes();
    const slug = eventIdx.find((i) => i.name === 'slug_1');
    assert.ok(slug && !slug.unique, 'unique index copied without unique');
    assert.ok(eventIdx.find((i) => i.name === 'seq_title'), 'compound index copied');
    assert.deepEqual(eventIdx.find((i) => i.name === 'seq_partial')?.partialFilterExpression, { seq: { $gt: 100 } });
    const ttl = (await bdb.collection('sessions').indexes()).find((i) => i.name === 'createdAt_1');
    assert.ok(ttl && ttl.expireAfterSeconds === undefined, 'TTL index copied without expireAfterSeconds');

    const state = await bdb.collection('_backupSync').findOne({ _id: 'state' });
    assert.equal(state.initialCopyDone, true);
    assert.ok(state.resumeToken && state.fullCopyAt instanceof Date);
    assert.equal(await pdb.collection('_backupSync').countDocuments(), 0, 'nothing written to the primary');
    await run.kill();
  });

  test('writes made during the initial copy are not missed', async () => {
    await bdb.collection('_backupSync').deleteMany({});
    await pdb.collection('bulk').insertMany(Array.from({ length: 20000 }, (_, i) => ({ i, pad: 'x'.repeat(200) })));
    const run = runSync();
    await run.waitFor(/Full copy started/);
    const during = [];
    for (let i = 0; i < 50; i += 1) {
      const { insertedId } = await pdb.collection('events').insertOne({ title: `During ${i}`, slug: `during-${i}` });
      during.push(insertedId);
      if (i === 10) await pdb.collection('events').updateOne({ seq: 1 }, { $set: { title: 'Edited during copy' } });
    }
    await run.waitFor(/Live sync running/, 60000);
    await waitUntil(async () => (await bdb.collection('events').countDocuments({ _id: { $in: during } })) === 50, { message: 'during-copy inserts' });
    assert.equal((await bdb.collection('events').findOne({ seq: 1 })).title, 'Edited during copy');
    assert.equal(await bdb.collection('bulk').countDocuments(), 20000);
    await run.kill();
  });

  /* --- live sync --- */

  describe('live sync', () => {
    let run;
    before(async () => {
      run = runSync();
      await run.waitFor(/Live sync running/);
    });
    after(() => run.kill());

    test('insert, $set/$inc/$unset/$push update and replace all reach the backup', async () => {
      const { insertedId } = await pdb.collection('bookings').insertOne({ name: 'A', seats: 1, tags: [], note: 'x' });
      await waitUntil(() => bdb.collection('bookings').findOne({ _id: insertedId }), { message: 'insert' });

      await pdb.collection('bookings').updateOne({ _id: insertedId }, { $set: { name: 'B' }, $inc: { seats: 2 }, $unset: { note: '' }, $push: { tags: 'vip' } });
      await waitUntil(async () => (await bdb.collection('bookings').findOne({ _id: insertedId }))?.name === 'B', { message: 'update' });
      assert.deepEqual(await bdb.collection('bookings').findOne({ _id: insertedId }), { _id: insertedId, name: 'B', seats: 3, tags: ['vip'] });

      await pdb.collection('bookings').replaceOne({ _id: insertedId }, { replaced: true });
      await waitUntil(async () => (await bdb.collection('bookings').findOne({ _id: insertedId }))?.replaced, { message: 'replace' });
      assert.deepEqual(await bdb.collection('bookings').findOne({ _id: insertedId }), { _id: insertedId, replaced: true });
    });

    test('updateMany, upsert, findOneAndUpdate and a brand-new collection', async () => {
      await pdb.collection('events').updateMany({ seq: { $lt: 10 } }, { $set: { flagged: true } });
      await pdb.collection('slots').updateOne({ key: 'new' }, { $set: { cap: 5 } }, { upsert: true });
      await pdb.collection('slots').findOneAndUpdate({ key: 'new' }, { $inc: { cap: 1 } });
      await pdb.collection('brandNew').insertOne({ hello: 'world' });
      await waitUntil(async () => (await bdb.collection('events').countDocuments({ flagged: true })) === 10, { message: 'updateMany' });
      await waitUntil(async () => (await bdb.collection('slots').findOne({ key: 'new' }))?.cap === 6, { message: 'upsert + findOneAndUpdate' });
      await waitUntil(() => bdb.collection('brandNew').findOne({ hello: 'world' }), { message: 'new collection' });
    });

    test('a burst of 5,000 inserts arrives in full and in order of final state', async () => {
      const docs = Array.from({ length: 5000 }, (_, i) => ({ burst: i }));
      await pdb.collection('burst').insertMany(docs);
      for (let i = 0; i < 20; i += 1) await pdb.collection('burst').updateOne({ burst: 0 }, { $set: { v: i } });
      await waitUntil(async () => (await bdb.collection('burst').countDocuments()) === 5000, { timeout: 60000, message: 'burst' });
      await waitUntil(async () => (await bdb.collection('burst').findOne({ burst: 0 }))?.v === 19, { message: 'last write wins' });
    });

    test('committed transactions are copied; aborted transactions are not', async () => {
      const session = primary.startSession();
      await session.withTransaction(async () => {
        await pdb.collection('bookings').insertOne({ tx: 'commit-1' }, { session });
        await pdb.collection('slots').insertOne({ tx: 'commit-2' }, { session });
      });
      const aborted = primary.startSession();
      aborted.startTransaction();
      await pdb.collection('bookings').insertOne({ tx: 'abort' }, { session: aborted });
      await aborted.abortTransaction();
      await Promise.all([session.endSession(), aborted.endSession()]);
      await waitUntil(async () => (await bdb.collection('slots').countDocuments({ tx: 'commit-2' })) === 1, { message: 'transaction' });
      assert.equal(await bdb.collection('bookings').countDocuments({ tx: 'commit-1' }), 1);
      await sleep(1500);
      assert.equal(await bdb.collection('bookings').countDocuments({ tx: 'abort' }), 0);
    });

    test('deletes never remove backup data and are logged once in _deletedOnPrimary', async () => {
      const { insertedId } = await pdb.collection('bookings').insertOne({ name: 'To delete', v: 1 });
      await pdb.collection('bookings').updateOne({ _id: insertedId }, { $set: { v: 2 } });
      await waitUntil(async () => (await bdb.collection('bookings').findOne({ _id: insertedId }))?.v === 2, { message: 'pre-delete' });
      await pdb.collection('bookings').deleteOne({ _id: insertedId });
      await pdb.collection('events').deleteMany({ seq: { $gte: 2000 } });
      await waitUntil(async () => {
        const logged = await bdb.collection('_deletedOnPrimary').countDocuments({ collection: 'events' });
        if (logged !== 500) throw new Error(`${logged} of 500 logged`);
        return true;
      }, { message: 'deleteMany logged' });
      const kept = await bdb.collection('bookings').findOne({ _id: insertedId });
      assert.equal(kept.v, 2, 'backup keeps the last known contents');
      const entry = await bdb.collection('_deletedOnPrimary').findOne({ collection: 'bookings', documentId: insertedId });
      assert.ok(entry?.deletedAt instanceof Date);
      assert.equal(await bdb.collection('events').countDocuments({ seq: { $gte: 2000 } }), 500, 'deleteMany kept in backup');
    });

    test('an update immediately followed by a delete keeps the earlier version', async () => {
      const { insertedId } = await pdb.collection('bookings').insertOne({ race: 1 });
      await waitUntil(() => bdb.collection('bookings').findOne({ _id: insertedId }), { message: 'race insert' });
      await pdb.collection('bookings').updateOne({ _id: insertedId }, { $set: { race: 2 } });
      await pdb.collection('bookings').deleteOne({ _id: insertedId });
      await waitUntil(() => bdb.collection('_deletedOnPrimary').findOne({ documentId: insertedId }), { message: 'race delete' });
      assert.ok(await bdb.collection('bookings').findOne({ _id: insertedId }), 'document still in backup');
    });

    test('a new document may reuse a deleted document\'s unique value', async () => {
      await pdb.collection('events').deleteOne({ slug: 'event-5' });
      const { insertedId } = await pdb.collection('events').insertOne({ slug: 'event-5', title: 'Reused' });
      await waitUntil(() => bdb.collection('events').findOne({ _id: insertedId }), { message: 'reused unique' });
      assert.equal(await bdb.collection('events').countDocuments({ slug: 'event-5' }), 2);
    });

    test('TTL expiry on the primary does not expire the backup copy', async () => {
      await pdb.collection('ttl').createIndex({ at: 1 }, { expireAfterSeconds: 1 });
      const { insertedId } = await pdb.collection('ttl').insertOne({ at: new Date(Date.now() - 60000) });
      await waitUntil(async () => !(await pdb.collection('ttl').findOne({ _id: insertedId })), { timeout: 30000, message: 'primary TTL delete' });
      await waitUntil(() => bdb.collection('_deletedOnPrimary').findOne({ documentId: insertedId }), { message: 'TTL delete logged' });
      assert.ok(await bdb.collection('ttl').findOne({ _id: insertedId }));
    });

    test('dropping a collection keeps the backup copy and sync continues', async () => {
      await pdb.collection('toDrop').insertMany([{ d: 1 }, { d: 2 }]);
      await waitUntil(async () => (await bdb.collection('toDrop').countDocuments()) === 2, { message: 'toDrop copied' });
      await pdb.collection('toDrop').drop();
      await run.waitFor(/Primary dropped "toDrop"/);
      await pdb.collection('afterDrop').insertOne({ ok: 1 });
      await waitUntil(() => bdb.collection('afterDrop').findOne({ ok: 1 }), { message: 'sync after drop' });
      assert.equal(await bdb.collection('toDrop').countDocuments(), 2);
    });

    test('renaming a collection triggers an additive re-copy; both names kept', async () => {
      await pdb.collection('oldName').insertMany([{ r: 1 }, { r: 2 }]);
      await waitUntil(async () => (await bdb.collection('oldName').countDocuments()) === 2, { message: 'oldName copied' });
      await pdb.collection('oldName').rename('newName');
      await run.waitFor(/primary renamed "oldName"/);
      await waitUntil(async () => (await bdb.collection('newName').countDocuments()) === 2, { timeout: 60000, message: 'renamed copy' });
      assert.equal(await bdb.collection('oldName').countDocuments(), 2);
      await run.waitFor(/Live sync running[\s\S]*Live sync running/, 60000);
      await pdb.collection('newName').insertOne({ r: 3 });
      await waitUntil(async () => (await bdb.collection('newName').countDocuments()) === 3, { message: 'sync after rename' });
    });

    test('collections whose names start with system. or the sync\'s own names are ignored', async () => {
      await pdb.collection('_backupSync').insertOne({ _id: 'state', poison: true });
      await pdb.collection('_deletedOnPrimary').insertOne({ poison: true });
      await pdb.collection('marker').insertOne({ m: 1 });
      await waitUntil(() => bdb.collection('marker').findOne({ m: 1 }), { message: 'marker' });
      assert.equal((await bdb.collection('_backupSync').findOne({ _id: 'state' })).poison, undefined);
      assert.equal(await bdb.collection('_deletedOnPrimary').countDocuments({ poison: true }), 0);
      await pdb.collection('_backupSync').drop();
      await pdb.collection('_deletedOnPrimary').drop();
    });
  });

  /* --- restarts and outages --- */

  test('crash and restart: catches up on changes made while stopped, no duplicates', async () => {
    let run = runSync();
    await run.waitFor(/Live sync running/);
    const since = new Date();
    await pdb.collection('restart').insertOne({ before: true });
    await waitForSaved(bdb, since);
    await run.kill();

    const offline = await pdb.collection('restart').insertMany(Array.from({ length: 300 }, (_, i) => ({ offline: i })));
    await pdb.collection('restart').updateOne({ before: true }, { $set: { editedOffline: true } });
    await pdb.collection('restart').deleteOne({ offline: 0 });

    run = runSync();
    await run.waitFor(/Live sync running/);
    assert.doesNotMatch(run.output, /Full copy started/, 'resumes instead of re-copying');
    await waitUntil(async () => (await bdb.collection('restart').countDocuments()) === 301, { message: 'offline catch-up' });
    assert.ok((await bdb.collection('restart').findOne({ before: true })).editedOffline);
    assert.ok(await bdb.collection('_deletedOnPrimary').findOne({ documentId: offline.insertedIds[0] }));
    await run.kill();
  });

  test('killed in the middle of the initial copy: next start copies again and completes', async () => {
    await bdb.collection('_backupSync').deleteMany({});
    let run = runSync();
    await run.waitFor(/Full copy started/);
    await run.kill();
    run = runSync();
    await run.waitFor(/Full copy finished/, 90000);
    await run.waitFor(/Live sync running/);
    assert.equal(await bdb.collection('bulk').countDocuments(), 20000);
    await run.kill();
  });

  test('backup cluster outage: retries, then applies everything written during the outage', async () => {
    const run = runSync();
    await run.waitFor(/Live sync running/);
    await stopServer('bsBackup');
    const { insertedIds } = await pdb.collection('outage').insertMany(Array.from({ length: 100 }, (_, i) => ({ o: i })));
    await run.waitFor(/retrying in 5s/, 60000);
    await startServer('bsBackup', BACKUP_PORT, dirs[1]);
    await backup.close().catch(() => {});
    backup = new MongoClient(BACKUP_URI);
    await backup.connect();
    bdb = backup.db(DB);
    await waitUntil(async () => (await bdb.collection('outage').countDocuments({ _id: { $in: Object.values(insertedIds) } })) === 100, { timeout: 90000, message: 'outage catch-up' });
    await run.kill();
  });

  test('primary dropDatabase: backup keeps everything, sync re-copies and continues', async () => {
    const run = runSync();
    await run.waitFor(/Live sync running/);
    const before = await bdb.collection('events').countDocuments();
    await pdb.dropDatabase();
    await run.waitFor(/primary dropDatabase|primary invalidate/, 30000);
    await run.waitFor(/Full copy finished[\s\S]*Live sync running/, 60000);
    await pdb.collection('events').insertOne({ title: 'After drop', slug: 'after-drop' });
    await waitUntil(() => bdb.collection('events').findOne({ slug: 'after-drop' }), { message: 'sync after dropDatabase' });
    assert.equal(await bdb.collection('events').countDocuments(), before + 1);
    await run.kill();
  });

  test('lost change-stream history (oplog rolled over while stopped) falls back to an additive full copy', async () => {
    // A third primary with a 1 MB oplog and 1 s checkpoints, so history is lost quickly.
    const dir = mkdtempSync(path.join(tmpdir(), 'bs-history-'));
    dirs.push(dir);
    await startServer('bsHistory', HISTORY_PORT, dir, ['--oplogSize', '1', '--syncdelay', '1']);
    const env = { MONGODB_URI: HISTORY_URI, BACKUP_DB_NAME: 'history_backup' };
    const hist = new MongoClient(HISTORY_URI);
    await hist.connect();
    const hdb = hist.db(DB);
    const hbackup = backup.db('history_backup');
    try {
      await hdb.collection('kept').insertOne({ before: true });
      let run = runSync([], env);
      await run.waitFor(/Live sync running/);
      const since = new Date();
      await hdb.collection('kept').insertOne({ live: true });
      await waitForSaved(hbackup, since);
      await run.kill();

      const { insertedId } = await hdb.collection('kept').insertOne({ whileStopped: true });
      const pad = 'x'.repeat(100 * 1024);
      const first = async () => (await hist.db('local').collection('oplog.rs').find().sort({ $natural: 1 }).limit(1).next()).ts;
      const start = await first();
      await waitUntil(async () => {
        for (let i = 0; i < 50; i += 1) await hdb.collection('filler').insertOne({ pad });
        return (await first()).greaterThan(start);
      }, { timeout: 60000, interval: 1000, message: 'oplog rollover' });
      await hdb.collection('filler').drop();

      run = runSync([], env);
      await run.waitFor(/copying everything again[\s\S]*Full copy finished[\s\S]*Live sync running/, 60000);
      await run.kill();
      assert.ok(await hbackup.collection('kept').findOne({ _id: insertedId }), 'write made while stopped recovered by the re-copy');
      assert.equal(await hbackup.collection('kept').countDocuments(), 3);
    } finally {
      await hist.close();
      await stopServer('bsHistory');
      await backup.db('history_backup').dropDatabase();
    }
  });

  /* --- --full and --verify --- */

  test('--full is additive: deleted documents stay, and changed indexes are rebuilt', async () => {
    await pdb.collection('events').insertMany([{ slug: 'x1', email: 'a@x' }, { slug: 'x2', email: 'b@x' }]);
    await pdb.collection('events').createIndex({ email: 1 }, { name: 'email_idx' });
    let run = runSync(['--full']);
    await run.waitFor(/Live sync running/, 90000);
    await run.kill();
    const backedUp = await bdb.collection('events').countDocuments();

    await pdb.collection('events').deleteOne({ slug: 'x1' });
    await pdb.collection('events').dropIndex('email_idx');
    await pdb.collection('events').createIndex({ email: -1 }, { name: 'email_idx' });
    run = runSync(['--full']);
    await run.waitFor(/Live sync running/, 90000);
    await run.kill();
    assert.match(run.output, /rebuilding indexes for events/);
    assert.equal(await bdb.collection('events').countDocuments(), backedUp, 'nothing removed by --full or the index rebuild');
    assert.deepEqual((await bdb.collection('events').indexes()).find((i) => i.name === 'email_idx').key, { email: -1 });
  });

  test('--verify passes when complete and fails (exit 2) when a document is missing', async () => {
    let run = runSync(['--verify']);
    assert.equal(await run.exit, 0, run.output);
    assert.match(run.output, /OK +events/);
    assert.doesNotMatch(run.output, /MISSING/);

    const victim = await pdb.collection('events').findOne({ slug: 'x2' });
    await bdb.collection('events').deleteOne({ _id: victim._id });
    run = runSync(['--verify']);
    assert.equal(await run.exit, 2, run.output);
    assert.match(run.output, /MISSING events: .*\(1 missing/);

    run = runSync(['--full']);
    await run.waitFor(/Live sync running/, 90000);
    await run.kill();
    run = runSync(['--verify']);
    assert.equal(await run.exit, 0, 'a --full run repairs the gap');
  });

  test('the backup database name can be overridden with BACKUP_DB_NAME', async () => {
    const run = runSync(['--full'], { BACKUP_DB_NAME: 'custom_backup' });
    await run.waitFor(/-> backup "custom_backup"[\s\S]*Live sync running/, 90000);
    await run.kill();
    assert.ok((await backup.db('custom_backup').collection('events').countDocuments()) > 0);
    await backup.db('custom_backup').dropDatabase();
  });
});
