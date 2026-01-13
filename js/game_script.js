

"use strict";
// creating element and placed in perticular class
function element(name, className) {
  var element = document.createElement(name);
  if (className) element.className = className;
  return element;
}

/* Vector */
function Vector(x, y) {
  this.x = x;
  this.y = y;
}
//this is for changing co-ordinates of player
Vector.prototype.plus = function (other) {
  return new Vector(this.x + other.x, this.y + other.y);
};
//this is for changing shape after died
Vector.prototype.times = function (factor) {
  return new Vector(this.x * factor, this.y * factor);
};
//level objects 
//by creating stack of array of element's  in level
function Level(plan) {
  this.width = plan[0].length;
  this.height = plan.length;
  this.grid = [];
  this.actors = [];
  // build the grid
  for (var y = 0; y < this.height; y++) {
    var line = plan[y],
      gridLine = [];
    for (var x = 0; x < this.width; x++) {
      var ch = line[x],
        fieldType = null;
      var Actor = actorChars[ch];
      if (Actor)
        this.actors.push(new Actor(new Vector(x, y), ch));
      else if (ch == "x")
        fieldType = "wall";
      else if (ch == "!")
        fieldType = "lava";
      gridLine.push(fieldType);
    }
    this.grid.push(gridLine);
  }
  this.player = this.actors.filter(function (actor) {
    return actor.type == "player";
  })[0];
  this.status = this.finishDelay = null;
}
Level.prototype.isFinished = function () {
  return this.status != null && this.finishDelay < 0;
}
//create floors which restrict the motion of player
Level.prototype.obstacleAt = function (pos, size) {
  var xStart = Math.floor(pos.x);
  var xEnd = Math.ceil(pos.x + size.x);
  var yStart = Math.floor(pos.y);
  var yEnd = Math.ceil(pos.y + size.y);
  if (xStart < 0 || xEnd > this.width || yStart < 0)
    return "wall";
  if (yEnd > this.height)
    return "lava";
  for (var y = yStart; y < yEnd; y++) {
    for (var x = xStart; x < xEnd; x++) {
      var fieldType = this.grid[y][x];
      if (fieldType) return fieldType;
    }
  }
}
// very important it separete thr player and grids
// Handle the collisions between the player and other dynamic actors.
Level.prototype.actorAt = function (actor) {
  for (var i = 0; i < this.actors.length; i++) {
    var other = this.actors[i];
    if (other != actor &&
      actor.pos.x + actor.size.x > other.pos.x &&
      actor.pos.x < other.pos.x + other.size.x &&
      actor.pos.y + actor.size.y > other.pos.y &&
      actor.pos.y < other.pos.y + other.size.y)
      return other;
  }
};
var maxStep = 0.05;
Level.prototype.animate = function (step, keys) {
  if (this.status != null) {
    this.finishDelay -= step;
  }
  while (step > 0) {
    var thisStep = Math.min(step, maxStep);
    this.actors.forEach(function (actor) {
      actor.act(thisStep, this, keys);
    }, this);
    step -= thisStep;
  }
};
// Handles collisions between the player and other objects
Level.prototype.playerTouched = function (type, actor) {
  if (type == "lava" && this.status == null) {
    this.status = "lost";
    this.finishDelay = 1;
  } else if (type == "coin") {
    this.actors = this.actors.filter(function (other) {
      return other != actor;
    });
    if (!this.actors.some(function (actor) {
      return actor.type == "coin";
    })) {
      this.status = "won";
      this.finishDelay = 1;
    }
  }
};
var actorChars = {
  "@": Player,
  "o": Coin,
  "=": Lava,
  "|": Lava,
  "v": Lava
};
//define our mario
function Player(pos) {
  this.pos = pos.plus(new Vector(0, -0.5));
  this.size = new Vector(0.8, 1.5);
  this.speed = new Vector(0, 0);
}

//create our mario and its movement
Player.prototype.type = "player";
// Horizontal motion
var playerXSpeed = 7;
Player.prototype.moveX = function (step, level, keys) {
  this.speed.x = 0;
  if (keys.left) this.speed.x -= playerXSpeed;
  if (keys.right) this.speed.x += playerXSpeed;

  var motion = new Vector(this.speed.x * step, 0);
  var newPos = this.pos.plus(motion);
  var obstacle = level.obstacleAt(newPos, this.size);
  if (obstacle)
    level.playerTouched(obstacle);
  else
    this.pos = newPos;
};
var gravity = 30;
var jumpSpeed = 17;
Player.prototype.moveY = function (step, level, keys) {
  this.speed.y += step * gravity;
  var motion = new Vector(0, this.speed.y * step);
  var newPos = this.pos.plus(motion);
  var obstacle = level.obstacleAt(newPos, this.size);
  if (obstacle) {
    level.playerTouched(obstacle);
    if (keys.up && this.speed.y > 0)
      this.speed.y = -jumpSpeed;
    else
      this.speed.y = 0;
  } else {
    this.pos = newPos;
  }
};

