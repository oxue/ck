function initApp(){
  class Box {
    constructor(cid, netName) {
      this.x = cid + '|xValue+' + netName;
      this.y = cid + '|yValue+' + netName;
    }

    toString() {
      return 'Box' + JSON.stringify(this);
    }
  }

  var keyMan = new Key();

  var testSocket = io();

  var cli = new cksync.Client(testSocket, 'localhost:2000', (clientId)=>{
    cli.valueStore['-1|boxList'] = new cksync.NetList('-1|boxList', clientId);
  });

  var canvas = $('canvas')[0];
  var ctx = canvas.getContext('2d');

  let myBox = null;

  var colors = ['blue', 'red', 'green', 'black', 'orange', 'purple'];
  let randomClockOffset = Math.random() * 2000;
  let speed = 100;
  let myLocalTimestamp = 0;
  var then = 0;

  $('.add-button').click(() => {
    if(myBox) return;
    console.log('add-value');
    let b = myBox = new Box(cli.clientId, 'myBox');
    cli.valueStore['-1|boxList'].push(b);
    cli.valueStore[b.x] = new cksync.C0(b.x, 100 + 10 * cli.clientId);
    cli.valueStore[b.y] = new cksync.C0(b.y, 100);
    //cli.valueStore[b.y] = new cksync.C0(b.y, 100 + 10 * clientId);
  });

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
      

      // input

      if(myBox){
        let myVar = cli.valueStore[myBox.x];

        let newDelta = 0;
        if(cli.clientId == 1){
          if(keyMan.isDown(Key.A)) newDelta = -speed;
          if(keyMan.isDown(Key.D)) newDelta = speed;
        }else{
          if(keyMan.isDown(Key.LEFT)) newDelta = -speed;
          if(keyMan.isDown(Key.RIGHT)) newDelta = speed;
        }
        myVar.setDelta(newDelta);

        myVar = cli.valueStore[myBox.y];

        newDelta = 0;
        if(cli.clientId == 1){
          if(keyMan.isDown(Key.W)) newDelta = -speed;
          if(keyMan.isDown(Key.S)) newDelta = speed;
        }else{
          if(keyMan.isDown(Key.UP)) newDelta = -speed;
          if(keyMan.isDown(Key.DOWN)) newDelta = speed;
        }
        myVar.setDelta(newDelta);
      }

      cli.sendDirtyValues();
      
      // update
      for(key in cli.valueStore){

        let c0 = cli.valueStore[key];
        
        if(c0.type == 'c0') { c0.update(ela); }
        
      }

      // render
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for(ind in cli.valueStore['-1|boxList'].value){
        let b = cli.valueStore['-1|boxList'].value[ind];
        let c0 = cli.valueStore[b.x];
        let c0y = cli.valueStore[b.y];
        if(c0 == undefined || c0y == undefined)
          continue;
        ctx.fillStyle = colors[parseInt(c0.key, 10)];

        ctx.fillRect(c0.lerpedValue, c0y.lerpedValue, 10,10);
      }
    }
    let listText = '';
    if(cli.isReady()) {
      listText = JSON.stringify(cli.valueStore['-1|boxList'].value);
    }
    $('#status-text')[0].innerHTML = listText + ' / ' + cli.ping.toFixed(0);
  }

  window.requestAnimationFrame(step.bind(this));
}

