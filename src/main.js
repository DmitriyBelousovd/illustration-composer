import { Scene } from "./canvas/scene.js";
import {
  FORMATS,
  layoutItems,
  measures,
  pickByMetaphor,
  pickByNames,
  wantsBackground,
} from "./compose/layout.js";

const svg = document.querySelector("#stage");
const scene = new Scene(svg);
const metaphorInput = document.querySelector("#metaphor");
const namesInput = document.querySelector("#names");
const sizeInput = document.querySelector("#size");
const schemeInput = document.querySelector("#scheme");
const formatInput = document.querySelector("#format");
const backgroundInput = document.querySelector("#background");
const status = document.querySelector("#status");
const layers = document.querySelector("#layers");
const swatches = document.querySelector("#swatches");

let catalog = [];
let palettes = { L: [], S: [] };
let chosenFill = null;

function schemeRecord() {
  return palettes[sizeInput.value].find((item) => item.id === schemeInput.value);
}

function formatRecord() {
  return FORMATS[formatInput.value];
}

function catalogRecord(id, role) {
  return catalog.find((item) => item.id === id && item.role === role && item.size === sizeInput.value);
}

function currentEntries() {
  return scene.items.map((item) => {
    const record = catalogRecord(item.objectId, item.role);
    const size = measures(record);
    return { ...item, ...size, file: record.file, scheme: schemeRecord() };
  });
}

function say(message) {
  status.textContent = message;
}

