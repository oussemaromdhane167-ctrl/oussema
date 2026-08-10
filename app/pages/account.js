/* ==========================================================================
   Buildario — client dashboard

   Shows the projects the signed-in user owns. Nothing here decides visibility:
   the queries are unfiltered and row level security returns only their rows, so
   a tampered-with page still cannot read someone else's thread.
   ========================================================================== */

import {
  $, html, fmtDate, fmtDateTime, fileSize, money,
  toast, pending, setMessage, PROJECT_STATUS
} from '../ui.js';
import {
  requireAuth, updateProfile, updatePassword, signOut, getProfile, friendlyError
} from '../auth.js';
import {
  listProjects, listUpdates, listMessages, sendMessage, markThreadRead,
  subscribeToThread, listFiles, uploadProjectFile, signedFileUrl,
  deleteProjectFile, uploadAvatar
} from '../api.js';

let session = null;
let profile = null;
let projects = [];
let current = null;
let unsubscribeThread = null;

boot();

async function boot() {
  const auth = await requireAuth({ loginUrl: '../login/' });
  if (!auth) return;                       // requireAuth already redirected

  session = auth.session;
  profile = auth.profile;

  paintIdentity();
  wireChrome();
  wireSettings();

  try {
    projects = await listProjects();
  } catch (error) {
    setMessage($('#pageMsg'), friendlyError(error));
    return;
  }

  if (!projects.length) {
    $('#projectList').innerHTML = '<p class="empty">No projects yet.</p>';
    $('#noProjects').hidden = false;
    return;
  }

  renderProjectList();

  // ?p=<id> keeps a specific project linkable and survives a refresh
  const wanted = new URLSearchParams(location.search).get('p');
  selectProject(projects.find((p) => p.id === wanted) || projects[0]);
}

/* ---------------------------------------------------------------------------
   Chrome
   --------------------------------------------------------------------------- */

function paintIdentity() {
  const name = (profile && profile.full_name) || session.user.email;
  $('#userName').textContent = name;
  $('#greeting').textContent = `Signed in as ${session.user.email}.`;
  paintAvatar(profile && profile.avatar_url, name);
  if (profile && profile.role === 'admin') $('#adminLink').hidden = false;
}

function paintAvatar(url, name) {
  const host = $('#userAvatar');
  if (url) {
    host.innerHTML = html`<img class="avatar" src="${url}" alt="">`;
    host.style.border = 'none';
  } else {
    host.textContent = (name || '?').trim().charAt(0).toUpperCase();
  }
}

function wireChrome() {
  $('#signOut').addEventListener('click', async () => {
    await signOut();
    location.replace('../login/');
  });
}

/* ---------------------------------------------------------------------------
   Projects
   --------------------------------------------------------------------------- */

function renderProjectList() {
  $('#projectList').innerHTML = projects.map((project) => html`
    <button type="button" class="row-item" data-project="${project.id}"
            aria-current="${String(Boolean(current) && current.id === project.id)}">
      <div>
        <h3>${project.title}</h3>
        <p>${PROJECT_STATUS[project.status] || project.status} · ${project.progress}%</p>
      </div>
    </button>
  `).join('');

  $('#projectList').querySelectorAll('[data-project]').forEach((button) => {
    button.addEventListener('click', () => {
      const project = projects.find((p) => p.id === button.dataset.project);
      if (project) selectProject(project);
    });
  });
}

async function selectProject(project) {
  current = project;

  if (unsubscribeThread) { unsubscribeThread(); unsubscribeThread = null; }

  renderProjectList();
  $('#noProjects').hidden = true;
  $('#projectPane').hidden = false;

  const url = new URL(location.href);
  url.searchParams.set('p', project.id);
  history.replaceState(null, '', url);

  renderOverview(project);
  wireProjectForms();

  await Promise.all([
    loadTimeline(project.id),
    loadFiles(project.id),
    loadThread(project.id)
  ]);

  unsubscribeThread = subscribeToThread(project.id, (message) => {
    appendMessage(message);
    if (message.sender_id !== session.user.id) {
      markThreadRead({ projectId: project.id, userId: session.user.id }).catch(() => {});
    }
  });
}

