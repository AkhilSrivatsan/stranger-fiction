// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SUBCATEGORIES = {
  fiction: ['After Forever', 'Stories'],
  music: ['Releases', 'Sonic Pi experiments'],
  reviews: ['Music', 'Cinema & TV', 'New Media'],
};

// In production, API calls go to the Vercel deployment.
// Detect automatically: if we're on localhost, use localhost; otherwise use the Vercel URL.
// The Vercel URL will be set after deployment.
const API_BASE = window.location.hostname === 'localhost' ? '' : (window.CMS_API_BASE || '');

let cmsPassword = '';
let editingPath = null; // tracks if we're editing an existing post
let previewVisible = false;
let allDrafts = [];
let allPublished = [];

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
function attemptLogin() {
  const pw = document.getElementById('password').value;
  if (!pw) return;
  cmsPassword = pw;
  localStorage.setItem('cms_password', pw);
  document.getElementById('login').style.display = 'none';
  document.getElementById('editor').style.display = 'block';
  setTodayDate();
}

// Auto-login if password was stored
(function() {
  const saved = localStorage.getItem('cms_password');
  if (saved) {
    cmsPassword = saved;
    document.getElementById('login').style.display = 'none';
    document.getElementById('editor').style.display = 'block';
    setTodayDate();
  }
  // Enter key on password field
  document.getElementById('password').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') attemptLogin();
  });
})();

function setTodayDate() {
  const d = new Date();
  const iso = d.toISOString().split('T')[0];
  document.getElementById('date').value = iso;
}

// ---------------------------------------------------------------------------
// Category / subcategory
// ---------------------------------------------------------------------------
document.getElementById('category').addEventListener('change', function() {
  const cat = this.value;
  const subField = document.getElementById('subcategory-field');
  const subSelect = document.getElementById('subcategory');
  const subCustom = document.getElementById('subcategory-custom');

  if (SUBCATEGORIES[cat] || cat) {
    subSelect.innerHTML = '<option value="">Subcategory</option>';
    if (SUBCATEGORIES[cat]) {
      for (const s of SUBCATEGORIES[cat]) {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        subSelect.appendChild(opt);
      }
    }
    // Always add "+ New" option
    const newOpt = document.createElement('option');
    newOpt.value = '__new__';
    newOpt.textContent = '+ New subcategory';
    subSelect.appendChild(newOpt);
    subField.style.display = '';
    subCustom.style.display = 'none';
    subCustom.value = '';
  } else {
    subField.style.display = 'none';
    subSelect.innerHTML = '<option value="">Subcategory</option>';
    subCustom.style.display = 'none';
    subCustom.value = '';
  }
});

document.getElementById('subcategory').addEventListener('change', function() {
  const subCustom = document.getElementById('subcategory-custom');
  if (this.value === '__new__') {
    subCustom.style.display = '';
    subCustom.focus();
  } else {
    subCustom.style.display = 'none';
    subCustom.value = '';
  }
});

// ---------------------------------------------------------------------------
// Slug generation
// ---------------------------------------------------------------------------
function makeSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

