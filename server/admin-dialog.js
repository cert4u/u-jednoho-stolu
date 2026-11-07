// In-page dialogs work in embedded browsers that do not implement prompt/confirm.
(() => {
    const dialog = document.getElementById('admin-dialog'), form = document.getElementById('admin-dialog-form');
    const fields = document.getElementById('admin-dialog-fields');
    let pending;
    function finish(value) { if (!pending)
        return; const resolve = pending; pending = undefined; dialog.close(); resolve(value); }
    form.addEventListener('submit', event => { event.preventDefault(); if (form.reportValidity())
        finish(Object.fromEntries(new FormData(form))); });
    document.getElementById('admin-dialog-cancel').onclick = () => finish(null);
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(null); });
    dialog.addEventListener('close', () => { if (!dialog.open && pending)
        finish(null); });
    window.stulAdminDialog = {
        ask({ title, message = '', fields: definitions = [], submit = 'Pokračovat' }) {
            if (pending)
                return Promise.resolve(null);
            document.getElementById('admin-dialog-title').textContent = title;
            document.getElementById('admin-dialog-message').textContent = message;
            document.getElementById('admin-dialog-submit').textContent = submit;
            fields.replaceChildren();
            for (const field of definitions) {
                const label = document.createElement('label'), input = document.createElement('input');
                label.textContent = field.label;
                input.name = field.name;
                input.type = field.type ?? 'text';
                input.value = field.value ?? '';
                input.required = Boolean(field.required);
                input.readOnly = Boolean(field.readOnly);
                input.autocomplete = 'off';
                if (field.pattern)
                    input.pattern = field.pattern;
                if (field.maxLength)
                    input.maxLength = field.maxLength;
                label.append(input);
                fields.append(label);
            }
            return new Promise(resolve => { pending = resolve; dialog.showModal(); (fields.querySelector('input:not([readonly])') ?? document.getElementById('admin-dialog-cancel')).focus(); });
        },
        async confirm(message) { return (await this.ask({ title: 'Potvrzení změny', message, submit: 'Potvrdit' })) !== null; },
        cancel() { finish(null); },
    };
    window.addEventListener('stul-admin-logout', () => finish(null));
})();
