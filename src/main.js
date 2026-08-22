import * as XLSX from 'xlsx';
import './style.css';
import catalog from './data/items.json';

const STORAGE_KEY = 'loot-ledger-v1';
const PEOPLE_KEY = 'loot-ledger-people-v1';
const currency = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 });

const sample = () => ({
  id: crypto.randomUUID(), itemId: '5100303', name: '布里萊赫核心', time: '', person: '', price: 150000000, split: 0, paid: false,
});
let state = load();
let view = 'ledger';

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return data?.items?.length ? data : { items: [sample()] };
  } catch { return { items: [sample()] }; }
}
function people() {
  try {
    const saved = localStorage.getItem(PEOPLE_KEY);
    if (saved) return JSON.parse(saved);
    const cookie = document.cookie.split('; ').find(x => x.startsWith(`${PEOPLE_KEY}=`));
    return cookie ? JSON.parse(decodeURIComponent(cookie.split('=').slice(1).join('='))) : [];
  } catch { return []; }
}
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const names = [...new Set(state.items.map(x => x.person.trim()).filter(Boolean))];
  const savedPeople = [...new Set([...people(), ...names])].slice(-30);
  localStorage.setItem(PEOPLE_KEY, JSON.stringify(savedPeople));
  document.cookie = `${PEOPLE_KEY}=${encodeURIComponent(JSON.stringify(savedPeople))}; max-age=31536000; path=/; SameSite=Lax`;
}
function itemInfo(itemId) { return catalog.find(x => String(x.id) === String(itemId)); }
function image(item) { return item.itemId ? `${import.meta.env.BASE_URL}${item.itemId}.png` : ''; }
function number(value) { return Number(value) || 0; }
function fmt(value) { return currency.format(Math.round(number(value))); }
function esc(value = '') { return String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' })[c]); }

function render() {
  const app = document.querySelector('#app');
  const total = state.items.reduce((sum, x) => sum + number(x.price), 0);
  const paid = state.items.filter(x => x.paid).length;
  app.innerHTML = `
    <main class="shell">
      <header class="topbar">
        <a class="brand" href="#" aria-label="Loot Ledger 首頁"><span>✦</span><strong>LOOT LEDGER</strong><em>分贓帳本</em></a>
        <nav>
          <button class="nav ${view === 'ledger' ? 'active' : ''}" data-view="ledger">分贓清單</button>
          <button class="nav ${view === 'summary' ? 'active' : ''}" data-view="summary">結算總覽</button>
        </nav>
        <div class="actions"><button class="ghost" id="importBtn">匯入 Excel</button><button class="primary" id="exportBtn">匯出 Excel</button><input id="fileInput" type="file" accept=".xlsx,.xls" hidden></div>
      </header>
      ${view === 'ledger' ? ledger(total, paid) : summary(total)}
    </main>`;
  bind();
}

function ledger(total, paid) {
  return `<section class="hero"><div><p class="eyebrow">MABINOGI RAID LOOT</p><h1>０．０</h1><p class="sub">輸入掉落、價格與得標者；每一筆的分攤金額會立即算好。</p></div><div class="metric"><span>本次戰利品</span><b>${fmt(total)} <small>Gold</small></b><i>${state.items.length} 項 · ${paid} 項已分</i></div></section>
  <section class="panel">
    <div class="panel-head"><div><h2>分贓明細</h2><p>人名會保存在此瀏覽器，下一次可直接選取。</p></div><button class="add" id="addRow">＋ 新增物品</button></div>
    <div class="table-wrap"><table><thead><tr><th>物品</th><th>時間</th><th>得標者</th><th>價格</th><th>每人平分</th><th>已分</th><th></th></tr></thead><tbody>
    ${state.items.map((item, index) => row(item, index)).join('')}
    </tbody></table></div>
  </section>`;
}

function row(item, index) {
  const selected = itemInfo(item.itemId);
  const name = item.name || selected?.name || '';
  const options = catalog.map(x => `<option value="${x.id}" ${String(x.id) === String(item.itemId) ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
  const personOptions = people().map(x => `<option value="${esc(x)}"></option>`).join('');
  return `<tr data-index="${index}">
    <td><div class="item-cell"><div class="icon">${item.itemId ? `<img src="${image(item)}" alt="" onerror="this.style.display='none'">` : '✦'}</div><div><input class="name-input" data-field="name" value="${esc(name)}" placeholder="輸入物品名稱"><select class="item-select" data-field="itemId"><option value="">自訂物品</option>${options}</select></div></div></td>
    <td><input class="time" data-field="time" type="datetime-local" value="${esc(item.time)}"></td>
    <td><input class="person" data-field="person" list="person-options-${index}" value="${esc(item.person)}" placeholder="輸入名字"><datalist id="person-options-${index}">${personOptions}</datalist></td>
    <td><label class="money"><span>G</span><input data-field="price" type="number" min="0" value="${number(item.price)}"></label></td>
    <td><output>${fmt(item.split)} G</output></td>
    <td><label class="toggle"><input data-field="paid" type="checkbox" ${item.paid ? 'checked' : ''}><span></span><b>${item.paid ? '已分' : '未分'}</b></label></td>
    <td><button class="delete" data-delete="${index}" aria-label="刪除這筆">×</button></td>
  </tr>`;
}

function summary(total) {
  const rows = state.items.filter(x => x.person.trim());
  const members = [...new Set(rows.map(x => x.person.trim()))];
  const eachTotal = members.length ? Math.round(total / members.length) : 0;
  return `<section class="hero compact"><div><p class="eyebrow">SETTLEMENT OVERVIEW</p><h1>本次分帳總覽</h1><p class="sub">每件物品的平分金額與每位玩家應付總額。</p></div><div class="metric"><span>全場價值</span><b>${fmt(total)} <small>Gold</small></b><i>${perPerson.size} 位得標者</i></div></section>
  <section class="summary-grid"><article class="panel"><div class="panel-head"><div><h2>每件物品應分</h2><p>價格依本次出席人數平分。</p></div></div><div class="summary-list">${state.items.map(x => `<div class="summary-row"><div class="mini-icon">${x.itemId ? `<img src="${image(x)}" alt="">` : '✦'}</div><div><b>${esc(x.name || itemInfo(x.itemId)?.name || '未命名物品')}</b><span>${esc(x.person || '尚未指定')} · ${x.time ? new Date(x.time).toLocaleString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : '未設定時間'}</span></div><strong>${fmt(x.split)} G</strong></div>`).join('')}</div></article>
  <article class="panel"><div class="panel-head"><div><h2>每位玩家總分攤</h2><p>依本次清單中的玩家人數平均。</p></div></div><div class="totals">${members.map((name) => `<div><span>${esc(name)}</span><b>${fmt(eachTotal)} G</b></div>`).join('') || '<p class="empty">輸入玩家後，這裡會顯示分攤合計。</p>'}</div></article></section>`;
}

function recalc() {
  const count = new Set(state.items.map(x => x.person.trim()).filter(Boolean)).size || 1;
  state.items.forEach(x => { x.split = Math.round(number(x.price) / count); });
  save();
}
function bind() {
  document.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', () => { view = btn.dataset.view; render(); }));
  document.querySelector('#addRow')?.addEventListener('click', () => { state.items.push({ ...sample(), id: crypto.randomUUID(), time: '' }); recalc(); render(); });
  document.querySelectorAll('[data-field]').forEach(input => input.addEventListener('change', event => {
    const index = Number(event.target.closest('tr').dataset.index); const field = event.target.dataset.field;
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    state.items[index][field] = value;
    if (field === 'itemId') { const info = itemInfo(value); if (info) { state.items[index].name = info.name; state.items[index].price = info.price; } }
    recalc(); render();
  }));
  document.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', () => { state.items.splice(Number(btn.dataset.delete), 1); if (!state.items.length) state.items.push(sample()); recalc(); render(); }));
  document.querySelector('#exportBtn')?.addEventListener('click', exportXlsx);
  document.querySelector('#importBtn')?.addEventListener('click', () => document.querySelector('#fileInput').click());
  document.querySelector('#fileInput')?.addEventListener('change', importXlsx);
}
function exportXlsx() {
  const output = state.items.map(x => ({ '物品ID': x.itemId || '', '名稱': x.name, '時間': x.time, '得標者': x.person, '價格': number(x.price), '每人平分價格': number(x.split), '已分': x.paid ? 'TRUE' : 'FALSE' }));
  const sheet = XLSX.utils.json_to_sheet(output);
  sheet['!cols'] = [{ wch: 12 }, { wch: 24 }, { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 10 }];
  const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, '分贓明細'); XLSX.writeFile(book, `分贓明細_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
function importXlsx(event) {
  const file = event.target.files?.[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => { try {
    const book = XLSX.read(e.target.result, { type: 'array' }); const data = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { defval: '' });
    const imported = data.map(row => ({ id: crypto.randomUUID(), itemId: String(row['物品ID'] || ''), name: String(row['名稱'] || ''), time: String(row['時間'] || ''), person: String(row['得標者'] || ''), price: number(row['價格']), split: number(row['每人平分價格']), paid: String(row['已分']).toLowerCase() === 'true' || row['已分'] === true }));
    if (!imported.length) throw new Error('empty'); state.items = imported; recalc(); render();
  } catch { alert('無法讀取此 Excel。請使用由本工具匯出的 .xlsx 格式。'); } };
  reader.readAsArrayBuffer(file); event.target.value = '';
}
recalc(); render();
