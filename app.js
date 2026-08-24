// =====================================================================
// Gmail — Gmail-style client-side app.
// All email data comes from EMAILS in data.js. Nothing here needs to
// change when you swap in your own 200 emails — just edit data.js.
// =====================================================================

// Edit this to customize the account switcher popup (top-right avatar).
const ACCOUNT = {
  name: "Aman Gourav Sethi",
  email: "719MM1041@nitrkl.ac.in",
  avatarColor: "#4285F4",
  otherAccounts: [
    { name: "Aman Beta", email: "amanbeta@example.com", avatarColor: "#8430ce" }
  ],
  storagePercent: 16,
  storageTotal: "15 GB"
};

const LABEL_COLORS = {
  Primary:    "#1a73e8",
  Social:     "#e91e63",
  Promotions: "#188038",
  Updates:    "#f9ab00",
  Forums:     "#8430ce"
};

const PAGE_SIZE = 50;

let state = {
  emails: JSON.parse(JSON.stringify(EMAILS)), // working copy so edits don't mutate source
  filter: "inbox",       // inbox | starred | sent | important | label:<name>
  tab: "Primary",
  search: "",
  page: 0,
  selected: new Set(),
  openEmailId: null
};

// -------------------- helpers --------------------
// email.date is a full ISO datetime string (e.g. "2026-03-14T09:32:00").
// Dates/times are fixed at data-generation time, so they don't shift
// depending on when the page happens to be opened.
function relativeDate(dateStr){
  const d = new Date(dateStr);
  const now = new Date();
  const startOfDay = x => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 0 && diffDays < 7) return d.toLocaleDateString(undefined,{weekday:'short'});
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString(undefined,{month:'short',day:'numeric'});
  return d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
}

function initials(name){
  return name.trim().charAt(0).toUpperCase();
}

// Deterministic pseudo-random hex string (looks like a real mailing-list id,
// but generated purely client-side from the email's own data — no real
// tracking/identifiers involved).
function pseudoHex(seed, length){
  let x = Math.abs(seed) % 2147483647;
  if (x <= 0) x += 2147483646;
  let out = '';
  while (out.length < length){
    x = (x * 16807) % 2147483647;
    out += x.toString(16);
  }
  return out.slice(0, length);
}

function seedFromString(str){
  let h = 0;
  for (let i=0;i<str.length;i++){ h = (h*31 + str.charCodeAt(i)) | 0; }
  return h;
}

function fullDateTime(email){
  const d = new Date(email.date);
  const dateStr = d.toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'});
  const timeStr = d.toLocaleTimeString(undefined, {hour:'numeric', minute:'2-digit'});
  return `${dateStr}, ${timeStr}`;
}

// Builds the "show original" style details popup content for an email.
function buildDetailsPopup(email){
  const domain = (email.fromEmail.split('@')[1] || 'example.com').toLowerCase();
  const parts = domain.split('.');
  const rootDomain = parts.length > 2 ? parts.slice(-2).join('.') : domain;
  const showMailingList = email.label !== 'Primary';
  const seed = seedFromString(email.id + '|' + email.subject);
  const mailingListId = pseudoHex(seed, 40);
  const dt = fullDateTime(email);

  let rows = `
    <div class="popup-row"><span class="popup-label">from:</span><span class="popup-value"><strong>${escapeHtml(email.from)}</strong> &lt;${email.fromEmail}&gt;</span></div>
    <div class="popup-row"><span class="popup-label">to:</span><span class="popup-value">${escapeHtml(email.to || 'me')}</span></div>
    <div class="popup-row"><span class="popup-label">date:</span><span class="popup-value">${dt}</span></div>
    <div class="popup-row"><span class="popup-label">subject:</span><span class="popup-value">${escapeHtml(email.subject)}</span></div>
  `;

  if (showMailingList){
    rows += `
    <div class="popup-row"><span class="popup-label">mailing list:</span>
      <span class="popup-value">
        &lt;${mailingListId}@${domain}&gt;<br>
        <a href="#" class="filter-list-link" data-label="${email.label}">Filter messages from this mailing list</a>
      </span>
    </div>`;
  }

  rows += `
    <div class="popup-row"><span class="popup-label">mailed-by:</span><span class="popup-value">${domain}</span></div>
    <div class="popup-row"><span class="popup-label">signed-by:</span><span class="popup-value">${rootDomain}</span></div>
    <div class="popup-row"><span class="popup-label">security:</span><span class="popup-value">🔒 Standard encryption (TLS)</span></div>
  `;
  return rows;
}

