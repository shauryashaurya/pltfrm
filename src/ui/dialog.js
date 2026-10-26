// In-page confirm, passphrase and toast UI (browser alert/confirm/prompt are blocked in some hosts)
import { $ } from '../core/format.js';

// Open the shared <dialog> with a message and optional password field; resolves with the button pressed
function open({ title, message, okLabel = 'OK', cancelLabel = 'Cancel', password = false, danger = false }) {
  const dlg = $('appDialog');
  $('dlgTitle').textContent = title;
  $('dlgMessage').textContent = message;
  $('dlgInputRow').hidden = !password;
  $('dlgInput').value = '';
  $('dlgOk').textContent = okLabel;
  $('dlgOk').className = 'btn ' + (danger ? 'danger' : 'primary');
  $('dlgCancel').textContent = cancelLabel;
  $('dlgCancel').hidden = !cancelLabel;
  return new Promise(resolve => {
    const done = ok => { dlg.close ? dlg.close() : dlg.removeAttribute('open'); cleanup(); resolve({ ok, value: $('dlgInput').value }); };
    const onOk = e => { e.preventDefault(); done(true); };
    const onCancel = e => { e.preventDefault(); done(false); };
    const cleanup = () => { $('dlgForm').removeEventListener('submit', onOk); $('dlgCancel').removeEventListener('click', onCancel); dlg.removeEventListener('cancel', onCancel); };
    $('dlgForm').addEventListener('submit', onOk);
    $('dlgCancel').addEventListener('click', onCancel);
    dlg.addEventListener('cancel', onCancel);
    dlg.showModal ? dlg.showModal() : dlg.setAttribute('open', '');
    (password ? $('dlgInput') : $('dlgOk')).focus();
  });
}

export async function askConfirm(message, { title = 'Please confirm', okLabel = 'Confirm', danger = false } = {}) {
  return (await open({ title, message, okLabel, danger })).ok;
}

export async function askPassphrase() {
  const r = await open({ title: 'Unlock editing', message: 'Enter the editor passphrase to change this study.', okLabel: 'Unlock', password: true });
  return r.ok ? r.value : null;
}

// Short status message in the corner; replaces alert()
export function notify(message) {
  const t = $('toast');
  t.textContent = message;
  t.hidden = false;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => { t.hidden = true; }, 3200);
}
