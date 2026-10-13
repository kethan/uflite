// A plain module, not app.service(): lite has no service registry.
const notes = new Map();
let nextId = 1;
export const store = {
  list: () => [...notes.values()],
  get: id => notes.get(id),
  create: title => {
    const note = { id: String(nextId++), title };
    notes.set(note.id, note);
    return note;
  },
  update: (id, title) => {
    const note = notes.get(id);
    if (note) note.title = title;
    return note;
  },
  remove: id => {
    const note = notes.get(id);
    if (note) notes.delete(id);
    return note;
  }
};
