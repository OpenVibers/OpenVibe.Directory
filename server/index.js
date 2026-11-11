'use strict';
const {createApp} = require('./app');
const {createStore}=require('./sources');
const {createPeopleStore}=require('./people');
const port = Number(process.env.PORT || 5281);
async function main(){
  const store=createStore();
  const peopleStore=process.env.DATABASE_URL?await createPeopleStore({entries:store.state.entries}):null;
  const server=createApp({store,peopleStore}).listen(port, '127.0.0.1', () => process.stdout.write(`directory listening on ${port}\n`));
  process.on('SIGTERM',()=>server.close(async()=>{store.stop();await peopleStore?.close();process.exit(0);}));
}
main().catch(err=>{console.error('directory startup failed:',err.message);process.exitCode=1;});