function avatarColor(name){
  const colors = ["#EA4335","#4285F4","#34A853","#FBBC05","#8430ce","#e91e63","#00897b"];
  let hash = 0;
  for (let i=0;i<name.length;i++) hash = name.charCodeAt(i) + ((hash<<5)-hash);
  return colors[Math.abs(hash) % colors.length];
}

function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(()=>t.classList.remove('show'), 2500);
}

// -------------------- derived data --------------------
function getLabels(){
  const set = new Set(state.emails.map(e=>e.label));
  return Array.from(set);
}

function getFilteredEmails(){
  let list = state.emails;

  if (state.filter === "inbox") {
    list = list.filter(e => e.tab !== 'sent' && !e.archived && !e.deleted);
    list = list.filter(e => e.label === state.tab);
  } else if (state.filter === "starred") {
    list = list.filter(e => e.starred && !e.deleted);
  } else if (state.filter === "sent") {
    list = list.filter(e => e.folder === 'sent' && !e.deleted);
  } else if (state.filter === "important") {
    list = list.filter(e => e.important && !e.deleted);
  } else if (state.filter.startsWith("label:")) {
    const lbl = state.filter.slice(6);
    list = list.filter(e => e.label === lbl && !e.deleted);
  }

  if (state.search.trim()) {
    const q = state.search.toLowerCase();
    list = list.filter(e =>
      e.from.toLowerCase().includes(q) ||
      e.subject.toLowerCase().includes(q) ||
      e.preview.toLowerCase().includes(q) ||
      e.body.toLowerCase().includes(q)
    );
  }

  return list.slice().sort((a,b)=>new Date(b.date)-new Date(a.date));
}

// -------------------- rendering --------------------
function renderSidebarCounts(){
  const unread = state.emails.filter(e=>!e.read && !e.archived && !e.deleted && !e.sentByMe).length;
  document.getElementById('inboxCount').textContent = unread > 0 ? unread : "";
}

function renderLabels(){
  const el = document.getElementById('labelList');
  const labels = getLabels();
  el.innerHTML = labels.map(l => `
    <li class="nav-item" data-filter="label:${l}">
      <span class="label-dot" style="background:${LABEL_COLORS[l]||'#999'}"></span>
      <span>${l}</span>
    </li>
  `).join('');
  el.querySelectorAll('.nav-item').forEach(item=>{
    item.addEventListener('click', ()=>{
      state.filter = item.dataset.filter;
      state.page = 0;
      closeDetail();
      setActiveNav(item);
      render();
    });
  });
}

function setActiveNav(activeEl){
  document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));
  activeEl.classList.add('active');
}

function renderTabs(){
  const showTabs = state.filter === "inbox";
  document.getElementById('tabs').style.display = showTabs ? 'flex' : 'none';
}

