/* ==========================================================================
   Buildario — studio admin

   Same tables as the client dashboard, seen through an admin profile: the
   policies widen from "your rows" to "all rows" on the strength of
   profiles.role, which only another admin can change. Nothing on this page is
   a permission check — it is a control surface over rows the server has
   already agreed to hand over.
   ========================================================================== */

import {
  $, html, raw, fmtDate, fmtDateTime, fileSize, relTime,
  toast, pending, setMessage, LEAD_STATUS, PROJECT_STATUS
} from '../ui.js';
import { requireAuth, signOut, friendlyError } from '../auth.js';
import {
  listLeads, updateLead, deleteLead,
  listProjects, createProject, updateProject, deleteProject, listClients,
  listUpdates, addUpdate, deleteUpdate,
  listMessages, sendMessage, markThreadRead, subscribeToThread,
  listFiles, uploadProjectFile, signedFileUrl, deleteProjectFile
} from '../api.js';

let session = null;
let profile = null;
let clients = [];
let projects = [];
let leads = [];
let current = null;                 // project being edited, null while creating
let unsubscribeThread = null;

boot();

async function boot() {
  const auth = await requireAuth({ loginUrl: '../login/', admin: true, homeUrl: '../account/' });
  if (!auth) return;

  session = auth.session;
  profile = auth.profile;
  $('#userName').textContent = profile.full_name || session.user.email;

  $('#signOut').addEventListener('click', async () => {
    await signOut();
    location.replace('../login/');
  });

  wireProjectForm();
  wireWorkspace();

  try {
    [leads, clients, projects] = await Promise.all([listLeads(), listClients(), listProjects()]);
  } catch (error) {
    setMessage($('#pageMsg'), friendlyError(error));
    return;
  }

  renderStats();
  renderLeads();
  renderClientOptions();
  renderProjectList();
}

/* ---------------------------------------------------------------------------
   Stats
   --------------------------------------------------------------------------- */

function renderStats() {
  const active = projects.filter((p) => !['launched', 'archived'].includes(p.status));
  $('#statNewLeads').textContent = leads.filter((l) => l.status === 'new').length;
  $('#statLeads').textContent = leads.length;
  $('#statActive').textContent = active.length;
  $('#statClients').textContent = clients.filter((c) => c.role === 'client').length;
}

/* ---------------------------------------------------------------------------
   Leads
   --------------------------------------------------------------------------- */

$('#leadFilter').addEventListener('change', renderLeads);

function renderLeads() {
  const filter = $('#leadFilter').value;
  const rows = filter ? leads.filter((lead) => lead.status === filter) : leads;
  const host = $('#leadRows');

  if (!rows.length) {
    host.innerHTML = '<tr><td colspan="5"><p class="empty">No leads here.</p></td></tr>';
    return;
  }

  host.innerHTML = rows.map((lead) => html`
    <tr data-lead="${lead.id}">
      <td class="muted small">
        ${fmtDate(lead.created_at)}<br>${relTime(lead.created_at)}
      </td>
      <td>
        <div><strong>${lead.name}</strong></div>
        <div class="muted small"><a href="mailto:${lead.email}">${lead.email}</a></div>
        ${lead.company ? html`<div class="muted small">${lead.company}</div>` : ''}
        ${lead.budget ? html`<div class="muted small">Budget: ${lead.budget}</div>` : ''}
      </td>
      <td>
        <div class="lead-msg">${lead.message}</div>
        <input class="input" style="margin-top:10px;font-size:13px;padding:8px 10px"
               data-note="${lead.id}" value="${lead.notes || ''}" placeholder="Private note…">
      </td>
      <td>
        <select class="input" style="font-size:13px;padding:8px 10px" data-status="${lead.id}">
          ${raw(Object.entries(LEAD_STATUS).map(([value, label]) => html`
            <option value="${value}" ${lead.status === value ? 'selected' : ''}>${label}</option>
          `).join(''))}
        </select>
      </td>
      <td>
        <button type="button" class="btn btn-quiet" data-start="${lead.id}">Start project</button>
        <button type="button" class="btn btn-danger" style="margin-top:8px" data-drop="${lead.id}">Delete</button>
      </td>
    </tr>
  `).join('');

  host.querySelectorAll('[data-status]').forEach((select) => {
    select.addEventListener('change', async () => {
      try {
        const updated = await updateLead(select.dataset.status, {
          status: select.value,
          handled_by: session.user.id
        });
        Object.assign(leads.find((l) => l.id === updated.id), updated);
        renderStats();
        toast('Lead updated.', 'success');
      } catch (error) {
        toast(friendlyError(error), 'error');
      }
    });
  });

  host.querySelectorAll('[data-note]').forEach((input) => {
    // save on blur rather than per keystroke — this is a scratchpad, not a chat
    input.addEventListener('change', async () => {
      try {
        const updated = await updateLead(input.dataset.note, { notes: input.value.trim() || null });
        Object.assign(leads.find((l) => l.id === updated.id), updated);
        toast('Note saved.', 'success');
      } catch (error) {
        toast(friendlyError(error), 'error');
      }
    });
  });

  host.querySelectorAll('[data-drop]').forEach((button) => {
    button.addEventListener('click', async () => {
      const lead = leads.find((l) => l.id === button.dataset.drop);
      if (!lead || !confirm(`Delete the lead from ${lead.name}? This cannot be undone.`)) return;
      try {
        await deleteLead(lead.id);
        leads = leads.filter((l) => l.id !== lead.id);
        renderStats();
        renderLeads();
        toast('Lead deleted.', 'success');
      } catch (error) {
        toast(friendlyError(error), 'error');
      }
    });
  });

  host.querySelectorAll('[data-start]').forEach((button) => {
    button.addEventListener('click', () => {
      const lead = leads.find((l) => l.id === button.dataset.start);
      if (lead) startProjectFromLead(lead);
    });
  });
}

