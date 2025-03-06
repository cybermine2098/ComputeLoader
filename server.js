const express = require('express');
const multer = require('multer');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { sequelize, File, runjobs } = require('./db');
const { Worker } = require('worker_threads');
const { parentPort, workerData } = require('worker_threads');
const { v4: uuidv4 } = require('uuid');
const { arrayBuffer } = require('stream/consumers');
const { finished } = require('stream');
const formatMemoryUsage = (data) => `${Math.round(data / 1024 / 1024 * 100) / 100} MB`;
const PORT = 4043
const app = express();
app.use(express.json());
app.use(express.static('public'));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname);
    const base = path.basename(file.originalname, extension);
    let filename = base + extension;
    let counter = 0;
    while (fs.existsSync(path.join('uploads', filename))) {
      counter++;
      filename = base + counter + extension;
    }
    cb(null, filename);
  }
});
const upload = multer({ storage });

// HTTPS server options
const options = {
  key: fs.readFileSync('keys/private.key'),
  cert: fs.readFileSync('keys/certificate.crt')
};

// New endpoint to get list of files
app.get('/files', async (req, res) => {
  try {
    const files = await File.findAll();
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: 'Unable to retrieve files' });
  }
});

// NEW: Add endpoint to fetch active and finished runjobs
app.get('/jobs', async (req, res) => {
  try {
    const activeJobs = await runjobs.findAll({ where: { active: true } });
    const finishedJobs = await runjobs.findAll({ where: { active: false } });
    
    for (const job of finishedJobs) {
      const logPath = path.join(__dirname, 'public', 'logs', job.correspondinguuid + '.txt');
      const stats = await fs.promises.stat(logPath);
      await job.update({ size: stats.size });
    }

    res.json({ active: activeJobs, finished: finishedJobs });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Unable to fetch jobs' });
  }
});

// NEW: Endpoint to delete a log file and remove its runjob record
app.post('/deletelog', async (req, res) => {
  const jobUuid = req.body.uuid;
  const logsDir = path.join(__dirname, 'public', 'logs');
  const logPath = path.join(logsDir, jobUuid + '.txt');
  try {
    await fs.promises.unlink(logPath);
  } catch (err) {
    // Log deletion error ignored; proceed to delete the DB record
    console.error('Error deleting log file:', err.message);
  }
  try {
    await runjobs.destroy({ where: { correspondinguuid: jobUuid } });
    res.json({ success: true, message: 'Log file and job record removed.' });
  } catch (err) {
    res.json({ success: false, message: 'Failed to remove job record: ' + err.message });
  }
});

// Sync the database
sequelize.sync({ alter: true });

// Handle file upload
app.post('/upload', upload.single('file'), async (req, res) => {
  if (req.file) {
    await File.create({ filename: req.file.filename });
    return res.json({ success: true, message: 'file uploaded' });
  }
  return res.json({ success: false, message: 'file upload failed' });
});

app.post('/getinfo', async (req, res) => {
  const file = require(path.join(__dirname, 'uploads', req.body.script));
  if (file) {
    return res.json({ success: true, data: file.data, execute: file.execute, message: 'file found' });
  }
  return res.json({ success: false, message: 'file not found' });
})

app.post('/reset', async (req, res) => {
  const file = await File.findOne({ where: { filename: req.body.filename } });
  if (file) {
    await file.update({ status: 'untested', tested: false, name: null, purpose: null });
    return res.json({ success: true, message: 'file reset' });
  } else {
    return res.json({ success: false, message: 'file not found' });
  }
})

app.post('/delete', async (req, res) => {
  const file = await File.findOne({ where: { filename: req.body.filename } });
  if (file) {
    await file.destroy();
    try {
      fs.unlinkSync(path.join(__dirname, 'uploads', req.body.filename));
    } catch (err) {
      return res.json({ success: false, message: 'file not found ' + err });
    }
    return res.json({ success: true, message: 'file deleted' });
  }
  return res.json({ success: false, message: 'file not found' });
})

app.post('/execute', async (req, res) => {
  const passthrougharguments = req.body.arguments;

  // Generate uuid and create runjob entry with active true
  const jobUuid = uuidv4();
  const jobEntry = await runjobs.create({
    filename: req.body.script,
    correspondinguuid: jobUuid,
    status: 'running',
    active: true,
    // ...existing fields...
  });

  // Ensure logs directory exists
  const logsDir = path.join(__dirname, 'public', 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
  }

  // Updated worker script: write logs directly to file
  const workerScript = `
    const { workerData, parentPort } = require('worker_threads');
    const fs = require('fs');
    const file = require(workerData.filePath);
    const passthrougharguments = workerData.arguments;
    
    // Override console.log to append messages straight to log file
    console.log = function(...args) {
      fs.appendFileSync(workerData.logFilePath, args.join(' ') + '\\n');
    };
    
    (async () => {
      try {
        await file.execute(...passthrougharguments.map(arg => arg.value));
        parentPort.postMessage({ success: true });
      } catch (error) {
        parentPort.postMessage({ success: false, error: error.message });
      }
    })();
  `;

  // Pass logFilePath to workerData
  const workerData = {
    filePath: path.join(__dirname, 'uploads', req.body.script),
    arguments: req.body.arguments,
    logFilePath: path.join(logsDir, jobUuid + '.txt')
  };

  const worker = new Worker(workerScript, {
    eval: true,
    workerData: workerData,
  });

  res.json({ success: true, message: 'Execution started' });

  worker.on('message', async (message) => {
    // Update runjob record; logs were written directly by the worker
    await jobEntry.update({ active: false, status: message.success ? 'completed' : 'failed', endtime: new Date() });
  });

  worker.on('error', async (error) => {
    await jobEntry.update({ active: false, status: 'failed', endtime: new Date() });
    fs.appendFileSync(path.join(logsDir, jobUuid + '.txt'), error.message);
    worker.terminate();
  });

  worker.on('exit', async (code) => {
    if (code !== 0) {
      await jobEntry.update({ active: false, status: 'failed', endtime: new Date() });
    } else {
      await jobEntry.update({ active: false, status: 'completed', endtime: new Date() });
    }
  });
});

