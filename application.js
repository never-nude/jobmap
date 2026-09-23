// Private by default: files never leave this browser. Sending reviewed text to the
// configured backend requires the explicit Generate draft action below.
const STORAGE_KEY = 'jobmap.profile.v1';
const MAX_TEXT = 30000;
const MAX_DRAFT_TEXT = 16000;
let endpoint = '', dialog, activeJob = null, returnFocus, pending, filePending, originalFile;
let profile = { text: '', linkedin: '', remember: false };
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  if (saved && typeof saved.text === 'string') profile = { text: saved.text.slice(0, MAX_TEXT), linkedin: String(saved.linkedin || '').slice(0, 500), remember: true };
} catch { /* Storage may be disabled; the editor still works. */ }
const el = id => dialog.querySelector(`#${id}`);
const safeUrl = value => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; } };

export function configureApplications({ endpoint: next = '' } = {}) {
  const value = String(next).replace(/\/+$/, '');
  endpoint = value && (value.startsWith('https://') || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(value)) ? value : '';
  if (dialog) updateAvailability();
}

export function openApplication(job = null) {
  ensureDialog();
  if (pending || filePending) return;
  activeJob = job;
  el('application-job-title').textContent = job ? job.title : 'Your application profile';
  el('application-job-company').textContent = job ? `${job.company} · ${job.location || 'See employer listing'}` : 'A private workspace for your CV and cover letters.';
  const url = safeUrl(job?.applyUrl || job?.url);
  el('application-apply').hidden = !url;
  el('application-apply').href = url || '#';
  el('application-letter').value = '';
  el('application-notes').value = '';
  el('application-draft-output').hidden = true;
  el('application-generation').hidden = !job;
  el('application-status').textContent = '';
  el('application-profile').value = profile.text;
  el('application-linkedin').value = profile.linkedin;
  el('application-remember').checked = profile.remember;
  el('application-reviewed').checked = false;
  updateAvailability();
  returnFocus = document.activeElement;
  if (!dialog.open) dialog.showModal();
  requestAnimationFrame(() => el('application-profile').focus());
}

