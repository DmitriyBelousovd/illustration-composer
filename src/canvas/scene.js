import { paintSvg } from "../theme/recolor.js";
import { downloadSvg, serializeScene } from "../export/download.js";

const NS = "http://www.w3.org/2000/svg";

function svgEl(name, attrs = {}) {
  const element = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  return element;
}

export class Scene {
  constructor(svg) {
    this.svg = svg;
    this.cache = new Map();
    this.items = [];
    this.scale = 1;
    this.format = { width: 1000, height: 1000 };
    this.plate = null;
    this.fillColor = null;
    this.objectFill = null;
    this.backgroundColors = [];
    this.selected = null;
    this.onChange = () => {};
    this.queue = Promise.resolve();
  }

  draw() {
    const job = this.queue.then(() => this.render());
    this.queue = job.catch((error) => {
      console.error(error);
    });
    return job;
  }

  async load(file) {
    if (!this.cache.has(file)) {
      const response = await fetch(encodeURI(file));
      if (!response.ok) throw new Error(`Не удалось открыть ${file}`);
      this.cache.set(file, await response.text());
    }
    return this.cache.get(file);
  }

  colorKey(value) {
    const color = String(value).trim().toLowerCase();
    return color === "white" ? "#ffffff" : color;
  }

  allowedBackgroundFill() {
    if (!this.fillColor) return false;
    const key = this.colorKey(this.fillColor);
    return this.backgroundColors.some((color) => this.colorKey(color) === key);
  }

  async showPlate(record) {
    this.plate = record ? await this.load(record.backgroundFile) : null;
  }

  select(uid) {
    this.selected = uid;
    this.draw();
  }

  update(uid, patch) {
    const item = this.items.find((entry) => entry.uid === uid);
    if (!item) return;
    Object.assign(item, patch);
    this.draw();
  }

  remove(uid) {
    this.items = this.items.filter((item) => item.uid !== uid);
    if (this.selected === uid) this.selected = null;
    this.draw();
  }

  duplicate(uid) {
    const item = this.items.find((entry) => entry.uid === uid);
    if (!item) return;
    const copy = { ...item, uid: crypto.randomUUID(), x: item.x + 28, y: item.y + 28 };
    this.items.push(copy);
    this.selected = copy.uid;
    this.draw();
  }

  reorder(uid, direction) {
    const index = this.items.findIndex((item) => item.uid === uid);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= this.items.length) return;
    const [item] = this.items.splice(index, 1);
    this.items.splice(next, 0, item);
    this.draw();
  }

  async render() {
    const { width, height } = this.format;
    this.svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    this.svg.setAttribute("width", String(width));
    this.svg.setAttribute("height", String(height));
    this.svg.replaceChildren();

    if (this.plate) {
      const painted = paintSvg(this.plate, null, "main");
      const frame = svgEl("svg", {
        x: "0",
        y: "0",
        width: String(width),
        height: String(height),
        viewBox: `${painted.minX} ${painted.minY} ${painted.width} ${painted.height}`,
        preserveAspectRatio: "xMidYMid slice",
      });
      frame.setAttribute("data-plate", "1");
      for (const node of painted.nodes) frame.appendChild(document.importNode(node, true));
      const fill = frame.querySelector("rect");
      if (fill && this.allowedBackgroundFill()) fill.setAttribute("fill", this.fillColor);
      this.svg.appendChild(frame);
    }

    for (const item of this.items) {
      const source = await this.load(item.file);
      const painted = paintSvg(source, item.scheme, item.role, this.objectFill);
      const group = svgEl("g", { "data-uid": item.uid });
      group.setAttribute(
        "transform",
        `translate(${item.x} ${item.y}) rotate(${item.rotation}) scale(${this.scale}) translate(${-painted.width / 2} ${-painted.height / 2}) translate(${-painted.minX} ${-painted.minY})`,
      );
      const local = svgEl("g", { class: "local" });
      for (const node of painted.nodes) local.appendChild(document.importNode(node, true));
      group.appendChild(local);
      this.svg.appendChild(group);
      if (item.uid === this.selected) {
        const box = local.getBBox();
        local.appendChild(svgEl("rect", {
          "data-chrome": "1",
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          fill: "none",
          stroke: "#181817",
          "stroke-width": String(2 / this.scale),
          "stroke-dasharray": `${8 / this.scale} ${6 / this.scale}`,
        }));
      }
    }
    this.onChange();
  }

  exportMarkup() {
    return serializeScene(this.svg);
  }

  save(filename) {
    downloadSvg(filename, this.exportMarkup());
  }
}
