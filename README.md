# Hi! Welcome to my compute loader. Here is how to set it up:
1. download all files and extract them to a directory.
2. make sure you have node and npm installed. 
3. open the project root (/computeloader), and run npm install. it should create a node_modules folder and get everything you need.
4. generate keys, and place them under keys/ You'll need a certicficate.crt, a certificate.csr, and a private.key.
5. Turn the program on with npm start. if required, you can turn down the ram allocated from 8gb to something smaller in the package.json file
6. Look at the example js file in the root for formatting. This file isn't used anywhere else, so if you don't need it, you can delete it.
7. upload a file from the homepage, and test it. if it tests without errors, everything is working correctly. Happy computing!