Player.prototype.act = function (step, level, keys) {
  this.moveX(step, level, keys);
  this.moveY(step, level, keys);

  // Update facing direction based on speed
  if (this.speed.x > 0) this.facing = "right";
  else if (this.speed.x < 0) this.facing = "left";

  // Update state (idle, run, jump)
  // Check typical gravity effects. If speed.y is significantly different from 0, we are "jumping" or falling.
  // We can use a small threshold.
  if (Math.abs(this.speed.y) > 0.1) {
    this.state = "jump";
  } else if (Math.abs(this.speed.x) > 0) {
    this.state = "run";
  } else {
    this.state = "idle";
  }

  var otherActor = level.actorAt(this);
  if (otherActor)
    level.playerTouched(otherActor.type, otherActor);
  if (level.status == "lost") {
    this.pos.y += step;
    this.size.y -= step;
  }
};
//lava objects
function Lava(pos, ch) {
  this.pos = pos;
  this.size = new Vector(1, 1);
  if (ch == "=") {
    this.speed = new Vector(2, 0);
  } else if (ch == "|") {
    this.speed = new Vector(0, 2);
  } else if (ch == "v") {
    this.speed = new Vector(0, 3);
    this.repeatPos = pos;
  }
}
Lava.prototype.type = "lava";
Lava.prototype.act = function (step, level) {
  var newPos = this.pos.plus(this.speed.times(step));
  if (!level.obstacleAt(newPos, this.size))
    this.pos = newPos;
  else if (this.repeatPos)
    this.pos = this.repeatPos;
  else
    this.speed = this.speed.times(-1);
};
//coin objects
function Coin(pos) {
  this.basePos = this.pos = pos.plus(new Vector(0.2, 0.1));
  this.size = new Vector(0.6, 0.6);
  this.wobble = Math.random() * Math.PI * 2;
}

Coin.prototype.type = "coin";

var wobbleSpeed = 8,
  wobbleDist = 0.07;
Coin.prototype.act = function (step) {
  this.wobble += step * wobbleSpeed;
  var wobblePos = Math.sin(this.wobble) * wobbleDist;
  this.pos = this.basePos.plus(new Vector(0, wobblePos));
};
//Dom Display objects
function DOMDisplay(parent, level) {
  this.wrap = parent.appendChild(element("div", "game"));
  this.level = level;
  this.wrap.appendChild(this.drawBackground());
  this.actorLayer = null;
  this.drawFrame();
}
var scale = 20;

DOMDisplay.prototype.drawBackground = function () {
  var table = element("table", "background");
  table.style.width = this.level.width * scale + "px";
  this.level.grid.forEach(function (row) {
    var rowelement = table.appendChild(element("tr"));
    rowelement.style.height = scale + "px";
    row.forEach(function (type) {
      rowelement.appendChild(element("td", type));
    });
  });
  return table;
};

DOMDisplay.prototype.drawActors = function () {
  var wrap = element("div");
  this.level.actors.forEach(function (actor) {
    var rect = wrap.appendChild(element("div",
      "actor " + actor.type));

    // Add facing class for player
    if (actor.type == "player") {
      if (actor.facing) rect.className += " facing-" + actor.facing;
      if (actor.state) rect.className += " state-" + actor.state;
    }

    rect.style.width = actor.size.x * scale + "px";
    rect.style.height = actor.size.y * scale + "px";
    rect.style.left = actor.pos.x * scale + "px";
    rect.style.top = actor.pos.y * scale + "px";
  });
  return wrap;
};
DOMDisplay.prototype.drawFrame = function () {
  if (this.actorLayer)
    this.wrap.removeChild(this.actorLayer);
  this.actorLayer = this.wrap.appendChild(this.drawActors());
  // By adding the level’s current status as a class name to the wrapper, 
  // we can style the player actor slightly differently when the game is won or lost
  this.wrap.className = "game " + (this.level.status || "");
  this.scrollPlayerIntoView();
};
DOMDisplay.prototype.scrollPlayerIntoView = function () {
  var width = this.wrap.clientWidth;
  var height = this.wrap.clientHeight;
  var margin = width / 3;
  var left = this.wrap.scrollLeft,
    right = left + width;
  var top = this.wrap.scrollTop,
    bottom = top + height;

  var player = this.level.player;
  var center = player.pos.plus(player.size.times(0.5)).times(scale);
  if (center.x < left + margin)
    this.wrap.scrollLeft = center.x - margin;
  else if (center.x > right - margin)
    this.wrap.scrollLeft = center.x + margin - width;

  if (center.y < top + margin)
    this.wrap.scrollTop = center.y - margin;
  else if (center.y > bottom - margin)
    this.wrap.scrollTop = center.y + margin - height;
};
DOMDisplay.prototype.clear = function () {
  this.wrap.parentNode.removeChild(this.wrap);
};

var arrowCodes = {
  37: "left",
  38: "up",
  39: "right",
};

