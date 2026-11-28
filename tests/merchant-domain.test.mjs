import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePriceMinor, initials, signInIdentity, merchantOrderLabel } from '../frontend/merchant-domain.js';
test('preserves metical cents without integer truncation',()=>{
 assert.equal(parsePriceMinor('125,50'),12550);assert.equal(parsePriceMinor('125.5'),12550);assert.equal(parsePriceMinor('0'),0);assert.equal(parsePriceMinor('9000000000.00'),900000000000);
});
test('rejects malformed or unrepresentable prices',()=>{
 for(const value of ['', '-5','1.234','1e6','Infinity','12abc','9000000000.01','99,99,99']) assert.throws(()=>parsePriceMinor(value));
});
test('supports existing account email or Mozambican phone without assigning roles',()=>{
 assert.deepEqual(signInIdentity(' teste@example.test '),{email:'teste@example.test'});
 assert.deepEqual(signInIdentity('84 123 4567'),{phone:'+258841234567'});
 assert.deepEqual(signInIdentity('+258841234567'),{phone:'+258841234567'});
 assert.throws(()=>signInIdentity('123'));
});
test('derives initials from the actual profile name',()=>{
 assert.equal(initials('Amélia Mondlane'),'AM');assert.equal(initials(''),'K');
});

test('a pausa manual prevalece sobre o horário semanal',()=>{
 const opening_hours=[{day:0,closed:false,open:'08:00',close:'17:00'}];
 assert.equal(merchantOrderLabel({is_open:false,opening_hours}),'Pedidos pausados');
 assert.equal(merchantOrderLabel({is_open:true,opening_hours}),'Pedidos seguem o horário');
 assert.equal(merchantOrderLabel({is_open:true,opening_hours:[]}),'A receber pedidos');
});
