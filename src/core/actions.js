// Handlers called from inline HTML (onclick="PB.x()") live on one global namespace
export const PB = {};
window.PB = PB;

export function expose(handlers) { Object.assign(PB, handlers); }
