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
    this.networkDelay = 0;
    this.networkFluctuation = 0;

    this.bindServerEvents();
  }

  getNetworkDelayWithFluctuation(){
    return this.networkDelay - this.networkFluctuation + Math.random() * this.networkFluctuation * 2;
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
      }, this.getNetworkDelayWithFluctuation());
      
    });

    socket.on('c0', (msg)=>{
      console.log(`event c0 + ${msg}`);

      setTimeout(() => {
        this.users.forEach((u)=>{
          u.socket.emit('c0', msg);
        });
      }, this.getNetworkDelayWithFluctuation());
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
  constructor(socket, address, onSuccess, dev = true) {

    // socket used for communication with server
    this.clientSocket = socket;
    // address of server socket
    this.serverAddress = address;
    // callback to run when the client is successfully connected to the server
    this.onSuccess = onSuccess;
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
        networkDelay: 80,
        // ping variance
        networkFluctuation: 10,
      };
    }

    this.pingTestEvent = new TimeLockedEvent(this.emitPingTest.bind(this), 1000);
    this.frameEvent = new TimeLockedEvent(()=>{}, 1000/30);

    // set up client events
    this.bindClientEvents();
  }

  networkDelayWithFluctuation(){
    return this.dev.networkDelay - this.dev.networkFluctuation + Math.random() * this.dev.networkFluctuation * 2;
  }

  emitPingTest(){
    this.emit('pingtest', {timestamp: this.localClientTime, sid: this.pingSequenceNumber});
  }

  on(message, _callback) {
    this.clientSocket.on(message, (data) => {
      setTimeout(
        () => { _callback(data) },
        this.networkDelayWithFluctuation()
      );
    });
  }

  emit(message, data) {
    setTimeout(() => {
      this.clientSocket.emit(message, data);
    }, this.networkDelayWithFluctuation());
  }

  bindPingTestEvent() {
    this.on('pingtest', (pingData) => {
      if(this.pingSequenceNumber == pingData.sid){
        const timeLerp = (this.pingSequenceNumber < 10) ? 1 : 2;
        this.ping = (this.localClientTime - pingData.timestamp) / 2;
        let actual = pingData.serverTimestamp - this.ping;
        let newTimeSyncCompensation = actual - pingData.timestamp;
        this.timeSyncCompensation += (newTimeSyncCompensation - this.timeSyncCompensation) / timeLerp;
      }
      this.pingSequenceNumber ++;
    });
  }

  bindIdEvent() {
    this.on('id', (_id) => {
      console.log('Client Connected successfully with ID ' + _id);
      this.clientId = _id;
      this.onSuccess(_id);
    });
  }

  ownsKey(key) {
    return this.clientId === parseInt(key.split('-')[0], 10);
  }

  bindCkEvent() {
    this.on('c0', (msg) => {
      var receivedC0 = cksync.C0.decode(msg);

      let c0 = this.valueStore[receivedC0.key];
      if (!c0) {
        c0 = new cksync.C0(receivedC0.key, receivedC0.value);
        this.valueStore[receivedC0.key] = c0;
      }

      // If this id belongs to me, then update it immediately
      if(this.ownsKey(receivedC0.key)) {
        if(receivedC0.requestSequenceNumber >= c0.requestSequenceNumber){
          receivedC0.update(this.synchronizedClientTime - receivedC0.requestTimestamp);
          c0.value = receivedC0.value;
          c0.delta = receivedC0.delta;
        }
      }else{ //else push it into the buffer for that var
        c0.buffer.push({
          update: receivedC0,
          updateTime: this.synchronizedClientTime,
          bufferTime: 0
        });
      }
    });
  }

  bindClientEvents() {
    this.bindPingTestEvent();
    this.bindIdEvent();
    this.bindCkEvent();
  }

  isReady() {
    return this.pingSequenceNumber > 2 && this.clientId >= 0;
  }

  // update the state of the client, you must provide a timestamp.
  // This method should be run as often as possible 
  update(timestamp) {
    this.localClientTime = timestamp + this.dev.randomClockOffset;
    this.synchronizedClientTime = this.localClientTime + this.timeSyncCompensation;

    this.pingTestEvent.update(timestamp);
  }

  processBuffers(){
    for(var key in this.valueStore){
      let c0 = this.valueStore[key];
      if(c0.buffer.length){
        // consume the update..
        while(c0.buffer[0] && this.synchronizedClientTime >= c0.buffer[0].updateTime + c0.buffer[0].bufferTime) {
          let bufferHead = c0.buffer.shift();
          let receivedUpdate = bufferHead.update;
          c0.value = receivedUpdate.value;
          c0.delta = receivedUpdate.delta;

          console.log(receivedUpdate.delta);
          console.log(receivedUpdate.value);
          c0.skipUpdate = true;
        }
      }
    }
  }

  sendDirtyValues() {
    for(var key in this.valueStore) {
      if(this.ownsKey(key)){
        let myVar = this.valueStore[key];
        if(myVar.deltaDirty){
          myVar.requestSequenceNumber ++;
          myVar.requestTimestamp = this.synchronizedClientTime;
          this.clientSocket.emit('c0', cksync.C0.encode(myVar));
        }
      }
    }
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
