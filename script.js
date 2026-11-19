(() => {
  'use strict';
  const header = document.querySelector('.site-header');
  const menuButton = document.querySelector('.menu-button');
  const nav = document.querySelector('.nav');
  const mobileViewport = window.matchMedia('(max-width: 760px)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function setMenu(open, returnFocus = false) {
    nav.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    if (returnFocus) menuButton.focus();
  }
  menuButton.addEventListener('click', () => setMenu(menuButton.getAttribute('aria-expanded') !== 'true'));
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', event => {
    if (menuButton.getAttribute('aria-expanded') !== 'true') return;
    if (event.key === 'Escape') setMenu(false, true);
    if (event.key === 'Tab') {
      const first = nav.querySelector('a');
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        menuButton.focus();
      } else if (!event.shiftKey && document.activeElement === menuButton) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  document.addEventListener('click', event => {
    if (!header.contains(event.target) && nav.classList.contains('is-open')) setMenu(false);
  });
  mobileViewport.addEventListener('change', () => { if (!mobileViewport.matches) setMenu(false); });
  function updateHeader() { header.classList.toggle('is-scrolled', window.scrollY > 100); }
  window.addEventListener('scroll', updateHeader, { passive: true });
  updateHeader();

  const form = document.querySelector('#evaluation-form');
  const situation = document.querySelector('#situation');
  const feedback = document.querySelector('#form-feedback');
  const situations = {
    financiado: 'As parcelas do financiamento estão em dia.',
    atrasado: 'Tenho parcelas do financiamento em atraso.',
    duvidas: 'Gostaria de entender minhas opções de negociação.'
  };
  document.querySelectorAll('[data-situation]').forEach(link => {
    link.addEventListener('click', () => {
      situation.value = link.dataset.situation;
      feedback.hidden = true;
    });
  });
  form.addEventListener('change', () => { feedback.hidden = true; });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const vehicle = new FormData(form).get('veiculo');
    const message = `Olá, José Júnior! Vim pelo site da Nobre & JJCar e gostaria de avaliar meu veículo.\n\nVeículo: ${vehicle}.\n${situations[situation.value]}\n\nPodemos conversar?`;
    const url = `https://wa.me/5548988134546?text=${encodeURIComponent(message)}`;
    // A visible fallback also works if the browser blocks the new tab.
    const fallback = document.createElement('a');
    fallback.href = url;
    fallback.target = '_blank';
    fallback.rel = 'noopener noreferrer';
    fallback.textContent = 'Continuar pelo WhatsApp';
    feedback.replaceChildren('Sua mensagem está pronta. ', fallback, '.');
    feedback.hidden = false;
    window.open(url, '_blank', 'noopener,noreferrer');
  });
  document.querySelector('#current-year').textContent = new Date().getFullYear();

  if ('IntersectionObserver' in window) {
    if (!reducedMotion.matches) {
      document.documentElement.classList.add('motion-enabled');
      const revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        });
      }, { threshold: 0.08 });
      document.querySelectorAll('.reveal').forEach(element => revealObserver.observe(element));
    }
    const sectionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const link = nav.querySelector(`a[href="#${entry.target.id}"]`);
        if (!link) return;
        link.classList.toggle('active', entry.isIntersecting);
        if (entry.isIntersecting) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }, { rootMargin: '-20% 0px -55% 0px', threshold: 0 });
    document.querySelectorAll('main section[id]').forEach(section => sectionObserver.observe(section));
    const floatingContact = document.querySelector('.floating-contact');
    const contactObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => floatingContact.classList.toggle('is-hidden', entry.isIntersecting));
    }, { threshold: 0.15 });
    contactObserver.observe(document.querySelector('#contato'));
  }
})();
