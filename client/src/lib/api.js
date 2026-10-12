// Pembungkus fetch + upload dengan progress (XHR)
export class ApiError extends Error {
  constructor(message, status, errors) {
    super(message);
    this.status = status;
    this.errors = errors || {};
  }
}

async function parse(res) {
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* body kosong */
  }
  if (!res.ok) throw new ApiError(data?.error || `Permintaan gagal (${res.status})`, res.status, data?.errors);
  return data;
}

async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return parse(res);
}

export const api = {
  get: (u) => request('GET', u),
  post: (u, b) => request('POST', u, b ?? {}),
  put: (u, b) => request('PUT', u, b ?? {}),
  del: (u) => request('DELETE', u),
};

/** Upload multipart dengan callback progress (0..1). */
export function upload(method, url, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.withCredentials = true;
    xhr.responseType = 'json';
    if (onProgress && xhr.upload) xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      const data = xhr.response;
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new ApiError(data?.error || `Upload gagal (${xhr.status})`, xhr.status, data?.errors));
    };
    xhr.onerror = () => reject(new ApiError('Koneksi terputus saat mengunggah.', 0));
    xhr.send(formData);
  });
}

export const formatBytes = (n = 0) => {
  if (n < 1024) return `${n} B`;
  const u = ['KB', 'MB', 'GB', 'TB'];
  let i = -1;
  do {
    n /= 1024;
    i += 1;
  } while (n >= 1024 && i < u.length - 1);
  return `${n.toFixed(n >= 10 ? 0 : 1)} ${u[i]}`;
};

export const formatDate = (s) => {
  if (!s) return '-';
  const d = new Date(s.replace(' ', 'T') + 'Z');
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};
