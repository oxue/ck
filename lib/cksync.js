class ValueStore {
  constructor() {
    
  }

  value(key) {

  }
}

class NetList {
  constructor(key, transactionKey, initialSequenceNumber = 0, initialTimestamp = 0) {
    this.key = key;
    this.transactionKey = transactionKey;
    this.value = [];
    this.delta = [];
    this.buffer = [];

    this.type = 'netlist';
    this.requestSequenceNumber = initialSequenceNumber;
    this.requestTimestamp = initialTimestamp;
  }

  push(obj){
    let transaction = {key: this.transactionKey, op: 'push', params: [obj]};
    this.delta.push(transaction);
    this._update(transaction);
  }

  _update(transaction){
    this.value[transaction.op].apply(this.value, transaction.params);
  }

  unDirty() {
    this.delta = [];
  }

  isDirty() {
    return this.delta.length > 0;
  }

  serialize () {
    return {
      key: this.key,
      delta: this.delta,
      requestSequenceNumber: this.requestSequenceNumber,
      requestTimestamp: this.requestTimestamp,
    }
  }

  processBuffer(synchronizedClientTime) {

    while(this.buffer.length && synchronizedClientTime >= this.buffer[0].updateTime + this.buffer[0].bufferTime) {
      let bufferHead = this.buffer.shift();
      let receivedUpdate = bufferHead.update;
      
      for(var i in receivedUpdate.delta) {
        let transaction = receivedUpdate.delta[i];
        if (transaction.key != this.transactionKey) {
          this.value[transaction.op].apply(this.value, transaction.params);
        }
      }
    }
  }

}

class C0 {
  constructor(key, initialValue = 0, initialDelta = 0, initialSequenceNumber = 0, initialTimestamp = 0) {
    this.key = key;
    this.value = initialValue;
    this.delta = initialDelta;
    this.oldDelta = initialDelta;
    this.requestSequenceNumber = initialSequenceNumber;
    this.requestTimestamp = initialTimestamp;

    this.type = 'c0';
    this.deltaDirty = false;
    
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
    this.lerpedValue += (this.value - this.lerpedValue)/1;
  }

  unDirty() {
    this.deltaDirty = false;
  }

  setDelta(delta) {
    if(delta != this.delta){
      this.deltaDirty = true;
    }
    this.delta = delta;
  }

  isDirty() {
    return this.deltaDirty;
  }

  processBuffer(synchronizedClientTime) {
    while(this.buffer.length && synchronizedClientTime >= this.buffer[0].updateTime + this.buffer[0].bufferTime) {
      let bufferHead = this.buffer.shift();
      let receivedUpdate = bufferHead.update;
      this.value = receivedUpdate.value;
      this.delta = receivedUpdate.delta;
      this.skipUpdate = true;
    }
  }

  serialize() {
    return {
      key: this.key,
      value: this.value,
      delta: this.delta,
      requestSequenceNumber: this.requestSequenceNumber,
      requestTimestamp: this.requestTimestamp,
    };
  }
}

C0.decode = function(encoded){
  return new C0(
    encoded.key,
    encoded.value,
    encoded.delta,
    encoded.requestSequenceNumber,
    encoded.requestTimestamp
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
    this.valueStore = {};

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

  // send all updates, should always be in sync
  updateAll(){
    for(var key in this.valueStore) {
      this.users.forEach((u)=>{
        let msg = this.valueStore[key].serialize();
        console.log(JSON.stringify(msg));
        u.socket.emit('c0', msg);
      });  
    }
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

    // WHen we receive a c0 update, we want to
    // - Add it to the value store if it does not exist
    // - Update the value attributes if it does 
    socket.on('c0', (msg)=>{
      console.log(`event c0 ${JSON.stringify(msg)}`);

      var receivedC0 = C0.decode(msg);

      let c0 = this.valueStore[receivedC0.key];
      if (!c0) {
        c0 = new C0(receivedC0.key, receivedC0.value);
        this.valueStore[receivedC0.key] = c0;
      }

      c0.value = receivedC0.value;
      c0.delta = receivedC0.delta;
      c0.requestTimestamp = receivedC0.requestTimestamp;
      c0.requestSequenceNumber = receivedC0.requestSequenceNumber;
    });

    socket.on('netlist', (msg)=>{
      console.log(`event netlist ${JSON.stringify(msg)}`);

      setTimeout(() => {
        this.users.forEach((u)=>{
          u.socket.emit('netlist', msg);
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
        networkDelay: 100,
        // ping variance
        networkFluctuation: 0,
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
    const keyId = parseInt(key.split('|')[0], 10);
    return keyId == -1 || this.clientId === keyId;
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
        if(receivedC0.requestSequenceNumber > c0.requestSequenceNumber){
          c0.requestSequenceNumber = receivedC0.requestSequenceNumber;
          //debugger;
          c0.buffer.push({
            update: receivedC0,
            updateTime: this.synchronizedClientTime,
            bufferTime: 10
          });
        }
      }
    });
  }

  bindNetListEvent() {
    this.on('netlist', (msg) => {
      let netList = this.valueStore[msg.key];
      if (!netList) {
        netList = new NetList(msg.key, this.clientId);
        this.valueStore[msg.key] = netList;
      }

      // If this id belongs to me
      if(false && this.ownsKey(msg.key)) {
        if(msg.requestSequenceNumber >= netList.requestSequenceNumber){
          // TODO: resolve conflits here
        }
      }else{ //else push it into the buffer for that var
        netList.buffer.push({
          update: msg,
          updateTime: this.synchronizedClientTime,
          bufferTime: 100
        });
      }
    });
  }

  bindClientEvents() {
    this.bindPingTestEvent();
    this.bindIdEvent();
    this.bindCkEvent();
    this.bindNetListEvent();
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
      let value = this.valueStore[key];
      value.processBuffer(this.synchronizedClientTime);
    }
  }

  sendDirtyValues() {
    for(var key in this.valueStore) {
      if(this.ownsKey(key)){
        let val = this.valueStore[key];
        if(val.isDirty()){
          val.requestSequenceNumber ++;
          val.requestTimestamp = this.synchronizedClientTime;
          this.emit(val.type, val.serialize());
          val.unDirty();
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
  window.cksync.NetList = NetList;
  window.cksync.Client = Client;
  window.cksync.TimeLockedEvent = TimeLockedEvent;
}