function ensureDialog() {
  if (dialog) return;
  dialog = document.createElement('dialog');
  dialog.className = 'application-dialog';
  dialog.setAttribute('aria-labelledby', 'application-job-title');
  dialog.innerHTML = `
    <div class="application-head"><div><div class="application-kicker">JOBS FOR DAVE · APPLICATION WORKSPACE</div><h2 id="application-job-title"></h2><p id="application-job-company"></p></div><button type="button" class="application-close" id="application-close" aria-label="Close application workspace">×</button></div>
    <div class="application-body">
      <p class="application-privacy">Your CV file stays on this device. Review the extracted text before generating a draft. Nothing is sent to employers from this workspace.</p>
      <label class="application-file" for="application-file"><strong>Choose your CV</strong><span>PDF, DOCX, TXT or Markdown · up to 5 MB</span><input id="application-file" type="file" accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"></label>
      <p class="application-help" id="application-file-status" role="status">Text-based PDFs and Word documents work here. For a scanned PDF, paste the text below.</p>
      <label class="application-label" for="application-profile">Your CV / LinkedIn profile text <span>Editable · trim to 16,000 characters before generating</span></label>
      <textarea id="application-profile" rows="9" maxlength="30000" autocomplete="off" placeholder="Paste your experience, projects, education and skills. Include the energy work you want to highlight."></textarea>
      <label class="application-label" for="application-linkedin">LinkedIn profile URL <span>Optional; added as a reference, never scraped</span></label>
      <input id="application-linkedin" type="url" maxlength="500" autocomplete="off" placeholder="https://www.linkedin.com/in/…">
      <p class="application-help">To include LinkedIn experience, paste its text above or choose an exported PDF. A URL alone does not import your profile.</p>
      <div class="application-storage"><label><input type="checkbox" id="application-remember"> Remember this profile on this device</label><button type="button" id="application-forget" class="application-text-button">Clear profile</button></div>
      <p class="application-help">Remembering saves the text and LinkedIn URL in this browser. Only use it on your own device. The original file, access code and generated letters are never saved by this page.</p>
      <section id="application-generation" aria-label="Draft a cover letter">
        <label class="application-label" for="application-notes">What should this letter emphasize? <span>Optional · 2,000 characters maximum</span></label><textarea id="application-notes" rows="3" maxlength="2000" placeholder="For example: transferable energy-sector experience, thermal systems, or hands-on commissioning. Include only experience you actually have."></textarea>
        <div id="application-access-wrap"><label class="application-label" for="application-access">Private drafting access code</label><input id="application-access" type="password" autocomplete="off" spellcheck="false" placeholder="Provided by the site owner">
        <p class="application-help">The code is held only while this page is open. It is not an AI provider API key.</p></div>
        <label class="application-review"><input id="application-reviewed" type="checkbox"> I reviewed the profile text and want to send it, these job details and my notes to the Cloudflare backend to generate a draft.</label>
        <p class="application-availability" id="application-availability"></p>
        <div class="application-actions"><button type="button" id="application-generate" class="application-primary">Generate cover letter</button><button type="button" id="application-cancel" hidden>Cancel generation</button></div>
      </section>
      <p id="application-status" class="application-status" role="status" aria-live="polite"></p>
      <section id="application-draft-output" hidden aria-label="Your cover letter draft"><label class="application-label" for="application-letter">Your draft <span>Edit and verify every claim before using it</span></label><textarea id="application-letter" rows="14" maxlength="20000"></textarea><p class="application-help">A draft can contain mistakes. Check names, qualifications and examples. Applications are completed on the employer’s website.</p><div class="application-actions"><button type="button" id="application-copy">Copy letter</button><button type="button" id="application-download">Download .txt</button></div></section>
      <a id="application-apply" class="application-employer" target="_blank" rel="noopener noreferrer">Continue on employer site ↗</a>
    </div>`;
  document.body.append(dialog);
  el('application-close').onclick = () => dialog.close();
  dialog.addEventListener('cancel', event => event.stopPropagation());
  // Keep Escape local: the map underneath has its own Escape handler.
  dialog.addEventListener('keydown', event => { if (event.key === 'Escape') event.stopPropagation(); });
  dialog.addEventListener('close', () => {
    pending?.abort(); filePending?.abort(); pending = filePending = null;
    setBusy(false); originalFile = null; el('application-file').value = '';
    el('application-file-status').textContent = 'Files stay on this device. Choose a file again to re-extract it.';
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  });
  el('application-profile').addEventListener('input', () => { profile.text = el('application-profile').value; el('application-reviewed').checked = false; persist(); });
  el('application-linkedin').addEventListener('input', () => { profile.linkedin = el('application-linkedin').value; el('application-reviewed').checked = false; persist(); });
  el('application-remember').onchange = () => { profile.remember = el('application-remember').checked; persist(); };
  el('application-forget').onclick = () => {
    filePending?.abort(); filePending = null;
    profile = { text: '', linkedin: '', remember: false }; originalFile = null;
    el('application-profile').value = ''; el('application-linkedin').value = ''; el('application-file').value = ''; el('application-remember').checked = false; el('application-reviewed').checked = false;
    el('application-letter').value = ''; el('application-draft-output').hidden = true;
    el('application-file-status').textContent = 'Profile cleared from this page and this browser’s saved storage.';
    persist(); updateAvailability();
  };
  el('application-file').onchange = readFile;
  el('application-generate').onclick = generate;
  el('application-cancel').onclick = () => pending?.abort();
  el('application-copy').onclick = async () => { try { await navigator.clipboard.writeText(el('application-letter').value); status('Letter copied.'); } catch { el('application-letter').focus(); el('application-letter').select(); status('Select and copy the letter using your device’s copy command.'); } };
  el('application-download').onclick = () => {
    const url = URL.createObjectURL(new Blob([el('application-letter').value], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `Cover letter - ${String(activeJob?.company || 'draft').replace(/[^a-zA-Z0-9 ._-]/g, '').slice(0, 70)}.txt`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
}
function status(message, error = false) { el('application-status').textContent = message; el('application-status').classList.toggle('error', error); }
function persist() {
  try { if (profile.remember) localStorage.setItem(STORAGE_KEY, JSON.stringify({ text: profile.text, linkedin: profile.linkedin })); else localStorage.removeItem(STORAGE_KEY); }
  catch { status('Your browser could not save this profile. It will remain available only while this page is open.', true); }
}
function updateAvailability() {
  el('application-availability').textContent = endpoint ? 'Generates an editable draft using Cloudflare. Review it before you apply.' : 'Cover-letter drafting will be available once Cloudflare is connected. You can prepare your profile now.';
  el('application-generate').disabled = !endpoint || !!pending || !!filePending;
  el('application-access').disabled = !endpoint;
  el('application-access-wrap').hidden = !endpoint;
}
function setBusy(value) {
  el('application-generate').textContent = value ? 'Drafting…' : 'Generate cover letter';
  el('application-cancel').hidden = !value;
  for (const id of ['application-file', 'application-profile', 'application-linkedin', 'application-notes', 'application-forget', 'application-remember', 'application-reviewed']) el(id).disabled = value;
  updateAvailability();
}
async function generate() {
  if (!activeJob || !endpoint || pending || filePending) return;
  const text = el('application-profile').value.trim(), linkedin = el('application-linkedin').value.trim();
  if (text.length < 100) { status('Add at least 100 characters of your experience before generating a letter.', true); el('application-profile').focus(); return; }
  if (linkedin && !/^https:\/\/(?:[a-z]{2,3}\.)?(?:www\.)?linkedin\.com\//i.test(linkedin)) { status('Use a full https://www.linkedin.com/ profile URL, or leave it blank.', true); el('application-linkedin').focus(); return; }
  const profileText = `${text}${linkedin ? `\n\nLinkedIn: ${linkedin}` : ''}`;
  if (profileText.length > MAX_DRAFT_TEXT) { status('Trim the profile text to 16,000 characters, including the LinkedIn reference, before generating a draft.', true); el('application-profile').focus(); return; }
  if (!el('application-reviewed').checked) { status('Review your profile text, then select the consent checkbox.', true); el('application-reviewed').focus(); return; }
  const access = el('application-access').value.trim();
  if (!access) { status('Enter the site’s private drafting access code.', true); el('application-access').focus(); return; }
  const body = JSON.stringify({ profileText, job: { id: activeJob.id, title: activeJob.title, company: activeJob.company, url: safeUrl(activeJob.url || activeJob.applyUrl) }, notes: el('application-notes').value.trim() });
  if (new TextEncoder().encode(body).byteLength > 32768) { status('Your profile and notes contain too much text for one draft. Shorten them and try again.', true); return; }
  const request = new AbortController(); pending = request; setBusy(true);
  const timeout = setTimeout(() => request.abort('timeout'), 60000);
  status('Generating a draft from the profile and job details you reviewed…');
  el('application-draft-output').hidden = true;
  try {
    const response = await fetch(`${endpoint}/api/draft`, { method: 'POST', mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access}` }, body, signal: request.signal });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(response.status === 401 || response.status === 403 ? 'The access code was not accepted. Check it and try again.' : response.status === 429 ? 'Drafting is temporarily rate-limited. Please try again later.' : String(result.error || 'Drafting is unavailable right now. Please try again.').slice(0, 400));
    const letter = result.letter || result.draft || result.coverLetter;
    if (typeof letter !== 'string' || !letter.trim() || letter.length > 20000) throw Error('The backend returned an unreadable draft. Please try again.');
    if (!dialog.open || pending !== request) return;
    el('application-letter').value = letter.trim(); el('application-draft-output').hidden = false;
    status('Your draft is ready. Edit it and verify the details before applying.'); el('application-letter').focus();
  } catch (error) {
    if (dialog.open && pending === request) status(request.signal.aborted ? (request.signal.reason === 'timeout' ? 'Generation took too long. Please try again.' : 'Generation canceled.') : error.message === 'Failed to fetch' ? 'Could not reach the drafting backend. Check your connection or try again later.' : error.message, true);
  } finally { clearTimeout(timeout); if (pending === request) { pending = null; setBusy(false); } }
}

async function readFile() {
  const file = el('application-file').files?.[0]; if (!file) return;
  filePending?.abort(); const controller = new AbortController(); filePending = controller; originalFile = file; updateAvailability();
  el('application-file-status').textContent = `Reading ${file.name} on this device…`;
  try {
    if (file.size > 5 * 1024 * 1024) throw Error('Choose a CV smaller than 5 MB, or paste its text below.');
    let text;
    if (/\.(txt|md)$/i.test(file.name)) text = await file.text();
    else if (/\.docx$/i.test(file.name)) text = await readDocx(await file.arrayBuffer(), controller.signal);
    else if (/\.pdf$/i.test(file.name)) text = await readPdf(await file.arrayBuffer(), controller.signal);
    else throw Error('Supported formats are PDF, DOCX, TXT and Markdown. Export legacy .doc files as .docx or PDF first.');
    if (controller.signal.aborted || filePending !== controller) return;
    text = text.replace(/\u0000/g, '').trim();
    if (text.length < 40) throw Error('This file did not contain enough readable text. For a scanned PDF, paste the CV text below.');
    if (text.length > MAX_TEXT) throw Error('This file has more than 30,000 characters. Paste the relevant CV sections instead.');
    profile.text = text; el('application-profile').value = text; el('application-reviewed').checked = false; persist();
    el('application-file-status').textContent = `${file.name} · ${text.length.toLocaleString()} characters extracted. Review the text below; document formatting is not preserved.${text.length > MAX_DRAFT_TEXT ? ' Trim to 16,000 characters before generating.' : ''}`;
  } catch (error) { if (!controller.signal.aborted && filePending === controller) el('application-file-status').textContent = error.message || 'Could not read this file. Paste its text below instead.'; }
  finally { if (filePending === controller) { filePending = null; updateAvailability(); } }
}
function checkDocxSize(buffer) {
  const view = new DataView(buffer);
  let end = -1;
  for (let i = view.byteLength - 22; i >= Math.max(0, view.byteLength - 65557); i--) if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  if (end < 0) throw Error('This is not a readable DOCX file. Try exporting it again.');
  const count = view.getUint16(end + 10, true); let pos = view.getUint32(end + 16, true), total = 0;
  if (count > 2000) throw Error('This document is too complex. Export it as a text PDF or paste the text.');
  for (let i = 0; i < count; i++) {
    if (pos + 46 > view.byteLength || view.getUint32(pos, true) !== 0x02014b50) throw Error('This Word document appears to be damaged.');
    total += view.getUint32(pos + 24, true);
    if (total > 25 * 1024 * 1024) throw Error('This document expands to more than 25 MB. Export a smaller CV or paste its text.');
    pos += 46 + view.getUint16(pos + 28, true) + view.getUint16(pos + 30, true) + view.getUint16(pos + 32, true);
  }
}
function readDocx(buffer, signal) {
  checkDocxSize(buffer);
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./vendor/profile/extract-worker.js', import.meta.url));
    const finish = (error, text) => { clearTimeout(timer); signal.removeEventListener('abort', cancel); worker.terminate(); error ? reject(error) : resolve(text); };
    const cancel = () => finish(Error('Extraction canceled.'));
    const timer = setTimeout(() => finish(Error('This file took too long to read. Paste the CV text below.')), 20000);
    signal.addEventListener('abort', cancel, { once: true });
    worker.onmessage = ({ data }) => finish(data.error ? Error(data.error) : null, data.text);
    worker.onerror = () => finish(Error('Could not read this Word document. Paste the CV text below.'));
    worker.postMessage(buffer, [buffer]);
    if (signal.aborted) cancel();
  });
}
async function readPdf(buffer, signal) {
  const pdfjs = await import('./vendor/profile/pdf.min.mjs');
  if (signal.aborted) throw Error('Extraction canceled.');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/profile/pdf.worker.min.mjs', import.meta.url).href;
  const task = pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, disableFontFace: true, useSystemFonts: true, useWorkerFetch: false, stopAtErrors: true });
  let timedOut = false;
  const cancel = () => { task.destroy().catch(() => {}); };
  const timer = setTimeout(() => { timedOut = true; cancel(); }, 20000);
  signal.addEventListener('abort', cancel, { once: true });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 20) throw Error('Choose a CV with 20 pages or fewer, or paste the relevant text.');
    let text = '';
    for (let number = 1; number <= pdf.numPages; number++) {
      if (signal.aborted) throw Error('Extraction canceled.');
      const page = await pdf.getPage(number), content = await page.getTextContent();
      text += content.items.map(item => item.str ? `${item.str}${item.hasEOL ? '\n' : ' '}` : '').join('') + '\n\n';
      page.cleanup();
      if (text.length > MAX_TEXT) throw Error('This PDF has too much text. Paste the relevant CV sections instead.');
    }
    return text;
  } catch (error) { if (timedOut) throw Error('This PDF took too long to read. Paste the CV text instead.'); if (error.name === 'PasswordException') throw Error('This PDF is password-protected. Choose an unlocked copy or paste its text.'); throw error; }
  finally { clearTimeout(timer); signal.removeEventListener('abort', cancel); await task.destroy().catch(() => {}); }
}