function renderLayers() {
  layers.replaceChildren();
  for (const item of scene.items) {
    const record = catalogRecord(item.objectId, item.role);
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${record.title}${item.role === "background" ? " · фон" : ""}`;
    button.classList.toggle("is-selected", item.uid === scene.selected);
    button.addEventListener("click", () => scene.select(item.uid));
    layers.appendChild(button);
  }
  renderPalettes();
}

const COLOR_NAMES = {
  "#d7cdf5": "Светло-фиолетовый",
  "#aa9bf0": "Сиреневый",
  "#7864d7": "Фиолетовый",
  "#181817": "Чёрный",
  "#f9ecb0": "Жёлтый",
  "#f9a3aa": "Розовый",
  "#ffe3e1": "Бледно-розовый",
  white: "Белый",
  "#ffffff": "Белый",
  "#fdd7b9": "Светло-персиковый",
  "#fac896": "Персиковый",
  "#d27532": "Оранжевый",
  "#80dada": "Бирюзовый",
  "#beebeb": "Светло-бирюзовый",
  "#5abebe": "Тёмно-бирюзовый",
  "#ffd4f2": "Светло-розовый",
  "#6d7bfc": "Синий",
  "#b6c6fe": "Голубой",
};

function colorKey(color) {
  const value = color.trim().toLowerCase();
  return value === "white" ? "#ffffff" : value;
}

function colorName(color) {
  return COLOR_NAMES[colorKey(color)] || COLOR_NAMES[color.trim().toLowerCase()] || color;
}

function activeFill() {
  const allowed = schemeRecord().background;
  const match = chosenFill && allowed.find((color) => colorKey(color) === colorKey(chosenFill.color));
  return match || allowed[0];
}

function syncFill() {
  const scheme = schemeRecord();
  scene.backgroundColors = scheme.background;
  scene.fillColor = activeFill();
}

function swatchTip(color) {
  const caption = document.createElement("span");
  caption.className = "swatch-tip";
  caption.textContent = colorName(color);
  return caption;
}

function renderPalettes() {
  const scheme = schemeRecord();
  const selected = colorKey(activeFill());
  swatches.replaceChildren();
  for (const color of scheme.background) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "swatch";
    button.style.background = color;
    button.setAttribute("aria-label", colorName(color));
    const pressed = colorKey(color) === selected;
    button.classList.toggle("is-selected", pressed);
    button.setAttribute("aria-pressed", pressed ? "true" : "false");
    button.append(swatchTip(color));
    button.addEventListener("click", () => {
      chosenFill = { color };
      syncFill();
      scene.draw();
    });
    swatches.append(button);
  }
}

async function applyLayout(entries, keepPositions) {
  const format = formatRecord();
  scene.format = format;
  const measured = entries.map((entry) => {
    const record = catalogRecord(entry.objectId, entry.role);
    return { ...entry, ...measures(record), file: record.file, scheme: schemeRecord() };
  });
  if (!keepPositions) {
    const laid = layoutItems(measured, format);
    scene.scale = laid.scale;
    scene.items = laid.items.map((item) => ({ ...item, uid: item.uid || crypto.randomUUID() }));
  } else {
    scene.items = measured;
  }
  syncFill();
  await scene.showPlate(schemeRecord());
  await scene.draw();
}

async function compose(mode) {
  try {
  const size = sizeInput.value;
  const useBackground = backgroundInput.checked || (mode === "metaphor" && wantsBackground(metaphorInput.value));
  let mains = [];
  if (mode === "metaphor") {
    mains = pickByMetaphor(catalog, metaphorInput.value, size);
    if (!metaphorInput.value.trim()) {
      say("Введите метафору или заголовок.");
      return;
    }
  } else {
    const { found, missing } = pickByNames(catalog, namesInput.value, size);
    if (missing.length) {
      say(`Нет в каталоге: ${missing.join(", ")}`);
      return;
    }
    if (!found.length) {
      say("Введите названия предметов через запятую.");
      return;
    }
    mains = found;
  }
  const entries = mains.map((item) => ({ objectId: item.id, role: "main" }));
  if (useBackground) {
    entries.unshift(...mains.map((item) => ({ objectId: item.id, role: "background" })));
  }
  scene.selected = null;
  await applyLayout(entries, false);
  const titles = mains.map((item) => item.title).join(", ");
  say(`Собрано: ${titles}${useBackground ? ". Фоновые копии добавлены." : "."}`);
  } catch (error) {
    say(error.message);
  }
}

function selected() {
  return scene.items.find((item) => item.uid === scene.selected);
}

scene.onChange = renderLayers;

svg.addEventListener("pointerdown", (event) => {
  const group = event.target.closest("[data-uid]");
  if (!group) {
    scene.select(null);
    return;
  }
  const uid = group.getAttribute("data-uid");
  scene.select(uid);
  const start = svgPoint(event);
  const item = selected();
  const origin = { x: item.x, y: item.y };
  svg.setPointerCapture(event.pointerId);
  const move = (ev) => {
    const point = svgPoint(ev);
    scene.update(uid, { x: origin.x + point.x - start.x, y: origin.y + point.y - start.y });
  };
  const up = () => {
    svg.removeEventListener("pointermove", move);
    svg.removeEventListener("pointerup", up);
  };
  svg.addEventListener("pointermove", move);
  svg.addEventListener("pointerup", up);
});

function svgPoint(event) {
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  return point.matrixTransform(svg.getScreenCTM().inverse());
}

document.querySelector("#compose-metaphor").addEventListener("click", () => compose("metaphor"));
document.querySelector("#compose-names").addEventListener("click", () => compose("names"));
document.querySelector("#rotate-left").addEventListener("click", () => {
  const item = selected();
  if (item) scene.update(item.uid, { rotation: item.rotation - 15 });
});
document.querySelector("#rotate-right").addEventListener("click", () => {
  const item = selected();
  if (item) scene.update(item.uid, { rotation: item.rotation + 15 });
});
document.querySelector("#duplicate").addEventListener("click", () => {
  if (scene.selected) scene.duplicate(scene.selected);
});
document.querySelector("#remove").addEventListener("click", () => {
  if (scene.selected) scene.remove(scene.selected);
});
document.querySelector("#up").addEventListener("click", () => {
  if (scene.selected) scene.reorder(scene.selected, 1);
});
document.querySelector("#down").addEventListener("click", () => {
  if (scene.selected) scene.reorder(scene.selected, -1);
});
document.querySelector("#download").addEventListener("click", () => {
  if (!scene.items.length) {
    say("Сначала соберите сцену.");
    return;
  }
  scene.save(`composition-${sizeInput.value}-${schemeInput.value}.svg`);
});

sizeInput.addEventListener("change", async () => {
  if (!scene.items.length) {
    syncFill();
    await scene.showPlate(schemeRecord());
    scene.format = formatRecord();
    await scene.draw();
    return;
  }
  await applyLayout(scene.items.map(({ objectId, role }) => ({ objectId, role })), false);
});
schemeInput.addEventListener("change", async () => {
  if (!scene.items.length) {
    syncFill();
    renderLayers();
    await scene.showPlate(schemeRecord());
    scene.format = formatRecord();
    await scene.draw();
    return;
  }
  await applyLayout(currentEntries(), true);
});
formatInput.addEventListener("change", async () => {
  if (!scene.items.length) {
    scene.format = formatRecord();
    await scene.showPlate(schemeRecord());
    await scene.draw();
    return;
  }
  await applyLayout(scene.items.map(({ objectId, role }) => ({ objectId, role })), false);
});

const data = await Promise.all([
  fetch("src/catalog/objects.json").then((response) => response.json()),
  fetch("src/catalog/palettes.json").then((response) => response.json()),
]);
catalog = data[0];
palettes = data[1];
scene.format = formatRecord();
syncFill();
await scene.showPlate(schemeRecord());
await scene.draw();
renderLayers();

window.app = {
  scene,
  compose,
  catalog: () => catalog,
};
