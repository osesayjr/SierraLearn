/* ============================================================
   SierraLearn v8 — supabase.js
   All Supabase operations: auth, resources, ratings,
   comments, likes, notifications, profile management
   ============================================================ */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = 'https://fmtcaqhzimndqgidtiks.supabase.co';
const SUPABASE_ANON_KEY= 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtdGNhcWh6aW1uZHFnaWR0aWtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2OTU4MzEsImV4cCI6MjA5NjI3MTgzMX0.oyLWqx9jqWS-XEkzwwMvlPqNAGAMkEtFc3nyjJxaatY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ── AUTH ─────────────────────────────────────────────────── */
export async function signUp({ email, password, fullName, role }) {
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name: fullName, role } }
  });
  if (error) throw error;
  return data;
}
export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}
export async function signOut() {
  /* scope:'local' clears only this browser's session immediately and
     skips the slower server-side call that revokes the session across
     every device — that global revoke was the real source of the delay
     users felt on sign-out. Local scope is what virtually every app uses
     for a standard "sign out" button. */
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw error;
}
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
export async function getCurrentProfile(knownUserId = null) {
  /* Skip the extra getUser() round-trip when the caller already has the
     user id from a session object (see auth.js initAuth) — this removes
     one full network request from the page-load critical path. */
  let userId = knownUserId;
  if (!userId) {
    const user = await getCurrentUser();
    if (!user) return null;
    userId = user.id;
  }
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
  return data;
}

/* ── PROFILE ─────────────────────────────────────────────── */
export async function updateProfile({ userId, fullName, avatarUrl }) {
  const updates = {};
  if (fullName)   updates.full_name  = fullName;
  if (avatarUrl)  updates.avatar_url = avatarUrl;
  updates.updated_at = new Date().toISOString();
  const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
  if (error) throw error;
}

export async function uploadAvatar(file, userId) {
  const ext  = file.name.split('.').pop();
  const path = `avatars/${userId}.${ext}`;
  const { error } = await supabase.storage.from('resources').upload(path, file, { upsert: true });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from('resources').getPublicUrl(path);
  return publicUrl;
}

