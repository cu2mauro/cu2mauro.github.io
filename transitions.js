/* Page-change transitions: the new page is revealed through an animated mask
   (cross-document View Transitions). Browsers without support load pages normally.
   Click or press a key to skip. */
(function () {
  if (!("onpagereveal" in window)) return;

  var DURATION = 1000;  // ms
  var FRAMES = 48;      // mask keyframes per transition
  // Effect per destination page; pages not listed get a random effect (never the same twice in a row).
  var PAGE_EFFECT = {
    // index: "profile", cv: "merger", publications: "wilson", research: "bubbles", outreach: "bubbles"
  };

  function poly(pts) {
    return "M" + pts.map(function (p) { return p[0].toFixed(1) + " " + p[1].toFixed(1); }).join("L") + "Z";
  }
  function circle(cx, cy, r, n, wobble) {
    var pts = [];
    for (var k = 0; k < n; k++) {
      var th = 2 * Math.PI * k / n;
      var rr = wobble ? r * (1 + wobble(th)) : r;
      pts.push([cx + rr * Math.cos(th), cy + rr * Math.sin(th)]);
    }
    return poly(pts);
  }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function rng(seed) {  // small deterministic PRNG
    return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  }

  var EFFECTS = {
    // 1. Bubble-wall (kink) profile sweeping down, tail along the left edge
    profile: function (t, W, H) {
      var e = smooth(t);
      var Y = -0.03 * H + 1.12 * H * e;
      var X0 = W * (0.04 + 0.12 * Math.sin(Math.PI * t));
      var w = W * (0.02 + 0.05 * t);
      var pts = [[-2, -2], [W + 2, -2]];
      for (var i = 0; i <= 80; i++) {
        var x = W + 2 - (W + 4) * i / 80;
        var s = 1 / (1 + Math.exp((x - X0) / w));
        pts.push([x, Y + (1.1 * H - Y) * s]);
      }
      return poly(pts);
    },

    // 2. Binary inspiral -> merger -> ringing remnant growing to fill the screen
    merger: function (t, W, H) {
      var m = Math.min(W, H), cx = W / 2, cy = H / 2, n = 40, tm = 0.45;
      if (t < tm) {
        var u = t / tm;
        var d = 0.11 * m * Math.pow(1 - u, 0.5);             // separation shrinks
        var phi = Math.PI / 2 + 9 * (1 - Math.pow(1 - u, 1.6)); // orbit speeds up (chirp)
        var r = m * (0.008 + 0.06 * u * u);
        var dx = d * Math.cos(phi), dy = d * Math.sin(phi);
        return circle(cx + dx, cy + dy, r, n) + circle(cx - dx, cy - dy, r, n);
      }
      var v = (t - tm) / (1 - tm);
      var R = 0.07 * m + 0.62 * Math.hypot(W, H) * Math.pow(v, 1.5);
      var a = 0.22 * Math.exp(-4 * v);                       // ringdown wobble
      var c = circle(cx, cy, R, n, function (th) {
        return a * Math.cos(2 * th - 14 * v) + 0.4 * a * Math.cos(3 * th + 9 * v);
      });
      return c + c;
    },

    // 3. Holographic Wilson loop: U-shaped string from the right boundary,
    //    flattening at the bottom as the separation L grows
    wilson: function (t, W, H) {
      var e = smooth(t);
      var yc = 0.42 * H;
      var L = H * (0.05 + 2.5 * Math.pow(e, 1.6));
      var D = 0.5 * L * (1 + 1.6 * e);
      var p = 2 + 6 * e;                                     // superellipse: round -> flat bottom
      var pts = [[W + 2, yc - L / 2]];
      for (var i = 0; i <= 80; i++) {
        var u = -1 + 2 * i / 80;
        var g = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), p)), 1 / p);
        pts.push([W - D * g, yc + u * L / 2]);
      }
      pts.push([W + 2, yc + L / 2]);
      return poly(pts);
    },

    // 4. Random nucleation, growth and collision of many bubbles
    bubbles: function (t, W, H) {
      var rand = rng(7), cols = 5, rows = 4, n = 28, path = "";
      var Rmax = 0.36 * Math.hypot(W, H);
      for (var i = 0; i < cols; i++) for (var j = 0; j < rows; j++) {
        var x = (i + 0.15 + 0.7 * rand()) * W / cols;
        var y = (j + 0.15 + 0.7 * rand()) * H / rows;
        var tn = 0.45 * rand();
        var s = Math.max(0, (t - tn) / (1 - tn));
        path += circle(x, y, Rmax * Math.pow(s, 1.3), n);
      }
      return path;
    }
  };

  window.addEventListener("pagereveal", function (e) {
    var vt = e.viewTransition;
    if (!vt) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { vt.skipTransition(); return; }
    var page = (location.pathname.split("/").pop() || "index.html").replace(/\.html$/, "") || "index";
    var name = PAGE_EFFECT[page];
    if (!name) {
      var last = null;
      try { last = sessionStorage.getItem("vt-last"); } catch (err) {}
      var names = Object.keys(EFFECTS).filter(function (k) { return k !== last; });
      name = names[Math.floor(Math.random() * names.length)];
      try { sessionStorage.setItem("vt-last", name); } catch (err) {}
    }
    var effect = EFFECTS[name];
    var skip = function () { vt.skipTransition(); };
    window.addEventListener("pointerdown", skip, { once: true });
    window.addEventListener("keydown", skip, { once: true });
    // outline drawn along the mask edge (own view-transition layer, above both pages)
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "vt-edge");
    svg.setAttribute("aria-hidden", "true");
    // stroke only outside the revealed region, so overlapping shapes show just their union's boundary
    svg.innerHTML = '<defs><mask id="vt-out" maskUnits="userSpaceOnUse" x="-50" y="-50" width="100000" height="100000">' +
      '<rect x="-50" y="-50" width="100000" height="100000" fill="#fff"/><path fill="#000"/></mask></defs>' +
      '<path class="vt-stroke" mask="url(#vt-out)"/>';
    var inner = svg.querySelector("mask path"), edge = svg.querySelector(".vt-stroke");
    document.documentElement.appendChild(svg);
    vt.ready.then(function () {
      var W = window.innerWidth, H = window.innerHeight, frames = [];
      svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      for (var i = 0; i <= FRAMES; i++) frames.push({ clipPath: 'path("' + effect(i / FRAMES, W, H) + '")' });
      var anim = document.documentElement.animate(frames, {
        duration: DURATION, easing: "linear", pseudoElement: "::view-transition-new(root)"
      });
      (function draw() {
        if (anim.playState !== "running") return;
        var d = effect(Math.min(1, anim.currentTime / DURATION), W, H);
        edge.setAttribute("d", d);
        inner.setAttribute("d", d);
        requestAnimationFrame(draw);
      })();
    });
    vt.finished.finally(function () {
      svg.remove();
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
    });
  });
})();
