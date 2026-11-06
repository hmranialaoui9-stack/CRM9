// Configurez window.CLUB_API_URL avant ce script en production.
const API_URL = (window.CLUB_API_URL || 'http://localhost:4000/api').replace(/\/+$/, '');
const PAGE_SIZE = 10;
const state = { friends: [], filtered: [], page: 1, view: 'dashboard', loading: false, error: null, editingId: null, selectedFriend: null, user: null };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const fullName = (friend) => `${friend.prenom || ''} ${friend.nom || ''}`.trim();
const initials = (friend) => `${friend.prenom?.[0] || ''}${friend.nom?.[0] || ''}`.toLocaleUpperCase('fr') || 'CA';
const formatDate = (value, options = { day: '2-digit', month: 'short', year: 'numeric' }) => value ? new Intl.DateTimeFormat('fr-FR', options).format(new Date(value)).replace('.', '') : '—';

function unwrap(payload) {
  return payload && typeof payload === 'object' && !Array.isArray(payload) && Object.hasOwn(payload, 'data') ? payload.data : payload;
}

async function api(path, options = {}) {
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  if (options.body && !Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')) headers['Content-Type'] = 'application/json';
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers, credentials: 'include' });
  } catch (_error) {
    throw new Error("Impossible de joindre le serveur. Vérifiez que l'API est lancée sur le port 4000.");
  }
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401 && state.user && !path.startsWith('/auth/')) showAuthentication(payload.message || 'Votre session a expiré. Reconnectez-vous.');
  if (!response.ok) throw new Error(payload.message || `La requête a échoué (HTTP ${response.status}).`);
  return unwrap(payload);
}

async function checkApiHealth() {
  const dot = $('#api-dot'); const label = $('#api-status');
  try {
    const response = await fetch(`${API_URL}/health`, { headers: { Accept: 'application/json' } });
    const health = await response.json().catch(() => ({}));
    const connected = response.ok && health.database === 'connected';
    dot.classList.toggle('offline', !connected);
    label.textContent = connected ? 'API et base connectées' : (health.database === 'disconnected' ? 'Base de données déconnectée' : 'API indisponible');
  } catch (_error) {
    dot.classList.add('offline'); label.textContent = 'API inaccessible';
  }
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-symbol">${type === 'success' ? '✓' : '!'}</span><span>${escapeHTML(message)}</span><button type="button" aria-label="Fermer">×</button>`;
  $('#toast-region').append(toast);
  $('button', toast).addEventListener('click', () => toast.remove());
  window.setTimeout(() => toast.remove(), 4200);
}

async function loadFriends() {
  if (!state.user) return;
  state.loading = true;
  state.error = null;
  renderFriends();
  try {
    const friends = await api('/friends');
    if (!Array.isArray(friends)) throw new Error("La réponse de l'API amis n'est pas une liste JSON.");
    state.friends = friends;
    state.error = null;
  } catch (error) {
    state.error = error.message;
  } finally {
    state.loading = false;
    renderAll();
  }
  if (state.error) showToast(state.error, 'error');
}

function renderAll() {
  renderStats();
  renderCityFilter();
  renderFriends();
  if (state.view === 'dashboard') renderRecentFriends();
  if (state.view === 'friend-detail' && state.selectedFriend) renderFriendDetail(state.selectedFriend);
}

function renderStats() {
  const total = state.friends.length;
  const cities = [...new Set(state.friends.map((friend) => friend.ville?.trim()).filter(Boolean))];
  const byCity = state.friends.reduce((counts, friend) => {
    const city = friend.ville?.trim();
    if (city) counts[city] = (counts[city] || 0) + 1;
    return counts;
  }, {});
  const topCity = Object.entries(byCity).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'))[0];
  const unavailable = Boolean(state.error && !state.friends.length);
  $('#stat-total').textContent = unavailable ? '—' : total;
  $('#stat-cities').textContent = unavailable ? '—' : cities.length;
  $('#stat-top-city').textContent = unavailable ? '—' : (topCity?.[0] || '—');
  $('#stat-top-city-detail').textContent = unavailable ? 'Données indisponibles' : topCity ? `${topCity[1]} membre${topCity[1] === 1 ? '' : 's'} du club` : 'Aucun membre pour le moment';
  $('#friend-count').textContent = unavailable ? '—' : total;
}