function trackKeys(codes) {
  var pressed = Object.create(null);

  function handler(event) {
    if (codes.hasOwnProperty(event.keyCode)) {
      var down = event.type == "keydown";
      pressed[codes[event.keyCode]] = down;
      event.preventDefault();
    }
  }
  addEventListener("keydown", handler);
  addEventListener("keyup", handler);

  pressed.unregister = function () {
    removeEventListener("keydown", handler);
    removeEventListener("keyup", handler);
  }

  return pressed;
}

function runAnimation(frameFunc) {
  var lastTime = null;

  function frame(time) {
    var stop = false;
    if (lastTime != null) {
      var timeStep = Math.min(time - lastTime, 100) / 1000; // convert to seconds
      stop = frameFunc(timeStep) == false;
    }
    lastTime = time;
    if (!stop)
      requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
function runLevel(level, Display, andThen) {
  var parent = document.getElementById("game-wrapper") || document.body;
  var display = new Display(parent, level);
  var running = "yes";

  // Start Recording
  if (window.gameRecorder) window.gameRecorder.start();

  function handleEscKey(event) {
    if (event.keyCode == 27) { // ESC's key code is 27
      var handler = arrows.eventListener;
      if (running == "yes") {
        running = "pausing";
      } else if (running == "no") { // resume
        running = "yes";
        runAnimation(animation);
      } else if (running == "pausing") { // not yet stop animation
        running = "yes";
      }
    }
  }
  addEventListener("keydown", handleEscKey);
  var arrows = trackKeys(arrowCodes);

  function animation(step) {
    if (running == "pausing") {
      running = "no";
      return false; // actually pause the game
    }

    level.animate(step, arrows);

    // Record Frame
    if (window.gameRecorder) {
      window.gameRecorder.recordFrame(level.player, arrows);
    }

    display.drawFrame(step);
    if (level.isFinished()) {
      display.clear();
      removeEventListener("keydown", handleEscKey);
      arrows.unregister();
      if (andThen)
        andThen(level.status);
      return false;
    }
  }

  runAnimation(animation);
}

function updateHUD(lives, level) {
  var livesDisplay = document.getElementById('lives-display');
  var levelDisplay = document.getElementById('level-display');
  if (livesDisplay) livesDisplay.textContent = "Lives: " + lives;
  if (levelDisplay) levelDisplay.textContent = "Level: " + (level + 1);
}

function showOverlay(message, isShown) {
  var overlay = document.getElementById('overlay');
  var overlayMsg = document.getElementById('overlay-message');
  if (overlay && overlayMsg) {
    if (isShown) {
      overlayMsg.textContent = message;
      overlay.classList.remove('hidden');
    } else {
      overlay.classList.add('hidden');
    }
  }
}

function runGame(plans, Display) {
  // We keep the original 'plans' as the starting set.
  // When we run out, we ask LMM for more.

  function startLevel(n, lives) {
    updateHUD(lives, n);

    // Check if we need to generate a level
    var levelPlanPromise;
    if (n < plans.length) {
      levelPlanPromise = Promise.resolve(plans[n]);
    } else {
      // Ask LMM for a new level
      showOverlay("AI GENERATING LEVEL...", true);
      var history = window.gameRecorder ? window.gameRecorder.getSummary() : {};
      levelPlanPromise = window.lmmAgent.generateNextLevel(history)
        .then(function (newPlan) {
          showOverlay("", false);
          // plans.push(newPlan); // Optionally save it
          return newPlan;
        });
    }

    levelPlanPromise.then(function (currentPlan) {
      runLevel(new Level(currentPlan), Display, function (status) {
        if (status == "lost") {
          if (window.gameRecorder) window.gameRecorder.logEvent('death', { level: n });

          if (lives > 0) {
            startLevel(n, lives - 1);
          } else {
            showOverlay("GAME OVER", true);
            if (window.gameRecorder) window.gameRecorder.saveHistory();
            setTimeout(function () {
              showOverlay("", false);
              startLevel(0, 3); // Restart from beginning? Or reset logic?
            }, 2000);
          }
        } else { // "won"
          // Proceed to next level (which might trigger LMM)
          startLevel(n + 1, lives);
        }
      });
    });
  }
  startLevel(0, 3);
}

// create game levels here
// create game levels here
var GAME_LEVELS = [
  [
    "                                                                                ",
    "                                                                                ",
    "                                                                                ",
    "                                                                                ",
    "                                                                                ",
    "                                                                                ",
    "                                                                                ",
    "                                                                                ",
    "                                                                                ",
    "                                                                                ",
    "                                                                      xxx       ",
    "                                                     xx      xx      xx!xx      ",
    "                                      o o      xx    xx!xx   xrx    xx!xx       ",
    "               @              xx     xxxxx     xx!xx xx!xx   xrx    xx!xx       ",
    "             xxxx            xxxx   xxxxxxx    xx!xx xx!xx   xrx    xx!xx       ",
    "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  ]
];
runGame(GAME_LEVELS, DOMDisplay);