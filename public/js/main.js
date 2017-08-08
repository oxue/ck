function initApp(){
  var keyMan = new Key();

  var testSocket = io();

  let boxes = [];

  var cli = new cksync.Client(testSocket, 'localhost:2000', (clientId)=>{
    const keyX = clientId + '-xValue';
    cli.valueStore[keyX] = new cksync.C0(keyX, 100 + 10 * clientId);
  });

  var canvas = $('canvas')[0];
  var ctx = canvas.getContext('2d');


  var colors = ['blue', 'red', 'green', 'black', 'orange', 'purple'];
  let randomClockOffset = Math.random() * 2000;
  let speed = 400;
  let myLocalTimestamp = 0;
  var then = 0;


  step = (timestamp) => {
    window.requestAnimationFrame(step.bind(this));
    cli.update(timestamp);
    myLocalTimestamp = timestamp + randomClockOffset;

    cli.processBuffers();
    
    ela = myLocalTimestamp - then;

    // TODO: move this into a time locked event
    // buffered network updates
    if(ela > 1000/30){
      then = myLocalTimestamp - (ela % 1000/30);

      if(!cli.isReady()) return;
      
      myVar = cli.valueStore[cli.clientId+'-xValue'];

      // input
      let newDelta = 0;
      if(cli.clientId == 1){
        if(keyMan.isDown(Key.A)) newDelta = -speed;
        if(keyMan.isDown(Key.D)) newDelta = speed;
      }else{
        if(keyMan.isDown(Key.LEFT)) newDelta = -speed;
        if(keyMan.isDown(Key.RIGHT)) newDelta = speed;
      }
      myVar.setDelta(newDelta);

      cli.sendDirtyValues();

      
      
      // update
      for(key in cli.valueStore){

        let c0 = cli.valueStore[key];
        c0.update(ela);
        
      }

      // render
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for(key in cli.valueStore){
        let c0 = cli.valueStore[key];
        ctx.fillStyle = colors[parseInt(key, 10)];
        ctx.fillRect(c0.lerpedValue, 100, 10,10);
      }
    }
    $('#status-text')[0].innerHTML = cli.synchronizedClientTime.toFixed(0) + ' / ' + cli.ping;
  }

  window.requestAnimationFrame(step.bind(this));
}

