d3.select('#svg').on('click', function () {
  draw('svg');
});

d3.select('select').on('change.pattern', function () {
  pattern = d3.select(this).property('value');
  load();
});

d3.select('button').on('click.randomise', function () {
  game.addRandom();
});

var example = d3.select("#example"),
  width = window.innerWidth,
  height = window.innerHeight,
  delta = 20,
  speed = 200,
  Ny = Math.floor(height/delta),
  Nx = Math.floor(width/delta),
  game = gameOfLife(Nx, Ny),
  pattern = 'gosper',
  radius = delta/2,
  squares = d3.map(),
  alive, dead, trail, squares,
  currentType,
  currentRes;

draw('svg');
load();
d3.timeout(redraw);

function load () {
  d3.csv('https://fluidily-public.s3.amazonaws.com/fluidily/life/' + pattern + '.csv')
    .then(function(data) {
      delete data.columns;
      squares = d3.map();
      game.reset(data);
      draw(currentType, currentRes);
    });
}

function redraw () {
  var cells = game.step(),
    stylet = false,
    current = alive.selectAll('circle').data(cells.alive);
  
  current
    .enter()
    .append('circle')
    .attr('r', radius)
    .merge(current)
    .style('fill', function (d) {
      return d.isnew ? '#1d91c0' : '#333';
    })
    .attr('cx', function (d) {
      return delta * d[0] - radius;
    })
    .attr('cy', function (d) {
      return delta * d[1] - radius;
    });
  
  current.exit().remove();
  
  current = dead.selectAll('circle').data(cells.dead);
  
  current
    .enter()
    .append('circle')
    .attr('r', radius)
    .merge(current)
    .style('fill', '#e31a1c')
    .attr('cx', function (d) {
      return delta * d[0] - radius;
    })
    .attr('cy', function (d) {
      return delta * d[1] - radius;
    })
    .transition()
    .duration(speed-20)
    .style('fill', '#fff')
    .transition()
    .duration(10)
    .each(function (d) {
      if (!squares.get(d)) {
        squares.set(d, d);
        stylet = true;
      }
    }).remove();
  
  if (stylet) styleTrail();
  
  d3.timeout(redraw, speed);
}

function draw(type, r) {
  example.select('.paper').remove();
  var paper = example
    .append(type)
    .classed('paper', true)
    .attr('width', width).attr('height', height)
    .attr("preserveAspectRatio", "xMinYMin meet")
    .attr("viewBox", "0 0 " + width + " " + height)
    .style('stroke', '#999')
    .style('stroke-width', 0.5);
  
  currentType = type;
  currentRes = r;
  
  paper.append('g')
    .selectAll('line')
    .data(d3.range(Ny+1))
    .enter()
    .append('line')
    .attr('x1', 0)
    .attr('y1', function (d, i) {return delta*i})
    .attr('x2', Nx*delta)
    .attr('y2', function (d, i) {return delta*i});
  
  paper.append('g')
    .selectAll('line')
    .data(d3.range(Nx+1))
    .enter()
    .append('line')
    .attr('y1', 0)
    .attr('x1', function (d, i) {return delta*i})
    .attr('y2', Ny*delta)
    .attr('x2', function (d, i) {return delta*i});
  
  alive = paper.append('g').classed('alive', true).style('stroke', 'none');
  dead = paper.append('g').classed('dead', true).style('stroke', 'none');
  trail = paper.append('g').classed('trail', true).style('stroke', 'none');
  
  styleTrail();
  
}

function styleTrail () {
  trail.selectAll('rect')
    .data(squares.values())
    .enter()
    .append('rect')
    .attr('x', function (d) {return delta * (d[0] - 1);})
    .attr('y', function (d) {return delta * (d[1] - 1);})
    .attr('height', delta)
    .attr('width', delta)
    .style('fill', '#e31a1c')
    .style('fill-opacity', 0.1);
}

function gameOfLife(N, M) {
  var cells = d3.map(),
    life = 0;
  
  return {
    reset: reset,
    step: step,
    addRandom: addRandom
  };
  
  function reset (data) {
    cells.clear();
    data.forEach(function (d) {
      d = [+d.i, +d.j];
      cells.set(d, d);
    });
    life = 0;
  }
  
  function step () {
    var dead = [];
    
    if (life) {
      var num,
        alive = d3.map(),
        born = d3.map();
      
      cells.each(function (cell, key) {
        num = neighbours(cell, born);
        if (num > 1 && num < 4) {
          cell.isnew = false;
          alive.set(key, cell);
        } else {
          dead.push(cell);
        }
      });
      
      
      cells = alive;
      
      born.each(function (num, key) {
        if (num === 3) {
          key = key.split(',');
          var cell = [+key[0], +key[1]];
          cell.isnew = true;
          cells.set(key, cell);
        }
      });
    }
    life += 1;
    return {alive: cells.values(), dead: dead};
  }
  
  function addRandom (p) {
    var n = Math.floor((p || 0.05)*N*M),
      i = d3.randomUniform(0, N-1),
      j = d3.randomUniform(1, M),
      d;
    for (var k=0; k<n; ++k) {
      d = [Math.floor(i()) + 1, Math.floor(j()) + 1];
      cells.set(d, d);
    }
    }
    
    function add (cell, i, j, dead) {
      i = cell[0] + i;
      j = cell[1] + j;
      i = i <= N ? (i > 0 ? i : N) : 1;
      j = j <= M ? (j > 0 ? j : M) : 1;
      var index = '' + [i, j];
      
      if (cells.get(index)) return 1;
      
      var idx = dead.get(index) || 0;
      dead.set(index, idx + 1);
      return 0;
    }
    
    function neighbours (cell, dead) {
      return  add(cell, -1, -1, dead) +
      add(cell, 0, -1, dead) +
      add(cell, 1, -1, dead) +
      add(cell, -1, 0, dead) +
      add(cell, 1, 0, dead) +
      add(cell, -1, 1, dead) +
      add(cell, 0, 1, dead) +
      add(cell, 1, 1, dead);
    }
    
    }