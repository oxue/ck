var express = require('express');
var http = require('http');
var expressLess = require('express-less');
var socketio = require('socket.io');
var cksync = require('./lib/cksync.js');
const repl = require('repl');

var app = express();

app.use(express.static(__dirname + '/public/js'));
app.use(express.static(__dirname + '/lib'));
app.use(expressLess(__dirname + '/public/less', { debug: true }));

var server = http.Server(app);
var io = socketio(server);

users = [];

const FAKEPING = 200;

app.get('/', function(req, res){
  res.sendFile(__dirname + '/view/index.html');
});

app.get('/demo', function(req, res){
  res.sendFile(__dirname + '/view/demo.html');
});

var ckserver = new cksync.Server(io);
global.ckserver = ckserver;

/*io.on('connection', (socket)=>{
  console.log('\na user connected!');
  console.log(socket.id);

  socket.emit('id', users.length);

  users.push(socket);

  socket.on('disconnect', function(){
    console.log(socket.id);
    users = users.filter((u) => u.id != socket.id);
    console.log(users.length);
    console.log('\nuser disconnected');
  });

  socket.on('c1', (msg)=>{
    setTimeout(() => {
      users.forEach((u)=>{
        u.emit('c1', msg);
      });
    }, FAKEPING);
  });
});*/

update = () => {
  //ckserver.simulate()
}

setInterval(update, 1000/30);

server.listen(2000, () => {
  console.log('listening on *:2000');
  repl.start({prompt:'shell> ', useGlobal:true});
});


