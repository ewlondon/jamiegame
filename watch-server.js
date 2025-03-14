const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');

let server;

function startServer() {
    server = spawn('node', ['server.js']);

    server.stdout.on('data', (data) => {
        console.log(`Server output: ${data}`);
    });

    server.stderr.on('data', (data) => {
        console.error(`Server error: ${data}`);
    });

    server.on('close', (code) => {
        console.log(`Server process exited with code ${code}`);
    });
}

function restartServer() {
    console.log('Restarting server...');
    if (server) {
        server.kill();
    }
    startServer();
}

function watchPublicFolder() {
    const publicFolder = path.join(__dirname, 'public');

    fs.watch(publicFolder, { recursive: true }, (eventType, filename) => {
        console.log(`File ${filename} has been changed. Restarting server...`);
        restartServer();
    });
}

startServer();
watchPublicFolder();

console.log('Watching for changes in the public folder...');
