export const el = () => ({
  handlers: {},
  innerHTML: "",
  textContent: "",
  value: "",
  hidden: false,
  open: false,
  showModal() { this.open = true; },
  close() { this.open = false; },
  dataset: {},
  classList: { toggle() {}, add() {}, remove() {} },
  setAttribute() {},
  focus() { this.focused = true; },
  requestSubmit() { this.handlers.submit({ preventDefault() {} }); },
  animate() {},
  addEventListener(type, fn) {
    this.handlers[type] = fn;
  },
  scrollIntoView() {},
  reset() {},
});

export const install = ({ fetchImpl, storage = new Map() } = {}) => {
  const nodes = new Map();
  globalThis.document = {
    getElementById: (id) => nodes.get(id) ?? nodes.set(id, el()).get(id),
    querySelector: (sel) => nodes.get(sel) ?? nodes.set(sel, el()).get(sel),
    documentElement: el(),
    body: el(),
    handlers: {},
    addEventListener(type, fn) {
      this.handlers[type] = fn;
    },
  };
  globalThis.localStorage = {
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  };
  globalThis.matchMedia = () => ({ matches: false });
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => "#0d0b14" });
  globalThis.fetch = fetchImpl;
  return { nodes, storage };
};