// ---------------------------------------------------------------------------
// Markdown toolbar
// ---------------------------------------------------------------------------
function insertMd(before, after) {
  const ta = document.getElementById('body');
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const selected = ta.value.substring(start, end);
  const replacement = before + (selected || 'text') + after;
  ta.value = ta.value.substring(0, start) + replacement + ta.value.substring(end);
  ta.focus();
  ta.selectionStart = start + before.length;
  ta.selectionEnd = start + before.length + (selected || 'text').length;
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------
function togglePreview() {
  const ta = document.getElementById('body');
  const pv = document.getElementById('preview');
  const btn = document.getElementById('preview-toggle');

  previewVisible = !previewVisible;
  if (previewVisible) {
    // Simple markdown-to-HTML (basic conversion for preview)
    pv.innerHTML = simpleMarkdown(ta.value);
    ta.style.display = 'none';
    pv.style.display = 'block';
    btn.textContent = 'Edit';
  } else {
    ta.style.display = 'block';
    pv.style.display = 'none';
    btn.textContent = 'Preview';
  }
}

function simpleMarkdown(md) {
  // Basic markdown rendering for preview — handles common cases
  let html = md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^---$/gm, '<hr>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
  return '<p>' + html + '</p>';
}

// ---------------------------------------------------------------------------
// Image upload
// ---------------------------------------------------------------------------
document.getElementById('image-input').addEventListener('change', handleImageSelect);

// Drag and drop on the textarea
const bodyEl = document.getElementById('body');
bodyEl.addEventListener('dragover', function(e) {
  e.preventDefault();
  document.querySelector('.editor-field').classList.add('drag-over');
});
bodyEl.addEventListener('dragleave', function() {
  document.querySelector('.editor-field').classList.remove('drag-over');
});
bodyEl.addEventListener('drop', function(e) {
  e.preventDefault();
  document.querySelector('.editor-field').classList.remove('drag-over');
  if (e.dataTransfer.files.length > 0) {
    uploadImages(e.dataTransfer.files);
  }
});

function handleImageSelect(e) {
  if (e.target.files.length > 0) {
    uploadImages(e.target.files);
  }
}

async function uploadImages(files) {
  const title = document.getElementById('title').value;
  if (!title) {
    setStatus('Enter a title before uploading images.');
    return;
  }
  const slug = makeSlug(title);
  const ta = document.getElementById('body');

  for (const file of files) {
    setStatus(`Uploading ${file.name}...`);
    try {
      const base64 = await fileToBase64(file);
      const res = await fetch(API_BASE + '/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: cmsPassword,
          slug: slug,
          filename: file.name,
          data: base64,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(`Upload failed: ${data.error}`);
        return;
      }
      // Insert markdown image at cursor
      const imgMd = `![${file.name}](${data.markdownPath})\n`;
      const pos = ta.selectionStart;
      ta.value = ta.value.substring(0, pos) + imgMd + ta.value.substring(pos);
      ta.selectionStart = ta.selectionEnd = pos + imgMd.length;
      setStatus(`Uploaded ${file.name}`);
    } catch (err) {
      setStatus(`Upload error: ${err.message}`);
    }
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Strip the data URL prefix to get raw base64
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------------------
// Publish / Draft
// ---------------------------------------------------------------------------
function getFormData() {
  const title = document.getElementById('title').value.trim();
  const category = document.getElementById('category').value;
  let subcategory = document.getElementById('subcategory').value;
  if (subcategory === '__new__') {
    subcategory = document.getElementById('subcategory-custom').value.trim();
  }
  const date = document.getElementById('date').value;
  const description = document.getElementById('description').value.trim();
  const body = document.getElementById('body').value;
  const email = document.getElementById('email-subscribers').checked;

  if (!title) { setStatus('Title is required.'); return null; }
  if (!category) { setStatus('Category is required.'); return null; }

  const slug = makeSlug(title);
  return { title, category, subcategory, date, description, body, slug, email, password: cmsPassword };
}

async function publish() {
  const data = getFormData();
  if (!data) return;

  document.getElementById('publish-btn').disabled = true;
  setStatus('Publishing...');

  try {
    const res = await fetch(API_BASE + '/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) {
      setStatus(`Error: ${result.error}`);
    } else {
      setStatus('Published! Site will rebuild in ~1 min.');
      editingPath = `content/${data.category}/${data.slug}.md`;
      document.getElementById('editor-heading').textContent = 'Editing: ' + data.title;
      document.getElementById('delete-btn').style.display = '';
    }
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
  document.getElementById('publish-btn').disabled = false;
}

async function saveDraft() {
  const data = getFormData();
  if (!data) return;

  document.getElementById('draft-btn').disabled = true;
  setStatus('Saving draft...');

  try {
    const res = await fetch(API_BASE + '/api/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) {
      setStatus(`Error: ${result.error}`);
    } else {
      setStatus('Draft saved.');
      editingPath = result.path;
      document.getElementById('delete-btn').style.display = '';
    }
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
  document.getElementById('draft-btn').disabled = false;
}

// ---------------------------------------------------------------------------
// Load existing posts
// ---------------------------------------------------------------------------
async function loadPosts() {
  setStatus('Loading posts...');
  try {
    const res = await fetch(API_BASE + '/api/posts', {
      headers: { 'X-CMS-Password': cmsPassword },
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        setStatus('Invalid password. Please refresh and try again.');
        localStorage.removeItem('cms_password');
        return;
      }
      setStatus(`Error: ${data.error}`);
      return;
    }

    allDrafts = data.drafts;
    allPublished = data.published.slice().reverse();

    document.getElementById('post-search').style.display = '';
    document.getElementById('post-search-input').value = '';
    document.getElementById('load-posts-btn').style.display = 'none';
    renderPostList(allDrafts, allPublished);
    setStatus('');
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
}

function renderPostList(drafts, published) {
  const draftsEl = document.getElementById('drafts');
  const draftsHead = document.getElementById('drafts-heading');
  draftsEl.innerHTML = '';
  if (drafts.length > 0) {
    draftsHead.style.display = '';
    for (const d of drafts) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.textContent = d.slug.replace(/-/g, ' ');
      a.href = '#';
      a.onclick = function(e) { e.preventDefault(); loadPost(d.path); };
      li.appendChild(a);
      const span = document.createElement('span');
      span.className = 'post-cat';
      span.textContent = d.category;
      li.appendChild(span);
      draftsEl.appendChild(li);
    }
  } else {
    draftsHead.style.display = 'none';
  }

  const pubEl = document.getElementById('published');
  const pubHead = document.getElementById('published-heading');
  pubEl.innerHTML = '';
  if (published.length > 0) {
    pubHead.style.display = '';
    for (const p of published) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.textContent = p.slug.replace(/-/g, ' ');
      a.href = '#';
      a.onclick = function(e) { e.preventDefault(); loadPost(p.path); };
      li.appendChild(a);
      const span = document.createElement('span');
      span.className = 'post-cat';
      span.textContent = p.category;
      li.appendChild(span);
      pubEl.appendChild(li);
    }
  } else {
    pubHead.style.display = 'none';
  }
}

function filterPosts() {
  const q = document.getElementById('post-search-input').value.toLowerCase().trim();
  if (!q) {
    renderPostList(allDrafts, allPublished);
    return;
  }
  const matchDrafts = allDrafts.filter(d =>
    d.slug.replace(/-/g, ' ').includes(q) || d.category.includes(q)
  );
  const matchPub = allPublished.filter(p =>
    p.slug.replace(/-/g, ' ').includes(q) || p.category.includes(q)
  );
  renderPostList(matchDrafts, matchPub);
}

async function loadPost(filePath) {
  setStatus('Loading...');
  try {
    const res = await fetch(API_BASE + '/api/posts?file=' + encodeURIComponent(filePath), {
      headers: { 'X-CMS-Password': cmsPassword },
    });
    const data = await res.json();
    if (!res.ok) {
      setStatus(`Error: ${data.error}`);
      return;
    }

    const fm = data.frontmatter;
    document.getElementById('title').value = fm.title || '';
    document.getElementById('description').value = fm.description || '';
    document.getElementById('body').value = data.body || '';

    // Set category
    const catMatch = filePath.match(/content\/(?:_drafts\/)?(\w+)\//);
    if (catMatch) {
      document.getElementById('category').value = catMatch[1];
      document.getElementById('category').dispatchEvent(new Event('change'));
    }

    if (fm.subcategory) {
      // Wait a tick for subcategory dropdown to populate
      setTimeout(function() {
        document.getElementById('subcategory').value = fm.subcategory;
      }, 50);
    }

    if (fm.date) {
      // Try to parse into YYYY-MM-DD for the date input
      const d = new Date(fm.date);
      if (!isNaN(d)) {
        document.getElementById('date').value = d.toISOString().split('T')[0];
      } else {
        document.getElementById('date').value = fm.date;
      }
    }

    editingPath = filePath;
    document.getElementById('editor-heading').textContent = 'Editing: ' + (fm.title || filePath);
    document.getElementById('delete-btn').style.display = '';

    // Ensure we're in edit mode, not preview
    if (previewVisible) togglePreview();

    setStatus('Loaded.');
    window.scrollTo(0, 0);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------
async function deletePost() {
  if (!editingPath) {
    setStatus('No post loaded to delete.');
    return;
  }
  if (!confirm('Delete this post? This cannot be undone.')) return;

  document.getElementById('delete-btn').disabled = true;
  setStatus('Deleting...');

  try {
    const res = await fetch(API_BASE + '/api/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: cmsPassword, filePath: editingPath }),
    });
    const result = await res.json();
    if (!res.ok) {
      setStatus(`Error: ${result.error}`);
    } else {
      setStatus('Deleted. Site will rebuild in ~1 min.');
      resetEditor();
    }
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
  document.getElementById('delete-btn').disabled = false;
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------
function resetEditor() {
  document.getElementById('title').value = '';
  document.getElementById('category').value = '';
  document.getElementById('category').dispatchEvent(new Event('change'));
  document.getElementById('description').value = '';
  document.getElementById('body').value = '';
  document.getElementById('email-subscribers').checked = false;
  editingPath = null;
  document.getElementById('editor-heading').textContent = 'New post';
  document.getElementById('delete-btn').style.display = 'none';
  setTodayDate();
  if (previewVisible) togglePreview();
  setStatus('');
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------
function setStatus(msg) {
  document.getElementById('status').textContent = msg;
}
