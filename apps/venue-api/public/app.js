/* Minimal vanilla-JS console: fetch-based, token in localStorage,
   data-testids kept stable so the E2E suite owns selectors, not CSS. */
const state = { token: localStorage.getItem('token'), user: null };

const $ = (sel) => document.querySelector(sel);
const show = (el, on = true) => { el.hidden = !on; };

function setStatus(sel, message) {
  const el = $(sel);
  el.textContent = message ?? '';
  show(el, Boolean(message));
}

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error ?? res.statusText), { status: res.status });
  return data;
}

function renderUser() {
  $('[data-testid="nav-org"]').textContent = state.user.org.name;
  $('[data-testid="nav-user"]').textContent = `${state.user.name} (${state.user.role})`;
  show($('[data-testid="create-form"]'), state.user.role === 'operator');
  show($('[data-testid="create-disabled-note"]'), state.user.role !== 'operator');
}

function renderEvents(events) {
  const body = $('[data-testid="events-body"]');
  body.replaceChildren();
  show($('[data-testid="empty-events"]'), events.length === 0);
  for (const ev of events) {
    const tr = document.createElement('tr');
    tr.dataset.testid = 'event-row';
    tr.dataset.eventId = String(ev.id);
    const cells = [ev.name, ev.status, ev.startsAt, String(ev.tickets)];
    cells.forEach((text, i) => {
      const td = document.createElement('td');
      td.textContent = text;
      if (i === 0) td.dataset.testid = 'event-name';
      tr.append(td);
    });
    body.append(tr);
  }
}

async function loadEvents() {
  const { events } = await api('GET', '/events');
  renderEvents(events);
}

async function boot() {
  if (!state.token) return;
  try {
    state.user = await api('GET', '/me');
    renderUser();
    await loadEvents();
    show($('#login-view'), false);
    show($('#console-view'), true);
  } catch {
    localStorage.removeItem('token');
    state.token = null;
  }
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  setStatus('[data-testid="login-error"]');
  const email = $('[data-testid="login-email"]').value.trim();
  try {
    const data = await api('POST', '/auth/login', { email });
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('token', data.token);
    renderUser();
    await loadEvents();
    show($('#login-view'), false);
    show($('#console-view'), true);
  } catch (err) {
    setStatus('[data-testid="login-error"]', err.message);
  }
});

$('#create-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  setStatus('[data-testid="console-error"]');
  const name = $('[data-testid="create-event-name"]').value.trim();
  const startsAt = $('[data-testid="create-event-date"]').value;
  try {
    await api('POST', '/events', { name, startsAt: new Date(startsAt).toISOString() });
    $('[data-testid="create-event-name"]').value = '';
    $('[data-testid="create-event-date"]').value = '';
    await loadEvents();
  } catch (err) {
    setStatus('[data-testid="console-error"]', err.message);
  }
});

$('#logout').addEventListener('click', () => {
  localStorage.removeItem('token');
  location.reload();
});

boot();
