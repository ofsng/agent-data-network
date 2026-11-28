// Pitch deck navigation: arrow keys, on-screen buttons, swipe, and #<n> deep links.
(() => {
  const slides = [...document.querySelectorAll(".slide")];
  const bar = document.getElementById("bar");
  const count = document.getElementById("count");
  const prev = document.getElementById("prev");
  const next = document.getElementById("next");
  const fromHash = () => (parseInt(location.hash.slice(1), 10) || 1) - 1;
  let i = 0;

  const show = (n) => {
    if (Number.isNaN(n)) n = 0;
    i = Math.min(Math.max(n, 0), slides.length - 1);
    slides.forEach((s, k) => (s.hidden = k !== i));
    bar.style.width = `${((i + 1) / slides.length) * 100}%`;
    count.textContent = `${i + 1} / ${slides.length}`;
    prev.disabled = i === 0;
    next.disabled = i === slides.length - 1;
    history.replaceState(null, "", `#${i + 1}`);
  };

  prev.addEventListener("click", () => show(i - 1));
  next.addEventListener("click", () => show(i + 1));
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); show(i + 1); }
    else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); show(i - 1); }
    else if (e.key === "Home") show(0);
    else if (e.key === "End") show(slides.length - 1);
  });
  let x0 = null;
  document.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
  document.addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1));
    x0 = null;
  });
  window.addEventListener("hashchange", () => fromHash() !== i && show(fromHash()));
  show(fromHash());
})();
