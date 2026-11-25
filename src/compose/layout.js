export const FORMATS = {
  square: { id: "square", title: "1000×1000", width: 1000, height: 1000 },
  wide: { id: "wide", title: "1200×630", width: 1200, height: 630 },
  tall: { id: "tall", title: "800×1200", width: 800, height: 1200 },
};

const SLOTS = {
  square: [
    [0.32, 0.64],
    [0.62, 0.4],
    [0.74, 0.7],
    [0.4, 0.32],
    [0.56, 0.8],
  ],
  wide: [
    [0.66, 0.62],
    [0.82, 0.36],
    [0.5, 0.46],
    [0.86, 0.72],
    [0.58, 0.24],
  ],
  tall: [
    [0.38, 0.26],
    [0.64, 0.44],
    [0.36, 0.62],
    [0.66, 0.78],
    [0.48, 0.9],
  ],
};

const PAD = ["lamp", "phone", "book", "pen", "headphones"];

function fold(value) {
  return value.toLowerCase().replaceAll("ё", "е").trim();
}

export function measures(record) {
  const [x0, y0, x1, y1] = record.viewBox;
  return { width: x1 - x0, height: y1 - y0, minX: x0, minY: y0 };
}

function tokens(text) {
  return fold(text).split(/[^a-zа-я0-9]+/i).filter((token) => token.length > 2);
}

function related(left, right) {
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;
  const size = Math.min(left.length, right.length, 5);
  return size >= 4 && left.slice(0, size) === right.slice(0, size);
}

export function pickByMetaphor(catalog, text, size) {
  const words = tokens(text);
  const mains = catalog.filter((item) => item.size === size && item.role === "main");
  const ranked = mains
    .map((item) => {
      const title = fold(item.title);
      const tags = item.tags.map(fold);
      let score = 0;
      for (const word of words) {
        if (title === word) score += 6;
        else if (related(title, word)) score += 4;
        for (const tag of tags) {
          if (tag === word) score += 3;
          else if (related(tag, word)) score += 2;
        }
      }
      return { item, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title, "ru"));
  const chosen = ranked.slice(0, 5).map((entry) => entry.item);
  for (const id of PAD) {
    if (chosen.length >= 3) break;
    const extra = mains.find((item) => item.id === id);
    if (extra && !chosen.some((item) => item.id === extra.id)) chosen.push(extra);
  }
  return chosen;
}

export function pickByNames(catalog, text, size) {
  const mains = catalog.filter((item) => item.size === size && item.role === "main");
  const queries = fold(text).split(/[,;]+/).map((part) => part.trim()).filter(Boolean);
  const found = [];
  const missing = [];
  for (const query of queries) {
    const match = mains.find((item) => {
      const title = fold(item.title);
      return item.id === query || related(title, query);
    });
    if (!match) missing.push(query);
    else if (!found.some((item) => item.id === match.id)) found.push(match);
  }
  return { found, missing };
}

export function wantsBackground(text) {
  return /фон|атмосфер|тишин|задн/.test(fold(text));
}

export function layoutItems(entries, format) {
  const mains = entries.filter((entry) => entry.role === "main");
  const backs = entries.filter((entry) => entry.role === "background");
  const slots = SLOTS[format.id];
  const margin = 28;
  let scale = Math.min(
    (format.width * 0.42) / Math.max(...entries.map((entry) => entry.width)),
    (format.height * 0.42) / Math.max(...entries.map((entry) => entry.height)),
  );
  const place = (list, dx, dy) => list.map((entry, index) => {
    const slot = slots[index % slots.length];
    return {
      ...entry,
      x: slot[0] * format.width + dx,
      y: slot[1] * format.height + dy,
      rotation: 0,
    };
  });

  let items = [];
  for (let attempt = 0; attempt < 14; attempt += 1) {
    items = [
      ...place(backs, -format.width * 0.04, format.height * 0.03),
      ...place(mains, 0, 0),
    ];
    const boxes = items.map((item) => ({
      left: item.x - (item.width * scale) / 2,
      top: item.y - (item.height * scale) / 2,
      right: item.x + (item.width * scale) / 2,
      bottom: item.y + (item.height * scale) / 2,
    }));
    const left = Math.min(...boxes.map((box) => box.left));
    const top = Math.min(...boxes.map((box) => box.top));
    const right = Math.max(...boxes.map((box) => box.right));
    const bottom = Math.max(...boxes.map((box) => box.bottom));
    if (left >= margin && top >= margin && right <= format.width - margin && bottom <= format.height - margin) {
      break;
    }
    scale *= 0.88;
  }
  return { scale, items };
}
