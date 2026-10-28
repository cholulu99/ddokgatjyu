/* 똑같쥬? 온라인 대결 — 각자 폰으로 방에 들어와 같은 소리를 따라하고 순위를 매긴다.
방장 브라우저가 게임 상태의 주인이고, Supabase Realtime(broadcast + presence)으로 중계한다. DB 테이블은 쓰지 않는다. */
(function () {
'use strict';
const SUPA_URL = 'https://dqxgnijdskzpxofvtevw.supabase.co';
const SUPA_KEY = 'sb_publishable_5cZzLfNtJLCObsypxmm7wg_Rn2F6QI4';
const A = window.__app, M = A.M, esc = A.esc;
const root = document.getElementById('online-root');
const $ = s => root.querySelector(s);
const store = {
get(k, d) { try { const v = localStorage.getItem('ddg.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
set(k, v) { try { localStorage.setItem('ddg.' + k, JSON.stringify(v)); } catch (e) {} }
};
const uid = () => Math.random().toString(36).slice(2, 10);
const me = { id: (/[?&]net=local/.test(location.search) ? null : store.get('oid', null)) || uid(), name: store.get('oname', '') };
store.set('oid', me.id);
/* ---------- 네트워크 (Supabase, 테스트용 로컬) ---------- */
function loadScript(src) {
return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load')); document.head.appendChild(s); });
}
let sb = null;
async function makeNet(code, h) {
if (/[?&]net=local/.test(location.search)) return localNet(code, h);
if (!sb) {
if (!window.supabase) await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js');
sb = window.supabase.createClient(SUPA_URL, SUPA_KEY, { realtime: { params: { eventsPerSecond: 20 } } });
}
const ch = sb.channel('ddg-room-' + code, { config: { broadcast: { self: false }, presence: { key: me.id } } });
ch.on('broadcast', { event: 'm' }, ({ payload }) => h.onMsg(payload));
ch.on('presence', { event: 'sync' }, () => {
const st = ch.presenceState(), list = [];
for (const k in st) { const p = st[k][0]; if (p) list.push(p); }
h.onPeers(list);
});
await new Promise((res, rej) => {
const t = setTimeout(() => rej(new Error('timeout')), 10000);
ch.subscribe(s => { if (s === 'SUBSCRIBED') { clearTimeout(t); res(); } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') { clearTimeout(t); rej(new Error(s)); } });
});
return {
send: m => ch.send({ type: 'broadcast', event: 'm', payload: m }),
track: info => ch.track(info),
leave: () => { try { sb.removeChannel(ch); } catch (e) {} }
};
}
function localNet(code, h) {
const bc = new BroadcastChannel('ddg-' + code); const peers = {}; let mine = null;
const emit = () => h.onPeers(Object.values(peers));
bc.onmessage = e => {
const d = e.data;
if (d.k === 'm') h.onMsg(d.m);
if (d.k === 'p') { peers[d.p.id] = d.p; emit(); if (d.ask && mine) bc.postMessage({ k: 'p', p: mine }); }
if (d.k === 'bye') { delete peers[d.id]; emit(); }
};
addEventListener('beforeunload', () => bc.postMessage({ k: 'bye', id: me.id }));
return Promise.resolve({
send: m => bc.postMessage({ k: 'm', m }),
track: p => { mine = p; peers[p.id] = p; emit(); bc.postMessage({ k: 'p', p, ask: true }); },
leave: () => { bc.postMessage({ k: 'bye', id: me.id }); bc.close(); }
});
}
/* ---------- 화면 ---------- */
root.innerHTML = `
<style>
.o-code{font:400 clamp(48px,12vw,72px)/1 var(--display);letter-spacing:.12em;color:var(--yellow);font-variant-numeric:tabular-nums}
.o-split{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px}
@media (max-width:760px){.o-split{grid-template-columns:1fr}}
.o-or{color:var(--muted);font-size:13px;margin:4px 0}
.o-plist{display:grid;gap:8px;margin:14px 0}
.o-p{display:flex;justify-content:space-between;align-items:center;gap:10px;background:#0b0d2c;border:1px solid var(--line);border-radius:12px;padding:10px 14px;font-weight:700;min-width:0}
.o-p span{min-width:0;overflow-wrap:anywhere}
.o-badge{font:600 12px var(--body);color:#1b1640;background:var(--yellow);border-radius:999px;padding:2px 8px;flex:none}
.o-badge.me{background:var(--cyan);color:#06302c}
.o-badge.done{background:var(--cyan);color:#06302c}
.o-badge.wait{background:transparent;color:var(--muted);border:1px solid var(--line)}
.o-err{color:var(--red);font-weight:600;min-height:1.4em;margin-top:8px}
.o-wait{color:var(--muted);margin-top:10px}
.o-codein{font:400 28px var(--display)!important;letter-spacing:.2em;text-align:center}
</style>
<div id="o-entry" class="panel">
<div class="o-split">
<div>
<label class="l" for="o-name">내 닉네임</label>
<input type="text" id="o-name" maxlength="12" placeholder="예: 성대장인">
<p class="note" style="margin-top:12px">친구들이 각자 자기 폰으로 같은 방에 들어와요. 라운드마다 소리 하나가 정해지고, 한 명씩 차례대로 따라해요. 라운드마다 순위가 나오고, 누적 점수가 가장 높은 사람이 우승이에요.</p>
</div>
<div style="display:grid;gap:10px;align-content:start">
<button class="btn yellow" id="o-create">방 만들기</button>
<div class="o-or">또는 방 코드로 들어가기</div>
<div class="pin"><input type="text" id="o-codein" class="o-codein" inputmode="numeric" maxlength="4" placeholder="0000" aria-label="방 코드"><button class="btn" id="o-join" style="flex:none">입장</button></div>
<div class="o-err" id="o-err"></div>
</div>
</div>
</div>
<div id="o-lobby" class="panel" hidden>
<div class="o-split">
<div>
<p class="note" style="margin:0 0 6px">방 코드</p>
<div class="o-code" id="o-code"></div>
<div class="row" style="margin-top:12px"><button class="btn" id="o-invite">초대 링크 복사</button><button class="btn ghost" id="o-leave1">나가기</button></div>
<p class="note" id="o-invtxt" style="margin-top:10px;overflow-wrap:anywhere"></p>
</div>
<div>
<label class="l">참가자 <span id="o-count" style="color:var(--muted)"></span></label>
<div class="o-plist" id="o-plist"></div>
<div id="o-hostctl" hidden>
<label class="l">라운드 수</label>
<div class="seg" id="o-rounds"><button aria-pressed="true" data-v="3">3판</button><button aria-pressed="false" data-v="5">5판</button><button aria-pressed="false" data-v="10">10판</button></div>
<div class="row" style="margin-top:14px"><button class="btn yellow" id="o-start">게임 시작</button></div>
</div>
<div class="o-wait" id="o-lwait">방장이 시작하기를 기다리는 중…</div>
</div>
</div>
</div>
<div id="o-game" hidden>
<div class="ghead"><div class="r" id="o-ground"></div><button class="btn ghost" id="o-leave2">나가기</button></div>
<div class="board" id="o-board"></div>
<div id="o-stage"></div>
<div class="row" style="margin-top:12px"><span class="o-wait" id="o-gwait"></span><button class="btn" id="o-reveal" hidden>이 사람 건너뛰기</button></div>
</div>
<div id="o-round" class="panel" hidden>
<h2 class="big" id="o-rtitle"></h2>
<div class="rank" id="o-rrank"></div>
<button class="btn yellow" id="o-next" hidden></button>
<div class="o-wait" id="o-rwait">잠시 후 다음 라운드가 시작돼요…</div>
</div>
<div id="o-final" class="panel" hidden>
<p class="note" style="margin:0 0 6px">최종 순위</p>
<h2 class="big" id="o-ftitle"></h2>
<div class="rank" id="o-frank"></div>
<div class="row"><button class="btn yellow" id="o-again" hidden>같은 방에서 한 판 더</button><button class="btn" id="o-fcopy">결과 복사</button><button class="btn ghost" id="o-leave3">나가기</button></div>
</div>`;
/* ---------- 상태 ---------- */
let lastTurn = null, lastFlash = null, lastListen = null, hostGoneT = null, net = null, code = null, isHost = false, peers = [], S = null, rounds = 3, hostSeen = false, lastStage = null, retried = 0;
const views = ['entry', 'lobby', 'game', 'round', 'final'];
function show(v) { views.forEach(x => { $('#o-' + x).hidden = x !== v; }); }
const err = t => { $('#o-err').textContent = t || ''; };
$('#o-name').value = me.name;
const qs = new URLSearchParams(location.search);
if (qs.get('room')) $('#o-codein').value = qs.get('room').replace(/\D/g, '').slice(0, 4);
function myName() {
const n = $('#o-name').value.trim();
if (!n) { err('닉네임을 먼저 적어주세요'); $('#o-name').focus(); return null; }
me.name = n; store.set('oname', n); return n;
}
function newState() { return { v: 0, host: me.id, phase: 'lobby', rounds, seq: [], round: 0, order: [], turn: 0, flash: null, names: {}, scores: {} }; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function unlock() { try { A.audio(); } catch (e) {} A.getMic().catch(() => {}); }
async function enter(c, host) {
if (!myName()) return;
unlock();
err(''); $('#o-create').disabled = $('#o-join').disabled = true;
try {
code = c; isHost = host; S = host ? newState() : null; hostSeen = host;
if (S) S.names[me.id] = me.name;
net = await makeNet(code, { onMsg, onPeers });
await net.track({ id: me.id, name: me.name, host });
if (!host) {
net.send({ t: 'hello', id: me.id, name: me.name });
setTimeout(() => { if (!hostSeen && net) { leave(); err('그 코드의 방을 찾을 수 없어요. 코드를 다시 확인해 주세요.'); } }, 6000);
} else broadcast();
try { history.replaceState(null, '', location.pathname + '?room=' + code); } catch (e) {}
render();
} catch (e) {
net = null; err('서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.');
} finally { $('#o-create').disabled = $('#o-join').disabled = false; }
}
function leave() {
if (net) net.leave(); net = null; S = null; code = null; isHost = false; peers = [];
try { history.replaceState(null, '', location.pathname); } catch (e) {}
show('entry');
}
function broadcast() { if (!isHost || !net) return; S.v++; net.send({ t: 'state', s: S }); render(); }
function onPeers(list) {
peers = list;
if (list.some(p => p.host)) hostSeen = true;
if (!isHost && S) {
clearTimeout(hostGoneT);
if (!list.some(p => p.id === S.host)) hostGoneT = setTimeout(() => { if (net && S && !peers.some(p => p.id === S.host)) { leave(); err('방장이 방을 나가서 게임이 끝났어요.'); } }, 8000);
}
if (isHost) {
let ch = false;
for (const p of list) if (S.names[p.id] !== p.name) { S.names[p.id] = p.name; ch = true; }
if (ch) broadcast(); else net && net.send({ t: 'state', s: S });
checkTurnGone();
}
render();
}
function onMsg(m) {
if (!m || typeof m !== 'object') return;
if (m.t === 'state' && !isHost) {
if (!S || m.s.v >= S.v || m.s.host !== S.host) { hostSeen = true; S = m.s; render(); }
return;
}
if (m.t === 'prog') { showProg(m); return; }
if (!isHost) return;
if (m.t === 'hello') { S.names[m.id] = String(m.name || '').slice(0, 12); broadcast(); }
if (m.t === 'score' && S.phase === 'play' && m.round === S.round && !S.flash) {
const arr = S.scores[m.id] || (S.scores[m.id] = []);
if (m.id === S.order[S.turn] && arr[m.round] == null) {
arr[m.round] = Math.max(0, Math.min(100, Math.round(+m.score || 0)));
S.names[m.id] = String(m.name || S.names[m.id] || '').slice(0, 12);
S.flash = { id: m.id, score: arr[m.round], turn: S.turn };
broadcast();
const key = S.round + ':' + S.turn;
setTimeout(() => { if (S && S.phase === 'play' && S.round + ':' + S.turn === key && S.flash) { S.flash = null; advance(); } }, 4200);
}
}
}
const online = () => peers.map(p => p.id);
const scoreOf = (id, r) => (S.scores[id] || [])[r];
const curId = () => S && S.phase === 'play' ? S.order[S.turn] : null;
const turnKey = () => S ? S.round + ':' + S.turn : '';
function advance(skipCurrent) {
if (!isHost || S.phase !== 'play') return;
S.flash = null;
if (skipCurrent !== false) S.turn++;
while (S.turn < S.order.length && !online().includes(S.order[S.turn])) S.turn++;
if (S.turn >= S.order.length) { S.phase = 'reveal'; scheduleNext(); }
broadcast();
}
let nextT = null;
function scheduleNext() {
clearTimeout(nextT);
const key = S.round;
nextT = setTimeout(() => { if (isHost && S && S.phase === 'reveal' && S.round === key) goNext(); }, 9000);
}
function goNext() {
clearTimeout(nextT);
if (S.round >= S.rounds - 1) { S.phase = 'final'; broadcast(); }
else { S.round++; startRound(); }
}
function startRound() {
S.order = roundOrder(); S.turn = 0; S.flash = null; S.phase = 'listen';
broadcast();
}
let goneT = null;
function checkTurnGone() {
if (!isHost || !S || S.phase !== 'play') return;
clearTimeout(goneT);
const c = curId();
if (c && !online().includes(c)) goneT = setTimeout(() => { if (S && S.phase === 'play' && curId() === c && !online().includes(c)) advance(); }, 5000);
}
function roundOrder() {
const on = online(), keep = S.order.filter(id => on.includes(id));
const rest = on.filter(id => !keep.includes(id));
if (!keep.length) return [S.host].concat(rest.filter(id => id !== S.host));
return keep.concat(rest);
}
function players() {
const ids = new Set([...online(), ...Object.keys(S.scores), ...(S.order || [])]);
return [...ids].map(id => ({ id, name: S.names[id] || (peers.find(p => p.id === id) || {}).name || '???', on: online().includes(id),
s: S.scores[id] || [], total: (S.scores[id] || []).reduce((a, b) => a + (b || 0), 0) }));
}
function rankRows(list, valFn, subFn) {
let prev = null, rank = 0;
return list.map((p, i) => { const v = valFn(p); if (v !== prev) { rank = i + 1; prev = v; }
return `<div class="rk"><span class="p">${rank}</span><span class="nmv">${esc(p.name)}${p.id === me.id ? ' (나)' : ''}<small>${subFn(p)}</small></span><span class="sc">${v == null ? '-' : v + '점'}</span></div>`; }).join('');
}
/* ---------- 게임 스테이지 ---------- */
const stage = A.makeStage($('#o-stage'), {
emptyText: '<strong>준비 중</strong>곧 다 같이 원본을 들어요.',
onProgress(k, n) { if (net && S && curId() === me.id) net.send({ t: 'prog', id: me.id, k, n, key: turnKey() }); },
onSilent() {
if (net && S && curId() === me.id) net.send({ t: 'prog', id: me.id, k: 'silent', key: turnKey() });
const tk = turnKey();
if (retried < 2) { retried++; stage.setStatus('소리가 안 잡혔어요. 잠시 후 다시 시작해요', true); setTimeout(() => autoTake(tk), 2500); }
},
onResult(res) {
stage.setRecDisabled(true);
const msg = { t: 'score', id: me.id, name: me.name, round: S.round, score: res.score };
myDone[S.round] = res.score;
if (isHost) onMsg(msg); else net && net.send(msg);
render();
}
});
const myDone = {};
function autoTake(tk) {
if (!S || S.phase !== 'play' || turnKey() !== tk || curId() !== me.id || stage.st.busy || myDone[S.round] != null || scoreOf(me.id, S.round) != null) return;
stage.take();
}
function showProg(m) {
if (!S || S.phase !== 'play' || m.id !== curId() || m.id === me.id || m.key !== turnKey()) return;
const nm = S.names[m.id] || '???', cnt = stage.q('.count');
if (m.k === 'count') {
cnt.hidden = false;
if (m.n === '시작!') { cnt.innerHTML = '<span style="font-size:.5em">시작!</span>'; setTimeout(() => { cnt.hidden = true; }, 600); }
else cnt.textContent = m.n;
stage.setStatus(nm + '님 차례! ' + (m.n === '시작!' ? '' : m.n + '…'));
} else if (m.k === 'rec') { cnt.hidden = true; stage.setStatus(nm + '님이 따라하는 중… 들어보세요!', true); }
else if (m.k === 'analyze') stage.setStatus(nm + '님 채점 중…');
else if (m.k === 'silent') { cnt.hidden = true; stage.setStatus(nm + '님 소리가 안 잡혀서 다시 해요'); }
}
async function listenTogether(round) {
const snd = M.SOUNDS.find(s => s.id === S.seq[round]);
stage.setStatus('다 같이 원본을 들어보세요');
let ok = true;
try { await A.audio(); await A.playRef(snd); } catch (e) { ok = false; }
if (S && S.phase === 'listen' && S.round === round) stage.setStatus(ok ? '곧 차례대로 시작해요' : '원본 재생이 안 됐어요. 원본 듣기를 눌러 들어보세요');
if (isHost) {
await A.sleep(ok ? 1200 : 3000);
if (S && S.phase === 'listen' && S.round === round) { S.phase = 'play'; S.turn = 0; advance(false); }
}
}
/* ---------- 렌더 ---------- */
function render() {
if (!net || !S) { if (!net) show('entry'); return; }
const ps = players();
if (S.phase === 'lobby') {
show('lobby');
$('#o-code').textContent = code;
const link = location.origin + location.pathname + '?room=' + code;
$('#o-invtxt').textContent = link;
const on = peers.length ? peers : [{ id: me.id, name: me.name, host: isHost }];
$('#o-count').textContent = on.length + '명';
$('#o-plist').innerHTML = on.map(p => `<div class="o-p"><span>${esc(p.name)}</span>${p.id === S.host ? '<span class="o-badge">방장</span>' : p.id === me.id ? '<span class="o-badge me">나</span>' : ''}</div>`).join('');
$('#o-hostctl').hidden = !isHost; $('#o-lwait').hidden = isHost;
$('#o-start').disabled = on.length < 2;
$('#o-start').textContent = on.length < 2 ? '친구가 들어오면 시작할 수 있어요' : `${on.length}명으로 게임 시작`;
Object.keys(myDone).forEach(k => delete myDone[k]);
lastStage = lastTurn = lastFlash = lastListen = null;
return;
}
if (S.phase === 'listen' || S.phase === 'play') {
show('game');
const snd = M.SOUNDS.find(s => s.id === S.seq[S.round]);
$('#o-ground').innerHTML = `라운드 ${S.round + 1} <em>/ ${S.rounds}</em>`;
const key = S.round + ':' + snd.id;
if (lastStage !== key) { lastStage = key; lastTurn = lastFlash = null; stage.setSound(snd); }
const ordNames = S.order.map((id, i) => `${i + 1}. ${esc(S.names[id] || '???')}${id === me.id ? '(나)' : ''}`).join(' → ');
if (S.phase === 'listen') {
stage.setRecDisabled(true);
const t = stage.q('.turn'); t.hidden = false; t.textContent = '다 같이 듣기';
if (lastListen !== S.round) {
lastListen = S.round;
stage.showEmpty(`<strong>이번 소리: ${esc(snd.word)}</strong>잘 들어두세요! 이 순서대로 따라해요.<br>${ordNames}`);
listenTogether(S.round);
}
} else {
const cur = curId(), curName = S.names[cur] || '???', mine = cur === me.id;
const iDid = myDone[S.round] != null || scoreOf(me.id, S.round) != null;
const tk = turnKey();
if (lastTurn !== tk && stage.st.busy) setTimeout(render, 250);
if (lastTurn !== tk && !stage.st.busy) {
lastTurn = tk; retried = 0;
stage.q('.count').hidden = true;
const t = stage.q('.turn'); t.hidden = false; t.textContent = mine ? '내 차례!' : curName + ' 차례';
if (mine) {
stage.setStatus('내 차례예요! 곧 3, 2, 1 후 녹음이 시작돼요');
try { navigator.vibrate && navigator.vibrate(200); } catch (e) {}
if (!iDid) { stage.showEmpty('<strong>내 차례!</strong>곧 3, 2, 1 후 녹음이 시작돼요.<br>"시작!"이 뜨면 따라하세요.'); setTimeout(() => autoTake(tk), 1600); }
} else {
stage.setStatus(curName + '님 차례! 곧 시작해요');
if (!iDid) stage.showEmpty(`<strong>${esc(curName)}님 차례</strong>잘 들어보세요! 순서: ${ordNames}`);
}
}
if (S.flash) {
const fk = tk + ':' + S.flash.id;
if (lastFlash !== fk) {
lastFlash = fk;
const fn = S.names[S.flash.id] || '???';
if (S.flash.id !== me.id) {
const [g] = A.grade(S.flash.score);
stage.q('.count').hidden = true;
stage.setStatus(`${fn}님 ${S.flash.score}점!`);
if (!iDid) stage.showEmpty(`<strong style="font-size:56px;color:var(--yellow)">${S.flash.score}점</strong><strong>${esc(fn)}님 · ${esc(g)}</strong>곧 다음 사람 차례예요.`);
}
}
}
stage.setRecDisabled(!mine || iDid || !!S.flash);
const ord = S.order.map(id => ps.find(p => p.id === id) || { id, name: S.names[id] || '???', total: 0, s: [], on: false });
$('#o-board').innerHTML = ord.map((p, i) => { const sc = scoreOf(p.id, S.round);
return `<span class="chip ${p.id === cur ? 'now' : ''}">${i + 1}. ${esc(p.name)}${p.id === me.id ? '(나)' : ''} <b>${p.total}</b> ${sc != null ? `<span class="o-badge done">${sc}점</span>` : p.id === cur ? '<span class="o-badge">지금 차례</span>' : !p.on ? '<span class="o-badge wait">나감</span>' : '<span class="o-badge wait">대기</span>'}</span>`; }).join('');
const done = S.order.filter(id => scoreOf(id, S.round) != null).length;
$('#o-gwait').textContent = `${done} / ${S.order.length}명 완료 · 지금 ${curName}${mine ? '(나)' : ''} 차례`;
$('#o-reveal').hidden = !isHost || mine || !!S.flash;
return;
}
$('#o-board').innerHTML = S.order.map((id, i) => `<span class="chip">${i + 1}. ${esc(S.names[id] || '???')}${id === me.id ? '(나)' : ''}</span>`).join('');
$('#o-gwait').textContent = '다 같이 원본 듣는 중…';
$('#o-reveal').hidden = true;
return;
}
if (S.phase === 'reveal') {
show('round');
const snd = M.SOUNDS.find(s => s.id === S.seq[S.round]);
const list = ps.filter(p => p.s[S.round] != null).sort((a, b) => b.s[S.round] - a.s[S.round] || a.name.localeCompare(b.name));
const rtop = list.filter(p => list.length && p.s[S.round] === list[0].s[S.round]);
$('#o-rtitle').innerHTML = !list.length ? `라운드 ${S.round + 1} 결과` : rtop.length > 1 ? `라운드 ${S.round + 1} 공동 1등: <b>${rtop.map(p => esc(p.name)).join(', ')}</b>` : `라운드 ${S.round + 1} "${esc(snd.word)}" 1등은 <b>${esc(list[0].name)}</b>`;
$('#o-rrank').innerHTML = rankRows(list, p => p.s[S.round], p => `${esc(A.grade(p.s[S.round])[0])} · 누적 ${p.total}점`);
const last = S.round >= S.rounds - 1;
$('#o-next').hidden = !isHost;
$('#o-next').textContent = last ? '바로 최종 순위 보기' : `바로 라운드 ${S.round + 2} 시작`;
$('#o-rwait').textContent = last ? '잠시 후 최종 순위가 나와요…' : '잠시 후 다음 라운드가 시작돼요…';
return;
}
if (S.phase === 'final') {
show('final');
const list = ps.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
const top = list.filter(p => p.total === list[0].total);
$('#o-ftitle').innerHTML = top.length > 1 ? `공동 1등: <b>${top.map(p => esc(p.name)).join(', ')}</b>` : `1등은 <b>${esc(list[0].name)}</b>!`;
$('#o-frank').innerHTML = rankRows(list, p => p.total, p => `평균 ${Math.round(p.total / S.rounds)}점 · ${p.s.map(v => v == null ? '-' : v).join(' / ')}`);
$('#o-again').hidden = !isHost;
}
}
/* ---------- 버튼 ---------- */
$('#o-create').onclick = () => enter(String(Math.floor(1000 + Math.random() * 9000)), true);
$('#o-join').onclick = () => { const c = $('#o-codein').value.replace(/\D/g, ''); if (c.length !== 4) { err('4자리 방 코드를 넣어주세요'); return; } enter(c, false); };
$('#o-codein').onkeydown = e => { if (e.key === 'Enter') $('#o-join').click(); };
$('#o-rounds').onclick = e => { const b = e.target.closest('button'); if (!b) return; rounds = +b.dataset.v; [...$('#o-rounds').children].forEach(x => x.setAttribute('aria-pressed', x === b)); };
$('#o-start').onclick = () => { if (!isHost) return; unlock(); S.rounds = rounds; S.seq = shuffle(M.SOUNDS.map(s => s.id)).slice(0, rounds); S.round = 0; S.scores = {}; S.order = []; startRound(); };
$('#o-reveal').onclick = () => { if (isHost && S.phase === 'play') advance(); };
$('#o-next').onclick = () => { if (isHost && S.phase === 'reveal') goNext(); };
$('#o-again').onclick = () => { if (!isHost) return; S.phase = 'lobby'; S.scores = {}; S.round = 0; S.order = []; broadcast(); };
$('#o-invite').onclick = () => A.copy(`[똑같쥬?] 성대모사 대결 방에 들어와! 방 코드 ${code}\n${location.origin + location.pathname}?room=${code}`);
$('#o-fcopy').onclick = () => { const list = players().sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)); A.copy(`[똑같쥬?] 온라인 성대모사 대결 (${S.rounds}판)\n` + list.map((p, i) => `${i + 1}위 ${p.name} ${p.total}점`).join('\n') + `\n${location.origin + location.pathname}`); };
['#o-leave1', '#o-leave2', '#o-leave3'].forEach(id => $(id).onclick = () => { if (stage.st.busy) return; leave(); });
addEventListener('beforeunload', () => { if (net) net.leave(); });
show('entry');
window.__online = { get cur() { return curId(); }, get S() { return S; }, get peers() { return peers; }, get isHost() { return isHost; } };
})();