function renderCityFilter() {
  const select = $('#city-filter');
  if (!select) return;
  const current = select.value;
  const cities = [...new Set(state.friends.map((friend) => friend.ville?.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  select.innerHTML = `<option value="">Toutes les villes</option>${cities.map((city) => `<option value="${escapeHTML(city)}">${escapeHTML(city)}</option>`).join('')}`;
  if (cities.includes(current)) select.value = current;
}

function getFilteredFriends() {
  const query = $('#friend-search').value.trim().toLocaleLowerCase('fr');
  const city = $('#city-filter').value;
  return state.friends.filter((friend) => {
    const matchesCity = !city || friend.ville === city;
    const searchable = [friend.nom, friend.prenom, friend.email, friend.telephone, friend.ville, friend._id].join(' ').toLocaleLowerCase('fr');
    return matchesCity && (!query || searchable.includes(query));
  });
}

function renderFriends() {
  const body = $('#friend-list');
  if (!body) return;
  const loading = $('#list-loading');
  const empty = $('#list-empty');
  const table = body.closest('table');
  if (state.loading) {
    loading.hidden = false; empty.hidden = true; table.hidden = true;
    $('#result-count').textContent = 'Chargement…';
    return;
  }
  loading.hidden = true;
  if (state.error && !state.friends.length) {
    table.hidden = true; empty.hidden = false;
    $('#empty-title').textContent = 'Impossible de charger les amis';
    $('#empty-message').textContent = state.error;
    $('#empty-add').hidden = true;
    $('#result-count').textContent = 'Données indisponibles';
    return;
  }
  table.hidden = false;
  const matches = getFilteredFriends();
  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  state.page = Math.min(state.page, pageCount);
  const pageItems = matches.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
  empty.hidden = pageItems.length > 0;
  $('#empty-title').textContent = state.friends.length ? 'Aucun ami trouvé' : 'Le club attend ses premiers amis';
  $('#empty-message').textContent = state.friends.length ? 'Modifiez votre recherche ou le filtre par ville.' : 'Ajoutez le premier membre de la communauté.';
  $('#empty-add').hidden = state.friends.length > 0;
  body.innerHTML = pageItems.map((friend, index) => `<tr>
    <td><button class="member-button" type="button" data-action="view" data-id="${escapeHTML(friend._id)}"><span class="member-avatar avatar-${index % 6}">${escapeHTML(initials(friend))}</span><span class="member-name"><strong>${escapeHTML(fullName(friend))}</strong><small>Membre du club</small></span></button></td>
    <td><code class="id-chip" title="${escapeHTML(friend._id)}">${escapeHTML(String(friend._id || '').slice(-8))}</code></td>
    <td><a class="table-email" href="mailto:${escapeHTML(friend.email)}">${escapeHTML(friend.email)}</a></td>
    <td>${escapeHTML(friend.telephone)}</td><td><span class="city-pill">${escapeHTML(friend.ville)}</span></td><td class="date-cell">${formatDate(friend.createdAt)}</td>
    <td><div class="row-actions"><button class="row-action" type="button" data-action="view" data-id="${escapeHTML(friend._id)}" aria-label="Voir ${escapeHTML(fullName(friend))}" title="Voir">⌕</button><button class="row-action" type="button" data-action="edit" data-id="${escapeHTML(friend._id)}" aria-label="Modifier ${escapeHTML(fullName(friend))}" title="Modifier">✎</button><button class="row-action delete-action" type="button" data-action="delete" data-id="${escapeHTML(friend._id)}" data-name="${escapeHTML(fullName(friend))}" aria-label="Supprimer ${escapeHTML(fullName(friend))}" title="Supprimer">⌫</button></div></td>
  </tr>`).join('');
  $('#result-count').textContent = `${matches.length} ami${matches.length === 1 ? '' : 's'}${matches.length ? ` · ${matches.length ? (state.page - 1) * PAGE_SIZE + 1 : 0}–${Math.min(state.page * PAGE_SIZE, matches.length)}` : ''}`;
  $('#page-label').textContent = `${state.page} / ${pageCount}`;
  $('#prev-page').disabled = state.page <= 1;
  $('#next-page').disabled = state.page >= pageCount;
}

function renderRecentFriends() {
  const container = $('#recent-friends');
  if (!container) return;
  if (state.error && !state.friends.length) {
    container.innerHTML = `<div class="empty-state"><strong>Les membres ne sont pas disponibles</strong><p>${escapeHTML(state.error)}</p><button type="button" class="button button-outline" data-action="refresh">Réessayer</button></div>`;
    return;
  }
  const recent = [...state.friends].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  container.innerHTML = recent.length ? recent.map((friend, index) => `<button class="recent-row" type="button" data-action="view" data-id="${escapeHTML(friend._id)}"><span class="member-avatar avatar-${index % 6}">${escapeHTML(initials(friend))}</span><span class="recent-copy"><strong>${escapeHTML(fullName(friend))}</strong><small>${escapeHTML(friend.ville)} · ${escapeHTML(friend.email)}</small></span><span class="recent-date">${formatDate(friend.createdAt, { day: '2-digit', month: 'short' })}</span><span class="recent-arrow">→</span></button>`).join('') : `<div class="empty-state"><span class="empty-illustration">♡</span><strong>Pas encore de membre</strong><p>Le premier ami peut rejoindre le club aujourd'hui.</p><a class="button button-primary" href="#new">Ajouter un ami</a></div>`;
}

function showPage(page) {
  state.view = page;
  $$('.app-page').forEach((section) => { section.hidden = section.dataset.view !== page; });
  $$('.nav-link[data-page]').forEach((link) => link.classList.toggle('active', link.dataset.page === page || (['friend-detail', 'friend-form'].includes(page) && link.dataset.page === 'friends')));
  const labels = { dashboard: 'Tableau de bord', friends: 'Les amis', new: 'Ajouter un ami', 'friend-form': state.editingId ? 'Modifier un ami' : 'Ajouter un ami', 'friend-detail': 'Fiche d’un ami', club: 'À propos du club' };
  $('#breadcrumb-title').textContent = labels[page] || 'Club des Amis';
  $('#sidebar').classList.remove('sidebar-open');
  if (page === 'dashboard') renderRecentFriends();
}

function navigate(page, replace = false) {
  const hash = page === 'friend-detail' && state.selectedFriend ? `#friend/${state.selectedFriend._id}`
    : page === 'friend-form' ? (state.editingId ? `#edit/${state.editingId}` : '#new')
      : `#${page}`;
  if (replace) history.replaceState(null, '', hash);
  else if (location.hash !== hash) location.hash = hash;
  showPage(page);
}

async function routeFromHash() {
  const hash = location.hash.slice(1);
  if (hash.startsWith('friend/')) {
    const id = hash.slice('friend/'.length);
    if (state.view === 'friend-detail' && state.selectedFriend?._id === id) return;
    return openFriend(id, false);
  }
  if (hash.startsWith('edit/')) {
    const id = hash.slice('edit/'.length);
    if (state.view === 'friend-form' && state.editingId === id) return;
    return openForm(id, false);
  }
  if (hash === 'new') { state.editingId = null; showPage('friend-form'); return; }
  const page = ['dashboard', 'friends', 'new', 'club'].includes(hash) ? hash : 'dashboard';
  showPage(page === 'new' ? 'friend-form' : page);
  if (!hash) history.replaceState(null, '', '#dashboard');
}

async function openFriend(id, updateHash = true) {
  try {
    const friend = await api(`/friends/${encodeURIComponent(id)}`);
    if (!friend || typeof friend !== 'object' || Array.isArray(friend)) throw new Error("La réponse de l'API pour cet ami est invalide.");
    state.selectedFriend = friend;
    renderFriendDetail(friend);
    if (updateHash) navigate('friend-detail'); else showPage('friend-detail');
  } catch (error) {
    showToast(error.message, 'error');
    navigate('friends');
  }
}

async function openForm(id = null, updateHash = true) {
  state.editingId = id;
  const form = $('#friend-form');
  form.reset(); $('#form-error').textContent = '';
  if (id) {
    try {
      const friend = await api(`/friends/${encodeURIComponent(id)}`);
      if (!friend || typeof friend !== 'object' || Array.isArray(friend)) throw new Error("La réponse de l'API pour cet ami est invalide.");
      ['prenom', 'nom', 'email', 'telephone', 'ville'].forEach((key) => { form.elements.namedItem(key).value = friend[key] ?? ''; });
      $('#form-title').innerHTML = 'Modifier les <span>informations.</span>';
      $('#form-description').textContent = `Mettez à jour les coordonnées de ${fullName(friend)}.`;
      $('#submit-friend').innerHTML = 'Enregistrer les modifications <span>→</span>';
    } catch (error) { showToast(error.message, 'error'); navigate('friends'); return; }
  } else {
    $('#form-title').innerHTML = 'Bienvenue <span>au club.</span>';
    $('#form-description').textContent = 'Quelques informations pour faire connaissance.';
    $('#submit-friend').innerHTML = "Ajouter l'ami <span>→</span>";
  }
  if (updateHash) navigate('friend-form'); else showPage('friend-form');
  window.setTimeout(() => form.elements.prenom.focus(), 30);
}

function renderFriendDetail(friend) {
  $('#friend-detail-content').innerHTML = `<button class="back-link" type="button" data-action="back">← Retour à l'annuaire</button>
    <div class="detail-heading"><div class="detail-profile"><span class="detail-avatar">${escapeHTML(initials(friend))}</span><div><span class="eyebrow"><i></i>MEMBRE DE LA COMMUNAUTÉ</span><h1>${escapeHTML(fullName(friend))}</h1><p>Un ami du Club des Amis depuis le ${formatDate(friend.createdAt)}.</p></div></div><div class="detail-actions"><button class="button button-outline" type="button" data-action="edit" data-id="${escapeHTML(friend._id)}">✎ Modifier</button><button class="button button-danger" type="button" data-action="delete" data-id="${escapeHTML(friend._id)}" data-name="${escapeHTML(fullName(friend))}">Supprimer</button></div></div>
    <div class="detail-cards"><article class="content-card detail-info"><span class="eyebrow"><i></i>COORDONNÉES</span><h2>Restons en contact.</h2><div class="info-grid"><div><span>Adresse email</span><a href="mailto:${escapeHTML(friend.email)}">${escapeHTML(friend.email)}</a></div><div><span>Téléphone</span><a href="tel:${escapeHTML(friend.telephone)}">${escapeHTML(friend.telephone)}</a></div><div><span>Ville</span><strong>${escapeHTML(friend.ville)}</strong></div><div><span>Identifiant membre</span><code>${escapeHTML(friend._id)}</code></div></div></article><article class="content-card detail-dates"><span class="eyebrow"><i></i>AU CLUB</span><h2>Une belle histoire commence.</h2><div class="date-info"><span class="date-icon">♡</span><div><small>Membre depuis</small><strong>${formatDate(friend.createdAt)}</strong></div></div><div class="date-info"><span class="date-icon cyan-icon">↻</span><div><small>Coordonnées actualisées</small><strong>${formatDate(friend.updatedAt)}</strong></div></div></article></div>`;
}

async function deleteFriend(id, name) {
  if (!window.confirm(`Supprimer ${name} de l'annuaire du club ?`)) return;
  try {
    await api(`/friends/${encodeURIComponent(id)}`, { method: 'DELETE' });
    state.friends = state.friends.filter((friend) => friend._id !== id);
    state.selectedFriend = null;
    renderAll(); navigate('friends');
    showToast(`${name} a été retiré de l'annuaire.`);
  } catch (error) { showToast(error.message, 'error'); }
}

$('#friend-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  $('#form-error').textContent = '';
  if (!form.reportValidity()) return;
  const data = Object.fromEntries(new FormData(form).entries());
  for (const key of ['nom', 'prenom', 'email', 'telephone', 'ville']) data[key] = data[key].trim();
  data.email = data.email.toLocaleLowerCase('fr');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    $('#form-error').textContent = 'Saisissez une adresse email valide.'; form.elements.email.focus(); return;
  }
  if (!/^\+?[\d\s().-]{6,30}$/.test(data.telephone)) {
    $('#form-error').textContent = 'Saisissez un numéro de téléphone valide.'; form.elements.telephone.focus(); return;
  }
  const submit = $('#submit-friend'); submit.disabled = true;
  const editingId = state.editingId;
  try {
    const saved = await api(editingId ? `/friends/${encodeURIComponent(editingId)}` : '/friends', { method: editingId ? 'PUT' : 'POST', body: JSON.stringify(data) });
    if (editingId) state.friends = state.friends.map((friend) => friend._id === editingId ? saved : friend);
    else state.friends.unshift(saved);
    state.selectedFriend = editingId ? saved : null;
    state.editingId = null;
    renderAll(); navigate(editingId ? 'friend-detail' : 'friends');
    showToast(editingId ? 'Les coordonnées ont été mises à jour.' : 'Bienvenue au nouvel ami du club !');
  } catch (error) { $('#form-error').textContent = error.message; }
  finally { submit.disabled = false; }
});

document.addEventListener('click', async (event) => {
  const pageLink = event.target.closest('[data-page]');
  if (pageLink) { event.preventDefault(); state.editingId = null; navigate(pageLink.dataset.page); return; }
  const hashLink = event.target.closest('a[href^="#"]');
  if (hashLink) {
    const target = hashLink.getAttribute('href').slice(1);
    if (target === 'new') { event.preventDefault(); openForm(); return; }
    if (target === 'friends' || target === 'dashboard' || target === 'club') { event.preventDefault(); state.editingId = null; navigate(target); return; }
  }
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.action === 'refresh' || button.id === 'refresh') { await loadFriends(); return; }
  if (button.dataset.action === 'back' || button.id === 'form-back') { state.selectedFriend = null; state.editingId = null; navigate('friends'); return; }
  if (button.id === 'prev-page') { state.page = Math.max(1, state.page - 1); renderFriends(); return; }
  if (button.id === 'next-page') { state.page += 1; renderFriends(); return; }
  const action = button.dataset.action;
  if (!action || !button.dataset.id) return;
  if (action === 'view') await openFriend(button.dataset.id);
  if (action === 'edit') await openForm(button.dataset.id);
  if (action === 'delete') await deleteFriend(button.dataset.id, button.dataset.name || 'cet ami');
});

