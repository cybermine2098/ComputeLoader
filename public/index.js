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

function formatSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1048576) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  } else if (bytes < 1073741824) {
    return `${(bytes / 1048576).toFixed(2)} MB`;
  } else {
    return `${(bytes / 1073741824).toFixed(2)} GB`;
  }
}

async function reloadFiles() {
  const fileListDiv = document.getElementById('fileList');
  fileListDiv.innerHTML = '';
  // Upload form submission using AJAX with Bootstrap toast notification
  const uploadForm = document.getElementById('uploadForm');
  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(uploadForm);
    const response = await fetch('/upload', {
      method: 'POST',
      body: formData
    });
    const result = await response.json();
    if (result.success) {
      showToast(result.message, 'success');
    } else {
      showToast(result.message, 'error');
    }
    await reloadFiles();
  });

  // Create table with header
  const table = document.createElement('table');
  const header = document.createElement('tr');
  header.innerHTML = `
    <th>Filename</th>
    <th>Name</th>
    <th>Description</th>
    <th>Upload Date</th>
    <th>Status</th>
    <th>Ready</th>
    <th>Action</th>
  `;
  table.appendChild(header);

  const response = await fetch('/files');
  const files = await response.json();

  files.forEach(file => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${file.filename}</td>
      <td>${file.name ?? '...'}</td>
      <td>${file.purpose ?? '...'}</td>
      <td>${new Date(file.uploaddate).toLocaleString()}</td>
      <td>${file.status}</td>
      <td>${file.tested}</td>
      <td></td>
    `;
    const actionCell = row.querySelector('td:last-child');
    const testButton = document.createElement('button');
    if(!file.tested){
      testButton.textContent = 'Test';
      testButton.addEventListener('click', async () => {
        showToast(`Starting testing of file ${file.filename}`, 'info');
        const response = await fetch('/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.filename }),
        }).catch(error => {
          showToast('There was an error sending a test request.', 'error');
        });
        const data = await response.json()
        if (data) {
          if (data.success) {
            showToast(data.message, 'success');
            reloadFiles();
          } else {
            showToast(data.message, 'error');
            reloadFiles();
          }
        } else {
          showToast('Test failed', 'error');
        }
      });
    }else{
      testButton.textContent = 'Run';
      testButton.className = 'run-button';
      testButton.addEventListener('click', async () => {
        showToast(`Starting testing of file ${file.filename}`, 'info');
        window.location.href = `/createrunjob.html?${file.filename}`;
      });
    }
    const resetbutton = document.createElement('button');
    resetbutton.textContent = 'Reset';
    resetbutton.className = 'reset-button';
    resetbutton.addEventListener('click', async () => {
      const response = await fetch('/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.filename }),
      });
      const data = await response.json();
      if (data.success) {
        showToast(data.message, 'Reset successful');
        reloadFiles();
      } else {
        showToast(data.message, 'Couldn\'t reset file');
        reloadFiles();
      }
    });
    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.className = 'delete-button';
    deleteButton.addEventListener('click', async () => {
      if (deleteButton.textContent == 'Delete') {
        deleteButton.textContent = 'Are you sure?'
        setTimeout(() => {
          deleteButton.textContent = 'Delete';
        }, 3000)
      } else {
        const response = await fetch('/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.filename }),
        });
        const data = await response.json();
        if (data.success) {
          showToast(data.message, 'Delete successful');
          reloadFiles();
        } else {
          showToast(data.message, 'Couldn\'t delete file');
          reloadFiles();
        }
      }
    });
    actionCell.appendChild(testButton);
    actionCell.appendChild(deleteButton);
    actionCell.appendChild(resetbutton);
    table.appendChild(row);
  });

  fileListDiv.appendChild(table);
}
let refreshinterval;
// NEW: Reload jobs function
async function reloadJobs() {
  const jobsDiv = document.getElementById('jobsContent');
  jobsDiv.innerHTML = '';
  try {
    const response = await fetch('/jobs');
    const { active, finished } = await response.json();
    refreshinterval && clearInterval(refreshinterval);
    // Active Jobs Table
    let uuids = [];
    let activeHTML = `<h4>Active Jobs</h4>`;
    if (active.length > 0) {
      activeHTML += `<table class="table"><thead><tr>
        <th>UUID</th>
        <th>Filename</th>
        <th>Status</th>
      </tr></thead><tbody>`;
      active.forEach(job => {
        activeHTML += `<tr>
          <td>${job.correspondinguuid}</td>
          <td>${job.filename}</td>
          <td id='${job.correspondinguuid}'>${job.status}, running for ${normalize((new Date() - new Date(job.starttime)))}</td>
        </tr>`;
        uuids.push(job.correspondinguuid);
      });
      activeHTML += `</tbody></table>`;
    } else {
      activeHTML += `<p>No active jobs.</p>`;
    }
    refreshinterval = setInterval(() => {
      for(const uuid of uuids){
        document.getElementById(uuid).textContent = `${active.find(job => job.correspondinguuid === uuid).status}, running for ${normalize((new Date() - new Date(active.find(job => job.correspondinguuid === uuid).starttime)))}`;
      }
    }, 250);
    // Finished Jobs Table with Download and Delete Log options
    let finishedHTML = `<h4>Finished Jobs</h4>`;
    if (finished.length > 0) {
      finishedHTML += `<table class="table"><thead><tr>
        <th>UUID</th>
        <th>Filename</th>
        <th>Status</th>
        <th>Log</th>
        <th>Actions</th>
      </tr></thead><tbody>`;
      finished.forEach(job => {
        finishedHTML += `<tr>
          <td>${job.correspondinguuid}</td>
          <td>${job.filename}</td>
          <td>${job.status} in ${normalize(new Date(job.endtime) - new Date(job.starttime))}</td>
          <td><a href="/logs/${job.correspondinguuid}.txt">View Log (${formatSize(job.size)})</a></td>
          <td>
            <button class="btn btn-danger btn-sm" onclick="deleteLog('${job.correspondinguuid}')">Delete Log</button>
          </td>
        </tr>`;
      });
      finishedHTML += `</tbody></table>`;
    } else {
      finishedHTML += `<p>No finished jobs.</p>`;
    }
    jobsDiv.innerHTML = activeHTML + finishedHTML;
  } catch (error) {
    jobsDiv.innerHTML = `<p>Error loading jobs.</p>`;
  }
}

// NEW: deleteLog function to remove a log and its job record
async function deleteLog(uuid) {
  try {
    const response = await fetch('/deletelog', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ uuid })
    });
    const result = await response.json();
    if (result.success) {
      showToast(result.message, 'success');
      reloadJobs();
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    showToast('Error deleting log.', 'error');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  reloadFiles();
  reloadJobs();
});
