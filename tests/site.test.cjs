const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');

const root = resolve(__dirname, '..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const script = readFileSync(resolve(root, 'script.js'), 'utf8');

// Lightweight DOM doubles test the interaction logic without opening WhatsApp.
// These tests do not replace browser layout or accessibility verification.
function element(attributes = {}) {
  const classes = new Set();
  return {
    attributes, events: {}, hidden: true, value: '', children: [],
    classList: {
      add: name => classes.add(name),
      contains: name => classes.has(name),
      toggle(name, force) {
        const on = force === undefined ? !classes.has(name) : force;
        if (on) classes.add(name);
        else classes.delete(name);
        return on;
      }
    },
    addEventListener(name, handler) { this.events[name] = handler; },
    setAttribute(name, value) { this.attributes[name] = value; },
    getAttribute(name) { return this.attributes[name]; },
    removeAttribute(name) { delete this.attributes[name]; },
    replaceChildren(...children) { this.children = children; },
    fire(name, event = {}) { this.events[name]?.(event); }
  };
}

function setup({ reducedMotion = false, observers = false } = {}) {
  const selectors = {};
  for (const name of [
    '.site-header', '.menu-button', '.nav', '#evaluation-form',
    '#situation', '#form-feedback', '#current-year', '.floating-contact', '#contato'
  ]) selectors[name] = element();
  selectors['.menu-button'].setAttribute('aria-expanded', 'false');
  selectors['#situation'].value = 'financiado';
  const links = ['solucoes', 'sobre', 'processo', 'duvidas', 'contato'].map(id => {
    const link = element();
    link.id = id;
    return link;
  });
  const solutions = ['financiado', 'atrasado', 'duvidas'].map(situation => {
    const link = element();
    link.dataset = { situation };
    return link;
  });
  const reveals = [element(), element()];
  const sections = links.map(link => Object.assign(element(), { id: link.id }));
  const document = {
    ...element(),
    body: element(),
    documentElement: element(),
    activeElement: null,
    querySelector: name => selectors[name],
    querySelectorAll: name => ({
      '[data-situation]': solutions, '.reveal': reveals, 'main section[id]': sections
    }[name] || []),
    createElement: () => element()
  };
  selectors['.menu-button'].focus = () => { document.activeElement = selectors['.menu-button']; };
  links.forEach(link => { link.focus = () => { document.activeElement = link; }; });
  selectors['.nav'].querySelectorAll = () => links;
  selectors['.nav'].querySelector = query => {
    if (query === 'a') return links[0];
    return links.find(link => query === `a[href="#${link.id}"]`);
  };
  selectors['.site-header'].contains = target => target === selectors['.menu-button'];
  const mobile = Object.assign(element(), { matches: true });
  const opened = [];
  const window = Object.assign(element(), {
    scrollY: 0,
    matchMedia: query => query.includes('reduced-motion') ? { matches: reducedMotion } : mobile,
    open: (...args) => { opened.push(args); return null; }
  });
  const observed = [];
  class Observer {
    constructor(callback, options) { this.callback = callback; this.options = options; this.targets = []; observed.push(this); }
    observe(target) { this.targets.push(target); }
    unobserve(target) { this.targets = this.targets.filter(item => item !== target); }
  }
  let vehicle = 'Carro';
  const context = { window, document, Date, encodeURIComponent, FormData: class { get() { return vehicle; } } };
  if (observers) {
    window.IntersectionObserver = Observer;
    context.IntersectionObserver = Observer;
  }
  vm.runInNewContext(script, context);
  return { selectors, links, solutions, reveals, document, window, mobile, opened, observed, setVehicle: value => { vehicle = value; } };
}

test('HTML has unique IDs, valid internal anchors and existing local assets', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const match of html.matchAll(/\bhref="#([^"]+)"/g)) assert.ok(ids.includes(match[1]), `Missing ID ${match[1]}`);
  for (const match of html.matchAll(/\b(?:src|href)="([^"#]+)"/g)) {
    if (/^(https?:|tel:)/.test(match[1])) continue;
    assert.ok(existsSync(resolve(root, match[1])), `Missing asset ${match[1]}`);
  }
  assert.equal([...html.matchAll(/<h1\b/g)].length, 1);
  assert.match(html, /<html lang="pt-BR">/);
});

