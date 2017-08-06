function initApp(){
  var keyMan = new Key();

  var socket = io();
  socket.connect('localhost:2000');
  var prevNetUp = 0;

  const NETUPINTERVAL = 1000;

  var canvas = $('canvas')[0];
  var ctx = canvas.getContext('2d');

  var valueStore = {};

  var colors = ['blue', 'red', 'green', 'black', 'orange', 'purple'];
  var myId = -1;

  let myRealTimestamp = 0;
  var requestSequenceNumber = 0;
  let pingSyncId = 0;
  let randomClockOffset = Math.random() * 2000;
  let timeSyncCompensation = 0;
  let ping = 0;
  let speed = 400;

  socket.on('id', (_id) => {
    console.log('id'+_id);
    myId = _id;
    const key = _id+'';
    valueStore[key] = new C0(key, 100);
  });

  socket.on('pingtest', (data) => {
    if(pingSyncId == data.sid){
      ping = (myRealTimestamp - data.timestamp) / 2;
      let actual = data.serverTimestamp - ping;
      if(pingSyncId == 0){
        timeSyncCompensation = actual - data.timestamp;
      }else{
        timeSyncCompensation += actual - data.timestamp;
      }
    }
    pingSyncId ++;
  });

  socket.on('c0', (msg) => {
    var receivedC0 = C0.decode(msg);

    let c0 = valueStore[receivedC0.key + ""];
    if (!c0) {
      c0 = new C0(receivedC0.key);//, receivedC0.value, receivedC0.delta, receivedC0.requestSequenceNumber);
      valueStore[receivedC0.key] = c0;
    }

    //console.log(`myRealTimestamp: ${myRealTimestamp} then: ${receivedC0.requestTimestamp}`);

    //c0.buffer.push()

    // If this id belongs to me, then update it immediately
    if(receivedC0.key === myId+'') {
      if(receivedC0.requestSequenceNumber >= c0.requestSequenceNumber){

        receivedC0.update(myRealTimestamp - receivedC0.requestTimestamp);

        // - receivedC0.requestTimestamp;

        c0.value = receivedC0.value;
        c0.delta = receivedC0.delta;
      }
    }else{ //else push it into the buffer for that var
      c0.buffer.push({update: receivedC0, updateTime: myRealTimestamp, bufferTime: 0});
    }


    
  });

  var then = 0;

  var frameNum = 0;

  step = (timestamp) => {
    window.requestAnimationFrame(step.bind(this));
    myRealTimestamp = timestamp + randomClockOffset + timeSyncCompensation;

    ela = myRealTimestamp - then;

    // strict time synch update
    if(myRealTimestamp - prevNetUp > NETUPINTERVAL){
      prevNetUp = myRealTimestamp - (ela % 1000/30);

      socket.emit('pingtest', ({timestamp: myRealTimestamp, sid: pingSyncId}));
    }

    // buffered network updates
      for(key in valueStore){
        let c0 = valueStore[key];
        if(c0.buffer.length){
          // consume the update..
          while(c0.buffer[0]){ //&& myRealTimestamp >= c0.buffer[0].updateTime + c0.buffer[0].bufferTime) {
            let bufferHead = c0.buffer.shift();
            console.log('pop ' +frameNum);
            let receivedUpdate = bufferHead.update;
            //console.log(bufferHead.bufferTime);

            //console.log('to up' + (myRealTimestamp - receivedUpdate.requestTimestamp - bufferHead.bufferTime  - ping * 2));

            //receivedUpdate.update(myRealTimestamp - (receivedUpdate.requestTimestamp + bufferHead.bufferTime + ping * 2));
            c0.value = receivedUpdate.value;
            c0.delta = receivedUpdate.delta;
            c0.skipUpdate = true;
          }
        }
      }

    if(ela > 1000/30){
      frameNum ++;
      then = myRealTimestamp - (ela % 1000/30);

      if(pingSyncId < 2) return;

      if(myId == -1) return;
      
      myVar = valueStore[myId+''];

      // input
      let newDelta = 0;
      if(myId == 1){
        if(keyMan.isDown(Key.A)) newDelta = -speed;
        if(keyMan.isDown(Key.D)) newDelta = speed;
      }else{
        if(keyMan.isDown(Key.LEFT)) newDelta = -speed;
        if(keyMan.isDown(Key.RIGHT)) newDelta = speed;
      }
      myVar.setDelta(newDelta);

      // netcode 
      if(myVar.deltaDirty){
        console.log("dort");
        myVar.requestSequenceNumber ++;
        myVar.requestTimestamp = myRealTimestamp;
        console.log(frameNum);
        socket.emit('c0', C0.encode(myVar));
      }
      
      // update
      for(key in valueStore){
        let c0 = valueStore[key];
        c0.update(ela);
      }



      // render
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);



      for(key in valueStore){
        let c0 = valueStore[key];
        ctx.fillStyle = colors[parseInt(key, 10)];
        ctx.fillRect(c0.lerpedValue, 100, 10,10);
      }

      

      $('#status-text')[0].innerHTML = myRealTimestamp;
      //$('#status-text')[0].innerHTML = myVar.requestSequenceNumber;
    }

  }

  window.requestAnimationFrame(step.bind(this));
}

