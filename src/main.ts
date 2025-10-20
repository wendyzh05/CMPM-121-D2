import "./style.css";

type Point = { x: number; y: number };
type Drawing = DisplayCommand[];

type Cursor = { active: boolean; x: number; y: number };
const cursor: Cursor = { active: false, x: 0, y: 0 };

const drawing: Drawing = [];
const redoStack: Drawing = [];

let toolPreview: ToolPreview | null = null;
let currentSticker: string | null = null;

interface DisplayCommand {
  display(ctx: CanvasRenderingContext2D): void;
}

class MarkerLine implements DisplayCommand {
  private points: Point[] = [];
  private thickness: number;

  constructor(start: Point, thickness: number) {
    this.points.push(start);
    this.thickness = thickness;
  }

  drag(x: number, y: number) {
    this.points.push({ x, y });
  }

  display(ctx: CanvasRenderingContext2D): void {
    if (this.points.length === 0) return; // nothing to draw

    ctx.beginPath();

    const first = this.points[0];
    if (!first) return; // type guard for TS safety

    ctx.moveTo(first.x, first.y);

    for (let i = 1; i < this.points.length; i++) {
      const p = this.points[i];
      if (!p) continue;
      ctx.lineTo(p.x, p.y);
    }

    ctx.lineWidth = this.thickness;
    ctx.stroke();
  }
}

class StickerCommand implements DisplayCommand {
  private x: number;
  private y: number;
  private sticker: string;
  private size: number;

  constructor(x: number, y: number, sticker: string, size: number = 32) {
    this.x = x;
    this.y = y;
    this.sticker = sticker;
    this.size = size;
  }

  drag(x: number, y: number): void {
    // Move the sticker rather than drawing a trail
    this.x = x;
    this.y = y;
  }

  display(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.font = `${this.size}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.sticker, this.x, this.y);
    ctx.restore();
  }
}

class ToolPreview implements DisplayCommand {
  constructor(
    public x: number,
    public y: number,
    private thickness: number,
  ) {}

  update(x: number, y: number, thickness: number): void {
    this.x = x;
    this.y = y;
    this.thickness = thickness;
  }

  display(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.thickness / 2, 0, Math.PI * 2);
    ctx.strokeStyle = "gray"; // light outline
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function createAppTitle(titleText: string): HTMLElement {
  const title = document.createElement("h1");
  title.textContent = titleText;
  return title;
}

function createDrawingCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.id = "drawingCanvas";
  return canvas;
}

function redrawCanvas(ctx: CanvasRenderingContext2D, drawing: Drawing) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.strokeStyle = "black";

  for (const cmd of drawing) cmd.display(ctx);

  if (!cursor.active && toolPreview) {
    if (currentSticker) {
      ctx.font = "32px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(currentSticker, toolPreview.x, toolPreview.y);
    } else {
      toolPreview.display(ctx);
    }
  }
}

function initUI(): void {
  const app = document.createElement("div");
  app.id = "app";
  document.body.appendChild(app);

  const title = createAppTitle("Sticker Sketchpad");
  const canvas = createDrawingCanvas(256, 256);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get 2D context");

  canvas.addEventListener("drawing-changed", () => {
    redrawCanvas(ctx, drawing);
  });

  canvas.addEventListener("tool-moved", () => {
    redrawCanvas(ctx, drawing);
  });

  ctx.strokeStyle = "black";
  ctx.lineWidth = 2;

  app.appendChild(title);
  app.appendChild(canvas);

  canvas.addEventListener("mousedown", (e: MouseEvent) => {
    cursor.active = true;

    if (currentSticker) {
      const newSticker = new StickerCommand(
        e.offsetX,
        e.offsetY,
        currentSticker,
      );
      drawing.push(newSticker);
      redoStack.length = 0;
      canvas.dispatchEvent(new Event("drawing-changed"));
      return;
    }

    const newLine = new MarkerLine(
      { x: e.offsetX, y: e.offsetY },
      currentThickness,
    );
    drawing.push(newLine);
    redoStack.length = 0;
  });

  canvas.addEventListener("mouseup", () => {
    cursor.active = false;
  });

  canvas.addEventListener("mousemove", (e: MouseEvent) => {
    if (!toolPreview) {
      toolPreview = new ToolPreview(e.offsetX, e.offsetY, currentThickness);
    } else {
      toolPreview.update(e.offsetX, e.offsetY, currentThickness);
    }

    canvas.dispatchEvent(new Event("tool-moved"));

    if (cursor.active) {
      const current = drawing[drawing.length - 1];
      if (currentSticker && current instanceof StickerCommand) {
        current.drag(e.offsetX, e.offsetY);
        canvas.dispatchEvent(new Event("drawing-changed"));
        return;
      }
      if (current instanceof MarkerLine) {
        current.drag(e.offsetX, e.offsetY);
        canvas.dispatchEvent(new Event("drawing-changed"));
      }
    }
  });

  let currentThickness = 2;

  const thinButton = document.createElement("button");
  thinButton.textContent = "Thin Marker";

  const thickButton = document.createElement("button");
  thickButton.textContent = "Thick Marker";

  function updateSelectedTool(selected: HTMLElement) {
    for (const btn of [thinButton, thickButton]) {
      btn.classList.toggle("selectedTool", btn === selected);
    }
  }

  thinButton.addEventListener("click", () => {
    currentThickness = 2;
    currentSticker = null;
    updateSelectedTool(thinButton);
  });

  thickButton.addEventListener("click", () => {
    currentThickness = 6;
    currentSticker = null;
    updateSelectedTool(thickButton);
  });

  document.body.append(thinButton, thickButton);
  updateSelectedTool(thinButton);

  const buttonContainer = document.createElement("div");
  buttonContainer.style.marginTop = "10px";

  const clearButton = document.createElement("button");
  clearButton.textContent = "Clear";

  const undoButton = document.createElement("button");
  undoButton.textContent = "Undo";

  const redoButton = document.createElement("button");
  redoButton.textContent = "Redo";

  buttonContainer.append(clearButton, undoButton, redoButton);
  document.body.append(buttonContainer);

  clearButton.addEventListener("click", () => {
    drawing.length = 0;
    redoStack.length = 0;
    canvas.dispatchEvent(new Event("drawing-changed"));
  });

  undoButton.addEventListener("click", () => {
    if (drawing.length === 0) return;
    const undone = drawing.pop();
    if (undone) redoStack.push(undone);
    canvas.dispatchEvent(new Event("drawing-changed"));
  });

  redoButton.addEventListener("click", () => {
    if (redoStack.length === 0) return;
    const restored = redoStack.pop();
    if (restored) drawing.push(restored);
    canvas.dispatchEvent(new Event("drawing-changed"));
  });

  const stickerContainer = document.createElement("div");
  stickerContainer.style.marginTop = "10px";

  const stickers = ["🎀", "🌸", "💗"];
  const stickerButtons: HTMLButtonElement[] = [];

  for (const emoji of stickers) {
    const btn = document.createElement("button");
    btn.textContent = emoji;
    btn.style.fontSize = "24px";

    btn.addEventListener("click", () => {
      currentSticker = emoji;
      updateSelectedTool(btn);
      if (toolPreview) {
        toolPreview = new ToolPreview(0, 0, 0); // clear circle preview
      }
      // Trigger UI refresh
      canvas.dispatchEvent(new Event("tool-moved"));
    });

    stickerButtons.push(btn);
    stickerContainer.appendChild(btn);
  }

  document.body.append(stickerContainer);
}
initUI();
