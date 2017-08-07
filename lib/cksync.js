class C0 {
  constructor(key, initialValue = 0, initialDelta = 0, initialSequenceNumber = 0, initialTimestamp = 0) {
    this.key = key;
    this.value = initialValue;
    this.delta = initialDelta;
    this.deltaDirty = false;
    this.oldDelta = initialDelta;
    this.requestSequenceNumber = initialSequenceNumber;
    this.requestTimestamp = initialTimestamp;
    this.lerpedValue = this.value;
    this.skipUpdate = false;

    this.buffer = [];
  }
  update(ela){
    if(this.skipUpdate) {
      this.skipUpdate = false;
      return;
    }
    this.value += this.delta * ela/1000;
    this.lerpedValue += (this.value - this.lerpedValue)/2;
    this.deltaDirty = false;
  }
  setDelta(delta) {
    if(delta != this.delta){
      this.deltaDirty = true;
    }
    this.delta = delta;
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

class User {
  constructor(socket) {
    this.socket = socket;
  }
}

class Server {
  constructor(serverSocket) {
    this.serverSocket = serverSocket;
    this.users = [];
    this.networkDelay = 200;
    this.networkVarianceRoot = 30;

    this.bindServerEvents();
  }

  getNetworkDelayWithVariance(){
    return this.networkDelay - this.networkVarianceRoot + Math.random() * this.networkVarianceRoot * 2;
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

    socket.on('pingtest', (data) => {
      setTimeout(() => {
        data.serverTimestamp = Date.now();
        socket.emit('pingtest', data);
      }, this.getNetworkDelayWithVariance());
      
    });

    socket.on('c0', (msg)=>{
      console.log(`event c0 + ${msg}`);

      setTimeout(() => {
        this.users.forEach((u)=>{
          u.socket.emit('c0', msg);
        });
      }, this.getNetworkDelayWithVariance());
    });
  }
}

class TimeLockedEvent {
  constructor(onTick, interval) {
    this.interval = interval;
    this.onTick = onTick;
    this.previousTick = -1;
  }

  update(timestamp) {
    if(this.previousTick === -1) {
      this.previousTick = timestamp;
      this.onTick();
    }else{
      const elaspedSinceTick = timestamp - this.previousTick;
      if(elaspedSinceTick >= this.interval) {
        this.previousTick = timestamp - (elaspedSinceTick % this.interval);
        this.onTick();
      }
    }
  }
}

class Client {
  constructor(socket, address, dev = true) {

    // socket used for communication with server
    this.clientSocket = socket;
    // address of server socket
    this.serverAddress = address;
    // how often to ping test the server to try to synchronize clocks
    this.PING_INTERVAL = 1000;
    // store for tracked values
    this.valueStore = {};
    // the number of times a ping test has been sent out
    this.pingSequenceNumber = 0;
    // the actual value of ping that has been calculated
    this.ping = 0;
    // the unaccurate, unstable time synchronized to the server's time; update positions based on this
    this.synchronizedClientTime = 0;
    // the accurate, local client time; lock timed updates with this
    this.localClientTime = 0;
    // last update time, invalid at -1 until the first update is called
    this.lastUpdate = -1;
    // the amount to componensate by to sync up with the server
    this.timeSyncCompensation = 0;
    // the identifier assigned by the server
    this.clientId = -1;

    // Some development used values
    if(dev) {
      this.dev = {
        // Initial difference in clock value for clients
        randomClockOffset: Math.random() * 2000,
        // ping delay
        networkDelay: 0,
      };
    }

    this.pingTestEvent = new TimeLockedEvent(this.emitPingTest.bind(this), 1000);
    this.frameEvent = new TimeLockedEvent(()=>{}, 1000/30);

    // set up client events
    this.bindClientEvents();
  }

  emitPingTest(){
    this.emit('pingtest', {timestamp: this.localClientTime, sid: this.pingSequenceNumber});
  }

  emit(message, data) {
    setTimeout(() => {
      this.clientSocket.emit(message, data);
    }, this.dev.networkDelay);
  }

  bindPingTestEvent() {
    this.clientSocket.on('pingtest', (pingData) => {
      console.log(this.ping);

      if(this.pingSequenceNumber == pingData.sid){
        this.ping = (this.localClientTime - pingData.timestamp) / 2;
        let actual = pingData.serverTimestamp - this.ping;
        this.timeSyncCompensation = actual - pingData.timestamp;
      }
      this.pingSequenceNumber ++;
    });
  }

  bindIdEvent() {
    this.clientSocket.on('id', (_id) => {
      console.log('Client Connected successfully with ID ' + _id);
      this.clientId = _id;
      const key = _id+'';
      valueStore[key] = new cksync.C0(key, 100);
    });
  }

  bindClientEvents() {
    this.bindPingTestEvent();
    this.bindIdEvent();
  }

  // update the state of the client, you must provide a timestamp.
  // This method should be run as often as possible 
  update(timestamp) {
    this.localClientTime = timestamp + this.dev.randomClockOffset;
    this.synchronizedClientTime = this.localClientTime + this.timeSyncCompensation;

    this.pingTestEvent.update(timestamp);
  }

}

if(typeof(module) != 'undefined' && module.exports) {
  module.exports = {
    C0: C0,
    Server: Server,
    Client: Client
  };
} else {
  window.cksync = {};
  window.cksync.C0 = C0;
  window.cksync.Client = Client;
  window.cksync.TimeLockedEvent = TimeLockedEvent;
}
