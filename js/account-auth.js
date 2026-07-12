'use strict';

//  ACCOUNT + TIER (Supabase-backed — server is the source of truth,
//  never localStorage. See supabase_setup.sql for the profiles table.)
// ═══════════════════════════════════════════════════════════
const SUPABASE_URL = 'https://hxaujqrsyvzojdpxyxvm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_yGfk_8pqqlbeGrfd9zyLSw_bkxBSRjb';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

state.session = null; // { user, ... } from Supabase, or null when logged out

// Free tier: furniture panel starts closed (no unprompted upsell). Once a
// choice is made via the toggle button, that choice persists either way.
const sidebarHiddenStored = localStorage.getItem('floorspacer_sidebar_hidden');
state.sidebarHidden = sidebarHiddenStored === null ? true : sidebarHiddenStored === '1';

async function refreshTierFromServer() {
  const { data: { session } } = await sb.auth.getSession();
  state.session = session;
  if (!session) {
    state.licenseUnlocked = false;
    applyTierGating();
    updateAccountUI();
    return;
  }
  const { data, error } = await sb
    .from('profiles')
    .select('tier')
    .eq('id', session.user.id)
    .single();
  state.licenseUnlocked = !error && data && data.tier === 'paid';
  applyTierGating();
  updateAccountUI();
}

async function signUp(email, password) {
  return sb.auth.signUp({ email, password });
}

async function signIn(email, password) {
  return sb.auth.signInWithPassword({ email, password });
}

async function signOut() {
  await sb.auth.signOut();
}

async function requestPasswordReset(email) {
  const redirectTo = location.origin + location.pathname;
  return sb.auth.resetPasswordForEmail(email, { redirectTo });
}

async function setNewPassword(newPassword) {
  return sb.auth.updateUser({ password: newPassword });
}

let inPasswordRecovery = false;

// The sb.auth.onAuthStateChange(...) registration lives in js/tooltips-init.js
// (right before INIT), not here — it calls applyTierGating()/updateAccountUI(),
// which aren't defined until later files load. Registering it this early was
// safe in the old single-inline-script version (no network gap between files),
// but with separate <script src> files there's now real time between this
// file executing and the later ones finishing, so registering it only once
// every file has loaded avoids a load-order race on Supabase's immediate
// initial-session callback fire.

// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
//  ACCOUNT MODAL
// ═══════════════════════════════════════════════════════════
const accountModalBackdrop = document.getElementById('account-modal-backdrop');

function openAccountModal(bannerMsg) {
  clearAccountModalBanner();
  if (typeof bannerMsg === 'string' && bannerMsg) showAccountModalBanner(bannerMsg);
  updateAccountUI();
  accountModalBackdrop.classList.add('show');
}
function closeAccountModal() {
  accountModalBackdrop.classList.remove('show');
  clearAccountModalBanner();
  inPasswordRecovery = false;
}

function showAccountModalBanner(msg) {
  const el = document.getElementById('account-modal-banner');
  el.textContent = msg;
  el.style.display = '';
}
function clearAccountModalBanner() {
  document.getElementById('account-modal-banner').style.display = 'none';
}

function updateAccountUI() {
  const loggedOut = document.getElementById('account-logged-out');
  const loggedIn = document.getElementById('account-logged-in');
  const resetPassword = document.getElementById('account-reset-password');
  const upgradeBtn = document.getElementById('account-upgrade-btn');
  const btnAccount = document.getElementById('btn-account');
  const btnAccountLabel = document.getElementById('btn-account-label');
  if (inPasswordRecovery) { resetPassword.style.display = ''; loggedOut.style.display = 'none'; loggedIn.style.display = 'none'; return; }
  resetPassword.style.display = 'none';
  if (state.session) {
    loggedOut.style.display = 'none';
    loggedIn.style.display = '';
    document.getElementById('account-email-display').textContent = state.session.user.email;
    document.getElementById('account-tier-display').textContent = state.licenseUnlocked ? 'Paid ✓' : 'Free';
    upgradeBtn.style.display = state.licenseUnlocked ? 'none' : '';
    btnAccountLabel.textContent = state.session.user.email.split('@')[0];
    btnAccount.classList.add('active');
  } else {
    loggedOut.style.display = '';
    loggedIn.style.display = 'none';
    btnAccountLabel.textContent = 'Account';
    btnAccount.classList.remove('active');
  }
}

