import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchPerson,phoneKey} from '../scripts/reconcile-training-director.mjs';
const users=[{id:'one',first_name:'Test',last_name:'Person',email:'test@example.com',personal_email:'shared@example.com',phone:'+27821234567'},{id:'two',first_name:'Other',last_name:'Person',email:'other@example.com',personal_email:'shared@example.com'}];
test('deterministic contact matching never chooses an ambiguous personal email',()=>{
  assert.equal(matchPerson({name:'Test Person',company_email:'TEST@EXAMPLE.COM'},users).user.id,'one');
  assert.equal(matchPerson({name:'Test Person',personal_email:'shared@example.com'},users).status,'CONFLICT');
  assert.equal(matchPerson({name:'Test Person',phone:'082 123 4567'},users).user.id,'one');
  assert.equal(matchPerson({name:'Tst Person'},users).status,'UNMATCHED');
  assert.match(matchPerson({name:'Wrong Person',company_email:'test@example.com'},users).status,/PROBABLE/);
  assert.equal(matchPerson({user_id:'two',company_email:'test@example.com'},users).user.id,'two');
  assert.equal(phoneKey('27821234567'),'+27821234567');
});
