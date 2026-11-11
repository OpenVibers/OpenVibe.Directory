'use strict';
const {createApp} = require('./app');
const port = Number(process.env.PORT || 5281);
const server=createApp().listen(port, '127.0.0.1', () => process.stdout.write(`directory listening on ${port}\n`));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