function showPasswordResetForm() {
  document.getElementById('account-logged-out').style.display = 'none';
  document.getElementById('account-logged-in').style.display = 'none';
  document.getElementById('account-reset-password').style.display = '';
}

function showAccountError(msg) {
  showAccountModalBanner(msg);
}

document.getElementById('btn-account').addEventListener('click', () => openAccountModal());
document.getElementById('account-modal-close').addEventListener('click', closeAccountModal);
accountModalBackdrop.addEventListener('click', e => { if (e.target === accountModalBackdrop) closeAccountModal(); });

document.getElementById('account-signin-btn').addEventListener('click', async () => {
  const email = document.getElementById('account-email').value.trim();
  const password = document.getElementById('account-password').value;
  if (!email || !password) return showAccountError('Enter an email and password.');
  const { error } = await signIn(email, password);
  if (error) return showAccountError(error.message);
  clearAccountModalBanner();
  updateAccountUI();
});

document.getElementById('account-signup-btn').addEventListener('click', async () => {
  const email = document.getElementById('account-email').value.trim();
  const password = document.getElementById('account-password').value;
  if (!email || !password) return showAccountError('Enter an email and password.');
  if (password.length < 8) return showAccountError('Password must be at least 8 characters.');
  const { data, error } = await signUp(email, password);
  if (error) return showAccountError(error.message);
  // Supabase returns no error for an already-registered email (to avoid leaking
  // which emails exist) — an empty identities array is the tell for that case.
  if (data?.user && data.user.identities && data.user.identities.length === 0) {
    return showAccountError('An account with this email already exists. Try logging in, or use "Forgot password?" below.');
  }
  trackEvent('signup_completed');
  showAccountError('Check your email to confirm your account, then log in.');
});

document.getElementById('account-forgot-link').addEventListener('click', async (e) => {
  e.preventDefault();
  const email = document.getElementById('account-email').value.trim();
  if (!email) return showAccountError('Enter your email above first, then click "Forgot password?".');
  const { error } = await requestPasswordReset(email);
  if (error) return showAccountError(error.message);
  showAccountError('Check your email for a password reset link.');
});

document.getElementById('account-reset-password-btn').addEventListener('click', async () => {
  const newPassword = document.getElementById('account-new-password').value;
  if (!newPassword || newPassword.length < 8) return showAccountError('Password must be at least 8 characters.');
  const { error } = await setNewPassword(newPassword);
  if (error) return showAccountError(error.message);
  inPasswordRecovery = false;
  clearAccountModalBanner();
  document.getElementById('account-new-password').value = '';
  updateAccountUI();
  showAccountError('Password updated ✓ You are now logged in.');
});

document.getElementById('account-logout-btn').addEventListener('click', async () => {
  await signOut();
  updateAccountUI();
});

document.getElementById('account-upgrade-btn').addEventListener('click', () => startCheckout());

async function startCheckout() {
  trackEvent('checkout_started');
  const btn = document.getElementById('account-upgrade-btn');
  btn.disabled = true;
  btn.textContent = 'Redirecting to checkout…';
  try {
    const { data, error } = await sb.functions.invoke('create-checkout-session', {
      body: { origin: location.origin + location.pathname.replace(/index\.html$/, '').replace(/\/$/, '') },
    });
    if (error || !data?.url) throw error || new Error('No checkout URL returned');
    location.href = data.url;
  } catch (err) {
    console.error('Checkout error:', err);
    showAccountError('Could not start checkout. Please try again.');
    btn.disabled = false;
    btn.textContent = 'Unlock full version — €10';
  }
}

// Absorb webhook delivery lag after returning from Stripe Checkout.
if (new URLSearchParams(location.search).get('paid') === '1') {
  let attempts = 0;
  const poll = setInterval(async () => {
    await refreshTierFromServer();
    attempts++;
    if (state.licenseUnlocked) { trackEvent('purchase_completed'); clearInterval(poll); }
    else if (attempts >= 8) clearInterval(poll);
  }, 1500);
}

// ═══════════════════════════════════════════════════════════