// New endpoint to handle testing
app.post('/test', async (req, res) => {
  const file = path.join(__dirname, 'uploads', req.body.filename);
  const filedb = await File.findOne({ where: { filename: req.body.filename } });
  if (!filedb) {
    return res.json({ success: false, message: 'file not found in database.' });
  }
  let openfile;
  try {
    openfile = require(file);
  } catch (err) {
    await filedb.update({ status: 'Error loading file' });
    return res.json({ success: false, message: 'File contains invalid syntax or tried to run something before calling:<br>' + err });
  }
  if (!openfile.data || !openfile.execute) {
    await filedb.update({ status: 'Missing property' });
    return res.json({ success: false, message: 'file is missing a data property or execute command.' });
  }
  if (!openfile.data.name) {
    await filedb.update({ status: 'Missing name' });
    return res.json({ success: false, message: 'file is missing a name.' });
  }
  if (!openfile.data.purpose) {
    await filedb.update({ status: 'Missing purpose' });
    return res.json({ success: false, message: 'file is missing a purpose.' });
  }
  if (!openfile.data.configuration) {
    await filedb.update({ status: 'Missing configuration' });
    return res.json({ success: false, message: 'file is missing configuration object.' });
  }
  if (openfile.data.arguments.length == 0) {
    await filedb.update({ status: 'Missing arguments when they were defined' });
    return res.json({ success: false, message: 'file is missing arguments, when it is specified that is has arguments.' });
  }
  if (openfile.data.arguments) {
    for (let i = 0; i < openfile.data.arguments.length; i++) {
      if (!openfile.data.arguments[i].name) {
        await filedb.update({ status: `Missing argument ${i + 1} name` });
        return res.json({ success: false, message: 'file is missing argument name.' });
      }
      if (!openfile.data.arguments[i].purpose) {
        await filedb.update({ status: `Missing argument ${i + 1} description` });
        return res.json({ success: false, message: 'file is missing argument description.' });
      }
      if (!openfile.data.arguments[i].type) {
        await filedb.update({ status: `Missing argument ${i + 1} type` });
        return res.json({ success: false, message: 'file is missing argument type.' });
      }
      const options = ['string', 'number', 'boolean', 'object', 'choice'];
      if (!options.includes(openfile.data.arguments[i].type)) {
        await filedb.update({ status: `Invalid argument ${i + 1} type` });
        return res.json({ success: false, message: 'file has an incorrect argument type.' });
      }
      if (openfile.data.arguments[i].type == 'choice') {
        if (!openfile.data.arguments[i].choices) {
          await filedb.update({ status: `Missing argument ${i + 1} choices` });
          return res.json({ success: false, message: 'file is missing argument choices.' });
        }
        if (openfile.data.arguments[i].choices.length == 0) {
          await filedb.update({ status: `Missing argument ${i + 1} choices` });
          return res.json({ success: false, message: 'file is missing argument choices.' });
        }
      }
      if (!(openfile.data.arguments[i].required == true || openfile.data.arguments[i].required == false)) {
        await filedb.update({ status: `Missing argument ${i} requirement` });
        return res.json({ success: false, message: 'file is missing argument required.' });
      }
    }
  }
  if (!openfile.data.configuration.ideal_execution) {
    await filedb.update({ status: 'Missing ideal execution time' });
    return res.json({ success: false, message: 'file is missing ideal execution time. This property is required for the calculation of script runtime.' });
  }
  if (!openfile.data.configuration.maximum_execution) {
    await filedb.update({ status: 'Missing maximum execution time' });
    return res.json({ success: false, message: 'file is missing maximum execution time. This property is required for the calculation of script runtime.' });
  }
  if (!(openfile.data.configuration.external_dependent === true || openfile.data.configuration.external_dependent === false)) {
    await filedb.update({ status: 'Missing external dependent' });
    return res.json({ success: false, message: 'file is missing external dependent. This property is required for the calculation of script runtime.' });
  }
  if (openfile.data.configuration.external_dependent) {
    if (!openfile.configuration.external_urls) {
      await filedb.update({ status: 'Missing external urls' });
      return res.json({ success: false, message: 'file is missing external urls property in it\'s entirety' });
    }
    if (openfile.data.configuration.external_urls.length == 0) {
      await filedb.update({ status: 'Missing external urls' });
      return res.json({ success: false, message: 'file does not list any external urls despite saying that it uses external APIs.' });
    }
  }
  await filedb.update({ status: 'Passed', tested: true, name: openfile.data.name, purpose: openfile.data.purpose });
  return res.json({ success: true, message: 'Test passed with no issues.' });
});

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', req.path.substring(1)));
});
// Start the HTTPS server
https.createServer(options, app).listen(PORT, async () => {
  await runjobs.update({ active: false, status: 'Could not finish before script close.' }, { where: { active: true } });
  console.log('Open! https://localhost:4043/index.html');
  setInterval(() => {
    const memoryData = process.memoryUsage();
    const heapUsed = memoryData.heapUsed;
    const heapTotal = memoryData.heapTotal;
    const percent = (heapUsed / heapTotal) * 100;
    process.stdout.write(`\rMemory Usage: ${formatMemoryUsage(heapUsed)} / ${formatMemoryUsage(heapTotal)} (${percent.toFixed(2)}%)`);
  }, 250);
});
