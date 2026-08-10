/* ==========================================================================
   Buildario — data access

   Every function here is a thin wrapper over PostgREST. None of them filter by
   user: row level security already does that server-side, so a client query and
   an admin query are frequently the same statement returning different rows.
   Where a filter *is* written (listProjectsForClient) it is for clarity, not
   for safety.
   ========================================================================== */

import { supabase } from './supabase.js';

const FILES_BUCKET = 'project-files';
const AVATARS_BUCKET = 'avatars';

/** Unwraps the { data, error } shape so callers can use try/catch throughout. */
function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

/* ---------------------------------------------------------------------------
   Leads
   --------------------------------------------------------------------------- */

export async function submitLead(payload) {
  return unwrap(await supabase.rpc('submit_lead', {
    p_name: payload.name,
    p_email: payload.email,
    p_message: payload.message,
    p_company: payload.company || null,
    p_budget: payload.budget || null,
    p_source: payload.source || 'website'
  }));
}

export async function listLeads({ status = null, limit = 200 } = {}) {
  let query = supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status) query = query.eq('status', status);
  return unwrap(await query);
}

export async function updateLead(id, patch) {
  return unwrap(await supabase.from('leads').update(patch).eq('id', id).select().single());
}

export async function deleteLead(id) {
  return unwrap(await supabase.from('leads').delete().eq('id', id));
}

/* ---------------------------------------------------------------------------
   Projects
   --------------------------------------------------------------------------- */

const PROJECT_COLUMNS =
  'id, client_id, lead_id, title, summary, status, progress, budget_cents, currency, ' +
  'started_on, target_launch, live_url, created_at, updated_at';

export async function listProjects() {
  return unwrap(await supabase
    .from('projects')
    .select(`${PROJECT_COLUMNS}, client:profiles!projects_client_id_fkey (id, full_name, email, company)`)
    .order('created_at', { ascending: false }));
}

export async function getProject(id) {
  return unwrap(await supabase
    .from('projects')
    .select(`${PROJECT_COLUMNS}, client:profiles!projects_client_id_fkey (id, full_name, email, company)`)
    .eq('id', id)
    .maybeSingle());
}

export async function createProject(payload) {
  return unwrap(await supabase.from('projects').insert(payload).select().single());
}

export async function updateProject(id, patch) {
  return unwrap(await supabase.from('projects').update(patch).eq('id', id).select().single());
}

export async function deleteProject(id) {
  return unwrap(await supabase.from('projects').delete().eq('id', id));
}

/** Admin only — the profiles policy returns just the caller's own row for
    anyone else, which is exactly what a client dashboard should see. */
export async function listClients() {
  return unwrap(await supabase
    .from('profiles')
    .select('id, full_name, email, company, role, created_at')
    .order('created_at', { ascending: false }));
}

/* ---------------------------------------------------------------------------
   Timeline
   --------------------------------------------------------------------------- */

export async function listUpdates(projectId) {
  return unwrap(await supabase
    .from('project_updates')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false }));
}

export async function addUpdate({ projectId, authorId, title, body, progress }) {
  return unwrap(await supabase
    .from('project_updates')
    .insert({
      project_id: projectId,
      author_id: authorId,
      title,
      body: body || null,
      // an empty progress field means "no change", not zero
      progress: progress === '' || progress === null || progress === undefined
        ? null
        : Number(progress)
    })
    .select()
    .single());
}

export async function deleteUpdate(id) {
  return unwrap(await supabase.from('project_updates').delete().eq('id', id));
}

/* ---------------------------------------------------------------------------
   Messages
   --------------------------------------------------------------------------- */

export async function listMessages(projectId) {
  return unwrap(await supabase
    .from('messages')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true }));
}

export async function sendMessage({ projectId, senderId, body }) {
  return unwrap(await supabase
    .from('messages')
    .insert({ project_id: projectId, sender_id: senderId, body: body.trim() })
    .select()
    .single());
}

/** Stamps read_at on everything the other side sent. The policy blocks marking
    your own messages read, so the sender filter also keeps the update from
    touching rows it would be rejected for. */
export async function markThreadRead({ projectId, userId }) {
  return unwrap(await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('project_id', projectId)
    .neq('sender_id', userId)
    .is('read_at', null));
}

/** Live thread. Returns an unsubscribe function — call it before navigating
    away or the socket keeps the old handler alive. */
export function subscribeToThread(projectId, onInsert) {
  const channel = supabase
    .channel(`messages:${projectId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `project_id=eq.${projectId}` },
      (payload) => onInsert(payload.new)
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

/* ---------------------------------------------------------------------------
   Files
   --------------------------------------------------------------------------- */

export async function listFiles(projectId) {
  return unwrap(await supabase
    .from('project_files')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false }));
}

/** The object key must start with the project id — the storage policies read
    that first segment back to decide who may touch the bytes. */
export async function uploadProjectFile({ projectId, userId, file }) {
  const safeName = file.name.replace(/[^\w.\-]+/g, '-').slice(-120);
  const path = `${projectId}/${Date.now()}-${safeName}`;

  const upload = await supabase.storage.from(FILES_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false
  });
  if (upload.error) throw upload.error;

  try {
    return unwrap(await supabase
      .from('project_files')
      .insert({
        project_id: projectId,
        uploaded_by: userId,
        path,
        name: file.name.slice(0, 255),
        size_bytes: file.size,
        mime_type: file.type || null
      })
      .select()
      .single());
  } catch (error) {
    // The bytes are up but the listing row is not; leaving the object behind
    // would make an invisible file that still counts against storage.
    await supabase.storage.from(FILES_BUCKET).remove([path]);
    throw error;
  }
}

/** The bucket is private, so downloads need a short-lived signed URL. */
export async function signedFileUrl(path, expiresIn = 60) {
  const { data, error } = await supabase.storage.from(FILES_BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteProjectFile(row) {
  const { error } = await supabase.storage.from(FILES_BUCKET).remove([row.path]);
  if (error) throw error;
  return unwrap(await supabase.from('project_files').delete().eq('id', row.id));
}

export async function uploadAvatar({ userId, file }) {
  const extension = (file.name.split('.').pop() || 'png').toLowerCase();
  const path = `${userId}/avatar-${Date.now()}.${extension}`;

  const upload = await supabase.storage.from(AVATARS_BUCKET).upload(path, file, { upsert: true });
  if (upload.error) throw upload.error;

  const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
