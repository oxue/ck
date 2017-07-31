class C1 {
  constructor(key, initialValue = 0, initialDelta = 0, initialSequenceNumber = 0) {
    this.key = key;
    this.value = initialValue;
    this.delta = initialDelta;
    this.deltaDirty = false;
    this.requestSequenceNumber = initialSequenceNumber;
  }
  update(ela){
    this.deltaDirty = (this.oldDelta != this.delta);
    this.value += this.delta * ela/1000;
    this.oldDelta = this.delta;
  }
}

C1.decode = function(encoded){
  data = encoded.split('/');
  return new C1(
    data[0],
    parseFloat(data[1]),
    parseFloat(data[2]),
    parseFloat(data[3])
  );
}

C0.clone = function(c0){
  return new C0(
    c0.key,
    c0.value,
    c0.delta,
    c0.requestSequenceNumber
  );
}

class VariableStore {
  constructor(props) {
    this.variables = {};
  }

  setVariable(variable){
    this.variables[variable.key] = variable;
  }
}

class User {
  constructor(socket) {
    this.socket = socket;
  }
}

class Server {
  constructor(serverSocket) {
    this.serverSocket = serverSocket;
    this.users = [];
    this.networkDelay = 80;

    this.bindServerEvents();
  }

  bindServerEvents(){
    this.serverSocket.on('connection', this.userConnect.bind(this));
  }

  userConnect(socket){
    console.log(`User ${socket.id} connected`);
    this.userAssignId(socket);

    this.bindUserEvents(socket);

    
  }

  userAssignId(socket){
    socket.emit('id', this.users.length);
    this.users.push(new User(socket));
  }

  bindUserEvents(socket){
    socket.on('disconnect', () => {
      this.users = this.users.filter((u) => u.socket.id != socket.id);
    });
    socket.on('c1', (msg)=>{
      console.log(`event c1 + ${msg}`);

      setTimeout(() => {
        this.users.forEach((u)=>{
          u.socket.emit('c1', msg);
        });
      }, this.networkDelay);
    });
  }
}

if(typeof(module) != 'undefined' && module.exports) {
  module.exports = {
    C1: C1,
    Server: Server,
  };
} else {
  window.C1 = C1;
}