function renderList(){
  const all = getFilteredEmails();
  const start = state.page * PAGE_SIZE;
  const pageItems = all.slice(start, start + PAGE_SIZE);
  const listEl = document.getElementById('emailList');
  const emptyEl = document.getElementById('emptyState');

  document.getElementById('listRange').textContent = all.length
    ? `${start+1}–${Math.min(start+PAGE_SIZE, all.length)} of ${all.length}`
    : '';

  if (pageItems.length === 0) {
    listEl.innerHTML = '';
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;

  listEl.innerHTML = pageItems.map(e => `
    <div class="email-row ${e.read ? '' : 'unread'} ${state.selected.has(e.id) ? 'selected':''}" data-id="${e.id}">
      <input type="checkbox" class="row-checkbox" data-id="${e.id}" ${state.selected.has(e.id)?'checked':''}>
      <span class="row-star ${e.starred?'starred':''}" data-id="${e.id}">
        <svg viewBox="0 0 24 24"><path d="M12 2l3.1 6.6 7.2.9-5.3 5 1.4 7.2L12 18.3 5.6 21.7 7 14.5l-5.3-5 7.2-.9L12 2z" fill="${e.starred?'currentColor':'none'}" stroke="currentColor" stroke-width="1.6"/></svg>
      </span>
      ${e.important ? `<span class="row-important"><svg viewBox="0 0 24 24"><path d="M13 2L3 14h7l-1 8 11-13h-7l1-7z" fill="currentColor"/></svg></span>` : `<span class="row-important"></span>`}
      <span class="row-from">${e.from}</span>
      <span class="row-content">
        <span class="label-chip" style="background:${LABEL_COLORS[e.label]||'#eee'}22;color:${LABEL_COLORS[e.label]||'#666'}">${e.label}</span>
        <span class="row-subject">${escapeHtml(e.subject)}</span> — <span class="email-preview">${escapeHtml(e.preview)}</span>
      </span>
      <span class="row-date">${relativeDate(e.date)}</span>
    </div>
  `).join('');

  // row click -> open
  listEl.querySelectorAll('.email-row').forEach(row=>{
    row.addEventListener('click', (ev)=>{
      if (ev.target.closest('.row-checkbox') || ev.target.closest('.row-star')) return;
      openEmail(parseInt(row.dataset.id));
    });
  });
  listEl.querySelectorAll('.row-checkbox').forEach(cb=>{
    cb.addEventListener('click', (ev)=>{
      ev.stopPropagation();
      const id = parseInt(cb.dataset.id);
      if (cb.checked) state.selected.add(id); else state.selected.delete(id);
      renderList();
    });
  });
  listEl.querySelectorAll('.row-star').forEach(star=>{
    star.addEventListener('click', (ev)=>{
      ev.stopPropagation();
      const id = parseInt(star.dataset.id);
      const email = state.emails.find(e=>e.id===id);
      email.starred = !email.starred;
      renderList();
    });
  });
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function openEmail(id){
  const email = state.emails.find(e=>e.id===id);
  if (!email) return;
  email.read = true;
  state.openEmailId = id;

  document.getElementById('emailList').style.display = 'none';
  document.getElementById('tabs').style.display = 'none';
  document.getElementById('listToolbar').style.display = 'none';
  const detail = document.getElementById('emailDetail');
  detail.hidden = false;

  document.getElementById('detailBody').innerHTML = `
    <h1 class="detail-subject">${escapeHtml(email.subject)}</h1>
    <div class="detail-meta">
      <div class="detail-avatar" style="background:${avatarColor(email.from)}">${initials(email.from)}</div>
      <div class="detail-meta-text">
        <div class="detail-from-name">${escapeHtml(email.from)} <span class="detail-from-email">&lt;${email.fromEmail}&gt;</span></div>
        <div class="detail-to-row">
          <span class="detail-to">to ${escapeHtml(email.to || 'me')}</span>
          <button class="detail-caret" id="detailCaret" title="Show details">
            <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </div>
      <div class="detail-date">${relativeDate(email.date)}</div>
    </div>
    <div class="detail-popup" id="detailPopup" hidden>${buildDetailsPopup(email)}</div>
    <div class="detail-content">${escapeHtml(email.body)}</div>
    <div class="detail-reply-bar">
      <button class="reply-btn" id="replyBtn">↩ Reply</button>
      <button class="reply-btn" id="forwardBtn">➜ Forward</button>
    </div>
  `;

  const caretBtn = document.getElementById('detailCaret');
  const popup = document.getElementById('detailPopup');
  caretBtn.addEventListener('click', (ev)=>{
    ev.stopPropagation();
    popup.hidden = !popup.hidden;
  });
  popup.querySelectorAll('.filter-list-link').forEach(a=>{
    a.addEventListener('click', (ev)=>{
      ev.preventDefault();
      const label = a.dataset.label;
      popup.hidden = true;
      state.filter = 'label:' + label;
      state.page = 0;
      closeDetail();
      document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));
      const target = document.querySelector(`.nav-item[data-filter="label:${label}"]`);
      if (target) target.classList.add('active');
      render();
      showToast(`Filtered by ${label} mailing list`);
    });
  });

  const starBtn = document.getElementById('detailStar');
  starBtn.querySelector('svg path').setAttribute('fill', email.starred ? 'currentColor' : 'none');
  starBtn.onclick = ()=>{
    email.starred = !email.starred;
    starBtn.querySelector('svg path').setAttribute('fill', email.starred ? 'currentColor' : 'none');
    renderSidebarCounts();
  };

  document.getElementById('replyBtn').onclick = ()=>{
    openCompose({to: email.fromEmail, subject: `Re: ${email.subject}`, body: `\n\nOn ${relativeDate(email.date)}, ${email.from} wrote:\n> ${email.body}`});
  };
  document.getElementById('forwardBtn').onclick = ()=>{
    openCompose({to: '', subject: `Fwd: ${email.subject}`, body: `\n\n---------- Forwarded message ----------\nFrom: ${email.from} <${email.fromEmail}>\n\n${email.body}`});
  };

  renderSidebarCounts();
  renderList();
}

