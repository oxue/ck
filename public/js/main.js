function initApp(){
  var keyMan = new Key();

  encode = (id, c1) => {
    return id + '/' + c1.value + '/' + c1.delta + '/' + c1.requestSequenceNumber;
  };

  var socket = io();
  socket.connect('localhost:2000');
  var prevNetUp = 0;

  const NETUPINTERVAL = 100;

  var canvas = $('canvas')[0];
  var ctx = canvas.getContext('2d');

  var myVar = new C1(0, 100, 100);
  var valueStore = {};

  var colors = ['blue', 'red', 'green', 'black', 'orange', 'purple'];
  var id = -1;

  var myTime = 0;
  var requestSequenceNumber = 0;

  socket.on('id', (_id) => {
    console.log('id'+_id);
    id = _id;
    valueStore['' + id] = myVar;
  });

  socket.on('c1', (msg) => {
    let data = msg.split('/');
    let id = data[0];
    let value = parseFloat(data[1]);
    let delta = parseFloat(data[2]);
    const rsn = parseFloat(data[3]);

    var recd = C1.decode(msg);

    let c1 = valueStore['' + recd.key];
    if (!c1) {
      c1 = new C1(id, value, delta, rsn);
      valueStore['' + id] = c1;
    }

    if(rsn < c1.requestSequenceNumber)

    c1.value = value;
    c1.delta = delta;
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
      
      // input
      myVar.delta = 0;
      if(keyMan.isDown(Key.LEFT)) myVar.delta = -50;
      if(keyMan.isDown(Key.RIGHT)) myVar.delta = 50;

      // update
      for(key in valueStore){
        let c1 = valueStore[key]
        c1.update(ela);
        if(c1.value > 390){
          v1.value = 390;
        }
      }

      // render
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for(key in valueStore){
        let c1 = valueStore[key]
        ctx.fillStyle = colors[parseInt(key, 10)];
        ctx.fillRect(c1.value, 100, 10,10);
      }

      // netcode
      //if(timestamp - prevNetUp > NETUPINTERVAL){
        //prevNetUp = timestamp - (ela % 1000/30);

        if(myVar.deltaDirty){
          requestSequenceNumber ++;
          socket.emit('c1', encode(id, myVar));
        }
      //}

      $('#status-text')[0].innerHTML = requestSequenceNumber;
    }

  }

  window.requestAnimationFrame(step.bind(this));
}