/** Prefills the project form from a lead. The client still has to be picked by
    hand: an account only exists once they have signed up, and matching on email
    alone would silently attach the project to the wrong person. */
function startProjectFromLead(lead) {
  enterCreateMode();
  $('#projectTitle').value = `${lead.company || lead.name} — website`;
  $('#projectSummary').value = lead.message;
  $('#projectForm').dataset.leadId = lead.id;

  const match = clients.find((c) => c.email.toLowerCase() === lead.email.toLowerCase());
  if (match) $('#projectClient').value = match.id;
  else toast('No account matches that email yet — ask them to sign up first.', 'error');

  $('#projectForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ---------------------------------------------------------------------------
   Projects
   --------------------------------------------------------------------------- */

function renderClientOptions() {
  $('#projectClient').innerHTML =
    '<option value="">Select a client…</option>' +
    clients.map((client) => html`
      <option value="${client.id}">${client.full_name || client.email}${client.company ? ` — ${client.company}` : ''}</option>
    `).join('');
}

function renderProjectList() {
  const host = $('#projectList');

  if (!projects.length) {
    host.innerHTML = '<p class="empty">No projects yet.</p>';
    return;
  }

  host.innerHTML = projects.map((project) => html`
    <button type="button" class="row-item" data-project="${project.id}"
            aria-current="${String(Boolean(current) && current.id === project.id)}">
      <div>
        <h3>${project.title}</h3>
        <p>${(project.client && (project.client.full_name || project.client.email)) || 'Unassigned'}
           · ${PROJECT_STATUS[project.status] || project.status} · ${project.progress}%</p>
      </div>
    </button>
  `).join('');

  host.querySelectorAll('[data-project]').forEach((button) => {
    button.addEventListener('click', () => {
      const project = projects.find((p) => p.id === button.dataset.project);
      if (project) selectProject(project);
    });
  });
}

function enterCreateMode() {
  current = null;
  $('#projectFormTitle').textContent = 'New project';
  $('#projectSubmit').textContent = 'Create project';
  $('#projectSubmit').dataset.label = 'Create project';
  $('#deleteProject').hidden = true;
  $('#workspace').hidden = true;
  $('#projectForm').reset();
  delete $('#projectForm').dataset.leadId;
  $('#projectCurrency').value = 'USD';
  setMessage($('#projectMsg'), '');
  if (unsubscribeThread) { unsubscribeThread(); unsubscribeThread = null; }
  renderProjectList();
}

$('#newProject').addEventListener('click', enterCreateMode);

async function selectProject(project) {
  current = project;

  if (unsubscribeThread) { unsubscribeThread(); unsubscribeThread = null; }

  $('#projectFormTitle').textContent = 'Edit project';
  $('#projectSubmit').textContent = 'Save changes';
  $('#projectSubmit').dataset.label = 'Save changes';
  $('#deleteProject').hidden = false;
  $('#workspace').hidden = false;
  setMessage($('#projectMsg'), '');

  $('#projectClient').value = project.client_id;
  $('#projectTitle').value = project.title;
  $('#projectSummary').value = project.summary || '';
  $('#projectStatus').value = project.status;
  $('#projectProgress').value = project.progress;
  $('#projectBudget').value = project.budget_cents === null ? '' : project.budget_cents / 100;
  $('#projectCurrency').value = project.currency || 'USD';
  $('#projectStarted').value = project.started_on || '';
  $('#projectTarget').value = project.target_launch || '';
  $('#projectLive').value = project.live_url || '';

  renderProjectList();

  await Promise.all([loadTimeline(project.id), loadFiles(project.id), loadThread(project.id)]);

  unsubscribeThread = subscribeToThread(project.id, (message) => {
    appendMessage(message);
    if (message.sender_id !== session.user.id) {
      markThreadRead({ projectId: project.id, userId: session.user.id }).catch(() => {});
    }
  });
}

function readProjectForm() {
  const budget = $('#projectBudget').value.trim();
  return {
    client_id: $('#projectClient').value,
    title: $('#projectTitle').value.trim(),
    summary: $('#projectSummary').value.trim() || null,
    status: $('#projectStatus').value,
    progress: Number($('#projectProgress').value || 0),
    // stored in cents so no rounding drifts into the ledger
    budget_cents: budget === '' ? null : Math.round(Number(budget) * 100),
    currency: ($('#projectCurrency').value.trim() || 'USD').toUpperCase().slice(0, 3),
    started_on: $('#projectStarted').value || null,
    target_launch: $('#projectTarget').value || null,
    live_url: $('#projectLive').value.trim() || null
  };
}

function wireProjectForm() {
  $('#projectForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('#projectSubmit');
    const msg = $('#projectMsg');
    setMessage(msg, '');

    const payload = readProjectForm();
    if (!payload.client_id) { setMessage(msg, 'Pick the client this project belongs to.'); return; }
    if (payload.title.length < 2) { setMessage(msg, 'Give the project a title.'); return; }

    pending(button, true, 'Saving…');
    try {
      if (current) {
        const updated = await updateProject(current.id, payload);
        Object.assign(current, updated);
        // the embedded client may have changed with client_id
        projects = await listProjects();
        current = projects.find((p) => p.id === updated.id) || current;
        renderProjectList();
        setMessage(msg, 'Project saved.', 'success');
      } else {
        const leadId = $('#projectForm').dataset.leadId;
        const created = await createProject(leadId ? { ...payload, lead_id: leadId } : payload);
        projects = await listProjects();
        renderStats();
        const fresh = projects.find((p) => p.id === created.id);
        toast('Project created.', 'success');
        if (fresh) await selectProject(fresh);
      }
    } catch (error) {
      setMessage(msg, friendlyError(error));
    } finally {
      pending(button, false);
    }
  });

  $('#deleteProject').addEventListener('click', async () => {
    if (!current) return;
    if (!confirm(`Delete "${current.title}"? Its updates, messages, and file records go with it. This cannot be undone.`)) return;

    try {
      await deleteProject(current.id);
      projects = projects.filter((p) => p.id !== current.id);
      enterCreateMode();
      renderStats();
      toast('Project deleted.', 'success');
    } catch (error) {
      toast(friendlyError(error), 'error');
    }
  });
}

/* ---------------------------------------------------------------------------
   Timeline
   --------------------------------------------------------------------------- */

async function loadTimeline(projectId) {
  try {
    const updates = await listUpdates(projectId);
    const host = $('#timeline');

    if (!updates.length) {
      host.innerHTML = '<p class="empty">No updates posted yet.</p>';
      return;
    }

    host.innerHTML = updates.map((update) => html`
      <article class="timeline-item">
        <h3>${update.title}</h3>
        <time datetime="${update.created_at}">${fmtDateTime(update.created_at)}${
          update.progress === null ? '' : ` · ${update.progress}%`
        }</time>
        ${update.body ? html`<p>${update.body}</p>` : ''}
        <button type="button" class="btn btn-danger" style="margin-top:10px" data-drop-update="${update.id}">Delete</button>
      </article>
    `).join('');

    host.querySelectorAll('[data-drop-update]').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!confirm('Delete this update?')) return;
        try {
          await deleteUpdate(button.dataset.dropUpdate);
          loadTimeline(projectId);
          toast('Update deleted.', 'success');
        } catch (error) {
          toast(friendlyError(error), 'error');
        }
      });
    });
  } catch (error) {
    toast(friendlyError(error), 'error');
  }
}