function renderOverview(project) {
  $('#projectTitle').textContent = project.title;
  $('#projectSummary').textContent = project.summary || 'No summary yet.';

  const statusEl = $('#projectStatus');
  statusEl.textContent = PROJECT_STATUS[project.status] || project.status;
  statusEl.className = `pill pill-${project.status}`;

  $('#progressValue').textContent = `${project.progress}%`;
  $('#progressBar').style.width = `${project.progress}%`;

  $('#metaStarted').textContent = fmtDate(project.started_on);
  $('#metaTarget').textContent = fmtDate(project.target_launch);
  $('#metaBudget').textContent = money(project.budget_cents, project.currency || 'USD');
  $('#metaLive').innerHTML = project.live_url
    ? html`<a href="${project.live_url}" target="_blank" rel="noopener noreferrer">Visit ↗</a>`
    : '—';
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
        <time datetime="${update.created_at}">${fmtDateTime(update.created_at)}</time>
        ${update.body ? html`<p>${update.body}</p>` : ''}
      </article>
    `).join('');
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
        ${file.uploaded_by === session.user.id
          ? html`<button type="button" class="btn btn-danger" data-delete-file="${file.id}">Delete</button>`
          : ''}
      </div>
    `).join('');

    host.querySelectorAll('[data-download]').forEach((button) => {
      button.addEventListener('click', () => download(button.dataset.download));
    });

    host.querySelectorAll('[data-delete-file]').forEach((button) => {
      button.addEventListener('click', async () => {
        const file = files.find((f) => f.id === button.dataset.deleteFile);
        if (!file || !confirm(`Delete ${file.name}? This cannot be undone.`)) return;
        try {
          await deleteProjectFile(file);
          toast('File deleted.', 'success');
          loadFiles(projectId);
        } catch (error) {
          toast(friendlyError(error), 'error');
        }
      });
    });
  } catch (error) {
    toast(friendlyError(error), 'error');
  }
}

/** The bucket is private, so a link only exists for the minute it is signed. */
async function download(path) {
  try {
    const url = await signedFileUrl(path, 60);
    window.open(url, '_blank', 'noopener');
  } catch (error) {
    toast(friendlyError(error), 'error');
  }
}

function wireProjectForms() {
  const input = $('#fileInput');
  const zone = $('#dropzone');
  if (input.dataset.wired) return;         // selecting another project re-renders around these
  input.dataset.wired = 'true';

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

  $('#composer').addEventListener('submit', onSendMessage);
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

/* ---------------------------------------------------------------------------
   Messages
   --------------------------------------------------------------------------- */

async function loadThread(projectId) {
  try {
    const messages = await listMessages(projectId);
    const host = $('#thread');

    host.innerHTML = messages.length
      ? messages.map(bubble).join('')
      : '<p class="empty">No messages yet — say hello.</p>';

    host.scrollTop = host.scrollHeight;
    await markThreadRead({ projectId, userId: session.user.id });
  } catch (error) {
    toast(friendlyError(error), 'error');
  }
}

function bubble(message) {
  const mine = message.sender_id === session.user.id;
  return html`
    <div class="bubble ${mine ? 'mine' : ''}" data-id="${message.id}">
      ${message.body}
      <time datetime="${message.created_at}">${mine ? 'You' : 'Buildario'} · ${fmtDateTime(message.created_at)}</time>
    </div>
  `;
}

function appendMessage(message) {
  const host = $('#thread');
  if (host.querySelector(`[data-id="${message.id}"]`)) return;   // our own echo
  if (host.querySelector('.empty')) host.innerHTML = '';
  host.insertAdjacentHTML('beforeend', bubble(message));
  host.scrollTop = host.scrollHeight;
}

async function onSendMessage(event) {
  event.preventDefault();
  const body = $('#messageBody').value.trim();
  if (!body || !current) return;

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
}

/* ---------------------------------------------------------------------------
   Settings
   --------------------------------------------------------------------------- */

function wireSettings() {
  $('#profileName').value = (profile && profile.full_name) || '';
  $('#profileCompany').value = (profile && profile.company) || '';
  $('#profileEmail').value = session.user.email;

  $('#profileForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('#profileSubmit');
    const msg = $('#profileMsg');
    setMessage(msg, '');
    pending(button, true, 'Saving…');

    try {
      profile = await updateProfile({
        full_name: $('#profileName').value.trim() || null,
        company: $('#profileCompany').value.trim() || null
      });
      paintIdentity();
      setMessage(msg, 'Profile saved.', 'success');
    } catch (error) {
      setMessage(msg, friendlyError(error));
    } finally {
      pending(button, false);
    }
  });

  $('#avatarInput').addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    try {
      const avatarUrl = await uploadAvatar({ userId: session.user.id, file });
      profile = await updateProfile({ avatar_url: avatarUrl });
      paintAvatar(avatarUrl, profile.full_name);
      toast('Profile picture updated.', 'success');
    } catch (error) {
      toast(friendlyError(error), 'error');
    } finally {
      event.target.value = '';
    }
  });

  $('#passwordForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('#passwordSubmit');
    const msg = $('#passwordMsg');
    setMessage(msg, '');

    const next = $('#newPassword').value;
    if (next.length < 8) { setMessage(msg, 'Password must be at least 8 characters.'); return; }
    if (next !== $('#confirmPassword').value) { setMessage(msg, 'Those two passwords do not match.'); return; }

    pending(button, true, 'Updating…');
    try {
      await updatePassword(next);
      $('#passwordForm').reset();
      setMessage(msg, 'Password updated.', 'success');
    } catch (error) {
      setMessage(msg, friendlyError(error));
    } finally {
      pending(button, false);
    }
  });
}

// keep the profile fresh if it changed in another tab
window.addEventListener('focus', () => {
  getProfile({ refresh: true }).then((fresh) => {
    if (fresh) { profile = fresh; paintIdentity(); }
  }).catch(() => {});
});
