function clamp(value, min, max) {
  if (max < min) {
    console.warn("clamping to empty range, taking minimum");
  }
  return Math.max(Math.min(value, max), min);
}

function getlowestfraction(x0) {
  var eps = 1.0e-15;
  var h, h1, h2, k, k1, k2, a, x;

  x = x0;
  a = Math.floor(x);
  h1 = 1;
  k1 = 0;
  h = a;
  k = 1;

  while (x - a > eps * k * k) {
    x = 1 / (x - a);
    a = Math.floor(x);
    h2 = h1;
    h1 = h;
    k2 = k1;
    k1 = k;
    h = h2 + a * h1;
    k = k2 + a * k1;
  }

  return { num: h, denom: k };
}

function getType(variable) {
  if (variable === null) {
    return "null";
  } else if (variable === undefined) {
    return "undefined";
  } else if (Array.isArray(variable)) {
    return "array";
  } else if (typeof variable === "object") {
    return "object";
  } else {
    return "neither";
  }
}

// Define the Web Component
class DataTable extends HTMLElement {
  static recognizedAttributes = [
    "columns",
    "readonly",
    "ignore-dpr",
    "default-dpr",
  ];
  static observedAttributes = [];

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
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
            // width: auto;
            // vertical-align: top; /* or bottom or middle depending on your needs */
            position: relative;
            // width: 100px;
            // height: 100%;
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

    const dataTableRoot = this.shadowRoot.querySelector(".data-table-root");