/* ---------------------------------------------------------------------------
   Files
   --------------------------------------------------------------------------- */

async function loadFiles(projectId) {
  try {
    const files = await listFiles(projectId);
    const host = $('#fileList');

    if (!files.length) {
      host.innerHTML = '<p class="empty">No files yet.</p>';
      return;
    }

    host.innerHTML = files.map((file) => html`
      <div class="file-row">
        <div>
          <div class="file-name">${file.name}</div>
          <div class="muted small">${fileSize(file.size_bytes)} · ${fmtDate(file.created_at)}</div>
        </div>
        <div class="spacer"></div>
        <button type="button" class="btn btn-quiet" data-download="${file.path}">Download</button>
        <button type="button" class="btn btn-danger" data-drop-file="${file.id}">Delete</button>
      </div>
    `).join('');

    host.querySelectorAll('[data-download]').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          window.open(await signedFileUrl(button.dataset.download, 60), '_blank', 'noopener');
        } catch (error) {
          toast(friendlyError(error), 'error');
        }
      });
    });

    host.querySelectorAll('[data-drop-file]').forEach((button) => {
      button.addEventListener('click', async () => {
        const file = files.find((f) => f.id === button.dataset.dropFile);
        if (!file || !confirm(`Delete ${file.name}?`)) return;
        try {
          await deleteProjectFile(file);
          loadFiles(projectId);
          toast('File deleted.', 'success');
        } catch (error) {
          toast(friendlyError(error), 'error');
        }
      });
    });
  } catch (error) {
    toast(friendlyError(error), 'error');
  }
}

