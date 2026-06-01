/**
 * ابزارک – نسخه با شمارنده مبتنی بر localStorage (بدون PHP)
 */

function preventHorizontalScroll() {
  document.body.style.overflowX = "hidden";
  document.documentElement.style.overflowX = "hidden";
  window.addEventListener("resize", () => {
    document.body.style.overflowX = "hidden";
    document.documentElement.style.overflowX = "hidden";
  });
}

function createBackToTopButton() {
  const btn = document.createElement("button");
  btn.id = "back-to-top";
  btn.innerHTML = '<i class="fas fa-arrow-up"></i>';
  document.body.appendChild(btn);
  window.addEventListener("scroll", () =>
    btn.classList.toggle("visible", window.scrollY > 400),
  );
  btn.addEventListener("click", () =>
    window.scrollTo({ top: 0, behavior: "smooth" }),
  );
}

function initThemeAndMenu() {
  const themeKey = "toolbox-theme";
  const saved = localStorage.getItem(themeKey) || "light";
  document.body.classList.toggle("dark", saved === "dark");
  const themeBtn = document.getElementById("theme-toggle");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const isDark = document.body.classList.toggle("dark");
      localStorage.setItem(themeKey, isDark ? "dark" : "light");
    });
  }
  const menuToggle = document.getElementById("menu-toggle");
  const mainNav = document.querySelector(".main-nav");
  if (menuToggle && mainNav) {
    const closeMenu = () => {
      mainNav.classList.remove("open");
      menuToggle.setAttribute("aria-expanded", "false");
    };
    menuToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const expanded = mainNav.classList.toggle("open");
      menuToggle.setAttribute("aria-expanded", expanded);
    });
    document.addEventListener("click", (e) => {
      if (
        mainNav.classList.contains("open") &&
        !mainNav.contains(e.target) &&
        e.target !== menuToggle
      )
        closeMenu();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu();
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth > 768) closeMenu();
    });
  }
}

// شمارنده با localStorage (همیشه کار می‌کند)
const COUNTER_KEY = "abzarak_total_uses";

function updateAllCounters(value) {
  document.querySelectorAll(".global-counter").forEach((el) => {
    if (el) el.textContent = Number(value).toLocaleString("fa-IR");
  });
}

function loadCounter() {
  let val = localStorage.getItem(COUNTER_KEY);
  if (val === null) val = "0";
  updateAllCounters(val);
  return parseInt(val);
}

function incrementGlobalCount() {
  let current = loadCounter();
  let newValue = current + 1;
  localStorage.setItem(COUNTER_KEY, newValue);
  updateAllCounters(newValue);
  console.log("🔢 شمارنده افزایش یافت به:", newValue);
}
window.incrementGlobalCount = incrementGlobalCount;

function trackRecentTools() {
  document.addEventListener("click", (e) => {
    const card = e.target.closest(".tool-card");
    if (card && card.href && !card.closest("#recentTools")) {
      const name = card.querySelector("h3")?.textContent;
      if (name) {
        try {
          let recent = JSON.parse(localStorage.getItem("recentTools") || "[]");
          let updated = [name, ...recent.filter((t) => t !== name)].slice(0, 5);
          localStorage.setItem("recentTools", JSON.stringify(updated));
        } catch (_) {}
      }
    }
  });
}

function disableUserArea() {
  const userArea = document.getElementById("user-area");
  if (userArea) userArea.style.display = "none";
}

function loadComponent(url, placeholderId, callback) {
  fetch(url)
    .then((res) => (res.ok ? res.text() : Promise.reject()))
    .then((html) => {
      const placeholder = document.getElementById(placeholderId);
      if (placeholder) {
        placeholder.innerHTML = html;
        if (callback) callback();
      }
    })
    .catch((err) => console.warn(`خطا در بارگذاری ${url}:`, err));
}

function attachHeaderEventsAfterLoad() {
  initThemeAndMenu();
  disableUserArea();
  loadCounter(); // نمایش مقدار ذخیره شده
}

function updateFooterYear() {
  const yearSpan = document.querySelector(".current-year");
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();
}

document.addEventListener("DOMContentLoaded", () => {
  preventHorizontalScroll();
  createBackToTopButton();
  loadComponent(
    "/components/header.html",
    "global-header",
    attachHeaderEventsAfterLoad,
  );
  loadComponent("/components/footer.html", "global-footer", () => {
    updateFooterYear();
    loadCounter();
  });
  trackRecentTools();
});
