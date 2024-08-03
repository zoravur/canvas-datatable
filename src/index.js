function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}


// Define the Web Component
class DataTable extends HTMLElement {
  static recognizedAttributes = ['columns', 'readonly', 'ignore-dpr', 'default-dpr'];
  static observedAttributes = [];

  constructor() {
    super();
    this.attachShadow({ mode: "open" });

  }

  // get headers() {
  //   const columns = this.columns;

  //   if (!columns) {
  //     return [];
  //   }
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
          #canvas {
            // box-shadow: inset 0 0 0 1px #000; /* adjust the color and width as needed */
            // position: absolute;
            // position: relative;
          }

          .data-table-root {
            border: 1px solid #000;

            display: inline-block;
            white-space: nowrap;
            font-size: 0;
            width: auto;
            vertical-align: top; /* or bottom or middle depending on your needs */
            position: relative;
          }

          .grid-container {
            width: 100%;
            height: 100%;
            position: absolute;
            overflow: hidden;
          }
        </style>

        <div class="data-table-root">
          <!--<div class="grid-container"></div>-->
          <canvas id="canvas"></canvas>
        </div>
    `;

    this.offsetX = 0;
    this.offsetY = 0;

    console.log(window.devicePixelRatio);
    const scaling = (window.devicePixelRatio || 1);

    this.setDefaultDpr();
  
    this.canvas = this.shadowRoot.getElementById("canvas");
    this._scaleCanvas();


    window.addEventListener('resize', this._scaleCanvas.bind(this));

    // DEBUG CODE
    // this.canvas.addEventListener("click", (evt) => {
    //   const [x, y] = [evt.offsetX, evt.offsetY];

    //   // console.log(this._screenToCanvasCoords(x, y));
    //   const {canvX, canvY} = this._screenToCanvasCoords(x, y);

    //   const infoObject = {
    //     x,
    //     y,
    //     canvX,
    //     canvY,
    //   }
      
    //   console.log(infoObject);

    //   const ctx = this.canvas.getContext("2d");
    //   ctx.fillStyle = "green";
    //   ctx.fillRect(canvX, canvY, 10, 10);
    // });

    this.canvas.addEventListener("wheel", this._handleWheelEvent.bind(this));

    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
  }

  
  _handleResizeStart = (index) => (e) => {
    this._initialResizeX = this._screenToCanvasCoords(e.offsetX, e.offsetY).canvX;
    this._initialResizeWidth = this.cellInfo.widths[index];
    this._initialResizeIndex = index;
    this._resizing = true;
  };

  _handleResize(e) {
    if (!this._resizing) {
      return;
    }
    const x_coord = this._screenToCanvasCoords(e.offsetX, e.offsetY).canvX;
    
    const indexHeader = this.headers[this._initialResizeIndex];

    this.config.widths[indexHeader] = 
      clamp(this._initialResizeWidth + x_coord - this._initialResizeX, 5, this.config.maxColWidth);
    // const {widths } = this.cellInfo;

    // widths[i] = 

    this._setCellInfo();
    
    this.render();
  };

  handleMouseMove(evt) {
    requestAnimationFrame(() => {
      this._handleMouseMove(evt);
    });
  }


  // _getMouseOffset(evt) {
  //   const x = (evt.offsetX + this.offsetX - 0.5) * this.scaling; 
  //   const y = (evt.offsetY - 0.5) * this.scaling

  //   return {x, y};
  // }

  _handleMouseMove(evt) {
    const {x_coords, headerHeight} = this.cellInfo;

    const {canvX:x, canvY:y} = this._screenToCanvasCoords(evt.offsetX, evt.offsetY);

    // console.log(`x: ${x}, x_coords: ${x_coords}`);

    let showScroll = false;
    let i;
    if (y < headerHeight) {
      for (i = 1; i < x_coords.length; i++) {
        if (Math.abs(x - x_coords[i]) <= 5) {
          showScroll = true;
          break;
        }
      }
    }

    if (showScroll) {
      this.style.cursor = "ew-resize";
      this.onmousedown = this._handleResizeStart(i-1).bind(this);
      this.onmousemove = this._handleResize.bind(this);
      this.onmouseup = () => {
        this._resizing = false;
      }
    } else {
      this.style.cursor = "default";
      this.onmousedown = null;
      this.onmouseup = null;
    }
  }


  _handleWheelEvent(evt) {
    // This is so that the window scrolls like regular html when the user is at the top or bottom of the table
    const oldOffsetX = this.offsetX;
    const oldOffsetY = this.offsetY;

    if (this.offsetX === undefined) {
      this.offsetX = 0;
    }
    if (this.offsetY === undefined) {
      this.offsetY = 0;
    }

    if (evt.shiftKey) {
      this.offsetY += evt.deltaX;
      this.offsetX += evt.deltaY;
    } else {
      this.offsetX += evt.deltaX;
      this.offsetY += evt.deltaY;
    }

    this.offsetX = clamp(this.offsetX, 0, this.cellInfo.x_coords[this.cellInfo.x_coords.length - 1] - this.canvas.width);
    this.offsetY = clamp(this.offsetY, 0, this.cellInfo.y_coords[this.cellInfo.y_coords.length - 1] - this.canvas.height);
    this._scaleCanvas();

    // console.log(`offsetX: ${this.offsetX}, offsetY: ${this.offsetY}, oldOffsetX: ${oldOffsetX}, oldOffsetY: ${oldOffsetY}`);

    if (oldOffsetX !== this.offsetX || oldOffsetY !== this.offsetY) {
      evt.preventDefault();
    }
  }

  _scaleCanvas() {
    this.canvas = this.shadowRoot.getElementById("canvas");
    this.container = this.shadowRoot.querySelector(".data-table-root");




    this.scaling = (window.devicePixelRatio || 1);
    console.log(this.scaling);
    const scaling = this.scaling;
    const canvas = this.canvas;
    canvas.width = Number(this.getAttribute('width')) * scaling;
    canvas.height = Number(this.getAttribute('height')) * scaling;

    this.container.style.width = canvas.width / scaling + "px";
    this.container.style.height = canvas.height / scaling + "px";

    canvas.style.width = '100%'
    canvas.style.height = '100%';


    const ctx = canvas.getContext("2d");
    ctx.resetTransform();
    if (!this.hasAttribute('ignore-dpr')) {
      ctx.scale(scaling / this.defaultPixelRatio, scaling / this.defaultPixelRatio);
    }

    ctx.translate(0.5, 0.5);
    ctx.translate(-this.offsetX, -this.offsetY);

    // console.log(`offsetX: ${this.offsetX}, offsetY: ${this.offsetY}`);


    this.render();

    this._screenToCanvasCoords(0, 0);
  }

  setDefaultDpr() {
    this.defaultPixelRatio = this.getAttribute("default-dpr") || window.devicePixelRatio;
  }

  render() {
    requestAnimationFrame(this._render.bind(this));
  }

  _render() {
    const canvas = this.canvas;
    const ctx = canvas.getContext("2d");


    
    const headers = this.headers
    const rows = this.rows;
    
    
    
    if (!headers || !rows) {
      console.log(`headers: ${headers}, rows: ${rows}`);
      console.log('returning early');
      return;
    }
    
    const data = [...rows.map(row => headers.map(header => row[header]))];
    
    this._drawGrid();



    for (let i = 0; i < data.length; i++) {
      for (let j = 0; j < data[i].length; j++) {
        const value = data[i][j];
        this._drawCell(i+1, j, value);
      }
    }

    // ctx.fillText(value, x + widths[j] / 2, y + heights[i] / 2);
    this._drawHeaders();


  }

  _drawHeaders() {
    const canvas = this.canvas;
    const ctx = canvas.getContext("2d");

    // ctx.save();

    // ctx.resetTransform();

    // const {canvX: x, canvY: y} = this._screenToCanvasCoords(0, 0);
    // const {canvY: canvasHeaderEnd} = this._screenToCanvasCoords(0, this.config.headerHeight);

    ctx.translate(0, this.offsetY);


    ctx.fillStyle = "white";
    const {x_coords, headerHeight} = this.cellInfo;
    ctx.fillRect(-0.5, -0.5, x_coords[x_coords.length-1], headerHeight);

    // ctx.fillStyle = "pink";
    // ctx.fillRect(this.offsetX, this.offsetY, 100, 100);


    const headers = this.headers;

    for (let j = 0; j < headers.length; j++) {
      this._drawCell(0, j, headers[j], true, true);
    }

    ctx.strokeStyle = "lightgray";
    for (let i = 0; i < x_coords.length; i++) {
      ctx.beginPath();
      ctx.moveTo(x_coords[i], 0);
      ctx.lineTo(x_coords[i], headerHeight);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(0, headerHeight);
    ctx.lineTo(x_coords[x_coords.length - 1], headerHeight);
    ctx.stroke();

    ctx.translate(0, -this.offsetY);
  }

  get cellInfo() {
    if (!this._cellInfo) {
      this._setCellInfo();
    }

    return this._cellInfo;
  }

  _setCellInfo() {
    const headers = this.headers;
    const widths = headers.map(header => this.config.widths[header]);
    const heights = Array.from({length: this.n_rows}, (_, i) => this.config.rowHeight);

    heights.unshift(this.config.headerHeight);

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
      y_coords,
      headerHeight: 40,
    }
  }


  _drawGrid() {
    const canvas = this.canvas;
    const ctx = canvas.getContext("2d");

    
    const {x_coords, y_coords} = this.cellInfo;
    
    ctx.clearRect(0, 0, x_coords[x_coords.length-1], y_coords[y_coords.length-1]);
    
    ctx.strokeStyle = "lightgray";
    
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

  _drawCell(i, j, value, bold=false, header=false) {

    // console.log(`Drawing cell ${i}, ${j} with value ${value}`);
    const canvas = this.canvas;
    const ctx = canvas.getContext("2d");

    const {widths, heights, x_coords, y_coords, headerHeight} = this.cellInfo;

    const x = x_coords[j];
    const y = y_coords[i];

    ctx.fillStyle = "black";
    ctx.font = `${bold ? 'bold ': ''}${this.config.fontSize}px Arial`;
    // console.log(ctx.font);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";


    
    ctx.fillText(value, x + widths[j] / 2, y + heights[i] / 2);
    
  }

  _screenToCanvasCoords(x, y) {
    const ctx = this.canvas.getContext("2d");
    // console.log(`ctx.getTransform(): ${ctx.getTransform()}`);

    // console.log(`offsetX: ${this.offsetX}, offsetY: ${this.offsetY}`);

    // console.log(this.scaling);

    // default

    return {
      // canvX: (x),
      // canvY: (y),
      canvX: (x) * this.defaultPixelRatio -0.5+this.offsetX,
      canvY: (y) * this.defaultPixelRatio -0.5+this.offsetY,
    }
  }

  // createHtml() {
  //   const gridContainer = this.shadowRoot.querySelector(".grid-container");
  //   console.log(`gridContainer: ${gridContainer}`);

  //   const {widths, heights, x_coords, y_coords, headerHeight} = this.cellInfo;



  //   for (let j = 0; j < this.n_cols; j++) {
  //     const handle = document.createElement("div");
  //     handle.style.backgroundColor = "red";
  //     handle.style.position = "absolute";
  //     handle.style.width = "10px";
  //     handle.style.height = `${headerHeight / this.scaling}px`;
  //     handle.style.left = `${x_coords[j] / this.scaling}px`;
  //     handle.style.top = "0px";
  //     handle.style.transform = "translateX(-50%)";
  //     handle.style.cursor = 'ew-resize';

  //     gridContainer.appendChild(handle);
  //   }
  // }
}

customElements.define("data-table", DataTable);