import assert from 'node:assert/strict';
import {examCountdown,toLocalInput,fromLocalInput} from '../lib/dates';
let passed=0;
for(const zone of ['UTC','Asia/Kolkata','America/New_York']){
 process.env.TZ=zone;
 const now=new Date('2028-02-28T23:30:00');
 assert.equal(examCountdown(new Date('2028-02-29T00:30:00').toISOString(),now),'Tomorrow');passed++;
 assert.equal(examCountdown(new Date('2028-02-28T23:45:00').toISOString(),now),'Today');passed++;
 assert.equal(examCountdown(new Date('2028-02-28T23:00:00').toISOString(),now),'Exam has passed');passed++;
 assert.equal(toLocalInput(new Date('2028-02-29T00:30:00').toISOString()),'2028-02-29T00:30');passed++;
}
process.env.TZ='America/New_York';
assert.equal(examCountdown('2027-03-15T12:00:00',new Date('2027-03-13T12:00:00')),'2 days remaining');passed++;
assert.equal(examCountdown('2027-11-08T12:00:00',new Date('2027-11-06T12:00:00')),'2 days remaining');passed++;
assert.equal(examCountdown('invalid'),'Date unavailable');passed++;
// Reproduction: the editor's Date constructor silently changes a nonexistent local time.
assert.throws(()=>{const value='2027-03-14T02:30';fromLocalInput(value);},/local time/);passed++;
console.log(`Dates: ${passed} passed, 0 failed`);
