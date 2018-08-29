var width = 600;
var height = 400;
var samples = 200;

var container = d3.select("body")
  .append("div")
  .classed("svg-container", true);

var svg = container
  .append("svg")
  .attr("preserveAspectRatio", "xMinYMin meet")
  .attr("viewBox", "0 0 " + width + " " + height)
  .classed("svg-content-responsive", true);

var sites = d3.range(samples)
  .map(function() { return [Math.random() * width, Math.random() * height]; });

var voronoi = d3.voronoi()
  .extent([[-1, -1], [width + 1, height + 1]]);

var polygons = svg.selectAll("path")
  .data(voronoi.polygons(sites))
  .enter().append("path")
  .call(redraw);

var text = svg.append("text")
  .attr("x", width/2)
  .attr("y", height/2){{?d.cls.heading}}
  .classed("{{=d.cls.heading}}", true){{?}}
  .text("{{=d.heading}}")
  .style("text-anchor", "middle");

function redraw (polygon) {
  polygon
    .attr("d", function(d) { return "M" + d.join("L") + "Z"; })
    .style("fill", function(d) { return color(d.data); })
    .style("stroke", function(d) { return color(d.data); });
}

function color (d) {
  var dx = d[0] - width / 2,
    dy = d[1] - height / 2;
  return d3.lab(100 - (dx * dx + dy * dy) / 5000, dx / 10, dy / 10);
}
