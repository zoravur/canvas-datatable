// Define the Web Component
class DataTable extends HTMLElement {
  static recognizedAttributes = ['columns', 'readonly', 'ignore-dpr', 'default-dpr'];
  static observedAttributes = [];

  constructor() {
    super();
    this.attachShadow({ mode: "open" });

  }

  // get columns() {
  //   return this.getAttribute("columns");
  // }

  // set columns(value) {
  //   // this.columns = value;
  //   // if (value) {
  //   //   this.setAttribute("columns", value);
  //   // } else {
  //   //   this.removeAttribute("columns");
  //   // }
  //   // this.render();
  // }

  get headers() {
    const columns = this.columns;

    if (!columns) {
      return [];
    }
  }

  // get rows() {
  //   this.getAttribute("rows");
  // }

  // set rows(value) {
  //   this.rows = value;
  //   // if (value) {
  //   //   this.setAttribute("rows", value);
  //   // } else {
  //   //   this.removeAttribute("rows");
  //   // }
  //   // this.render();
  // }

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

  get n_cols() {
    return this.headers.length;
  }

  get n_rows() {
    return this.rows.length;
  }


  connectedCallback() {
    this.shadowRoot.innerHTML = `
            <style>
              canvas {
                // box-shadow: inset 0 0 0 1px #000; /* adjust the color and width as needed */
                border: 1px solid #000;
              }
            </style>

            <canvas id="canvas"></canvas>
        `;

    console.log(window.devicePixelRatio);
    const scaling = (window.devicePixelRatio || 1);

    this.setDefaultDpr();
  
    this.canvas = this.shadowRoot.getElementById("canvas");
    this._scaleCanvas();


    window.addEventListener('resize', this._scaleCanvas.bind(this));

    this.addEventListener("click", (evt) => {
      console.log("DataTable clicked", evt);
    });

    this.addEventListener("wheel", this._handleWheelEvent.bind(this));



  }

  _handleWheelEvent(evt) {
    if (this.offsetX === undefined) {
      this.offsetX = 0;
    }
    if (this.offsetY === undefined) {
      this.offsetY = 0;
    }

    if (evt.shiftKey) {
      this.offsetY -= evt.deltaX;
      this.offsetX -= evt.deltaY;
    } else {
      this.offsetX -= evt.deltaX;
      this.offsetY -= evt.deltaY;
    }

    this.offsetX = Math.min(this.offsetX, 0);
    this.offsetY = Math.min(this.offsetY, 0);
    this._scaleCanvas();
  }

  _scaleCanvas() {
    this.canvas = this.shadowRoot.getElementById("canvas");

    const scaling = (window.devicePixelRatio || 1);
    const canvas = this.canvas;
    canvas.width = Number(this.getAttribute('width')) * scaling;
    canvas.height = Number(this.getAttribute('height')) * scaling;
    canvas.style.width = canvas.width / scaling + "px";
    canvas.style.height = canvas.height / scaling + "px";

    const ctx = canvas.getContext("2d");
    ctx.translate(0.5, 0.5);
    ctx.translate(this.offsetX, this.offsetY);

    console.log(`offsetX: ${this.offsetX}, offsetY: ${this.offsetY}`);

    if (!this.hasAttribute('ignore-dpr')) {
      ctx.scale(scaling / this.defaultPixelRatio, scaling / this.defaultPixelRatio);
    }

    this.render();
  }

  setDefaultDpr() {
    this.defaultPixelRatio = this.getAttribute("default-dpr") || window.devicePixelRatio;
  }

  render() {
    requestAnimationFrame(this._render.bind(this));
  }

  _render() {
    const canvas = this.canvas;


    
    const headers = this.columns;
    const rows = this.rows;
    
    
    
    if (!headers || !rows) {
      console.log(`headers: ${headers}, rows: ${rows}`);
      console.log('returning early');
      return;
    }
    
    const data = [headers, ...rows.map(row => headers.map(header => row[header]))];
    
    this._drawGrid();
    for (let i = 0; i < data.length; i++) {
      for (let j = 0; j < data[i].length; j++) {
        const value = data[i][j];

        this._drawCell(i, j, value, i === 0);
      }
    }
  }

  get cellInfo() {
    if (!this._cellInfo) {
      this._setCellInfo();
    }

    return this._cellInfo;
  }

  _setCellInfo() {
    const headers = this.columns;
    const widths = headers.map(header => this.config.widths[header]);
    const heights = Array.from({length: this.n_rows}, (_, i) => 30);

    const x_coords = widths.reduce((acc, val, i) => {
      acc.push(acc[i] + val);
      return acc;
    }, [0]);

    const y_coords = heights.reduce((acc, val, i) => {
      acc.push(acc[i] + val);
      return acc;
    }, [0]);

    this._cellInfo = {
      widths,
      heights,
      x_coords,
      y_coords
    }
  }


  _drawGrid() {
    const canvas = this.canvas;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = "lightgray";
    
    const {x_coords, y_coords} = this.cellInfo;

    // draw vertical lines
    for (let i = 0; i < x_coords.length; i++) {
      ctx.beginPath();
      ctx.moveTo(x_coords[i], 0);
      ctx.lineTo(x_coords[i], y_coords[y_coords.length - 1]);
      ctx.stroke();
    }

    // draw horizontal lines
    for (let i = 0; i < y_coords.length; i++) {
      ctx.beginPath();
      ctx.moveTo(0, y_coords[i]);
      ctx.lineTo(x_coords[x_coords.length - 1], y_coords[i]);
      ctx.stroke();
    }
  }

  _drawCell(i, j, value, bold=false) {

    // console.log(`Drawing cell ${i}, ${j} with value ${value}`);
    const canvas = this.canvas;
    const ctx = canvas.getContext("2d");

    const {widths, heights, x_coords, y_coords} = this.cellInfo;

    const x = x_coords[j];
    const y = y_coords[i];

    ctx.fillStyle = "black";
    ctx.font = `${bold ? 'bold ': ''}12px Arial`;
    // console.log(ctx.font);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(value, x + widths[j] / 2, y + heights[i] / 2);
  }

}

customElements.define("data-table", DataTable);