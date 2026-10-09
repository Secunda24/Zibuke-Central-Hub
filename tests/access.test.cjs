
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');
function setup(){
 const sql=new DatabaseSync(':memory:');
 sql.exec("CREATE TABLE channels(id TEXT,visibility TEXT,created_by TEXT,archived_at TEXT);CREATE TABLE channel_members(channel_id TEXT,user_id TEXT);CREATE TABLE channel_messages(id TEXT,channel_id TEXT,deleted_at TEXT);CREATE TABLE messages(id TEXT,sender_id TEXT,receiver_id TEXT,deleted_at TEXT);INSERT INTO channels VALUES('private','private','owner',NULL),('public','company','owner',NULL);INSERT INTO channel_members VALUES('private','member');INSERT INTO channel_messages VALUES('cm','private',NULL);INSERT INTO messages VALUES('dm','owner','member',NULL);");
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/modules/backend/access.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,Headers,encodeURIComponent});
 const db={prepare:query=>({bind:(...args)=>({first:async()=>sql.prepare(query).get(...args)})})};
 return {sql,db,...exports};
}
test('private channels and attachments require membership and deleted messages remain inaccessible',async()=>{
 const c=setup();
 assert.ok(await c.accessibleChannel(c.db,'private','owner'));
 assert.ok(await c.accessibleChannel(c.db,'private','member'));
 assert.equal(await c.accessibleChannel(c.db,'private','stranger'),undefined);
 assert.ok(await c.accessibleChannel(c.db,'public','stranger'));
 for(const [kind,id] of [['direct','dm'],['channel','cm']]){
  assert.ok(await c.accessibleMessage(c.db,kind,id,'member'));
  assert.equal(await c.accessibleMessage(c.db,kind,id,'stranger'),undefined);
 }
 c.sql.exec("UPDATE messages SET deleted_at=CURRENT_TIMESTAMP;UPDATE channel_messages SET deleted_at=CURRENT_TIMESTAMP;");
 assert.equal(await c.accessibleMessage(c.db,'direct','dm','owner'),undefined);
 assert.equal(await c.accessibleMessage(c.db,'channel','cm','member'),undefined);
 c.sql.exec("UPDATE channels SET archived_at=CURRENT_TIMESTAMP");
 assert.equal(await c.accessibleChannel(c.db,'private','owner'),undefined);
});
test('active content downloads cannot execute inline',()=>{
 const c=setup();
 for(const mime of ['text/html','image/svg+xml','application/javascript']){
  const h=c.downloadHeaders('test.html',mime);
  assert.match(h.get('Content-Disposition'),/^attachment;/);
  assert.equal(h.get('X-Content-Type-Options'),'nosniff');
  assert.match(h.get('Content-Security-Policy'),/sandbox/);
 }
 assert.match(c.downloadHeaders('photo.jpg','image/jpeg').get('Content-Disposition'),/^inline;/);
});
