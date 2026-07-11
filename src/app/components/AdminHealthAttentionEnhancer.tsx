"use client";

import { useEffect } from "react";

function textOf(element: Element | null) {
  return element?.textContent?.replace(/\s+/g, " ").trim() || "";
}

function findServicesSection() {
  return Array.from(document.querySelectorAll("main section")).find((section) => textOf(section).includes("Serviços principais"));
}

function getFailingServices() {
  const section = findServicesSection();
  if (!section) return [] as Array<{ label: string; detail: string }>;

  return Array.from(section.querySelectorAll("article"))
    .filter((article) => textOf(article).includes("Atenção"))
    .map((article) => {
      const label = textOf(article.querySelector("h3"));
      const detail = textOf(article.querySelector("p"));
      return { label, detail };
    })
    .filter((item) => item.label);
}

function updateHealthMetric(failing: Array<{ label: string; detail: string }>) {
  const healthCard = Array.from(document.querySelectorAll("article")).find((article) => textOf(article).startsWith("Saúde geral"));
  if (!healthCard || !failing.length) return;

  const paragraphs = Array.from(healthCard.querySelectorAll("p"));
  const detail = paragraphs[paragraphs.length - 1];
  if (detail) detail.textContent = `Atenção: ${failing.map((item) => item.label).join(", ")}`;
}

function insertAttentionBlock(failing: Array<{ label: string; detail: string }>) {
  const servicesSection = findServicesSection();
  if (!servicesSection || !failing.length) return;

  const existing = document.getElementById("admin-health-attention-block");
  if (existing) existing.remove();

  const section = document.createElement("section");
  section.id = "admin-health-attention-block";
  section.className = "rounded-3xl bg-red-50 p-5 shadow-sm ring-1 ring-red-100";

  const badge = document.createElement("p");
  badge.className = "inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-red-700";
  badge.textContent = "Serviços com atenção";

  const title = document.createElement("h2");
  title.className = "mt-3 text-2xl font-black text-red-950";
  title.textContent = "O que está afetando a saúde geral";

  const grid = document.createElement("div");
  grid.className = "mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3";

  failing.forEach((service) => {
    const card = document.createElement("article");
    card.className = "rounded-2xl bg-white p-4 ring-1 ring-red-100";

    const name = document.createElement("h3");
    name.className = "font-extrabold text-slate-900";
    name.textContent = service.label;

    const detail = document.createElement("p");
    detail.className = "mt-1 text-sm leading-5 text-slate-600";
    detail.textContent = service.detail || "Sem detalhe disponível";

    card.appendChild(name);
    card.appendChild(detail);
    grid.appendChild(card);
  });

  section.appendChild(badge);
  section.appendChild(title);
  section.appendChild(grid);
  servicesSection.parentNode?.insertBefore(section, servicesSection);
}

export default function AdminHealthAttentionEnhancer() {
  useEffect(() => {
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      const failing = getFailingServices();
      if (failing.length) {
        updateHealthMetric(failing);
        insertAttentionBlock(failing);
        window.clearInterval(timer);
      }
      if (attempts > 40) window.clearInterval(timer);
    }, 500);

    return () => window.clearInterval(timer);
  }, []);

  return null;
}
