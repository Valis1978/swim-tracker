import test from 'node:test';
import assert from 'node:assert/strict';
import { normDisc, parseSeed, parseAcceptedList, parseOmegaCsv, parseStartListPdf, personKey, rows } from '../src/lib/entry_docs.ts';
import { resolveStatus, changeText, raceSteps, changed, snapshot } from '../src/lib/entries.ts';

// Synthetic swimmers only — the repository is public.
const ANNA = personKey('NOVÁKOVÁ Anna', 2016);
const it = (s, x, y) => ({ s, x, y, w: s.length * 5 });

test('discipline codes and seed times normalise across sources', () => {
  assert.equal(normDisc('100 VZ'), '100K');
  assert.equal(normDisc('100 PZ'), '100O');
  assert.equal(normDisc('200K'), '200K');
  assert.equal(normDisc('50 P'), '50P');
  assert.equal(parseSeed('02:07,70'), 127700);
  assert.equal(parseSeed('00:57,90'), 57900);
  assert.equal(parseSeed('57,9'), 57900);
  assert.equal(parseSeed('-'), null);
});

test('rows tolerate baseline jitter and sort items left to right', () => {
  const r = rows([it('B', 100, 500.4), it('A', 20, 501.6), it('C', 20, 480)]);
  assert.deepEqual(r.map((x) => x.map((i) => i.s).join('')), ['AB', 'C']);
});

test('accepted list: heat/lane, reserve order, accepted, not accepted, block continuation', () => {
  const page = {
    width: 595,
    height: 842,
    items: [
      it('Přihlášky - TEST (Testovací klub)', 150, 800),
      it('NOVÁKOVÁ Anna', 22, 760), it('2016', 222, 760), it('1) 200 Z', 276, 760), it('04:07,00', 383, 760), it('2/5', 490, 760),
      it('3) 100 P', 276, 747), it('02:04,09', 383, 747), it('N1', 490, 747),
      it('7) 100 VZ', 276, 734), it('-', 383, 734), it('A', 490, 734),
      it('9) 100 PZ', 276, 721), it('02:10,00', 383, 721), it('X', 490, 721),
    ],
  };
  const next = { width: 595, height: 842, items: [it('Přihlášky - TEST (Testovací klub)', 150, 800), it('11) 50 M', 276, 760), it('00:50,00', 383, 760), it('N12', 490, 760)] };
  const list = parseAcceptedList([page, next]).get(ANNA);
  assert.deepEqual(list.map((e) => [e.eventNo, e.disc, e.status.kind]), [
    [1, '200Z', 'drawn'], [3, '100P', 'reserve'], [7, '100K', 'accepted'], [9, '100O', 'not_accepted'], [11, '50M', 'reserve'],
  ]);
  assert.deepEqual(list[0].status, { kind: 'drawn', heat: 2, lane: 5, heatCount: null });
  assert.equal(list[1].status.no, 1);
  assert.equal(list[4].status.no, 12);
  assert.equal(list[2].seedMs, null);
});

test('OMEGA CSV: heat 0 is a reserve, rows keyed by name + year', () => {
  const csv = ['999', 'Test meet', '01.01.2026',
    '3;"100P";5;"NOVÁKOVÁ";"Anna";"2016";"Z";"TEST";02:04,09;0;8;2;01.01.2026;"";""',
    '5;"200K";1;"NOVÁKOVÁ";"Anna";"2016";"Z";"TEST";03:12,00;0;0;0;01.01.2026;"";""'].join('\n');
  const r = parseOmegaCsv(csv);
  assert.equal(r.length, 2);
  assert.deepEqual([r[0].key, r[0].eventNo, r[0].disc, r[0].heat, r[0].lane], [ANNA, 3, '100P', 8, 2]);
  assert.equal(r[1].heat, 0);
});

test('start list PDF: two-column heats and reserves resolve to the right event', () => {
  const page = {
    width: 595,
    height: 842,
    items: [
      it('1) 200 Znak žačky', 240, 780),
      it('1. rozplavba z 6', 120, 760), it('2. rozplavba z 6', 400, 760),
      it('Dr', 24, 745), it('Jméno', 43, 745), it('Dr', 301, 745), it('Jméno', 320, 745),
      it('5', 301, 700), it('NOVÁKOVÁ Anna', 320, 700), it('2016', 461, 700), it('TEST', 495, 700),
      it('3) 100 Prsa žačky', 240, 600),
      it('Náhradníci', 120, 560), it('Náhradníci', 400, 560),
      it('1', 24, 540), it('NOVÁKOVÁ Anna', 43, 540), it('2016', 183, 540),
    ],
  };
  const m = parseStartListPdf([page], new Set([ANNA])).get(ANNA);
  assert.deepEqual(m.get(1), { kind: 'drawn', heat: 2, lane: 5, heatCount: 6 });
  assert.deepEqual(m.get(3), { kind: 'reserve', no: 1 });
});