function closeDetail(){
  state.openEmailId = null;
  document.getElementById('emailDetail').hidden = true;
  document.getElementById('emailList').style.display = '';
  document.getElementById('listToolbar').style.display = '';
  renderTabs();
}

// -------------------- compose --------------------
function openCompose({to='', subject='', body=''} = {}){
  const win = document.getElementById('composeWindow');
  win.hidden = false;
  win.classList.remove('minimized');
  document.getElementById('composeTo').value = to;
  document.getElementById('composeSubject').value = subject;
  document.getElementById('composeBody').value = body;
  document.getElementById('composeBody').focus();
}
function closeCompose(){
  const win = document.getElementById('composeWindow');
  win.hidden = true;
  win.classList.remove('minimized');
}
function toggleMinimizeCompose(){
  document.getElementById('composeWindow').classList.toggle('minimized');
}

// -------------------- account switcher --------------------
function renderAccountPopup(){
  const displayName = ACCOUNT.name.trim();
  document.getElementById('accountEmailText').textContent = ACCOUNT.email;
  document.getElementById('accountFirstName').textContent = displayName;
  const photo = document.getElementById('accountPhoto');
  photo.textContent = initials(ACCOUNT.name);
  photo.style.background = ACCOUNT.avatarColor;

  document.getElementById('otherAccountsList').innerHTML = ACCOUNT.otherAccounts.map(acc => `
    <div class="account-row" data-email="${acc.email}">
      <div class="account-row-avatar" style="background:${acc.avatarColor}">${initials(acc.name)}</div>
      <div class="account-row-text">
        <div class="account-row-name">${escapeHtml(acc.name)}</div>
        <div class="account-row-email">${escapeHtml(acc.email)}</div>
      </div>
    </div>
  `).join('');

  document.getElementById('storageInfo').innerHTML =
    `☁️ ${ACCOUNT.storagePercent}% of ${ACCOUNT.storageTotal} used`;

  document.querySelectorAll('#otherAccountsList .account-row').forEach(row=>{
    row.addEventListener('click', ()=>{
      showToast(`Switched to ${row.dataset.email}`);
      closeAccountPopup();
    });
  });
}

function openAccountPopup(){
  document.getElementById('accountPopup').hidden = false;
}
function closeAccountPopup(){
  document.getElementById('accountPopup').hidden = true;
}

// -------------------- bulk actions --------------------
function applyToSelected(fn){
  if (state.selected.size === 0) { showToast('Select a conversation first'); return; }
  state.emails.forEach(e=>{ if (state.selected.has(e.id)) fn(e); });
  state.selected.clear();
  renderList();
  renderSidebarCounts();
}

