/* Login por PIN: aceita só dígitos e envia ao sexto. */
(() => {
  'use strict';
  const form = document.getElementById('pin-form');
  const input = document.getElementById('pin');
  if (!form || !input) return;
  const len = Number(input.getAttribute('maxlength')) || 6;
  let sent = false;
  input.addEventListener('input', () => {
    const digits = input.value.replace(/\D/g, '').slice(0, len);
    if (digits !== input.value) input.value = digits;
    if (digits.length === len && !sent) {
      sent = true;
      form.requestSubmit();
    }
  });
  form.addEventListener('submit', () => { sent = true; });
})();