test('External tabs have safe rel attributes and the original contact is preserved', () => {
  for (const match of html.matchAll(/<(?:a|form)\b[^>]*target="_blank"[^>]*>/g)) {
    assert.match(match[0], /rel="noopener noreferrer"/);
  }
  const phones = [...html.matchAll(/wa\.me\/(\d+)/g)].map(match => match[1]);
  assert.ok(phones.length > 3);
  assert.ok(phones.every(phone => phone === '5548988134546'));
});

test('All nine evaluation combinations generate the expected WhatsApp message', () => {
  for (const vehicle of ['Carro', 'Moto', 'Caminhão']) {
    for (const situation of ['financiado', 'atrasado', 'duvidas']) {
      const app = setup();
      app.setVehicle(vehicle);
      app.selectors['#situation'].value = situation;
      let prevented = false;
      app.selectors['#evaluation-form'].fire('submit', { preventDefault() { prevented = true; } });
      assert.ok(prevented);
      assert.equal(app.opened.length, 1);
      const [address, target, features] = app.opened[0];
      const url = new URL(address);
      assert.equal(url.origin, 'https://wa.me');
      assert.equal(url.pathname, '/5548988134546');
      assert.ok(url.searchParams.get('text').includes(`Veículo: ${vehicle}.`));
      assert.ok(url.searchParams.get('text').includes({
        financiado: 'estão em dia', atrasado: 'em atraso', duvidas: 'minhas opções'
      }[situation]));
      assert.equal(target, '_blank');
      assert.equal(features, 'noopener,noreferrer');
      assert.equal(app.selectors['#form-feedback'].hidden, false);
      assert.equal(app.selectors['#form-feedback'].children[1].href, address);
    }
  }
});

test('Solution links preselect the appropriate financing situation', () => {
  const app = setup();
  for (const solution of app.solutions) {
    app.selectors['#form-feedback'].hidden = false;
    solution.fire('click');
    assert.equal(app.selectors['#situation'].value, solution.dataset.situation);
    assert.equal(app.selectors['#form-feedback'].hidden, true);
  }
});

test('Mobile menu opens, traps keyboard focus, and closes with Escape or a link', () => {
  const app = setup();
  const button = app.selectors['.menu-button'];
  button.fire('click');
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.ok(app.document.body.classList.contains('menu-open'));
  button.focus();
  app.document.fire('keydown', { key: 'Tab', preventDefault() {} });
  assert.equal(app.document.activeElement, app.links[0]);
  app.document.fire('keydown', { key: 'Tab', shiftKey: true, preventDefault() {} });
  assert.equal(app.document.activeElement, button);
  app.document.fire('keydown', { key: 'Escape' });
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  assert.equal(app.document.activeElement, button);
  button.fire('click');
  app.links[0].fire('click');
  assert.equal(button.getAttribute('aria-expanded'), 'false');
});

test('Desktop resize clears mobile scroll lock and scroll updates sticky header', () => {
  const app = setup();
  app.selectors['.menu-button'].fire('click');
  app.mobile.matches = false;
  app.mobile.fire('change');
  assert.equal(app.document.body.classList.contains('menu-open'), false);
  app.window.scrollY = 300;
  app.window.fire('scroll');
  assert.ok(app.selectors['.site-header'].classList.contains('is-scrolled'));
  app.window.scrollY = 0;
  app.window.fire('scroll');
  assert.equal(app.selectors['.site-header'].classList.contains('is-scrolled'), false);
});

test('Content stays visible without IntersectionObserver and with reduced motion', () => {
  const fallback = setup();
  assert.equal(fallback.document.documentElement.classList.contains('motion-enabled'), false);
  const reduced = setup({ observers: true, reducedMotion: true });
  assert.equal(reduced.document.documentElement.classList.contains('motion-enabled'), false);
  assert.equal(reduced.observed.length, 2);
});

test('Scroll reveals run once and the floating button yields to the contact section', () => {
  const app = setup({ observers: true });
  const [revealObserver, sectionObserver, contactObserver] = app.observed;
  revealObserver.callback([{ target: app.reveals[0], isIntersecting: true }]);
  assert.ok(app.reveals[0].classList.contains('is-visible'));
  assert.equal(revealObserver.targets.includes(app.reveals[0]), false);
  sectionObserver.callback([{ target: { id: 'solucoes' }, isIntersecting: true }]);
  assert.equal(app.links[0].getAttribute('aria-current'), 'location');
  contactObserver.callback([{ isIntersecting: true }]);
  assert.ok(app.selectors['.floating-contact'].classList.contains('is-hidden'));
  contactObserver.callback([{ isIntersecting: false }]);
  assert.equal(app.selectors['.floating-contact'].classList.contains('is-hidden'), false);
});