/* ── RESOURCES ───────────────────────────────────────────── */
export async function fetchResources({ query='', subject='', level='', license='', type='' } = {}) {
  let q = supabase
    .from('resources')
    .select('*')
    .eq('status','approved')
    .order('created_at', { ascending: false });
  if (subject) q = q.eq('subject', subject);
  if (level)   q = q.eq('level', level);
  if (license) q = q.eq('license', license);
  if (type)    q = q.eq('type', type);
  if (query) {
    const t = `%${query}%`;
    q = q.or(`title.ilike.${t},description.ilike.${t}`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function fetchResourceById(id) {
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function uploadFile(file, userId) {
  const ext  = file.name.split('.').pop();
  const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('resources').upload(path, file, { cacheControl:'3600', upsert:false });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from('resources').getPublicUrl(path);
  return { publicUrl, storagePath: path };
}

export async function submitResource(resource) {
  const { data, error } = await supabase.from('resources').insert([{ ...resource, status:'pending' }]).select().single();
  if (error) throw error;
  return data;
}

export async function bumpDownload(resourceId, userId = null) {
  await supabase.rpc('increment_download', { resource_id: resourceId, p_user_id: userId });
}

export async function submitRating(resourceId, userId, score) {
  const { data, error } = await supabase.rpc('submit_rating', { p_resource_id: resourceId, p_user_id: userId, p_score: score });
  if (error) throw error;
  return data?.[0] || { avg_rating: 0, total_ratings: 0 };
}

export async function getUserRating(resourceId, userId) {
  const { data } = await supabase.from('ratings').select('score').eq('resource_id', resourceId).eq('user_id', userId).single();
  return data?.score || null;
}

/* ── COMMENTS ────────────────────────────────────────────── */
export async function fetchComments(resourceId) {
  const { data, error } = await supabase
    .from('comments')
    .select('*, profiles(full_name, avatar_url, role)')
    .eq('resource_id', resourceId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addComment(resourceId, userId, content) {
  const { data, error } = await supabase
    .from('comments')
    .insert([{ resource_id: resourceId, user_id: userId, content }])
    .select('*, profiles(full_name, avatar_url, role)')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteComment(commentId) {
  const { error } = await supabase.from('comments').delete().eq('id', commentId);
  if (error) throw error;
}

/* ── LIKES ───────────────────────────────────────────────── */
export async function fetchLikeCount(resourceId) {
  const { count } = await supabase.from('likes').select('*', { count:'exact', head:true }).eq('resource_id', resourceId);
  return count || 0;
}

export async function getUserLike(resourceId, userId) {
  const { data } = await supabase.from('likes').select('id').eq('resource_id', resourceId).eq('user_id', userId).single();
  return !!data;
}

export async function toggleLike(resourceId, userId) {
  const liked = await getUserLike(resourceId, userId);
  if (liked) {
    await supabase.from('likes').delete().eq('resource_id', resourceId).eq('user_id', userId);
    return false;
  } else {
    await supabase.from('likes').insert([{ resource_id: resourceId, user_id: userId }]);
    return true;
  }
}

/* ── NOTIFICATIONS ───────────────────────────────────────── */
export async function fetchNotifications(userId) {
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  return data || [];
}

export async function markNotificationsRead(userId) {
  await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
}

export async function createNotification({ userId, type, message, resourceId }) {
  await supabase.from('notifications').insert([{ user_id: userId, type, message, resource_id: resourceId }]);
}

export async function fetchUnreadCount(userId) {
  const { count } = await supabase.from('notifications').select('*', { count:'exact', head:true }).eq('user_id', userId).eq('is_read', false);
  return count || 0;
}

/* ── TEACHER PROFILE ─────────────────────────────────────── */
export async function fetchMyResources(userId) {
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .eq('uploader_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

/* ── STUDENT PROFILE ACTIVITY ─────────────────────────────────
   These three power the Student Profile's activity sections:
   resources liked, commented on, and downloaded. Each returns
   full resource rows (deduplicated) ordered by most recent
   activity first. */

export async function fetchLikedResources(userId) {
  const { data, error } = await supabase
    .from('likes')
    .select('created_at, resources(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(row => row.resources).filter(Boolean);
}

export async function fetchCommentedResources(userId) {
  /* Per product decision: shows every resource the student has EVER
     commented on, even if they later deleted that specific comment.
     We dedupe by resource id since a student may have left multiple
     comments on the same resource. */
  const { data, error } = await supabase
    .from('comments')
    .select('created_at, resources(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const seen = new Set();
  const out = [];
  for (const row of (data || [])) {
    if (row.resources && !seen.has(row.resources.id)) {
      seen.add(row.resources.id);
      out.push(row.resources);
    }
  }
  return out;
}

export async function fetchDownloadedResources(userId) {
  const { data, error } = await supabase
    .from('downloads_log')
    .select('created_at, resources(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const seen = new Set();
  const out = [];
  for (const row of (data || [])) {
    if (row.resources && !seen.has(row.resources.id)) {
      seen.add(row.resources.id);
      out.push(row.resources);
    }
  }
  return out;
}

export async function fetchResourceDownloaders(resourceId) {
  /* Returns download count — actual user-level tracking would need a downloads table */
  const { data } = await supabase.from('resources').select('downloads').eq('id', resourceId).single();
  return data?.downloads || 0;
}

export async function fetchResourceLikers(resourceId) {
  const { data } = await supabase.from('likes').select('profiles(full_name, avatar_url)').eq('resource_id', resourceId);
  return data || [];
}

export async function fetchResourceRaters(resourceId) {
  const { data } = await supabase.from('ratings').select('score, profiles(full_name)').eq('resource_id', resourceId);
  return data || [];
}

/* ── ADMIN ───────────────────────────────────────────────── */
export async function fetchAdminStats() {
  const { data } = await supabase.from('admin_stats').select('*').single();
  return data;
}

export async function adminFetchAllResources() {
  const { data, error } = await supabase
    .from('resources')
    .select('*, profiles(full_name, email)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function adminFetchAllUsers() {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function approveResource(id) {
  const { error } = await supabase.from('resources').update({ status:'approved', rejection_note:null }).eq('id', id);
  if (error) throw error;
}

export async function rejectResource(id, note='') {
  const { error } = await supabase.from('resources').update({ status:'rejected', rejection_note: note }).eq('id', id);
  if (error) throw error;
}

export async function deleteResource(id, storagePath) {
  if (storagePath) await supabase.storage.from('resources').remove([storagePath]);
  const { error } = await supabase.from('resources').delete().eq('id', id);
  if (error) throw error;
}

export async function adminChangeUserRole(userId, newRole) {
  const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
  if (error) throw error;
}

export async function adminDeleteUser(userId) {
  const { error } = await supabase.from('profiles').delete().eq('id', userId);
  if (error) throw error;
}

export async function fetchTopResources() {
  const [{ data: byDownloads }, { data: byRating }, { data: byLikes }] = await Promise.all([
    supabase.from('resources').select('id,title,downloads,uploader_name,type').eq('status','approved').order('downloads', { ascending:false }).limit(5),
    supabase.from('resources').select('id,title,rating_sum,rating_count,uploader_name,type').eq('status','approved').order('rating_count', { ascending:false }).limit(5),
    supabase.from('resources').select('id,title,like_count,uploader_name,type').eq('status','approved').order('like_count', { ascending:false }).limit(5),
  ]);
  return { byDownloads: byDownloads||[], byRating: byRating||[], byLikes: byLikes||[] };
}

export async function fetchTopTeachers() {
  const { data } = await supabase
    .from('resources')
    .select('uploader_id, uploader_name')
    .eq('status','approved');
  if (!data) return [];
  const counts = {};
  data.forEach(r => {
    if (!counts[r.uploader_id]) counts[r.uploader_id] = { name: r.uploader_name, count: 0 };
    counts[r.uploader_id].count++;
  });
  return Object.values(counts).sort((a,b) => b.count - a.count).slice(0,5);
}

export async function exportAllAsJSON() {
  const { data } = await supabase.from('resources').select('id,title,description,subject,level,type,license,tags,uploader_name,created_at,downloads,rating_sum,rating_count,like_count').eq('status','approved');
  const blob = new Blob([JSON.stringify(data||[], null, 2)], { type:'application/json' });
  const url  = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href:url, download:'sierralearn_resources.json' }).click();
  URL.revokeObjectURL(url);
}
