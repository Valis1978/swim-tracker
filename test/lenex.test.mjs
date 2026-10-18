import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { parseLenex, readLenex, lenexOutputs, lxTime } from '../src/lib/lenex.ts';

// Synthetic meet only — the repository is public.
const XML = `<?xml version="1.0" encoding="utf-8"?>
<LENEX version="3.0"><MEETS><MEET city="Testov" course="SCM" name="TEST">
<CLUBS>
 <CLUB code="TST" name="Testovací klub"><ATHLETES>
  <ATHLETE athleteid="1" birthdate="2016-01-01" firstname="Anna" gender="F" lastname="NOVÁKOVÁ" license="111"><RESULTS>
   <RESULT eventid="7" heatid="45" lane="2" points="132" resultid="1" swimtime="00:00:55.59"><SPLITS /></RESULT>
   <RESULT eventid="3" heatid="16" lane="7" points="86" resultid="2" swimtime="00:02:02.16"><SPLITS><SPLIT distance="50" swimtime="00:00:58.94" /></SPLITS></RESULT>
  </RESULTS></ATHLETE>
  <ATHLETE athleteid="2" birthdate="2015-03-02" firstname="Eva" gender="F" lastname="Svobodová" license="222"><RESULTS>
   <RESULT eventid="7" heatid="45" lane="3" resultid="3" swimtime="00:00:51.10" />
   <RESULT eventid="3" heatid="16" lane="6" resultid="4" status="DSQ" swimtime="00:02:10.00" />
  </RESULTS></ATHLETE>
 </ATHLETES>
 <RELAYS><RELAY number="1"><RESULTS><RESULT eventid="7" resultid="9" swimtime="00:01:00.00" /></RESULTS></RELAY></RELAYS></CLUB>
</CLUBS>
<SESSIONS><SESSION date="2026-10-17" number="1"><EVENTS>
 <EVENT eventid="3" number="4"><SWIMSTYLE distance="100" relaycount="1" stroke="BACK" /><HEATS><HEAT heatid="16" number="2" /></HEATS></EVENT>
 <EVENT eventid="7" number="8"><SWIMSTYLE distance="50" relaycount="1" stroke="BREAST" /><HEATS><HEAT heatid="45" number="3" /></HEATS></EVENT>
</EVENTS></SESSION></SESSIONS></MEET></MEETS></LENEX>`;

function zip(name, text) {
  const data = Buffer.from(text, 'utf8');
  const comp = deflateRawSync(data);
  const n = Buffer.from(name);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(n.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(comp.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(n.length, 28); central.writeUInt32LE(0, 42);
  const cdOffset = local.length + n.length + comp.length;
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(central.length + n.length, 12); end.writeUInt32LE(cdOffset, 16);
  return new Uint8Array(Buffer.concat([local, n, comp, central, n, end]));
}

test('LENEX times', () => {
  assert.equal(lxTime('00:02:02.16'), 122160);
  assert.equal(lxTime('00:00:55.59'), 55590);
  assert.equal(lxTime('NT'), null);
  assert.equal(lxTime(undefined), null);
});

test('LENEX results: events, heats, splits, DSQ, relays skipped, zipped file', () => {
  const lx = readLenex(zip('10813_results.lef', XML));
  assert.deepEqual([lx.pool, lx.city, lx.results.length], [25, 'Testov', 4]);
  const anna = lx.results.filter((r) => r.license === 111);
  assert.deepEqual(anna.map((r) => [r.eventNo, `${r.distance} ${r.stroke}`, r.ms, r.heat, r.lane, r.points, r.date]), [
    [8, '50 P', 55590, 3, 2, 132, '2026-10-17'],
    [4, '100 Z', 122160, 2, 7, 86, '2026-10-17'],
  ]);
  assert.deepEqual(anna[1].splits, [{ distance: 50, ms: 58940 }]);
  assert.equal(anna[0].name, 'Anna Nováková');
  const dsq = lx.results.find((r) => r.license === 222 && r.eventNo === 4);
  assert.deepEqual([dsq.status, dsq.ms], ['DSQ', null]);
  assert.deepEqual(parseLenex(XML).results.length, 4);
});

test('LENEX outputs rank by time like CSPS category results', () => {
  const lx = parseLenex(XML);
  const ev8 = lenexOutputs(lx, 8, 6039990);
  assert.deepEqual(ev8.map((o) => [o.userId, o.order, o.time, o.heat, o.lane, o.birthYear, o.club]), [[111, 2, 55590, 3, 2, 2016, 'TST'], [222, 1, 51100, 3, 3, 2015, 'TST']]);
  const ev4 = lenexOutputs(lx, 4, 6039990);
  assert.deepEqual(ev4.map((o) => [o.userId, o.order, o.time]), [[111, 1, 122160], [222, 0, 6039990]]);
});
