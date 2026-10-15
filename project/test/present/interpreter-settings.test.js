import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

function fixture() {
  let cursor = 0, release;
  const slots = [], listeners = new Set(), configured = [];
  const models = new Promise(resolve => { release = resolve; });
  const provider = { catalogue: () => [], model: () => '', getState: () => ({ available: false, model: '' }),
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    models: () => models, configure: (...args) => configured.push(args),
    disconnect: () => { for (const listener of listeners) listener(); } };
  const sb = { OpenRouter: provider, React: {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(init) { const index = cursor++; if (!(index in slots)) slots[index] = typeof init === 'function' ? init() : init;
      return [slots[index], value => { slots[index] = value; }]; },
    useRef(init) { const index = cursor++; if (!(index in slots)) slots[index] = { current: init }; return slots[index]; },
    useEffect(fn) { const index = cursor++; if (!(index in slots)) slots[index] = { cleanup: fn() }; },
  } }; sb.window = sb; vm.createContext(sb);
  vm.runInContext(transformSync(readFileSync(new URL('../../interpreter-settings.jsx', import.meta.url), 'utf8'), { loader: 'jsx' }).code, sb);
  return { render: () => { cursor = 0; return sb.InterpreterSettings({}); }, configured,
    resolve: () => release([{ id: 'qwen/vision:free', name: 'Free vision' }]),
    unmount: () => { for (const slot of slots) if (slot?.cleanup) slot.cleanup(); } };
}
function element(tree, predicate) {
  if (!tree || typeof tree !== 'object') return null;
  if (!Array.isArray(tree) && predicate(tree)) return tree;
  for (const child of Array.isArray(tree) ? tree : tree.props?.children || []) {
    const match = element(child, predicate); if (match) return match;
  }
  return null;
}
const button = (tree, label) => element(tree, node => node.type === 'button' && node.props.children.includes(label));

export async function run() {
  const rows = [], t = (name, ok) => rows.push({ name, ok: !!ok });
  const view = fixture(); let tree = view.render();
  element(tree, node => node.type === 'input').props.onChange({ target: { value: 'private-key' } }); tree = view.render();
  const pending = button(tree, 'Connect OpenRouter').props.onClick();
  button(tree, 'Disconnect').props.onClick(); view.resolve(); await pending; tree = view.render();
  t('Disconnect during catalogue lookup cannot reconnect the interpreter', view.configured.length === 0
    && element(tree, node => node.props?.role === 'status').props.children.includes('Disconnected'));
  t('Disconnect clears the unsaved password field', element(tree, node => node.type === 'input').props.value === '');
  view.unmount();
  const leaving = fixture(); tree = leaving.render();
  element(tree, node => node.type === 'input').props.onChange({ target: { value: 'private-key' } }); tree = leaving.render();
  const abandoned = button(tree, 'Connect OpenRouter').props.onClick(); leaving.unmount(); leaving.resolve(); await abandoned;
  t('leaving interpreter settings cancels a pending account configuration', leaving.configured.length === 0);
  return rows;
}
