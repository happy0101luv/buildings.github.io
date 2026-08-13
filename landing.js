(function initLanding() {
  if (window.lucide?.createIcons) window.lucide.createIcons();
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const headers = new Headers(init?.headers || {});
    if (!headers.has("X-Client-Type")) headers.set("X-Client-Type", "web");
    return nativeFetch(input, { ...init, headers });
  };

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.documentElement.classList.add("motion-ready");

  const totalNode = document.querySelector("#catalogTotal");
  const formatTotal = (value) => {
    const n = Number(value || 0);
    if (!Number.isFinite(n) || n <= 0) return "12000+";
    if (n >= 10000) return `${(n / 10000).toFixed(1).replace(/\.0$/, "")} 万+`;
    return `${new Intl.NumberFormat("zh-CN").format(n)}+`;
  };

  fetch("./api-snapshots/catalog-limit-4-newest.json", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("catalog unavailable");
      return response.json();
    })
    .then((data) => {
      if (totalNode) totalNode.textContent = formatTotal(data.total);
    })
    .catch(() => {});

  fetch("./api-snapshots/app-session.json", { cache: "no-store" })
    .then((response) => response.json())
    .then((session) => {
      if (!session?.authenticated) return;
      document.querySelectorAll('a[href="./login/"]').forEach((link) => {
        if (link.classList.contains("secondary-cta") || link.classList.contains("ghost-link")) {
          link.textContent = "进入看板";
          link.href = "./app/";
        }
      });
    })
    .catch(() => {});

  const showTabs = document.querySelectorAll(".showcase-tabs button");
  const showImgs = document.querySelectorAll(".stage-img");
  const stageCaption = document.querySelector("#stageCaption");
  const stageCaptions = {
    dashboard: "总览看板 · 年度收藏投入与新品速递",
    catalog: "模型图鉴 · 12,289 条，按品牌 / IP / 分级检索",
    collection: "收藏库 · 状态、价格与图鉴关联",
    news: "玩具情报 · 种草墙与频道订阅",
  };
  const stageOrder = ["dashboard", "catalog", "collection", "news"];
  let stageTimer = null;

  function activateStage(tab) {
    showTabs.forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
    showImgs.forEach((img) => img.classList.toggle("active", img.dataset.tab === tab));
    if (stageCaption && stageCaptions[tab]) stageCaption.textContent = stageCaptions[tab];
  }

  function startStageAuto() {
    clearInterval(stageTimer);
    stageTimer = setInterval(() => {
      const cur = [...showTabs].find((button) => button.classList.contains("active"))?.dataset.tab || "dashboard";
      activateStage(stageOrder[(stageOrder.indexOf(cur) + 1) % stageOrder.length]);
    }, 4600);
  }

  if (showTabs.length) {
    showTabs.forEach((button) => {
      button.addEventListener("click", () => {
        activateStage(button.dataset.tab);
        startStageAuto();
      });
    });

    const stage = document.querySelector(".showcase-stage");
    if (stage) {
      stage.addEventListener("mouseenter", () => clearInterval(stageTimer));
      stage.addEventListener("mouseleave", startStageAuto);
    }
    if (!prefersReduced) startStageAuto();
  }

  if (!window.gsap || prefersReduced) return;

  const { gsap } = window;
  if (window.ScrollTrigger) {
    gsap.registerPlugin(window.ScrollTrigger);
  }

  // Text Split Utility
  document.querySelectorAll(".split-text").forEach(el => {
    const chars = el.textContent.split("");
    el.innerHTML = "";
    chars.forEach(char => {
      const span = document.createElement("span");
      span.className = "char";
      span.textContent = char === " " ? "\u00A0" : char;
      el.appendChild(span);
    });
  });

  // Global Spotlight
  const spotlight = document.querySelector(".global-spotlight");
  if (spotlight && !prefersReduced && window.matchMedia("(hover: hover)").matches) {
    gsap.set(spotlight, { opacity: 1 });
    const moveSpotlightX = gsap.quickTo(spotlight, "x", { duration: 0.6, ease: "power3" });
    const moveSpotlightY = gsap.quickTo(spotlight, "y", { duration: 0.6, ease: "power3" });
    window.addEventListener("mousemove", e => {
      moveSpotlightX(e.clientX);
      moveSpotlightY(e.clientY);
    });
  }

  // Feature Card Interactive Glow
  document.querySelectorAll(".feature-card").forEach(card => {
    card.addEventListener("mousemove", e => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty("--mouse-x", `${x}px`);
      card.style.setProperty("--mouse-y", `${y}px`);
    });
  });

  const heroTl = gsap.timeline({ defaults: { ease: "power4.out" } });
  heroTl
    .from(".site-header", { y: -20, opacity: 0, duration: 0.6 })
    .from(".hero-copy .kicker", { y: 20, opacity: 0, filter: "blur(4px)", duration: 0.6 }, "-=0.4")
    .from(".hero-logo-card", { y: 20, opacity: 0, duration: 0.6 }, "-=0.5")
    .from("#heroTitle .char", {
      y: 40, opacity: 0, rotationX: -90, transformOrigin: "0% 50% -50",
      duration: 0.8, stagger: 0.04
    }, "-=0.4")
    .from(".hero-lead", { y: 20, opacity: 0, duration: 0.6 }, "-=0.6")
    .from(".mini-program-entry", { y: 30, opacity: 0, scale: 0.95, filter: "blur(5px)", duration: 0.7 }, "-=0.6")
    .from(".hero-cta > *", { y: 20, opacity: 0, duration: 0.5, stagger: 0.1 }, "-=0.5")
    .from(".hero-stats div", { y: 20, opacity: 0, duration: 0.5, stagger: 0.08 }, "-=0.4")
    .from(".hero-console", { x: 40, y: 30, rotateY: -15, scale: 0.9, opacity: 0, duration: 0.8 }, "-=1.2")
    .from(".screen-hero", { y: 20, opacity: 0, duration: 0.5 }, "-=0.4")
    .from(".screen-list article", { x: 20, opacity: 0, duration: 0.4, stagger: 0.1 }, "-=0.3");

  // Hero Section Scroll Pin & Scrub
  if (window.ScrollTrigger) {
    const heroPinTl = gsap.timeline({
      scrollTrigger: {
        trigger: ".hero-section",
        start: "top top",
        end: "+=60%",
        scrub: 1.5,
        pin: true,
      }
    });
    heroPinTl
      .to(".hero-copy", { opacity: 0, y: -40, scale: 0.95, duration: 1 })
      .to(".hero-console", { rotateX: 10, rotateY: 10, scale: 1.05, opacity: 0, duration: 1 }, "<")
      .to(".hero-bg", { scale: 1.1, filter: "blur(10px) brightness(0.3)", duration: 1 }, "<");
  }

  const amountNode = document.querySelector("[data-count-to]");
  if (amountNode) {
    const countState = { value: 0 };
    gsap.to(countState, {
      value: Number(amountNode.dataset.countTo || 0),
      duration: 1.25,
      delay: 0.75,
      ease: "power2.out",
      onUpdate: () => {
        amountNode.textContent = `¥ ${Math.round(countState.value).toLocaleString("zh-CN")}`;
      },
    });
  }

  // Removed old hero-bg scrollTrigger since it is now part of the pinned sequence.

  gsap.to(".hero-console", {
    y: -18,
    ease: "sine.inOut",
    duration: 3.6,
    repeat: -1,
    yoyo: true,
  });

  gsap.utils.toArray("[data-reveal], .section-head, .feature-card, .catalog-copy, .catalog-wall figure, .device-frame, .sync-note, .roadmap-list article, .final-cta").forEach((el) => {
    // Animate the container itself
    gsap.from(el, {
      y: 40,
      opacity: 0,
      filter: "blur(3px)",
      duration: 0.8,
      ease: "power3.out",
      scrollTrigger: {
        trigger: el,
        start: "top 85%",
        once: true,
      },
    });
  });

  // Animate split texts independently to avoid double initialization
  document.querySelectorAll(".split-text").forEach((el) => {
    if (el.id === "heroTitle") return; // Handled by heroTl
    gsap.from(el.querySelectorAll(".char"), {
      y: 30, opacity: 0, rotationX: -60, transformOrigin: "0% 50% -50",
      duration: 0.7, stagger: 0.03, ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 85%", once: true }
    });
  });

  gsap.from(".stage-frame", {
    y: 42,
    rotateX: 5,
    opacity: 0,
    duration: 0.82,
    ease: "power3.out",
    scrollTrigger: {
      trigger: ".showcase-section",
      start: "top 76%",
      once: true,
    },
  });

  gsap.from(".catalog-wall figure", {
    y: 60,
    opacity: 0,
    scale: 0.9,
    rotation: () => gsap.utils.random(-8, 8),
    duration: 0.8,
    stagger: 0.1,
    ease: "back.out(1.5)",
    scrollTrigger: {
      trigger: ".catalog-section",
      start: "top 75%",
      once: true,
    },
  });

  const heroConsole = document.querySelector(".hero-console");
  if (heroConsole && window.matchMedia("(hover: hover)").matches) {
    heroConsole.addEventListener("mousemove", (event) => {
      const rect = heroConsole.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      gsap.to(heroConsole, {
        rotateY: x * 7,
        rotateX: y * -6,
        transformPerspective: 900,
        duration: 0.35,
        ease: "power2.out",
      });
    });
    heroConsole.addEventListener("mouseleave", () => {
      gsap.to(heroConsole, { rotateX: 0, rotateY: 0, duration: 0.45, ease: "power3.out" });
    });
  }

  document.querySelectorAll(".magnetic").forEach((el) => {
    el.addEventListener("pointermove", (event) => {
      const rect = el.getBoundingClientRect();
      const x = event.clientX - rect.left - rect.width / 2;
      const y = event.clientY - rect.top - rect.height / 2;
      gsap.to(el, { x: x * 0.12, y: y * 0.16, duration: 0.22, ease: "power2.out" });
    });
    el.addEventListener("pointerleave", () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.34, ease: "back.out(2)" });
    });
  });
})();