$('#friend-search').addEventListener('input', () => { state.page = 1; renderFriends(); });
$('#city-filter').addEventListener('change', () => { state.page = 1; renderFriends(); });
$('#mobile-menu').addEventListener('click', () => $('#sidebar').classList.toggle('sidebar-open'));
document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); $('#friend-search').focus(); navigate('friends'); }
  if (event.key === 'Escape') $('#sidebar').classList.remove('sidebar-open');
});

$('#today').textContent = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
$('#year').textContent = new Date().getFullYear();
$$('.year-copy').forEach((node) => { node.textContent = new Date().getFullYear(); });
window.addEventListener('hashchange', routeFromHash);
window.addEventListener('resize', () => document.body.classList.toggle('compact-screen', window.innerWidth < 760));

function setAuthView(view) {
  const titles = {
    login: ['Heureux de vous retrouver.', 'Connectez-vous pour retrouver votre communauté.'],
    register: ['Rejoignez le Club des Amis.', 'Créez votre compte pour accéder à votre espace privé.'],
    forgot: ['Retrouvons l’accès à votre compte.', 'Quelques informations sur la récupération de mot de passe.'],
  };
  const [title, subtitle] = titles[view] || titles.login;
  $('#auth-title').textContent = title;
  $('#auth-subtitle').textContent = subtitle;
  $('#login-form').hidden = view !== 'login';
  $('#register-form').hidden = view !== 'register';
  $('#forgot-panel').hidden = view !== 'forgot';
  $('#auth-switch-login').hidden = view !== 'login';
  $('#auth-switch-register').hidden = view !== 'register';
  $('#auth-switch-forgot').hidden = view !== 'forgot';
  $('#login-error').textContent = '';
  $('#register-error').textContent = '';
  $('#google-auth').hidden = view === 'forgot';
  $('.auth-divider').hidden = view === 'forgot';
  document.body.dataset.authView = view;
}

