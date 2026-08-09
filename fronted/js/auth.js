document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const togglePassword = document.getElementById('togglePassword');
  const passwordInput = document.getElementById('password');
  const loginError = document.getElementById('loginError');
  const loginButton = document.getElementById('loginButton');
  const loginButtonText = document.getElementById('loginButtonText');
  const loginSpinner = document.getElementById('loginSpinner');

  togglePassword.addEventListener('click', () => {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    togglePassword.textContent = type === 'password' ? '👁' : '🙈';
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    loginError.style.display = 'none';
    loginButton.disabled = true;
    loginButtonText.style.display = 'none';
    loginSpinner.style.display = 'inline-block';

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login gagal');
      }

      if (data.data.role === 'owner') {
        window.location.href = 'owner.html';
      } else if (data.data.role === 'cashier') {
        window.location.href = 'cashier.html';
      } else {
        throw new Error('Role tidak dikenali');
      }
    } catch (error) {
      loginError.textContent = error.message;
      loginError.style.display = 'block';
    } finally {
      loginButton.disabled = false;
      loginButtonText.style.display = 'inline';
      loginSpinner.style.display = 'none';
    }
  });
});
