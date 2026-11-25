export function downloadSvg(filename, markup) {
  const blob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function serializeScene(svg) {
  const clone = svg.cloneNode(true);
  clone.querySelectorAll("[data-chrome]").forEach((node) => node.remove());
  clone.removeAttribute("id");
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return `<?xml version="1.0" encoding="UTF-8"?>\n${clone.outerHTML}`;
}
