function initApp(){
  var keyMan = new Key();

  encode = (c0) => {
    return c0.key + '/' + c0.value + '/' + c0.delta + '/' + c0.requestSequenceNumber + '/' + c0.requestTimestamp;
  };

  var socket = io();
  socket.connect('localhost:2000');
  var prevNetUp = 0;

  const NETUPINTERVAL = 100;

  var canvas = $('canvas')[0];
  var ctx = canvas.getContext('2d');

  var valueStore = {};

  var colors = ['blue', 'red', 'green', 'black', 'orange', 'purple'];
  var id = -1;

  var myTime = 0;
  var requestSequenceNumber = 0;

  socket.on('id', (_id) => {
    console.log('id'+_id);
    id = _id;
    valueStore['' + id] = new C0(_id+'', 100, 100);
  });

  socket.on('c0', (msg) => {
    let data = msg.split('/');
    let idid = data[0];
    let value = parseFloat(data[1]);
    let delta = parseFloat(data[2]);
    const rsn = parseFloat(data[3]);

    var recd = C0.decode(msg);

    let c0 = valueStore['' + recd.key];
    if (!c0) {
      c0 = new C0(idid, value, delta, rsn);
      valueStore['' + idid] = c0;
    }


    console.log(colors[id] + rsn + '/' + c0.requestSequenceNumber);


    if(rsn >= c0.requestSequenceNumber){

      c0.value = value;
      c0.delta = delta;
    }

    
    
  });

  var then = 0;

  step = (timestamp) => {
    window.requestAnimationFrame(step.bind(this));

    now = timestamp;
    myTime = now;

    ela = now - then;

    if(ela > 1000/30){
      then = now - (ela % 1000/30);

      if(id == -1) return;
      
      myVar = valueStore[id+''];

      // input
      myVar.delta = 0;
      if(keyMan.isDown(Key.LEFT)) myVar.delta = -50;
      if(keyMan.isDown(Key.RIGHT)) myVar.delta = 50;

      // update
      for(key in valueStore){
        let c0 = valueStore[key]
        c0.update(ela);
        if(c0.value > 390){
          c0.value = 390;
        }
      }

      // render
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for(key in valueStore){
        let c0 = valueStore[key]
        ctx.fillStyle = colors[parseInt(key, 10)];
        ctx.fillRect(c0.value, 100, 10,10);
      }

      // netcode
      //if(timestamp - prevNetUp > NETUPINTERVAL){
        //prevNetUp = timestamp - (ela % 1000/30);

        if(myVar.deltaDirty){
          myVar.requestSequenceNumber ++;
          myVar.requestTimestamp = now;
          socket.emit('c0', encode(myVar));
        }
      //}

      $('#status-text')[0].innerHTML = myVar.requestSequenceNumber;
    }

  }

  window.requestAnimationFrame(step.bind(this));
}

