"use strict";

const items = document.querySelector("#items");
const template = document.querySelector("#item-template");
const addButton = document.querySelector("#add-item");
const totalOutput = document.querySelector("#total");
const dateInput = document.querySelector("#estimate-date");
const discountInput = document.querySelector("#discount-rate");
const vatInput = document.querySelector("#vat-rate");
const currencyInput = document.querySelector("#currency");
const priceHeading = document.querySelector("#price-heading");
const subtotalOutput = document.querySelector("#subtotal");
const moneyFormatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

function parseNumber(value) {
  const normalized = value.trim().replace(/[\s\u00a0\u202f]/g, "").replace(",", ".");
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return 0;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function safeMoney(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

function formatMoney(value) {
  return `${moneyFormatter.format(safeMoney(value)).replace(/[\u00a0\u202f]/g, " ")} ${currencyInput.value}`;
}

function showSummaryAmount(name, amount) {
  document.querySelector(`#${name}-amount`).textContent = formatMoney(amount);
  document.querySelector(`#${name}-row`).hidden = amount === 0;
}

function recalculate() {
  let total = 0;
  const priceLabel = `Цена, ${currencyInput.value}`;
  priceHeading.textContent = priceLabel;
  for (const row of items.rows) {
    const quantity = parseNumber(row.querySelector(".item-quantity").value);
    const priceInput = row.querySelector(".item-price");
    const price = parseNumber(priceInput.value);
    priceInput.setAttribute("aria-label", priceLabel);
    priceInput.closest("td").dataset.label = priceLabel;
    const amount = safeMoney(quantity * price);
    row.querySelector(".item-amount").textContent = formatMoney(amount);
    total = safeMoney(total + amount);
  }
  const discount = safeMoney(total * (parseNumber(discountInput.value) / 100));
  const discounted = safeMoney(total - discount);
  const vat = safeMoney(discounted * (parseNumber(vatInput.value) / 100));
  subtotalOutput.textContent = formatMoney(total);
  showSummaryAmount("discount", discount);
  showSummaryAmount("discounted", discounted);
  showSummaryAmount("vat", vat);
  totalOutput.textContent = formatMoney(safeMoney(discounted + vat));
}

function addItem(focus = true) {
  const row = template.content.firstElementChild.cloneNode(true);
  items.append(row);
  if (focus) row.querySelector(".item-name").focus();
  recalculate();
}

addButton.addEventListener("click", () => addItem());
discountInput.addEventListener("input", recalculate);
vatInput.addEventListener("input", recalculate);
currencyInput.addEventListener("change", recalculate);
items.addEventListener("input", recalculate);
items.addEventListener("click", (event) => {
  const button = event.target.closest(".remove-button");
  if (!button) return;
  const row = button.closest("tr");
  const nextRow = row.nextElementSibling || row.previousElementSibling;
  row.remove();
  recalculate();
  if (nextRow) nextRow.querySelector(".item-name").focus();
  else addButton.focus();
});
items.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.isComposing || event.repeat) return;
  if (!event.target.matches("input")) return;
  if (event.target.closest("tr") !== items.lastElementChild) return;
  event.preventDefault();
  addItem();
});

// Use the browser's local calendar date, without shifting it through UTC.
const today = new Date();
dateInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
addItem(false);

function preparePrint() {
  recalculate();
  const number = document.querySelector('[name="estimate-number"]').value.trim();
  const date = dateInput.value ? dateInput.value.split("-").reverse().join(".") : "—";
  document.querySelector("#print-title").textContent = `Смета № ${number || "—"} от ${date}`;

  // Text copies wrap long values on paper instead of clipping them inside inputs.
  for (const field of document.querySelectorAll(".details-grid input, #items input, #items select")) {
    let value = field.value;
    if (field === dateInput) value = date;
    if (field.matches(".item-price")) value = formatMoney(parseNumber(value));
    if (field.matches(".item-quantity")) value = String(parseNumber(value));
    let copy = field.nextElementSibling;
    if (!copy || !copy.classList.contains("print-value")) {
      copy = document.createElement("span");
      copy.className = "print-value";
      copy.setAttribute("aria-hidden", "true");
      field.after(copy);
    }
    copy.textContent = value;
  }
  document.querySelector("#print-comment").textContent = document.querySelector("#comment").value;
}

document.querySelector("#save-pdf").addEventListener("click", () => {
  preparePrint();
  window.print();
});
window.addEventListener("beforeprint", preparePrint);