function showAuthenticatedApp(user) {
  state.user = user;
  $('#auth-shell').hidden = true;
  $('#app-shell').hidden = false;
  $('#user-name').textContent = `${user.prenom || ''} ${user.nom || ''}`.trim();
  $('#user-avatar').textContent = `${user.prenom?.[0] || ''}${user.nom?.[0] || ''}`.toLocaleUpperCase('fr') || 'CA';
  routeFromHash();
  checkApiHealth();
  loadFriends();
}

function showAuthentication(error = '') {
  state.user = null;
  $('#app-shell').hidden = true;
  $('#auth-shell').hidden = false;
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const errorCode = params.get('error');
  const googleErrors = {
    google_unconfigured: 'La connexion Google sera disponible après configuration OAuth par l’administrateur.',
    google_cancelled: 'La connexion Google a été annulée.',
    google_state_invalid: 'La vérification de sécurité Google a échoué. Réessayez.',
    google_exchange_failed: 'Google n’a pas pu confirmer la connexion. Réessayez.',
    google_email_unverified: 'Utilisez un compte Gmail vérifié pour continuer.',
    google_account_conflict: 'Ce compte Google est déjà associé à un autre profil.',
  };
  const message = error || googleErrors[errorCode] || '';
  history.replaceState(null, '', '#auth');
  setAuthView('login');
  if (message) $('#login-error').textContent = message;
}

