import * as XLSX from 'xlsx';
import './style.css';
import catalog from './data/items.json';

const STORAGE_KEY = 'loot-ledger-v2';
const LEGACY_STORAGE_KEY = 'loot-ledger-v1';
const PEOPLE_KEY = 'loot-ledger-people-v1';
const currency = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 });

function localDateTime(value = new Date()) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}
const sample = () => ({
  id: crypto.randomUUID(), itemId: '5100303', name: '布里萊赫核心', time: localDateTime(), person: '', quantity: 1, price: 150000000, split: 0, paid: false,
});
let state = load();
let view = 'ledger';

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY));
    if (!data?.items?.length) return { items: [sample()] };
    return { items: data.items.map(item => ({ ...sample(), ...item, quantity: Math.max(1, number(item.quantity) || 1), time: item.time || localDateTime() })) };
  } catch { return { items: [sample()] }; }
}
function recipients(value = '') {
  return [...new Set(String(value).split(/[+＋]/).map(name => name.trim()).filter(Boolean))];
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
  const names = state.items.flatMap(x => recipients(x.person));
  const savedPeople = [...new Set([...people(), ...names])].slice(-30);
  localStorage.setItem(PEOPLE_KEY, JSON.stringify(savedPeople));
  document.cookie = `${PEOPLE_KEY}=${encodeURIComponent(JSON.stringify(savedPeople))}; max-age=31536000; path=/; SameSite=Lax`;
}
function itemInfo(itemId) { return catalog.find(x => String(x.id) === String(itemId)); }
function image(item) { return item.itemId ? `${import.meta.env.BASE_URL}${item.itemId}.png` : ''; }
function number(value) { return Number(value) || 0; }
function quantity(value) { return Math.max(1, Math.floor(number(value)) || 1); }
function itemTotal(item) { return number(item.price) * quantity(item.quantity); }
function splitFor(item) { const count = recipients(item.person).length; return count ? Math.round(itemTotal(item) / count) : 0; }
function fmt(value) { return currency.format(Math.round(number(value))); }
function esc(value = '') { return String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' })[c]); }

function render() {
  const app = document.querySelector('#app');
  const total = state.items.reduce((sum, x) => sum + itemTotal(x), 0);
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
  return `<section class="hero"><div><p class="eyebrow">MABINOGI RAID LOOT</p><h1>神奇小迪...真的好強</h1><p class="sub">輸入掉落、價格與得標者；每一筆的分攤金額會立即算好。</p></div><div class="metric"><span>本次戰利品</span><b>${fmt(total)} <small>Gold</small></b><i>${state.items.length} 項 · ${paid} 項已分</i></div></section>
  <section class="panel">
    <div class="panel-head"><div><h2>分贓明細</h2><p>得標者以「+」分隔（如：莉+C+貓+布）；人名和所有明細都會保存在此瀏覽器。</p></div><button class="add" id="addRow">＋ 新增物品</button></div>
    <div class="table-wrap"><table><thead><tr><th>物品</th><th>時間</th><th>得標者</th><th>數量</th><th>單價</th><th>每人平分</th><th>已分</th><th></th></tr></thead><tbody>
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
    <td><input class="person" data-field="person" list="person-options-${index}" value="${esc(item.person)}" placeholder="莉+C+貓+布"><datalist id="person-options-${index}">${personOptions}</datalist></td>
    <td><input class="quantity" data-field="quantity" type="number" min="1" step="1" value="${quantity(item.quantity)}" aria-label="物品數量"></td>
    <td><label class="money"><span>G</span><input data-field="price" type="number" min="0" value="${number(item.price)}"></label></td>
    <td><output>${fmt(item.split)} G</output></td>
    <td><label class="toggle"><input data-field="paid" type="checkbox" ${item.paid ? 'checked' : ''}><span></span><b>${item.paid ? '已分' : '未分'}</b></label></td>
    <td><button class="delete" data-delete="${index}" aria-label="刪除這筆">×</button></td>
  </tr>`;
}

function summary(total) {
  const perPerson = new Map();
  state.items.forEach(item => recipients(item.person).forEach(name => perPerson.set(name, (perPerson.get(name) || 0) + splitFor(item))));
  return `<section class="hero compact"><div><p class="eyebrow">SETTLEMENT OVERVIEW</p><h1>本次分帳總覽</h1><p class="sub">每件物品依其得標者人數平分，並彙整每位玩家的應付金額。</p></div><div class="metric"><span>全場價值</span><b>${fmt(total)} <small>Gold</small></b><i>${perPerson.size} 位得標者</i></div></section>
  <section class="summary-grid"><article class="panel"><div class="panel-head"><div><h2>每件物品應分</h2><p>單價 × 數量，再依該列得標者人數平分。</p></div></div><div class="summary-list">${state.items.map(x => { const names = recipients(x.person); return `<div class="summary-row"><div class="mini-icon">${x.itemId ? `<img src="${image(x)}" alt="">` : '✦'}</div><div><b>${esc(x.name || itemInfo(x.itemId)?.name || '未命名物品')} × ${quantity(x.quantity)}</b><span>${esc(x.person || '尚未指定')} · ${names.length ? `${fmt(itemTotal(x))} ÷ ${names.length}` : '尚未指定得標者'}</span></div><strong>${fmt(x.split)} G</strong></div>`; }).join('')}</div></article>
  <article class="panel"><div class="panel-head"><div><h2>每位玩家總分攤</h2><p>只加總其列在得標者中的物品。</p></div></div><div class="totals">${[...perPerson.entries()].map(([name, amount]) => `<div><span>${esc(name)}</span><b>${fmt(amount)} G</b></div>`).join('') || '<p class="empty">輸入得標者後，這裡會顯示分攤合計。</p>'}</div></article></section>`;
}

function recalc() {
  state.items.forEach(x => { x.quantity = quantity(x.quantity); x.split = splitFor(x); });
  save();
}
function bind() {
  document.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', () => { view = btn.dataset.view; render(); }));
  document.querySelector('#addRow')?.addEventListener('click', () => { state.items.push(sample()); recalc(); render(); });
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
  const output = state.items.map(x => ({ '物品ID': x.itemId || '', '名稱': x.name, '時間': x.time, '得標者': x.person, '數量': quantity(x.quantity), '單價': number(x.price), '總價': itemTotal(x), '每人平分價格': number(x.split), '已分': x.paid ? 'TRUE' : 'FALSE' }));
  const sheet = XLSX.utils.json_to_sheet(output);
  sheet['!cols'] = [{ wch: 12 }, { wch: 24 }, { wch: 22 }, { wch: 20 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 10 }];
  const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, '分贓明細'); XLSX.writeFile(book, `分贓明細_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
function importXlsx(event) {
  const file = event.target.files?.[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => { try {
    const book = XLSX.read(e.target.result, { type: 'array' }); const data = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { defval: '' });
    const imported = data.map(row => ({ id: crypto.randomUUID(), itemId: String(row['物品ID'] || ''), name: String(row['名稱'] || ''), time: String(row['時間'] || localDateTime()), person: String(row['得標者'] || ''), quantity: quantity(row['數量']), price: number(row['單價'] ?? row['價格']), split: number(row['每人平分價格']), paid: String(row['已分']).toLowerCase() === 'true' || row['已分'] === true }));
    if (!imported.length) throw new Error('empty'); state.items = imported; recalc(); render();
  } catch { alert('無法讀取此 Excel。請使用由本工具匯出的 .xlsx 格式。'); } };
  reader.readAsArrayBuffer(file); event.target.value = '';
}
recalc(); render();