    new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.target === dataTableRoot) {
          // console.log(entry.target.getBoundingClientRect());
          // console.log(entry);
          // dataTable.setAttribute("width", entry.contentBoxSize[0].inlineSize);
          // dataTable.setAttribute("height", entry.contentBoxSize[0].blockSize);\

          this._width = entry.contentBoxSize[0].inlineSize;
          this._height = entry.contentBoxSize[0].blockSize;

          // console.log(this._width, this._height, this.scaling);
          this._scaleCanvas();
          this.render();
        }
      }
    }).observe(dataTableRoot);

    this.offsetX = 0;
    this.offsetY = 0;

    // console.log(window.devicePixelRatio);
    const scaling = window.devicePixelRatio || 1;

    this.setDefaultDpr();

    this.canvas = this.shadowRoot.getElementById("canvas");
    this._scaleCanvas();

    window.addEventListener("resize", this._scaleCanvas.bind(this));

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

    this.canvas.addEventListener("mousemove", this.handleMouseMove.bind(this));

    this.mergeStyles();
  }

  /**********************CLAUDE CODE */
  mergeStyles() {
    const root = this.shadowRoot.querySelector(".data-table-root");

    // Get styles from the web component's attribute
    const componentStyles = this.getAttribute("style") || "";

    // Get existing styles from the root DOM node
    const rootStyles = root.getAttribute("style") || "";

    // Merge styles
    const mergedStyles = this.combineStyles(componentStyles, rootStyles);

    console.log("merged styles: ", mergedStyles);

    // Apply merged styles to the root DOM node
    root.setAttribute("style", mergedStyles);
  }

  combineStyles(styles1, styles2) {
    const styleMap = new Map();

    // Helper function to parse styles into a Map
    const parseStyles = (styles) => {
      styles.split(";").forEach((style) => {
        const [property, value] = style.split(":").map((s) => s.trim());
        if (property && value) {
          styleMap.set(property, value);
        }
      });
    };

    // Parse both style strings
    parseStyles(styles1);
    parseStyles(styles2);

    // Convert the Map back to a style string
    return Array.from(styleMap.entries())
      .map(([property, value]) => `${property}: ${value}`)
      .join("; ");
  }
  /******************** END CLAUDE CODE */

  _handleResizeStart = (index) => (e) => {
    this._initialResizeX = this._screenToCanvasCoords(
      e.offsetX,
      e.offsetY
    ).canvX;
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

    this.config.widths[indexHeader] = clamp(
      this._initialResizeWidth + x_coord - this._initialResizeX,
      5,
      this.config.maxColWidth
    );

    this._setCellInfo();

    this.render();
  }

  handleMouseMove(evt) {
    requestAnimationFrame(() => {
      this._handleMouseMove(evt);
    });
  }

  _handleMouseMove(evt) {
    if (this._isDragging) return;
    this._isDragging = false;

    const { x_coords, headerHeight } = this.cellInfo;

    /******************* SCROLL BAR CODE ****************************/
    const { canvX: x_abs, canvY: y_abs } = this._screenToCanvasCoordsAbsolute(
      evt.offsetX,
      evt.offsetY
    );
    // let isDragging = false;
    let startY;
    let startX;

    const { contentWidth, contentHeight } = this.getContentDimensions();

    const _handleVertScrollStart = (evt) => {
      const canvasHeight = this.canvas.height;
      const { canvY: mouseY } = this._screenToCanvasCoordsAbsolute(
        evt.offsetX,
        evt.offsetY
      );
      if (
        mouseY >= (this.offsetY / contentHeight) * canvasHeight &&
        mouseY <=
          (this.offsetY / contentHeight) * canvasHeight +
            this.getScrollbarHeight()
      ) {
        this._isDragging = true;
        startY = evt.screenY * this.scaling;
      }
    };

    const _handleVertScroll = (evt) => {
      if (this._isDragging) {
        const canvasHeight = this.canvas.height;
        const mouseY = evt.screenY * this.scaling;
        const deltaY = mouseY - startY;

        this._moveOrigin(0, deltaY * (contentHeight / canvasHeight));
        startY = mouseY;
        this.render();
      }
    };

    if (this.vertScrollbarVisible && !this._resizing) {
      if (this.canvas.width - this.config.scrollbarThickness <= x_abs) {
        this.onmousedown = _handleVertScrollStart;
        window.onmousemove = _handleVertScroll;
        window.onmouseup = () => {
          window.onmousemove = null;
          this._isDragging = false;
          this.render();
        };
        return;
      }
    }

    const _handleHorScrollStart = (evt) => {
      const canvasWidth = this.canvas.width;
      const { canvX: mouseX } = this._screenToCanvasCoordsAbsolute(
        evt.offsetX,
        evt.offsetY
      );
      if (
        mouseX >= (this.offsetX / contentWidth) * canvasWidth &&
        mouseX <=
          (this.offsetX / contentWidth) * canvasWidth + this.getScrollbarWidth()
      ) {
        this._isDragging = true;
        startX = evt.screenX * this.scaling;
      }
    };

    const _handleHorScroll = (evt) => {
      if (this._isDragging) {
        const canvasWidth = this.canvas.width;
        const mouseX = evt.screenX * this.scaling;
        const deltaX = mouseX - startX;

        this._moveOrigin(deltaX * (contentWidth / canvasWidth), 0);
        startX = mouseX;
        this.render();
      }
    };

    if (this.horScrollbarVisible) {
      if (this.canvas.height - this.config.scrollbarThickness <= y_abs) {
        this.onmousedown = _handleHorScrollStart;
        window.onmousemove = _handleHorScroll;
        window.onmouseup = () => {
          window.onmousemove = null;
          this._isDragging = false;
          this.render();
        };
        return;
      }
    }

    /****************** COLUMN RESIZE CODE **************************/
    const { canvX: x, canvY: y } = this._screenToCanvasCoords(
      evt.offsetX,
      evt.offsetY
    );

    // console.log(`x: ${x}, x_coords: ${x_coords}`);

    let showResize = false;
    let i;
    for (i = 1; i < x_coords.length; i++) {
      if (Math.abs(x - x_coords[i]) <= 5) {
        showResize = true;
        break;
      }
    }

    if (showResize) {
      this.style.cursor = "ew-resize";
      this.onmousedown = this._handleResizeStart(i - 1).bind(this);
      window.onmousemove = this._handleResize.bind(this);
      window.onmouseup = () => {
        this._resizing = false;
        this._moveOrigin(0, 0);
        this.render();
      };
    } else {
      this.style.cursor = "default";
      this.onmousedown = null;
      window.onmouseup = null;
    }
  }

  _moveOrigin(x, y) {
    const initialOffsetX = this.offsetX;
    const initialOffsetY = this.offsetY;

    if (this.offsetX === undefined) {
      this.offsetX = 0;
    }
    if (this.offsetY === undefined) {
      this.offsetY = 0;
    }

    this.offsetX += x;
    this.offsetY += y;

    this.offsetX = clamp(
      this.offsetX,
      0,
      Math.max(
        this.cellInfo.x_coords[this.cellInfo.x_coords.length - 1] -
          this.canvas.width +
          (this.horScrollbarVisible ? this.config.scrollbarThickness : 0),
        0
      )
    );
    this.offsetY = clamp(
      this.offsetY,
      0,
      Math.max(
        this.cellInfo.y_coords[this.cellInfo.y_coords.length - 1] -
          this.canvas.height +
          (this.vertScrollbarVisible ? this.config.scrollbarThickness : 0),
        0
      )
    );
    this._scaleCanvas();

    this.dispatchScrollEvent();

    return {
      x_moved: this.offsetX - initialOffsetX,
      y_moved: this.offsetY - initialOffsetY,
    };
  }

  _handleWheelEvent(evt) {
    // This is so that the window scrolls like regular html when the user is at the top or bottom of the table
    const oldOffsetX = this.offsetX;
    const oldOffsetY = this.offsetY;

    if (evt.shiftKey) {
      this._moveOrigin(evt.deltaY, evt.deltaX);
    } else {
      this._moveOrigin(evt.deltaX, evt.deltaY);
    }

    // console.log(`offsetX: ${this.offsetX}, offsetY: ${this.offsetY}, oldOffsetX: ${oldOffsetX}, oldOffsetY: ${oldOffsetY}`);

    if (oldOffsetX !== this.offsetX || oldOffsetY !== this.offsetY) {
      evt.preventDefault();
    }
  }

  _scaleCanvas() {
    this.canvas = this.shadowRoot.getElementById("canvas");
    this.container = this.shadowRoot.querySelector(".data-table-root");

    this.scaling = window.devicePixelRatio || 1;
    const scaling = this.scaling;
    const { num, denom } = getlowestfraction(scaling);

    const canvas = this.canvas;
    canvas.width = Math.ceil(this._width / denom) * num; // Number(this.getAttribute("width")) * scaling;
    canvas.height = Math.ceil(this._height / denom) * num; // Number(this.getAttribute("height")) * scaling;

    // this.container.style.width = canvas.width / scaling + "px";
    // this.container.style.height = canvas.height / scaling + "px";

    // canvas.style.width = "100%";
    // canvas.style.height = "100%";
    // console.log(this._width, this._height);
    canvas.style.width = Math.ceil(this._width / denom) * denom + "px";
    canvas.style.height = Math.ceil(this._height / denom) * denom + "px";

    const ctx = canvas.getContext("2d");
    ctx.resetTransform();
    if (!this.hasAttribute("ignore-dpr")) {
      ctx.scale(
        scaling / this.defaultPixelRatio,
        scaling / this.defaultPixelRatio
      );
    }

    ctx.translate(0.5, 0.5);
    ctx.translate(-this.offsetX, -this.offsetY);

    // console.log(`offsetX: ${this.offsetX}, offsetY: ${this.offsetY}`);

    this.render();

    this._screenToCanvasCoords(0, 0);
  }

  setDefaultDpr() {
    this.defaultPixelRatio =
      this.getAttribute("default-dpr") || window.devicePixelRatio;
  }

  render() {
    requestAnimationFrame(this._render.bind(this));
  }

  _render() {
    const canvas = this.canvas;
    const ctx = canvas.getContext("2d");
    this.ctx = ctx;

    const { x_coords, y_coords } = this.cellInfo;

    ctx.clearRect(
      0,
      0,
      x_coords[x_coords.length - 1],
      y_coords[y_coords.length - 1]
    );

    const headers = this.headers;
    const rows = this.rows;

    if (!headers || !rows) {
      console.log(`headers: ${headers}, rows: ${rows}`);
      console.log("returning early");
      return;
    }

    const data = [...rows.map((row) => headers.map((header) => row[header]))];

    const rowColors = rows.map(this.getRowColors.bind(this));
    for (let i = 0; i < data.length; i++) {
      this._drawRowBackground(i + 1, rowColors[i]);
    }

    this._drawGrid();

    for (let i = 0; i < data.length; i++) {
      for (let j = 0; j < data[i].length; j++) {
        const value = data[i][j];
        this._drawCell(i + 1, j, value);
      }
    }

    this._drawHeaders();
    this._drawScrollBars();
  }

  _drawHeaders() {
    const canvas = this.canvas;
    const ctx = canvas.getContext("2d");

    ctx.translate(0, this.offsetY);

    ctx.fillStyle = "white";
    const { x_coords, headerHeight } = this.cellInfo;
    ctx.fillRect(-0.5, -0.5, x_coords[x_coords.length - 1], headerHeight);

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
    const widths = headers.map((header) => this.config.widths[header]);
    const heights = Array.from(
      { length: this.n_rows },
      (_, i) => this.config.rowHeight
    );

    heights.unshift(this.config.headerHeight);

    const x_coords = widths.reduce(
      (acc, val, i) => {
        acc.push(acc[i] + val);
        return acc;
      },
      [0]
    );

    const y_coords = heights.reduce(
      (acc, val, i) => {
        acc.push(acc[i] + val);
        return acc;
      },
      [0]
    );

    this._cellInfo = {
      widths,
      heights,
      x_coords,
      y_coords,
      headerHeight: 40,
    };
  }

  _drawGrid() {
    const canvas = this.canvas;
    const ctx = canvas.getContext("2d");

    const { x_coords, y_coords } = this.cellInfo;

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

  _drawRowBackground(i, color = "white") {
    const canvas = this.canvas;
    const ctx = canvas.getContext("2d");

    const { x_coords, y_coords, headerHeight } = this.cellInfo;

    ctx.fillStyle = color;
    ctx.fillRect(
      0,
      y_coords[i],
      x_coords[x_coords.length - 1],
      y_coords[i + 1]
    );

    // console.log(`Drawing row background for row ${i}`);

    // ctx.fillStyle = "white";
    // ctx.fillRect(0, y_coords[i], x_coords[x_coords.length - 1], y_coords[i + 1]);
  }

  _drawCell(i, j, value, bold = false, header = false) {
    // console.log(`Drawing cell ${i}, ${j} with value ${value}`);
    const canvas = this.canvas;
    const ctx = this.ctx;

    const { widths, heights, x_coords, y_coords, headerHeight } = this.cellInfo;

    const x = x_coords[j];
    const y = y_coords[i];

    const canvasBoundsStart = this._screenToCanvasCoords(0, 0);
    const canvasBoundsEnd = this._screenToCanvasCoords(
      this.canvas.width,
      this.canvas.height
    );

    if (!header) {
      if (
        x > canvasBoundsEnd.canvX ||
        x + widths[j] < canvasBoundsStart.canvX ||
        y > canvasBoundsEnd.canvY ||
        y + heights[i] < canvasBoundsStart.canvY
      ) {
        return;
      }
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, widths[j], heights[i]);
    ctx.clip();

    ctx.fillStyle = "black";
    ctx.font = `${bold ? "bold " : ""}${this.config.fontSize}px Arial`;
    // console.log(ctx.font);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText(value, x + widths[j] / 2, y + heights[i] / 2);

    ctx.restore();
  }

  getContentDimensions() {
    const { x_coords, y_coords } = this.cellInfo;
    const contentHeight = y_coords[y_coords.length - 1];
    const contentWidth = x_coords[x_coords.length - 1];

    return {
      contentWidth,
      contentHeight,
    };
  }

  // get the height of the vertical scroll bar.
  getScrollbarHeight() {
    const canvasHeight = this.canvas.height;
    const { contentHeight } = this.getContentDimensions();

    const scrollbarHeight = (canvasHeight / contentHeight) * canvasHeight;
    return scrollbarHeight;
  }

  // get the width of the horizontal scroll bar.
  getScrollbarWidth() {
    const canvasWidth = this.canvas.width;
    const { contentWidth } = this.getContentDimensions();

    const scrollbarWidth = (canvasWidth / contentWidth) * canvasWidth;
    return scrollbarWidth;
  }

  _drawScrollBars() {
    const ctx = this.canvas.getContext("2d");
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

    const { contentWidth, contentHeight } = this.getContentDimensions();

    const scrollbarThickness = this.config.scrollbarThickness;

    const drawVertical = () => {
      if (contentHeight <= canvasHeight) {
        this.vertScrollbarVisible = false;
        return;
      }
      ctx.translate(this.offsetX, this.offsetY);

      // draw the track
      ctx.fillStyle = "lightgray";
      ctx.fillRect(
        canvasWidth - scrollbarThickness,
        0,
        scrollbarThickness,
        canvasHeight
      );

      ctx.fillStyle = "gray";
      ctx.fillRect(
        canvasWidth - scrollbarThickness,
        (this.offsetY / contentHeight) * canvasHeight,
        scrollbarThickness,
        this.getScrollbarHeight()
      );

      ctx.translate(-this.offsetX, -this.offsetY);

      this.vertScrollbarVisible = true;
    };

    const drawHorizontal = () => {
      if (contentWidth <= canvasWidth) {
        this.horScrollbarVisible = false;
        return;
      }

      ctx.translate(this.offsetX, this.offsetY);

      // draw the track
      ctx.fillStyle = "lightgray";
      ctx.fillRect(
        0,
        canvasHeight - scrollbarThickness,
        canvasWidth,
        scrollbarThickness
      );

      const scrollbarWidth = (canvasWidth / contentWidth) * canvasWidth;
      ctx.fillStyle = "gray";
      ctx.fillRect(
        (this.offsetX / contentWidth) * canvasWidth,
        canvasHeight - scrollbarThickness,
        this.getScrollbarWidth(),
        scrollbarThickness
      );

      ctx.translate(-this.offsetX, -this.offsetY);

      this.horScrollbarVisible = true;
    };

    drawHorizontal();
    drawVertical();
  }

  _screenToCanvasCoords(x, y) {
    return {
      // canvX: (x),
      // canvY: (y),
      canvX: x * this.defaultPixelRatio - 0.5 + this.offsetX,
      canvY: y * this.defaultPixelRatio - 0.5 + this.offsetY,
    };
  }

  _screenToCanvasCoordsAbsolute(x, y) {
    return {
      canvX: x * this.defaultPixelRatio - 0.5,
      canvY: y * this.defaultPixelRatio - 0.5,
    };
  }

  getRowColors(row, i) {
    const type = getType(this.config.rowColors);
    if (type === "null" || type === "undefined") {
      return "white";
    } else if (type === "array") {
      return this.config.rowColors[i % this.config.rowColors.length];
    } else if (type === "object") {
      const key = Object.keys(this.config.rowColors)[0];
      if (!this.config.rowColors[key][row[key]]) {
        return "white";
      }
      const color = this.config.rowColors[key][row[key]];
      return color;
    }

    // return i % 2 === 0 ? "white" : "whitesmoke";
  }

  dispatchScrollEvent() {
    const event = new CustomEvent("cdt-scroll", {
      detail: {
        scrollX: this.offsetX,
        scrollY: this.offsetY,
        canvasWidth: this.canvas.width,
        canvasHeight: this.canvas.height,
        scaling: this.scaling,
      },
      bubbles: true,
      composed: true,
    });

    this.dispatchEvent(event);
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
