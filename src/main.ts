import "./style.css";

type Point = { x: number; y: number };
type Stroke = Point[];
type Drawing = Stroke[];

type Cursor = { active: boolean; x: number; y: number };
const cursor: Cursor = { active: false, x: 0, y: 0 };

const drawing: Drawing = [];
const redoStack: Drawing = [];

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
  ctx.lineWidth = 2;

  for (const stroke of drawing) {
    const [first, ...rest] = stroke;
    if (!first) continue;
    if (rest.length === 0) continue;

    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (const p of rest) {
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
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

  ctx.strokeStyle = "black";
  ctx.lineWidth = 2;

  app.appendChild(title);
  app.appendChild(canvas);

  canvas.addEventListener("mousedown", (e: MouseEvent) => {
    cursor.active = true;
    const newStroke: Stroke = [{ x: e.offsetX, y: e.offsetY }];
    redoStack.length = 0;
    drawing.push(newStroke);
  });

  canvas.addEventListener("mouseup", () => {
    cursor.active = false;
  });

  canvas.addEventListener("mousemove", (e: MouseEvent) => {
    if (!cursor.active) return;
    const currentStroke = drawing[drawing.length - 1];
    if (!currentStroke) return;
    currentStroke.push({ x: e.offsetX, y: e.offsetY });
    canvas.dispatchEvent(new Event("drawing-changed"));
  });

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
}
initUI();