$$('[data-auth-view]').forEach((button) => button.addEventListener('click', () => setAuthView(button.dataset.authView)));

$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const submit = $('button[type="submit"]', form); submit.disabled = true;
  try {
    const result = await api('/auth/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    form.reset(); showAuthenticatedApp(result.user); showToast('Connexion réussie. Bienvenue au club !');
  } catch (error) { $('#login-error').textContent = error.message; }
  finally { submit.disabled = false; }
});

$('#register-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const values = Object.fromEntries(new FormData(form));
  if (values.password !== values.confirmPassword) { $('#register-error').textContent = 'Les mots de passe ne correspondent pas.'; return; }
  const submit = $('button[type="submit"]', form); submit.disabled = true;
  try {
    const result = await api('/auth/register', { method: 'POST', body: JSON.stringify(values) });
    form.reset(); showAuthenticatedApp(result.user); showToast('Votre compte a été créé. Bienvenue au Club des Amis !');
  } catch (error) { $('#register-error').textContent = error.message; }
  finally { submit.disabled = false; }
});

$('#google-auth').addEventListener('click', () => { window.location.assign(`${API_URL}/auth/google`); });
$('#logout-button').addEventListener('click', async () => {
  try { await api('/auth/logout', { method: 'POST' }); }
  catch (error) { showToast(error.message, 'error'); return; }
  state.friends = []; state.selectedFriend = null; state.editingId = null;
  showAuthentication();
});

async function bootstrapSession() {
  try {
    const result = await api('/auth/me');
    if (!result?.user) throw new Error('Session invalide.');
    showAuthenticatedApp(result.user);
  } catch (_error) { showAuthentication(); }
}

setAuthView('login');
bootstrapSession();
