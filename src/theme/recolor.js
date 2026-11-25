const SOURCE = {
  background: ["#d7cdf5", "#aa9bf0", "#7864d7", "#181817"],
  objects: ["#f9ecb0", "#f9a3aa", "#ffe3e1", "#ffffff"],
};

export function normalizeColor(value) {
  if (!value) return "";
  const color = value.trim().toLowerCase();
  if (color === "none") return "none";
  if (color === "white") return "#ffffff";
  if (color === "black") return "#181817";
  if (/^#[0-9a-f]{3}$/.test(color)) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  }
  return color;
}

export function mapColor(value, scheme, role) {
  const color = normalizeColor(value);
  if (!color || color === "none") return value;
  const background = scheme.background.map(normalizeColor);
  const objects = scheme.objects.map(normalizeColor);
  const backgroundIndex = SOURCE.background.indexOf(color);
  if (backgroundIndex >= 0) return background[backgroundIndex];
  const objectIndex = SOURCE.objects.indexOf(color);
  if (objectIndex >= 0) {
    return role === "background" ? background[objectIndex] : objects[objectIndex];
  }
  return value;
}

export function paintSvg(svgText, scheme, role, fillOverride) {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const root = doc.documentElement;
  const viewBox = root.getAttribute("viewBox").trim().split(/[\s,]+/).map(Number);
  const [minX, minY, width, height] = viewBox;
  const override = fillOverride ? normalizeColor(fillOverride) : "";
  if (scheme) {
    for (const element of root.querySelectorAll("*")) {
      for (const attr of ["fill", "stroke"]) {
        const value = element.getAttribute(attr);
        if (!value || value === "none" || value.startsWith("url(")) continue;
        let next = mapColor(value, scheme, role);
        if (override && role !== "background" && attr === "fill") {
          const mapped = normalizeColor(next);
          if (mapped && mapped !== "none" && mapped !== "#181817") next = fillOverride;
        }
        element.setAttribute(attr, next);
      }
    }
  }
  return {
    minX,
    minY,
    width,
    height,
    nodes: [...root.children],
  };
}
