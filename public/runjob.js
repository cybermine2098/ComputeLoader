function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    const toastEl = document.createElement('div');
    toastEl.classList.add('toast');
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');
    toastEl.style.minWidth = '250px';

    const headerBg = type === 'success' ? 'bg-success' : type === 'error' ? 'bg-danger' : 'bg-info';
    toastEl.innerHTML = `
      <div class="toast-header ${headerBg} text-white">
        <strong class="me-auto">Notification</strong>
        <small>Just now</small>
        <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
      <div class="toast-body">
        ${message}
      </div>
    `;

    toastContainer.appendChild(toastEl);
    const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
    toast.show();
    toastEl.addEventListener('hidden.bs.toast', () => {
        toastEl.remove();
    });
}

function normalize(time) {
    if (time < 1000) {
        return `${time}ms`;
    } else if (time < 60000) {
        return `${(time / 1000).toFixed(2)}s`;
    } else if(time < 3600000){
        return `${(time / 60000).toFixed(2)}m`;
    }else{
        return `${(time / 3600000).toFixed(2)}h`;
    }
}

async function init() {
    const targetscript = window.location.href.split('?').pop().toString();
    document.getElementById('title').innerHTML = targetscript;
    const response = await fetch('/getinfo', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ script: targetscript })
    })
    if (response) {
        const data = await response.json();
        document.getElementById('scriptname').innerHTML = data.data.name;
        document.getElementById('scriptdescript').innerHTML = data.data.purpose;
        if (data.data.arguments) {
            const argcontainer = document.getElementById('inputsform');
            for (const arg of data.data.arguments) {
                switch (arg.type) {
                    case "string":
                        argcontainer.innerHTML += `<div class="mb-3">
                        <label for="${arg.name}" class="form-label">${arg.name}: string</label>
                        <input type="text" placeholder='${arg.purpose}' class="form-control" ${arg.default ? `value="${arg.default}"` : ''} id="${arg.name}" ${arg.required ? 'required' : ''}>
                        </div>`;
                        break;
                    case "boolean":
                        argcontainer.innerHTML += `<div class="mb-3">
                            <label for="${arg.name}" class="form-label">${arg.name}: boolean</label>
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" id="${arg.name}" ${arg.default ? 'checked' : ''} ${arg.required ? 'required' : ''}>
                                <label class="form-check-label" for="${arg.name}">${arg.purpose}</label>
                            </div>
                            `;
                        break;
                    case "number":
                        argcontainer.innerHTML += `<div class="mb-3">
                        <label for="${arg.name}" class="form-label">${arg.name}: number</label>
                        <div class="col">
                            <input type="number" class="form-control" ${arg.default ? `value="${arg.default}"` : ''} id="${arg.name}" ${arg.required ? 'required' : ''}>
                        </div>
                        <div class="col">
                            <p class="form-text">${arg.purpose}</p>
                        </div>
                        </div>`;
                        break;
                    case "object":
                        argcontainer.innerHTML += `<div class="mb-3">
                        <label for="${arg.name}" class="form-label">${arg.name}: JSON</label>
                        <textarea class="form-control" id="${arg.name}" ${arg.required ? 'required' : ''} placeholder='${arg.purpose}'></textarea>
                        </div>`;
                        break;
                    case "choice":
                        argcontainer.innerHTML += `<div class="mb-3">
                        <label for="${arg.name}" class="form-label
                        ">${arg.name}: choice</label>
                        <select class="form-select" id="${arg.name}" ${arg.required ? 'required' : ''}>
                            ${arg.choices.map(dat => `<option value="${dat}">${dat}</option>`).join('')}
                        </select>
                        <p class="form-text">${arg.purpose}</p>
                        </div>`;
                        break;
                    default:
                        argcontainer.innerHTML += `<div class="mb-3">
                        <p class='red-text'>${arg.name}: ${arg.type}</p>
                        <p class='red-text'>${arg.purpose}</p>
                        </div>`;
                        break;
                }
            }
        }
        if(data.data.configuration.external_dependent){
            document.getElementById('external_dependent').innerHTML = `<p class='red-text'>This script is dependent on the following external services:<br>${data.data.configuration.external_urls.map(dat => `<a target='_blank' href=${dat}>${dat}</a>`).join('<br>')}</p>`;
        }else{
            document.getElementById('external_dependent').innerHTML = `<p class='green-text'>This script is not dependent on external services</p>`;
        }
        document.getElementById('executiontime').innerHTML = `<p class='green-text'>Ideal execution time: ${normalize(data.data.configuration.ideal_execution)}<br>Rough max execution time: ${normalize(data.data.configuration.maximum_execution)}</p>`;
        const executebutton = document.createElement('button');
        executebutton.innerHTML = 'Execute';
        executebutton.classList.add('btn', 'btn-success','form-control');
        executebutton.onclick = async () => {
            Array.from(document.getElementById('inputsform').children).filter(dat => dat.tagName === 'DIV').map(dat => {
                const input = dat.querySelector('textarea');
                if(!input) return;
                try{
                    JSON.parse('{'+input.value+'}');
                }catch(e){
                    showToast(`Failed to parse JSON in ${input.id}`, 'error');
                    return;
                }
            })
            await fetch('/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    script: targetscript,
                    arguments: Array.from(document.getElementById('inputsform').children).filter(dat => dat.tagName === 'DIV').map(dat => {
                        try{
                            const input = dat.querySelector('input,textarea,select');
                            if (input.type === 'checkbox') {
                                return { name: input.id, value: input.checked };
                            }else if(input.type === "textarea"){
                                return { name: input.id, value: JSON.parse('{'+input.value+'}') };
                            }else if(input.type === "number"){
                                return { name: input.id, value: Number(input.value) };
                            }else{
                                return { name: input.id, value: input.value };
                            }
                        }catch(Err){
                            showToast(`Failed to parse ${dat.querySelector('label').innerHTML}`, 'error');
                            return;
                        }
                        
                    })
                })
            }).then(async res => {
                if (res.ok) {
                    const data = await res.json();
                    if (data.success) {
                        showToast(`Script cronjob scheduled successfully: ${targetscript}`, 'success');
                        setTimeout(() => {window.location.href = '/index.html'},3000)
                    } else {
                        showToast(`Failed to execute script: ${targetscript}`, 'error');
                    }
                }
            })
        }
        document.getElementById('inputsform').appendChild(executebutton);
    } else {
        showToast(`Failed to retrieve script: ${targetscript}`, 'error');
    }
    showToast(`Loaded script: ${targetscript}`, 'info');
}
init();