/* ---------------------------------------------------------------------------
   Thread
   --------------------------------------------------------------------------- */

async function loadThread(projectId) {
  try {
    const messages = await listMessages(projectId);
    const host = $('#thread');

    host.innerHTML = messages.length
      ? messages.map(bubble).join('')
      : '<p class="empty">No messages yet.</p>';

    host.scrollTop = host.scrollHeight;
    await markThreadRead({ projectId, userId: session.user.id });
  } catch (error) {
    toast(friendlyError(error), 'error');
  }
}

function bubble(message) {
  const mine = message.sender_id === session.user.id;
  const who = mine ? 'You' : (current && current.client && (current.client.full_name || current.client.email)) || 'Client';
  return html`
    <div class="bubble ${mine ? 'mine' : ''}" data-id="${message.id}">
      ${message.body}
      <time datetime="${message.created_at}">${who} · ${fmtDateTime(message.created_at)}</time>
    </div>
  `;
}

function appendMessage(message) {
  const host = $('#thread');
  if (host.querySelector(`[data-id="${message.id}"]`)) return;
  if (host.querySelector('.empty')) host.innerHTML = '';
  host.insertAdjacentHTML('beforeend', bubble(message));
  host.scrollTop = host.scrollHeight;
}

function wireWorkspace() {
  $('#updateForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!current) return;

    const button = $('#updateSubmit');
    const msg = $('#updateMsg');
    setMessage(msg, '');

    const title = $('#updateTitle').value.trim();
    if (title.length < 2) { setMessage(msg, 'Give the update a title.'); return; }

    pending(button, true, 'Posting…');
    try {
      await addUpdate({
        projectId: current.id,
        authorId: session.user.id,
        title,
        body: $('#updateBody').value.trim(),
        progress: $('#updateProgress').value
      });
      $('#updateForm').reset();
      await loadTimeline(current.id);

      // the progress trigger moved the project row; pull it back in
      projects = await listProjects();
      current = projects.find((p) => p.id === current.id) || current;
      $('#projectProgress').value = current.progress;
      renderProjectList();
      setMessage(msg, 'Update posted.', 'success');
    } catch (error) {
      setMessage(msg, friendlyError(error));
    } finally {
      pending(button, false);
    }
  });

  $('#composer').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!current) return;

    const body = $('#messageBody').value.trim();
    if (!body) return;

    const button = $('#sendMessage');
    pending(button, true, 'Sending…');
    try {
      const message = await sendMessage({
        projectId: current.id,
        senderId: session.user.id,
        body
      });
      $('#messageBody').value = '';
      appendMessage(message);
    } catch (error) {
      toast(friendlyError(error), 'error');
    } finally {
      pending(button, false);
    }
  });

  const input = $('#fileInput');
  const zone = $('#dropzone');

  input.addEventListener('change', () => {
    if (input.files && input.files[0]) upload(input.files[0]);
    input.value = '';
  });

  ['dragover', 'dragenter'].forEach((type) => {
    zone.addEventListener(type, (event) => { event.preventDefault(); zone.style.borderColor = 'var(--accent)'; });
  });
  ['dragleave', 'drop'].forEach((type) => {
    zone.addEventListener(type, () => { zone.style.borderColor = ''; });
  });
  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    const file = event.dataTransfer && event.dataTransfer.files[0];
    if (file) upload(file);
  });
}

async function upload(file) {
  if (!current) return;
  if (file.size > 25 * 1024 * 1024) {
    toast('That file is over the 25 MB limit.', 'error');
    return;
  }

  toast(`Uploading ${file.name}…`);
  try {
    await uploadProjectFile({ projectId: current.id, userId: session.user.id, file });
    toast('Upload complete.', 'success');
    loadFiles(current.id);
  } catch (error) {
    toast(friendlyError(error), 'error');
  }
}
