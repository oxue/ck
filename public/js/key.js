class Key{
  constructor() {
    this._pressed = {};
    window.addEventListener('keyup', this.onKeyup.bind(this), false);
    window.addEventListener('keydown', this.onKeydown.bind(this), false);
  }

  isDown(keyCode) {
    return this._pressed[keyCode];
  }
  
  onKeydown(event) {
    this._pressed[event.keyCode] = true;
  }
  
  onKeyup(event) {
    delete this._pressed[event.keyCode];
  }
}

Key.LEFT = 37;
Key.UP = 38;
Key.RIGHT = 39;
Key.DOWN = 40;
Key.A = 65;
Key.D = 68;

if(typeof(module) != 'undefined' && module.exports) {
  module.exports = Key;
} else {
  window.Key = Key;
}
