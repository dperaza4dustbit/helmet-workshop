const catalogEl = document.querySelector("#catalog");
const ordersEl = document.querySelector("#orders");
const form = document.querySelector("#order-form");
const selectedItemEl = document.querySelector("#selected-item");
const departmentSelect = document.querySelector("#department-select");
const resetButton = document.querySelector("#reset-selection");
const messageEl = document.querySelector("#form-message");

let catalog = [];
let departments = [];
let selectedItem = null;

async function fetchJSON(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return response.json();
}

function showMessage(text, type = "success") {
  messageEl.hidden = false;
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
}

function renderCatalog() {
  catalogEl.innerHTML = catalog
    .map(
      (item) => `
      <article class="item-card ${selectedItem?.id === item.id ? "selected" : ""}" data-id="${item.id}">
        <div class="emoji">${item.emoji}</div>
        <h3>${item.name}</h3>
        <p>${item.category}</p>
      </article>`
    )
    .join("");
}

function renderDepartments() {
  departmentSelect.innerHTML = departments
    .map(
      (dept) => `<option value="${dept.id}">${dept.name} (${dept.id})</option>`
    )
    .join("");
}

function renderSelectedItem() {
  if (!selectedItem) {
    form.classList.add("hidden");
    selectedItemEl.innerHTML = "";
    return;
  }
  form.classList.remove("hidden");
  selectedItemEl.innerHTML = `
    <span class="emoji">${selectedItem.emoji}</span>
    <div>
      <strong>${selectedItem.name}</strong>
      <p>${selectedItem.category}</p>
    </div>`;
}

function renderOrders(orders) {
  if (!orders.length) {
    ordersEl.innerHTML = `<p class="empty">No orders yet. Submit the first thank-you reward.</p>`;
    return;
  }

  ordersEl.innerHTML = orders
    .map(
      (order) => `
      <article class="order-card">
        <header>
          <div>
            <strong>#${order.orderId} · ${order.itemName}</strong>
            <p>${order.employeeName} · ${order.departmentName}</p>
          </div>
          <span class="badge ${order.orderStatus}">${order.statusLabel}</span>
        </header>
        <dl>
          <div><dt>Employee ID</dt><dd>${order.employeeId}</dd></div>
          <div><dt>Department ID</dt><dd>${order.departmentId}</dd></div>
        </dl>
        <footer>
          ${
            order.orderStatus === "shipped"
              ? `<button class="primary" data-deliver="${order.orderId}">Mark delivered</button>`
              : `<span class="empty">${order.orderStatus === "delivered" ? "Completed" : "Waiting for corp store shipment"}</span>`
          }
        </footer>
      </article>`
    )
    .join("");
}

async function refreshOrders() {
  const orders = await fetchJSON("/api/orders");
  renderOrders(orders);
}

catalogEl.addEventListener("click", (event) => {
  const card = event.target.closest(".item-card");
  if (!card) return;
  selectedItem = catalog.find((item) => item.id === card.dataset.id);
  renderCatalog();
  renderSelectedItem();
});

resetButton.addEventListener("click", () => {
  selectedItem = null;
  form.reset();
  messageEl.hidden = true;
  renderCatalog();
  renderSelectedItem();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedItem) return;

  const data = Object.fromEntries(new FormData(form));
  try {
    await fetchJSON("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId: selectedItem.id,
        employeeName: data.employeeName,
        employeeId: data.employeeId,
        departmentId: data.departmentId,
      }),
    });
    showMessage("Order submitted. The corp store will ship it to the department head.");
    form.reset();
    selectedItem = null;
    renderCatalog();
    renderSelectedItem();
    await refreshOrders();
  } catch (err) {
    showMessage(err.message, "error");
  }
});

ordersEl.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-deliver]");
  if (!button) return;
  try {
    await fetchJSON(`/api/orders/${button.dataset.deliver}/delivered`, {
      method: "PATCH",
    });
    await refreshOrders();
  } catch (err) {
    showMessage(err.message, "error");
  }
});

async function init() {
  [catalog, departments] = await Promise.all([
    fetchJSON("/api/catalog"),
    fetchJSON("/api/departments"),
  ]);
  renderCatalog();
  renderDepartments();
  await refreshOrders();
  setInterval(refreshOrders, 15000);
}

init().catch((err) => {
  ordersEl.innerHTML = `<p class="empty">${err.message}</p>`;
});
