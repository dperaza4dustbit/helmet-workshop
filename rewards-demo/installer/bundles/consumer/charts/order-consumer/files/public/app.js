const ordersEl = document.querySelector("#orders");
const pendingCountEl = document.querySelector("#pending-count");
const shippedCountEl = document.querySelector("#shipped-count");

async function fetchJSON(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return response.json();
}

function renderOrders(orders) {
  const pending = orders.filter((order) => order.orderStatus === "pending");
  const shipped = orders.filter((order) => order.orderStatus !== "pending");

  pendingCountEl.textContent = String(pending.length);
  shippedCountEl.textContent = String(
    shipped.filter((order) => order.orderStatus === "shipped").length
  );

  if (!pending.length) {
    ordersEl.innerHTML =
      `<p class="empty">No pending orders. New manager requests will appear here automatically.</p>`;
    return;
  }

  ordersEl.innerHTML = pending
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
          <div><dt>Ship to</dt><dd>${order.departmentName} department head</dd></div>
          <div><dt>Created</dt><dd>${new Date(order.createdAt).toLocaleString()}</dd></div>
        </dl>
        <footer>
          <button data-ship="${order.orderId}">Mark shipped</button>
        </footer>
      </article>`
    )
    .join("");
}

async function refreshOrders() {
  const orders = await fetchJSON("/api/orders");
  renderOrders(orders);
}

ordersEl.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-ship]");
  if (!button) return;
  try {
    await fetchJSON(`/api/orders/${button.dataset.ship}/shipped`, {
      method: "PATCH",
    });
    await refreshOrders();
  } catch (err) {
    ordersEl.insertAdjacentHTML(
      "beforebegin",
      `<p class="message">${err.message}</p>`
    );
  }
});

refreshOrders().catch((err) => {
  ordersEl.innerHTML = `<p class="empty">${err.message}</p>`;
});

setInterval(refreshOrders, 10000);
