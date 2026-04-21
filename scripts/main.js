// Nav scroll
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => nav?.classList.toggle('scrolled', scrollY > 20));

// Mood blob hover on landing
document.querySelectorAll('.mood-blob').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.mood-blob').forEach(x => x.style.transform = '');
    b.style.transform = 'scale(1.15)';
  });
});

// Fade in on scroll
const obs = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.1 });
document.querySelectorAll('.step-card,.feat-card,.mood-blob').forEach(el => {
  el.style.cssText += 'opacity:0;transform:translateY(24px);transition:opacity .5s ease,transform .5s ease';
  obs.observe(el);
});
const style = document.createElement('style');
style.textContent = '.visible{opacity:1 !important;transform:translateY(0) !important}';
document.head.appendChild(style);
