# Compute Loader v1.0
> by cyber.98
## Setup instructions:
1. Download all files and extract them to a directory.
2. Make sure you have node and npm installed. Run `node -v` and `npm -v` to check if you have these applications installed
3. Open the project root (/computeloader), and run npm install. it should create a node_modules folder and get everything you need. If you get issues with missing package.json, make sure your terminal is in the same directory as the folder and where the package.json is.
4. Generate keys, I reccomend openSSL on both windows and linux, and place them under the keys folder You'll need a certicficate.crt, a certificate.csr, and a private.key.
5. Turn the program on with npm start. if required, you can turn down the ram allocated from 8gb to something smaller in the package.json file. If manual arguments are required, run `node server.js`
6. Look at the `example js` file in the root for formatting. This file isn't used anywhere else, so if you don't need it, you can delete it without any issues. This file is just an example of every possible input the program can take, until Documentation comes out.
7. Upload a file from the homepage (this part is required, files are not auto-scanned), and test it using the button. If it tests without errors, everything is working correctly. You can then press reset to reset the test status or run to open a runjob. Once everything is inputted, press execute and your code will run, output, and can be viewed in the logs tab on the homepage. Happy computing!

## Known issues
- Required feilds are not actually required
- Files uploaded directly to the server are not scanned
- Occasional multi-upload and incorrect refresh seen when uploading medium-size files

## Versions
### 1.0
Required modules:
`express 4.21.2`,`fs ^0.0.1-security`,`https ^1.0.0`,`multer ^1.4.5-lts.1`,`path ^0.12.7`,`sequelize ^6.37.5`,`sqlite3 ^5.1.7`
- Provides support for file uploads, and tests each file for integrity and errors.
- Supports Inputs:
> String
> Number
> Object
> Choice
> Boolean
- Supports runtimes and summaries of run execution, keeps logs of each execution output.
- Allows for deletion of files on the remote server.
- Allows for automatic script failure detection.
### 1.1
Required modules:
`express 4.21.2`,`fs ^0.0.1-security`,`https ^1.0.0`,`multer ^1.4.5-lts.1`,`path ^0.12.7`,`sequelize ^6.37.5`,`sqlite3 ^5.1.7`
- Fixes a required field issue
- Keeps tabs on Process memory issue for host process
- Fixes minor formatting issues within the job launching interface.
- Adds a new storage usage statistic onto each process job, allowing you to see how large files are before you try to load a 23 gigabyte text file onto your chromebook with only 4GB of ram, crashing it instantly.