// The server remains authoritative; this setting explains its current upload limit.
window.storageSettings = fetch('/api/storage/config')
    .then(response => { if (!response.ok) throw new Error('Storage settings unavailable'); return response.json(); })
    .then(settings => {
        document.querySelectorAll('.application-file-hint, .resume-file-name').forEach(el => {
            if (el.textContent.includes('up to 10 MB')) el.textContent = el.textContent.replace('up to 10 MB', `up to ${settings.maxUploadBytes / 1024 / 1024} MB`);
        });
        return settings;
    })
    .catch(() => ({ maxUploadBytes: 1.5 * 1024 * 1024 }));
