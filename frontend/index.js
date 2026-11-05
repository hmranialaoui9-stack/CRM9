// Adresse de l'API. Peut être remplacée sans exposer de secret côté navigateur.
const API_URL = window.CRM_API_URL || 'http://localhost:5000/api';

const state = { clients: [], status: 'Tous', search: '', editingId: null, loading: false };
const $ = (selector) => document.querySelector(selector);
const list = $('#client-list');
const modal = $('#modal-backdrop');
const form = $('#client-form');

function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

async function api(path = '', options = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}/clients${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
  } catch (_error) {
    throw new Error("Impossible de joindre l'API. Vérifiez que le backend est démarré et accessible.");
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `Erreur serveur (${response.status}).`);
  return body;
}

function toast(message, type = 'success') {
  const item = document.createElement('div');
  item.className = `toast ${type}`;
  item.innerHTML = `<span class="toast-symbol">${type === 'success' ? '✓' : '!'}</span><span>${escapeHTML(message)}</span><button aria-label="Fermer">×</button>`;
  $('#toast-region').append(item);
  item.querySelector('button').addEventListener('click', () => item.remove());
  window.setTimeout(() => item.remove(), 4500);
}

function initials(client) { return `${client.prenom?.[0] || ''}${client.nom?.[0] || ''}`.toUpperCase(); }
function fullName(client) { return `${client.prenom} ${client.nom}`.trim(); }
function dateLabel(date) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date)).replace('.', '');
}

function visibleClients() {
  const query = state.search.trim().toLocaleLowerCase('fr');
  return state.clients.filter((client) => {
    const matchesStatus = state.status === 'Tous' || client.statut === state.status;
    const haystack = [client.prenom, client.nom, client.email, client.entreprise, client.telephone, client.ville].join(' ').toLocaleLowerCase('fr');
    return matchesStatus && (!query || haystack.includes(query));
  });
}

function renderClients() {
  const clients = visibleClients();
  $('#loading').hidden = !state.loading;
  list.hidden = state.loading;
  $('#empty-state').hidden = state.loading || clients.length > 0;
  if (!state.loading) {
    $('#empty-title').textContent = state.clients.length ? 'Aucun résultat' : 'Aucun client pour le moment';
    $('#empty-copy').textContent = state.clients.length ? 'Essayez un autre terme ou filtre.' : 'Ajoutez votre premier contact pour commencer.';
  }
  $('#empty-add').hidden = state.clients.length > 0;
  list.innerHTML = clients.map((client, index) => `<tr>
    <td><input type="checkbox" class="row-select" aria-label="Sélectionner ${escapeHTML(fullName(client))}"></td>
    <td><div class="client-cell"><span class="client-avatar avatar-${index % 6}">${escapeHTML(initials(client))}</span><span class="client-copy"><strong>${escapeHTML(fullName(client))}</strong><small>${escapeHTML(client.email)}</small></span></div></td>
    <td class="company-cell">${escapeHTML(client.entreprise || '—')}</td>
    <td><span class="status-badge status-${client.statut.toLowerCase()}"><i></i>${escapeHTML(client.statut)}</span></td>
    <td class="muted-cell">${escapeHTML(client.telephone || '—')}</td><td class="muted-cell">${escapeHTML(client.ville || '—')}</td><td class="muted-cell date-cell">${dateLabel(client.createdAt)}</td>
    <td><div class="row-actions"><button class="row-action edit-action" data-id="${escapeHTML(client._id)}" aria-label="Modifier ${escapeHTML(fullName(client))}" title="Modifier">✎</button><button class="row-action delete-action" data-id="${escapeHTML(client._id)}" data-name="${escapeHTML(fullName(client))}" aria-label="Supprimer ${escapeHTML(fullName(client))}" title="Supprimer">⌫</button></div></td></tr>`).join('');
  $('#result-count').textContent = `${clients.length} client${clients.length === 1 ? '' : 's'} affiché${clients.length === 1 ? '' : 's'}`;
  $('#nav-count').textContent = state.clients.length;
  renderStats();
}

function renderStats() {
  const total = state.clients.length;
  const active = state.clients.filter((client) => client.statut === 'Actif').length;
  const prospects = state.clients.filter((client) => client.statut === 'Prospect').length;
  const inactive = state.clients.filter((client) => client.statut === 'Inactif').length;
  const percentage = total ? Math.round((active / total) * 100) : 0;
  $('#stat-total').textContent = total;
  $('#stat-active').textContent = active;
  $('#stat-prospects').textContent = prospects;
  $('#stat-inactive').textContent = inactive;
  $('#active-percent').textContent = `${percentage}%`;
  $('#active-progress').style.width = `${percentage}%`;
}

