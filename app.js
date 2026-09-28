const sourcePath = document.body.dataset.promptSource || './prompts/gem-match.md';
const documentHost = document.querySelector('#prompt-document');
const statusLabel = document.querySelector('#load-status');
const copyButton = document.querySelector('#copy-prompt');
const toast = document.querySelector('#toast');
let promptMarkdown = '';
let toastTimer;

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r/g, '').split('\n');
  const output = [];
  let codeLines = [];
  let codeMode = false;
  let listType = '';
  let paragraph = [];
  const closeList = () => { if (listType) output.push(`</${listType}>`); listType = ''; };
  const closeParagraph = () => { if (paragraph.length) { output.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`); paragraph = []; } };
  const closeCode = () => { output.push(`<pre><button class="copy-snippet" type="button">复制本段</button><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`); codeLines = []; };

  for (const line of lines) {
    if (line.startsWith('```')) {
      closeParagraph(); closeList();
      if (codeMode) { closeCode(); codeMode = false; }
      else codeMode = true;
      continue;
    }
    if (codeMode) { codeLines.push(line); continue; }
    if (!line.trim()) { closeParagraph(); closeList(); continue; }
    if (/^---+$/.test(line.trim())) { closeParagraph(); closeList(); output.push('<hr class="doc-rule">'); continue; }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) { closeParagraph(); closeList(); const level = Math.min(heading[1].length, 2); output.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`); continue; }
    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    if (ordered || unordered) {
      closeParagraph(); const desired = ordered ? 'ol' : 'ul';
      if (listType && listType !== desired) closeList();
      if (!listType) { listType = desired; output.push(`<${listType}>`); }
      output.push(`<li>${inlineMarkdown((ordered || unordered)[1])}</li>`); continue;
    }
    closeList(); paragraph.push(line.trim());
  }
  closeParagraph(); closeList();
  if (codeMode) closeCode();
  return output.join('\n');
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

async function loadPrompt() {
  if (!documentHost) return;
  try {
    const response = await fetch(sourcePath, {cache: 'no-store'});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    promptMarkdown = await response.text();
    documentHost.innerHTML = renderMarkdown(promptMarkdown);
    statusLabel.textContent = '提示词已就绪 · 可直接复制或下载';
    copyButton.disabled = false;
  } catch (error) {
    statusLabel.textContent = '提示词加载失败';
    documentHost.innerHTML = '<div class="document-loading"><span class="loading-icon">✦</span><p>本地直接双击打开时，浏览器可能会拦截文件读取。<br>请用静态服务器预览，或直接点“下载 Markdown”。</p></div>';
  }
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch (error) {
    const helper = document.createElement('textarea');
    helper.value = value;
    helper.style.position = 'fixed'; helper.style.opacity = '0';
    document.body.appendChild(helper); helper.select();
    const copied = document.execCommand('copy'); helper.remove();
    return copied;
  }
}

copyButton?.addEventListener('click', async () => {
  const copied = await copyText(promptMarkdown);
  showToast(copied ? '完整提示词包已复制' : '复制未成功，请下载 Markdown 文件');
});

documentHost?.addEventListener('click', async event => {
  const button = event.target.closest('.copy-snippet');
  if (!button) return;
  const snippet = button.parentElement.querySelector('code')?.textContent ?? '';
  const copied = await copyText(snippet);
  showToast(copied ? '这一段提示词已复制' : '复制未成功，请下载 Markdown 文件');
});

loadPrompt();
