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
const draftKey = "smeta-draft-v1";
const draftFields = {
  sender: document.querySelector('[name="sender"]'),
  recipient: document.querySelector('[name="recipient"]'),
  number: document.querySelector('[name="estimate-number"]'),
  date: dateInput,
  discount: discountInput,
  vat: vatInput,
  currency: currencyInput,
  comment: document.querySelector("#comment")
};
const itemFields = { name: ".item-name", quantity: ".item-quantity", unit: ".item-unit", price: ".item-price" };
let restoringDraft = true;
let copyTimer;
let copyAttempt = 0;

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

function addItem(focus = true, values = {}) {
  const row = template.content.firstElementChild.cloneNode(true);
  for (const [key, selector] of Object.entries(itemFields)) {
    if (typeof values[key] === "string") row.querySelector(selector).value = values[key];
  }
  items.append(row);
  if (focus) row.querySelector(".item-name").focus();
  recalculate();
  saveDraft();
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
  saveDraft();
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

function setToday() {
  // Use the local calendar date, without shifting it through UTC.
  const today = new Date();
  dateInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function saveDraft() {
  if (restoringDraft) return;
  try {
    const fields = Object.fromEntries(Object.entries(draftFields).map(([key, field]) => [key, field.value]));
    const positions = Array.from(items.rows, row => Object.fromEntries(
      Object.entries(itemFields).map(([key, selector]) => [key, row.querySelector(selector).value])
    ));
    localStorage.setItem(draftKey, JSON.stringify({ version: 1, fields, positions }));
    document.querySelector("#storage-status").textContent = "";
  } catch {
    document.querySelector("#storage-status").textContent = "Не удалось сохранить черновик в браузере. Не закрывайте страницу, пока не сохраните смету в PDF или не скопируете текст.";
  }
}

function restoreDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(draftKey));
    if (!saved || saved.version !== 1 || !saved.fields || !Array.isArray(saved.positions)) return false;
    if (!Object.keys(draftFields).every(key => typeof saved.fields[key] === "string")) return false;
    if (!["₸", "₽", "$", "€"].includes(saved.fields.currency)) return false;
    if (!saved.positions.every(row => row && Object.keys(itemFields).every(key => typeof row[key] === "string") && ["шт", "час", "услуга"].includes(row.unit))) return false;
    for (const [key, field] of Object.entries(draftFields)) field.value = saved.fields[key];
    for (const position of saved.positions) addItem(false, position);
    return true;
  } catch {
    return false;
  }
}

if (!restoreDraft()) {
  setToday();
  addItem(false);
}
restoringDraft = false;
recalculate();

for (const eventName of ["input", "change"]) {
  document.addEventListener(eventName, event => {
    if (event.target.matches(".details-grid input, .adjustments input, .adjustments select, #items input, #items select, #comment")) saveDraft();
  });
}

function clearCopyFeedback() {
  copyAttempt++;
  clearTimeout(copyTimer);
  document.querySelector("#copy-status").textContent = "";
  document.querySelector("#manual-copy").hidden = true;
  document.querySelector("#share-text").value = "";
}

document.querySelector("#new-estimate").addEventListener("click", () => {
  if (!window.confirm("Создать новую смету? Текущий черновик будет очищен.")) return;
  const number = draftFields.number.value.trim();
  const match = number.match(/^(.*?)(\d+)$/);
  const nextNumber = match ? match[1] + String(BigInt(match[2]) + 1n).padStart(match[2].length, "0") : "1";
  restoringDraft = true;
  for (const field of Object.values(draftFields)) field.value = "";
  draftFields.number.value = nextNumber;
  discountInput.value = "0";
  vatInput.value = "0";
  currencyInput.value = "₸";
  setToday();
  items.replaceChildren();
  document.querySelectorAll(".print-value").forEach(copy => copy.remove());
  document.querySelector("#print-title").textContent = "";
  document.querySelector("#print-comment").textContent = "";
  clearCopyFeedback();
  addItem();
  restoringDraft = false;
  saveDraft();
});

function buildShareText() {
  recalculate();
  const date = dateInput.value ? dateInput.value.split("-").reverse().join(".") : "—";
  const lines = [`Смета № ${draftFields.number.value.trim() || "—"} от ${date}`];
  if (draftFields.sender.value.trim()) lines.push(`От кого: ${draftFields.sender.value.trim()}`);
  if (draftFields.recipient.value.trim()) lines.push(`Для кого: ${draftFields.recipient.value.trim()}`);
  lines.push("");
  for (const row of items.rows) {
    const name = row.querySelector(".item-name").value.trim() || "Без наименования";
    const quantity = parseNumber(row.querySelector(".item-quantity").value);
    const unit = row.querySelector(".item-unit").value;
    const price = parseNumber(row.querySelector(".item-price").value);
    const amount = row.querySelector(".item-amount").textContent;
    lines.push(`• ${name} — ${quantity} ${unit} × ${formatMoney(price)} = ${amount}`);
  }
  lines.push("", `Сумма: ${subtotalOutput.textContent}`);
  for (const [key, label] of [["discount", "Скидка"], ["discounted", "Сумма со скидкой"], ["vat", "НДС"]]) {
    if (!document.querySelector(`#${key}-row`).hidden) lines.push(`${label}: ${document.querySelector(`#${key}-amount`).textContent}`);
  }
  lines.push(`Итого к оплате: ${totalOutput.textContent}`);
  if (draftFields.comment.value.trim()) lines.push("", draftFields.comment.value.trim());
  return lines.join("\n");
}

document.querySelector("#copy-whatsapp").addEventListener("click", async () => {
  clearCopyFeedback();
  const attempt = copyAttempt;
  const text = buildShareText();
  try {
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(text);
    if (attempt !== copyAttempt) return;
    document.querySelector("#copy-status").textContent = "Скопировано ✓";
    copyTimer = setTimeout(() => { document.querySelector("#copy-status").textContent = ""; }, 2000);
  } catch {
    if (attempt !== copyAttempt) return;
    const field = document.querySelector("#share-text");
    document.querySelector("#manual-copy").hidden = false;
    field.value = text;
    field.focus();
    field.select();
  }
});

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