async function loadClients() {
  state.loading = true;
  renderClients();
  try {
    const result = await api();
    state.clients = Array.isArray(result) ? result : (result.data || []);
  } catch (error) {
    state.clients = [];
    toast(error.message, 'error');
  } finally {
    state.loading = false;
    renderClients();
  }
}

function openModal(client = null) {
  state.editingId = client?._id || null;
  form.reset();
  $('#form-error').textContent = '';
  $('#modal-title').textContent = client ? 'Modifier le client' : 'Ajouter un client';
  $('#save-client').innerHTML = client ? 'Enregistrer les modifications <span>→</span>' : 'Enregistrer le client <span>→</span>';
  if (client) Object.entries(client).forEach(([key, value]) => { if (form.elements[key]) form.elements[key].value = value || ''; });
  modal.hidden = false;
  document.body.classList.add('modal-open');
  window.setTimeout(() => form.elements.prenom.focus(), 40);
}

function closeModal() {
  modal.hidden = true;
  document.body.classList.remove('modal-open');
  state.editingId = null;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  $('#form-error').textContent = '';
  if (!form.reportValidity()) return;
  const data = Object.fromEntries(new FormData(form).entries());
  data.email = data.email.trim().toLowerCase();
  data.prenom = data.prenom.trim();
  data.nom = data.nom.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    $('#form-error').textContent = 'Veuillez saisir une adresse email valide.';
    form.elements.email.focus();
    return;
  }
  const button = $('#save-client');
  button.disabled = true;
  try {
    const editing = Boolean(state.editingId);
    const result = await api(editing ? `/${encodeURIComponent(state.editingId)}` : '', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(data) });
    const savedClient = result.data || result;
    if (editing) state.clients = state.clients.map((client) => client._id === state.editingId ? savedClient : client);
    else state.clients.unshift(savedClient);
    closeModal();
    renderClients();
    toast(editing ? 'Les modifications ont été enregistrées.' : 'Le client a été ajouté.');
  } catch (error) {
    $('#form-error').textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

list.addEventListener('click', async (event) => {
  const editButton = event.target.closest('.edit-action');
  const deleteButton = event.target.closest('.delete-action');
  if (editButton) openModal(state.clients.find((client) => client._id === editButton.dataset.id));
  if (deleteButton) {
    const name = deleteButton.dataset.name;
    if (!window.confirm(`Supprimer ${name} ? Cette action est définitive.`)) return;
    deleteButton.disabled = true;
    try {
      await api(`/${encodeURIComponent(deleteButton.dataset.id)}`, { method: 'DELETE' });
      state.clients = state.clients.filter((client) => client._id !== deleteButton.dataset.id);
      renderClients();
      toast(`${name} a été supprimé.`);
    } catch (error) {
      deleteButton.disabled = false;
      toast(error.message, 'error');
    }
  }
});

$('#add-client').addEventListener('click', () => openModal());
$('#empty-add').addEventListener('click', () => openModal());
$('#close-modal').addEventListener('click', closeModal);
$('#cancel-modal').addEventListener('click', closeModal);
modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !modal.hidden) closeModal();
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); $('#search').focus(); }
});
$('#search').addEventListener('input', (event) => { state.search = event.target.value; renderClients(); });
$('#status-filter').addEventListener('change', (event) => { state.status = event.target.value; renderClients(); });
$('#refresh').addEventListener('click', loadClients);
$('#select-all').addEventListener('change', (event) => { list.querySelectorAll('.row-select').forEach((checkbox) => { checkbox.checked = event.target.checked; }); });
$('#export-csv').addEventListener('click', () => {
  if (!state.clients.length) return toast('Aucun client à exporter.', 'error');
  const columns = ['prenom', 'nom', 'email', 'telephone', 'entreprise', 'adresse', 'ville', 'statut', 'notes'];
  const quote = (value) => `"${String(value || '').replace(/"/g, '""')}"`;
  const csv = [columns.join(';'), ...state.clients.map((client) => columns.map((key) => quote(client[key])).join(';'))].join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
  link.download = 'clients-pulse-crm.csv';
  link.click();
  URL.revokeObjectURL(link.href);
  toast('Export CSV téléchargé.');
});
$('#mobile-menu').addEventListener('click', () => $('#sidebar').classList.toggle('sidebar-open'));
document.querySelectorAll('.main-nav a').forEach((link) => link.addEventListener('click', () => $('#sidebar').classList.remove('sidebar-open')));
$('#today').textContent = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date());

loadClients();