const base = { inApplications: true, overLimit: false, raceStarted: false, raceOver: false, omega: { kind: 'unknown' }, accepted: { kind: 'unknown' }, startPdf: { kind: 'unknown' }, result: null };

test('status precedence: result > OMEGA > newer PDF > CSPS flags', () => {
  assert.equal(resolveStatus({ ...base, overLimit: true }).snap.status, 'reserve');
  const newerStart = resolveStatus({ ...base, accepted: { kind: 'drawn', heat: 4, lane: 5, heatCount: null, date: '2026-10-01T11:00' }, startPdf: { kind: 'drawn', heat: 6, lane: 7, heatCount: 8, date: '2026-09-28T12:00' } });
  assert.deepEqual([newerStart.snap.heat, newerStart.snap.lane, newerStart.source], [4, 5, 'accepted_pdf']);
  const omega = resolveStatus({ ...base, omega: { kind: 'reserve', no: null }, accepted: { kind: 'reserve', no: 3, date: null } });
  assert.deepEqual([omega.snap.status, omega.snap.reserve_no, omega.source], ['reserve', 3, 'startlist_csv']);
  const swum = resolveStatus({ ...base, omega: { kind: 'drawn', heat: 8, lane: 2, heatCount: 12 }, result: { ms: 127850, dsq: false } });
  assert.deepEqual([swum.snap.status, swum.snap.heat, swum.snap.result_ms], ['swum', 8, 127850]);
  assert.equal(resolveStatus({ ...base, omega: { kind: 'absent' } }).snap.status, 'not_accepted');
  assert.equal(resolveStatus({ ...base, accepted: { kind: 'absent', date: null } }).snap.status, 'withdrawn');
});

test('withdrawals only before the race; reserves without a result become "not this time" after it', () => {
  assert.equal(resolveStatus({ ...base, inApplications: false }).snap.status, 'withdrawn');
  assert.equal(resolveStatus({ ...base, inApplications: false, raceStarted: true, accepted: { kind: 'accepted', date: null } }).snap.status, 'accepted');
  const after = resolveStatus({ ...base, raceStarted: true, raceOver: true, accepted: { kind: 'reserve', no: 14, date: null } });
  assert.deepEqual([after.snap.status, after.snap.reserve_no], ['not_accepted', 14]);
});

test('kid-facing change texts', () => {
  const fmt = (ms) => `${ms / 1000}`;
  const from = snapshot({ status: 'reserve', reserve_no: 1 });
  assert.match(changeText('100 prsa', from, snapshot({ status: 'drawn', heat: 8, lane: 2 }), fmt), /postoupila jsi z náhradnic.*8.*2/);
  assert.match(changeText('100 kraul', snapshot({ status: 'reserve', reserve_no: 8 }), snapshot({ status: 'reserve', reserve_no: 3 }), fmt), /3\. náhradnici/);
  assert.equal(changeText('50 prsa', null, snapshot({ status: 'entered' }), fmt), null);
  assert.equal(changed(snapshot({ status: 'drawn', heat: 1, lane: 4 }), snapshot({ status: 'drawn', heat: 1, lane: 4, heat_count: 6 })), false);
});

test('race steps follow deadlines, documents and results', () => {
  const steps = raceSteps({ nowLocal: '2026-10-16T18:00', registrationEnd: '2026-10-10T23:59:00', deregistrationEnd: '2026-10-15T09:00:00', startDate: '2026-10-17', endDate: '2026-10-17', drawn: false, hasAccepted: true, hasResults: false });
  assert.deepEqual(steps.map((s) => s.state), ['done', 'done', 'now', 'todo', 'todo']);
  const raceDay = raceSteps({ nowLocal: '2026-10-17T10:00', registrationEnd: null, deregistrationEnd: null, startDate: '2026-10-17', endDate: null, drawn: true, hasAccepted: true, hasResults: false });
  assert.deepEqual(raceDay.map((s) => s.state), ['done', 'done', 'done', 'now', 'now']);
});