// -------------------- event wiring --------------------
function initEvents(){
  // nav items (inbox/starred/sent/important)
  document.querySelectorAll('#navList .nav-item').forEach(item=>{
    item.addEventListener('click', ()=>{
      state.filter = item.dataset.filter;
      state.page = 0;
      state.selected.clear();
      closeDetail();
      setActiveNav(item);
      render();
    });
  });

  // tabs
  document.querySelectorAll('.tab').forEach(tab=>{
    tab.addEventListener('click', ()=>{
      document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
      state.tab = tab.dataset.tab;
      state.page = 0;
      render();
    });
  });

  // search
  const searchInput = document.getElementById('searchInput');
  let searchTimer;
  searchInput.addEventListener('input', ()=>{
    clearTimeout(searchTimer);
    searchTimer = setTimeout(()=>{
      state.search = searchInput.value;
      state.page = 0;
      closeDetail();
      render();
    }, 150);
  });

  // menu toggle (collapse sidebar)
  document.getElementById('menuToggle').addEventListener('click', ()=>{
    document.getElementById('sidebar').classList.toggle('collapsed');
  });

  // refresh
  document.getElementById('refreshBtn').addEventListener('click', ()=>{
    showToast('Inbox refreshed');
    render();
  });

  // compose
  document.getElementById('composeBtn').addEventListener('click', ()=>openCompose());
  document.getElementById('closeCompose').addEventListener('click', closeCompose);
  document.getElementById('minimizeCompose').addEventListener('click', (ev)=>{
    ev.stopPropagation();
    toggleMinimizeCompose();
  });
  document.querySelector('.compose-header').addEventListener('click', ()=>{
    const win = document.getElementById('composeWindow');
    if (win.classList.contains('minimized')) win.classList.remove('minimized');
  });
  document.getElementById('discardCompose').addEventListener('click', ()=>{
    closeCompose();
    showToast('Draft discarded');
  });
  document.getElementById('sendBtn').addEventListener('click', ()=>{
    const to = document.getElementById('composeTo').value.trim();
    if (!to) { showToast('Add a recipient first'); return; }
    closeCompose();
    showToast('Message sent');
  });

  // account switcher
  document.getElementById('avatarBtn').addEventListener('click', (ev)=>{
    ev.stopPropagation();
    const popup = document.getElementById('accountPopup');
    popup.hidden ? openAccountPopup() : closeAccountPopup();
  });
  document.getElementById('closeAccountPopup').addEventListener('click', closeAccountPopup);
  document.getElementById('addAccountBtn').addEventListener('click', ()=>{
    closeAccountPopup();
    showToast('Add another account (demo only)');
  });
  document.getElementById('signOutAllBtn').addEventListener('click', ()=>{
    closeAccountPopup();
    showToast('Signed out of all accounts (demo only)');
  });

  // back button from detail view
  document.getElementById('backBtn').addEventListener('click', closeDetail);

  // close the "show details" popup when clicking outside it
  document.addEventListener('click', (ev)=>{
    const popup = document.getElementById('detailPopup');
    const caret = document.getElementById('detailCaret');
    if (popup && !popup.hidden) {
      if (!popup.contains(ev.target) && ev.target !== caret && !(caret && caret.contains(ev.target))) {
        popup.hidden = true;
      }
    }
    const accountPopup = document.getElementById('accountPopup');
    const avatarBtn = document.getElementById('avatarBtn');
    if (accountPopup && !accountPopup.hidden) {
      if (!accountPopup.contains(ev.target) && ev.target !== avatarBtn && !avatarBtn.contains(ev.target)) {
        accountPopup.hidden = true;
      }
    }
  });
  document.addEventListener('keydown', (ev)=>{
    if (ev.key === 'Escape'){
      const popup = document.getElementById('detailPopup');
      if (popup && !popup.hidden) popup.hidden = true;
      const accountPopup = document.getElementById('accountPopup');
      if (accountPopup && !accountPopup.hidden) accountPopup.hidden = true;
    }
  });

  // detail archive/delete
  document.getElementById('detailArchive').addEventListener('click', ()=>{
    const e = state.emails.find(e=>e.id===state.openEmailId);
    if (e) e.archived = true;
    closeDetail();
    render();
    showToast('Conversation archived');
  });
  document.getElementById('detailDelete').addEventListener('click', ()=>{
    const e = state.emails.find(e=>e.id===state.openEmailId);
    if (e) e.deleted = true;
    closeDetail();
    render();
    showToast('Conversation deleted');
  });

  // select all
  document.getElementById('selectAllCheckbox').addEventListener('change', (ev)=>{
    const all = getFilteredEmails();
    const start = state.page*PAGE_SIZE;
    const pageItems = all.slice(start, start+PAGE_SIZE);
    if (ev.target.checked) pageItems.forEach(e=>state.selected.add(e.id));
    else pageItems.forEach(e=>state.selected.delete(e.id));
    renderList();
  });

  // bulk toolbar actions
  document.getElementById('archiveSelected').addEventListener('click', ()=>{
    applyToSelected(e=>e.archived=true);
    showToast('Archived');
    render();
  });
  document.getElementById('deleteSelected').addEventListener('click', ()=>{
    applyToSelected(e=>e.deleted=true);
    showToast('Deleted');
    render();
  });
  document.getElementById('markReadSelected').addEventListener('click', ()=>{
    applyToSelected(e=>e.read=true);
    showToast('Marked as read');
    render();
  });

  // pagination
  document.getElementById('nextPage').addEventListener('click', ()=>{
    const maxPage = Math.ceil(getFilteredEmails().length / PAGE_SIZE) - 1;
    if (state.page < maxPage) { state.page++; renderList(); }
  });
  document.getElementById('prevPage').addEventListener('click', ()=>{
    if (state.page > 0) { state.page--; renderList(); }
  });
}

function render(){
  renderTabs();
  renderList();
  renderSidebarCounts();
}

// -------------------- init --------------------
document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('avatarBtn').textContent = initials(ACCOUNT.name);
  document.getElementById('avatarBtn').style.background = ACCOUNT.avatarColor;
  renderAccountPopup();
  renderLabels();
  initEvents();
  render();
});
