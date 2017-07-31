class C0 {
  constructor(key, initialValue = 0, initialDelta = 0, initialSequenceNumber = 0, initialTimestamp = 0) {
    this.key = key;
    this.value = initialValue;
    this.delta = initialDelta;
    this.deltaDirty = false;
    this.requestSequenceNumber = initialSequenceNumber;
    this.requestTimestamp = initialTimestamp;
    this.lerpedValue = this.value;
  }
  update(ela){
    this.deltaDirty = (this.oldDelta != this.delta);
    this.value += this.delta * ela/1000;
    this.oldDelta = this.delta;
    this.lerpedValue += (this.value - this.lerpedValue)/1;
  }
}

C0.decode = function(encoded){
  data = encoded.split('/');
  return new C0(
    data[0],
    parseFloat(data[1]),
    parseFloat(data[2]),
    parseFloat(data[3]),
    parseFloat(data[4])
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

C0.encode = (c0) => {
  return c0.key + '/' + c0.value + '/' + c0.delta + '/' + c0.requestSequenceNumber + '/' + c0.requestTimestamp;
};

class VariableStore {
  constructor(props) {
    this.variables = {};
  }

  setVariable(variable){
    this.variables[variable.key] = C0.clone(variable);
  }

  getVariable(key){
    return this.variables[key];
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
    this.networkDelay = 120;

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
    socket.on('c0', (msg)=>{
      console.log(`event c0 + ${msg}`);

      setTimeout(() => {
        this.users.forEach((u)=>{
          u.socket.emit('c0', msg);
        });
      }, this.networkDelay);
    });
  }
}

if(typeof(module) != 'undefined' && module.exports) {
  module.exports = {
    C0: C0,
    Server: Server,
  };
} else {
  window.C0 = C0;
  window.VariableStore = VariableStore;
}
