const Draw = new Drawing(document.getElementById('c'))
const game = new Game(levels)

const levelIndex = 0
game.loadLevel(levelIndex)

setTimeout(() => {
  document.getElementById('intro').className = 'a'
}, 1)

let previous
let accumulator = 0 //stores incrementing value (in seconds) until the next tick, when it's then decremented by 1 tick's length
const update = time => {
  requestAnimationFrame(update)
  if (previous === undefined) {
    previous = time
  }
  const dt = (time - previous) / 1000.0
  accumulator += dt

  if (accumulator > 1.0 / settings_tps) {
    accumulator -= 1.0 / settings_tps
    game.tick()
  }
  if (accumulator > 1.0 / settings_tps) {
    accumulator = 1.0 / settings_tps
  }

  game.draw(accumulator, time / 1000.0, dt)

  previous = time
}
requestAnimationFrame(update)

const keyMap = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Backspace: 'back'
}
window.addEventListener('keydown', ev => {
  if (keyMap[ev.code]) {
    game.buttonDown(keyMap[ev.code])
    ev.preventDefault()
  } else {
    game.buttonDown('*') //any-key
  }
  return false
})
window.addEventListener('keyup', ev => {
  if (keyMap[ev.code]) {
    game.buttonUp(keyMap[ev.code])
    ev.preventDefault()
  }
  return false
})

let fullscreen = false
function openFullscreen() {
  if (!fullscreen) {
    document.documentElement.requestFullscreen({ navigationUI: 'hide' })
    fullscreen = true
  }
}

TouchCompat.init()
TouchCompat.joystick().on('move', function (e, data) {
  var angle = data.angle.degree;
  game.buttonUp('up');
  game.buttonUp('down');
  game.buttonUp('left');
  game.buttonUp('right');
  if (data.force > 0.5) {
    var down = 200 <= angle && angle < 340;
    var up = 20 <= angle && angle < 160;
    var left = 110 <= angle && angle < 250;
    var right = (0 <= angle && angle < 70) || (290 <= angle && angle <= 360);
    if (up || down) {
      game.buttonDown(up ? 'up' : 'down')
    }
    if (left || right) {
      game.buttonDown(left ? 'left' : 'right')
    }
  }
}).on('start', function () {
  game.buttonDown('s')
}).on('end', function () {
  openFullscreen();
  game.buttonUp('up');
  game.buttonUp('down');
  game.buttonUp('left');
  game.buttonUp('right');
})
