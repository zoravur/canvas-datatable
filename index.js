function drawTable(ctx, x, y, n_rows, n_cols, cellWidth, cellHeight) {
  // Set line styles
  ctx.strokeStyle = 'black';
  // ctx.lineWidth = 0.8;
  // console.log(this.scaling);
  // console.log(ctx.lineWidth);

  x = x + 0.5;
  y = y + 0.5;

  // Draw vertical lines
  for (let i = 0; i <= n_cols; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i * cellWidth, y);
    ctx.lineTo(x + i * cellWidth, y + n_rows * cellHeight);
    ctx.stroke();
  }

  // Draw horizontal lines
  for (let i = 0; i <= n_rows; i++) {
    ctx.beginPath();
    ctx.moveTo(x, y + i * cellHeight);
    ctx.lineTo(x + n_cols * cellWidth, y + i * cellHeight);
    ctx.stroke();
  }
}

// Define the Web Component
class DataTable extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.addEventListener("click", (evt) => {
      console.log("DataTable clicked", evt);
    });
  }

  get columns() {
    return this.getAttribute("columns");
  }

  set columns(value) {
    if (value) {
      this.setAttribute("columns", value);
    } else {
      this.removeAttribute("columns");
    }
    this.render();
  }

  get readonly() {
    return this.hasAttribute("readonly");
  }

  set readonly(value) {
    if (value) {
      this.setAttribute("readonly", true);
    } else {
      console.error("The readonly attribute cannot be removed");
    }
  }

  connectedCallback() {
    this.shadowRoot.innerHTML = `
            <style>
              canvas {
                border: 1px solid black;
              }
            </style>

            <canvas id="canvas"></canvas>
        `;

    console.log(window.devicePixelRatio);
    const scaling = (window.devicePixelRatio || 1);
    // this.scaling = scaling;
    // const scaling = 1;

    console.log(this.getAttribute('width'));

    this.canvas = this.shadowRoot.getElementById("canvas");
    const canvas = this.canvas;
    canvas.width = Number(this.getAttribute('width')) * scaling;
    canvas.height = Number(this.getAttribute('height')) * scaling;
    canvas.style.width = canvas.width / scaling + "px";
    canvas.style.height = canvas.height / scaling + "px";

    window.addEventListener('resize', (event) => {
      console.log(window.devicePixelRatio);
      this.scaleCanvas();
    });

    // ctx.scale(scaling, scaling);

    // ctx.imageSmoothingEnabled = false;


    this.render();
  }

  scaleCanvas() {
    this.canvas = this.shadowRoot.getElementById("canvas");

    const scaling = (window.devicePixelRatio || 1);
    const canvas = this.canvas;
    canvas.width = Number(this.getAttribute('width')) * scaling;
    canvas.height = Number(this.getAttribute('height')) * scaling;
    canvas.style.width = canvas.width / scaling + "px";
    canvas.style.height = canvas.height / scaling + "px";

    console.log(Math.round((window.outerWidth / window.innerWidth) * 100))

    const ctx = canvas.getContext("2d");
    ctx.scale(scaling / this.defaultPixelRatio, scaling / this.defaultPixelRatio);

    this.render();
  }

  setDefaultPixelRatio() {
    this.defaultPixelRatio = window.devicePixelRatio;
  }

  render() {
    requestAnimationFrame(this._render.bind(this));
  }

  _render() {
    const canvas = this.canvas;
    const ctx = canvas.getContext("2d");

    drawTable(ctx, 50, 50, 4, 3, 60, 40);
  }
}

customElements.define("data-table", DataTable);
