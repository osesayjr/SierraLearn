/* ============================================================
   SierraLearn v8 — auth.js
   Session state, role guards, dynamic navbar with
   notification bell and profile avatar
   ============================================================ */

import { getSession, getCurrentProfile, signOut, fetchUnreadCount, markNotificationsRead, fetchNotifications } from './supabase.js';

export let currentSession = null;
export let currentProfile = null;

export async function initAuth(requiredRole = null) {
  currentSession = await getSession();
  if (currentSession) {
    currentProfile = await getCurrentProfile();
  }
  if (requiredRole) {
    if (!currentSession) {
      window.location.href = `login.html?next=${encodeURIComponent(window.location.pathname)}`;
      return null;
    }
    if (requiredRole === 'admin' && currentProfile?.role !== 'admin') {
      window.location.href = 'index.html'; return null;
    }
    if (requiredRole === 'teacher' && !['teacher','admin'].includes(currentProfile?.role)) {
      window.location.href = 'index.html'; return null;
    }
  }
  await renderNav();
  return currentProfile;
}

async function renderNav() {
  const navRight = document.querySelector('.nav-right');
  if (!navRight) return;

  if (!currentSession || !currentProfile) {
    navRight.innerHTML = `
      <ul class="nav-links" role="list">
        <li><a href="index.html">Library</a></li>
        <li><a href="privacy.html">Privacy</a></li>
      </ul>
      <a href="login.html" class="nav-btn-ghost" style="margin-left:8px;">Sign In</a>
      <a href="signup.html" class="nav-cta" style="margin-left:8px;">
        <svg viewBox="0 0 20 20" fill="white" style="width:15px;height:15px"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/></svg>
        Get Started
      </a>`;
    return;
  }

  const role     = currentProfile.role;
  const initials = currentProfile.full_name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const avatar   = currentProfile.avatar_url;

  /* Notification count */
  let unread = 0;
  try { unread = await fetchUnreadCount(currentProfile.id); } catch(e) {}

  let links = `<li><a href="index.html">Library</a></li>`;
  if (role === 'teacher' || role === 'admin') links += `<li><a href="upload.html">Upload</a></li>`;
  if (role === 'admin') links += `<li><a href="dashboard.html" class="nav-admin-link">Admin</a></li>`;
  links += `<li><a href="privacy.html">Privacy</a></li>`;

  navRight.innerHTML = `
    <ul class="nav-links" role="list">${links}</ul>

    <!-- Notification bell -->
    <div class="nav-notif-wrap" id="nav-notif-wrap" style="position:relative;margin-left:8px;">
      <button class="nav-notif-btn" id="nav-notif-btn" aria-label="Notifications">
        <svg viewBox="0 0 20 20" fill="currentColor" style="width:20px;height:20px"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zm0 16a2 2 0 01-2-2h4a2 2 0 01-2 2z"/></svg>
        ${unread > 0 ? `<span class="notif-badge">${unread > 9 ? '9+' : unread}</span>` : ''}
      </button>
      <div class="notif-dropdown" id="notif-dropdown">
        <div class="notif-header">
          <span style="font-weight:700;font-size:0.95rem;">Notifications</span>
          <button class="notif-mark-read" id="notif-mark-read">Mark all read</button>
        </div>
        <div id="notif-list" style="max-height:320px;overflow-y:auto;">
          <div style="text-align:center;padding:32px 16px;color:var(--text-muted);font-size:0.9rem;">Loading…</div>
        </div>
      </div>
    </div>

    <!-- User avatar menu -->
    <div class="nav-user-menu" style="margin-left:8px;">
      <button class="nav-avatar-btn" id="nav-avatar-btn" aria-expanded="false">
        ${avatar
          ? `<img src="${avatar}" alt="${initials}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;">`
          : `<span class="nav-avatar">${initials}</span>`}
        <span class="nav-user-name">${currentProfile.full_name.split(' ')[0]}</span>
        <span class="nav-role-badge nav-role-${role}">${role}</span>
        <svg class="nav-chevron" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
      </button>
      <div class="nav-dropdown" id="nav-dropdown" aria-hidden="true">
        <div class="nav-dropdown-header">
          <div class="nav-dropdown-name">${currentProfile.full_name}</div>
          <div class="nav-dropdown-email">${currentProfile.email}</div>
        </div>
        <a href="profile.html" class="nav-dropdown-item">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/></svg>
          My Profile
        </a>
        ${role === 'admin' ? `<a href="dashboard.html" class="nav-dropdown-item">
          <svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>
          Admin Dashboard</a>` : ''}
        ${(role==='teacher'||role==='admin') ? `<a href="upload.html" class="nav-dropdown-item">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>
          Upload Resource</a>` : ''}
        <button class="nav-dropdown-item nav-dropdown-signout" id="nav-signout">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clip-rule="evenodd"/></svg>
          Sign Out
        </button>
      </div>
    </div>`;

  /* Avatar dropdown toggle */
  const avatarBtn = document.getElementById('nav-avatar-btn');
  const dropdown  = document.getElementById('nav-dropdown');
  avatarBtn?.addEventListener('click', e => {
    e.stopPropagation();
    const open = dropdown.classList.toggle('open');
    avatarBtn.setAttribute('aria-expanded', open);
    dropdown.setAttribute('aria-hidden', !open);
    /* Close notif if open */
    document.getElementById('notif-dropdown')?.classList.remove('open');
  });

  /* Notification dropdown */
  const notifBtn = document.getElementById('nav-notif-btn');
  const notifDD  = document.getElementById('notif-dropdown');
  notifBtn?.addEventListener('click', async e => {
    e.stopPropagation();
    const open = notifDD.classList.toggle('open');
    dropdown.classList.remove('open');
    if (open) await loadNotifications();
  });

  document.getElementById('notif-mark-read')?.addEventListener('click', async () => {
    await markNotificationsRead(currentProfile.id);
    const badge = notifBtn.querySelector('.notif-badge');
    if (badge) badge.remove();
    loadNotifications();
  });

  document.addEventListener('click', () => {
    dropdown?.classList.remove('open');
    notifDD?.classList.remove('open');
    avatarBtn?.setAttribute('aria-expanded','false');
  });

  /* Sign out */
  document.getElementById('nav-signout')?.addEventListener('click', async () => {
    await signOut();
    window.location.href = 'index.html';
  });

  async function loadNotifications() {
    const list = document.getElementById('notif-list');
    try {
      const notifs = await fetchNotifications(currentProfile.id);
      if (!notifs.length) {
        list.innerHTML = `<div style="text-align:center;padding:32px 16px;color:var(--text-muted);font-size:0.9rem;">No notifications yet</div>`;
        return;
      }
      list.innerHTML = notifs.map(n => `
        <a href="${n.resource_id ? 'resource.html?id='+n.resource_id : '#'}" class="notif-item ${n.is_read?'':'notif-unread'}">
          <div class="notif-icon notif-icon-${n.type}">
            ${n.type==='like'?'♥':n.type==='comment'?'💬':n.type==='approved'?'✓':'✕'}
          </div>
          <div class="notif-body">
            <div class="notif-msg">${n.message}</div>
            <div class="notif-time">${timeAgo(n.created_at)}</div>
          </div>
        </a>`).join('');
    } catch(e) {
      list.innerHTML = `<div style="color:var(--red);padding:16px;font-size:0.9rem;">Failed to load</div>`;
    }
  }
}

function timeAgo(iso) {
  if (!iso) return '';
  const d=Date.now()-new Date(iso).getTime(), m=Math.floor(d/60000), h=Math.floor(d/3600000), dy=Math.floor(d/86400000);
  if (m<1) return 'Just now'; if (m<60) return m+'m ago'; if (h<24) return h+'h ago'; return dy+'d ago';
}

export function isAdmin()   { return currentProfile?.role === 'admin'; }
export function isTeacher() { return ['teacher','admin'].includes(currentProfile?.role); }
export function isGuest()   { return !currentSession; }
