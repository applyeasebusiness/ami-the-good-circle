document.addEventListener("DOMContentLoaded", () => {
  const menuButton = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".site-nav");

  const closeMenu = () => {
    if (!nav || !menuButton) return;
    nav.classList.remove("open");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.textContent = "Menu ☰";
  };

  if (menuButton && nav) {
    menuButton.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      menuButton.setAttribute("aria-expanded", String(open));
      menuButton.textContent = open ? "Close ×" : "Menu ☰";
    });
    nav.querySelectorAll("a").forEach(link => link.addEventListener("click", closeMenu));
    document.addEventListener("click", event => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!nav.contains(target) && !menuButton.contains(target)) closeMenu();
    });
    document.addEventListener("keydown", event => { if (event.key === "Escape") closeMenu(); });
  }

  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  document.querySelectorAll(".backend-form").forEach(form => {
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const status = form.querySelector(".form-status");
      const button = form.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      if (status) status.textContent = "Sending…";

      const formData = new FormData(form);
      const fields = Object.fromEntries(formData.entries());
      fields.consent = formData.get("consent") === "yes" || formData.get("consent") === "on";
      const formType = form.dataset.formType;
      try {
        const response = await fetch("/api/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ formType, fields, website: fields.website || "" })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.ok) throw new Error(result.message || "Submission failed. Please try again.");
        if (status) status.textContent = result.message || "Thank you. Your submission has been received.";
        form.reset();
      } catch (error) {
        if (status) status.textContent = error.message || "We could not send your submission. Please try again later.";
      } finally {
        if (button) button.disabled = false;
      }
    });
  });
});
