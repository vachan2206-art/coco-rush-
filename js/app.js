'use strict';

// Ensure data layer is initialized
CR.init();

const App = (() => {

  function toast(msg, type = 'ok') {
    const wrap = document.getElementById('toast-wrap');
    if (!wrap) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    t.innerHTML = `<span style="margin-right:8px">${type === 'ok' ? '✅' : '❌'}</span> ${msg}`;
    wrap.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }

  function checkSession() {
    return CR.getSession();
  }

  function requireAuth(role) {
    const s = checkSession();
    if (!s) {
      window.location.href = 'index.html';
      return null;
    }
    if (role && s.role !== role && s.role !== 'owner') { 
      // owner can view salesman pages if needed, but usually strict
      if (s.role !== role) {
         window.location.href = s.role === 'owner' ? 'owner.html' : 'salesman.html';
         return null;
      }
    }
    return s;
  }

  function logout() {
    CR.clearSession();
    window.location.href = 'index.html';
  }

  function setupAuthForm() {
    const form = document.getElementById('login-form');
    if (!form) return;

    // Check if already logged in
    const s = checkSession();
    if (s) {
      window.location.href = s.role === 'owner' ? 'owner.html' : 'salesman.html';
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const em = document.getElementById('email').value.trim();
      const pw = document.getElementById('password').value;
      const errBox = document.getElementById('err-msg');

      const user = CR.getUserByEmail(em);
      if (!user || user.password !== pw) {
        errBox.textContent = 'Invalid email or password';
        errBox.classList.add('show');
        return;
      }

      errBox.classList.remove('show');
      CR.setSession(user);
      
      if (user.role === 'owner') {
        window.location.href = 'owner.html';
      } else {
        window.location.href = 'salesman.html';
      }
    });
    
    // Toggle password visibility
    const eye = document.getElementById('toggle-pw');
    if(eye) {
        eye.addEventListener('click', () => {
            const pwInput = document.getElementById('password');
            if(pwInput.type === 'password') {
                pwInput.type = 'text';
                eye.textContent = '👁️';
            } else {
                pwInput.type = 'password';
                eye.textContent = '👁️‍🗨️';
            }
        });
    }
  }

  return { toast, checkSession, requireAuth, logout, setupAuthForm };
})();

document.addEventListener('DOMContentLoaded', () => {
  App.setupAuthForm();
});
