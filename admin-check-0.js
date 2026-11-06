
  const refreshBtn = document.getElementById("refreshBtn");
  const statusMessage = document.getElementById("statusMessage");
  const bookingTable = document.getElementById("bookingTable");

  const totalBookings = document.getElementById("totalBookings");
  const pendingBookings = document.getElementById("pendingBookings");
  const confirmedBookings = document.getElementById("confirmedBookings");
  const totalRevenue = document.getElementById("totalRevenue");

  let isLoggedIn = false;

  function formatDate(date) {
    if (!date) return "-";

    return new Date(date).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "medium",
      timeStyle: "short"
    });
  }

  function createCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = value ?? "-";
    row.appendChild(cell);
    return cell;
  }

  async function adminLogin() {
    const password = prompt("LEVEL X Admin Password:");

    if (password === null || !password) {
      statusMessage.textContent = "Admin login required.";
      return;
    }

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify({ password })
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Invalid password");
        return;
      }

      isLoggedIn = true;
      statusMessage.textContent = "Admin login successful.";

      await loadBookings();

    } catch (error) {
      console.error(error);
      statusMessage.textContent = "Login failed.";
    }
  }

  async function loadBookings() {
    try {
      statusMessage.textContent = "Loading bookings...";

      const response = await fetch("/api/admin/bookings", {
        credentials: "same-origin",
        cache: "no-store"
      });

      if (response.status === 401) {
        isLoggedIn = false;
        statusMessage.textContent = "Session expired. Login again.";
        return;
      }

      if (!response.ok) {
        throw new Error("Could not fetch bookings");
      }

      const data = await response.json();
      const bookings = data.bookings || [];

      totalBookings.textContent = bookings.length;

      pendingBookings.textContent = bookings.filter(
        b => b.status === "pending_verification"
      ).length;

      confirmedBookings.textContent = bookings.filter(
        b => b.status === "confirmed"
      ).length;

      const revenue = bookings
        .filter(b => b.status === "confirmed")
        .reduce((sum, b) => sum + Number(b.total || 0), 0);

      totalRevenue.textContent = "₹" + revenue.toLocaleString("en-IN");

      bookingTable.replaceChildren();

      if (bookings.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 8;
        cell.textContent = "No bookings found.";

        row.appendChild(cell);
        bookingTable.appendChild(row);
      }

      bookings.forEach(booking => {
        const row = document.createElement("tr");

        createCell(row, booking.customer_name);
        createCell(row, booking.phone);
        createCell(row, booking.package_name);
        createCell(row, booking.station_name);
        createCell(row, formatDate(booking.start_at));
        createCell(row, "₹" + Number(booking.total || 0));
        createCell(row, booking.status);

        const actionCell = document.createElement("td");

        if (booking.status === "pending_verification") {
  const approveBtn = document.createElement("button");
  approveBtn.textContent = "✓ Approve";
  approveBtn.style.cssText =
    "background:#16a34a;color:white;border:0;" +
    "padding:8px 12px;border-radius:6px;" +
    "cursor:pointer;margin:4px;";

  const rejectBtn = document.createElement("button");
  rejectBtn.textContent = "✕ Reject";
  rejectBtn.style.cssText =
    "background:#dc2626;color:white;border:0;" +
    "padding:8px 12px;border-radius:6px;" +
    "cursor:pointer;margin:4px;";

  approveBtn.addEventListener("click", () => {
    updateBooking(booking.id, "confirmed");
  });

  rejectBtn.addEventListener("click", () => {
    updateBooking(booking.id, "rejected");
  });

  actionCell.append(approveBtn, rejectBtn);
} else if (booking.status === "confirmed") {
  const whatsappBtn = document.createElement("button");

  whatsappBtn.textContent = "💬 Send WhatsApp";
  whatsappBtn.style.cssText =
    "background:#25D366;color:#fff;border:0;" +
    "padding:8px 12px;border-radius:6px;" +
    "cursor:pointer;font-weight:bold;";

  whatsappBtn.addEventListener("click", () => {
    sendWhatsApp(booking);
  });

  actionCell.appendChild(whatsappBtn);
} else {
  actionCell.textContent = "-";
}

        row.appendChild(actionCell);
        bookingTable.appendChild(row);
      });

      statusMessage.textContent =
        `${bookings.length} bookings loaded successfully.`;

    } catch (error) {
      console.error(error);
      statusMessage.textContent = "Failed to load bookings.";
    }
  }

  refreshBtn.addEventListener("click", () => {
    if (isLoggedIn) {
      loadBookings();
    } else {
      adminLogin();
    }
  });
async function updateBooking(id, status) {
  const action = status === "confirmed" ? "APPROVE" : "REJECT";

  if (!confirm(`Are you sure you want to ${action} this booking?`)) {
    return;
  }

  try {
    statusMessage.textContent = "Updating booking...";

    const response = await fetch(
      `/api/admin/bookings/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify({ status })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Booking update failed");
    }

    alert(
      status === "confirmed"
        ? "Booking approved successfully!"
        : "Booking rejected successfully!"
    );

    await loadBookings();

  } catch (error) {
    console.error(error);
    statusMessage.textContent = error.message;
    alert(error.message);
  }
}
function sendWhatsApp(booking) {
    const arenaMapLink = "https://maps.app.goo.gl/oUY1qeqzBGaznS3G8?g_st=aw";
  const rawPhone = String(booking.phone || "").replace(/\D/g, "");

  // Indian numbers: 10 digits or 91 + 10 digits
  const phone = rawPhone.length === 10
    ? "91" + rawPhone
    : rawPhone;

  if (!/^91[6-9]\d{9}$/.test(phone)) {
    alert("Customer ka valid Indian WhatsApp number nahi mila.");
    return;
  }

  const start = new Date(booking.start_at);
  const end = new Date(booking.end_at);

  const date = start.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric"
  });

  const timeFormat = {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  };

  const startTime = start.toLocaleTimeString("en-IN", timeFormat);
  const endTime = end.toLocaleTimeString("en-IN", timeFormat);

  const message = `🎮 *LEVEL X GAMING ARENA* 🎮
_Your Game. Your Arena. Your Victory._

━━━━━━━━━━━━━━━━━━
🟢 *BOOKING CONFIRMED*
━━━━━━━━━━━━━━━━━━

Hey *${booking.customer_name}*! 👋

⚡ *YOUR GAMING SESSION IS LOCKED IN!*

Your arena is ready. Get your squad together and prepare for an epic gaming experience! 🚀

🏆 *YOUR BOOKING PASS*

🎟️ *Booking ID:* ${booking.id}
👤 *Player:* ${booking.customer_name}
🎮 *Gaming Package:* ${booking.package_name}
🕹️ *Gaming Station:* ${booking.station_name}
📅 *Date:* ${date}
⏰ *Time:* ${startTime} – ${endTime}
⌛ *Duration:* ${booking.hours} Hours
💰 *Total Amount:* ₹${booking.total}
✅ *Payment:* Verified

━━━━━━━━━━━━━━━━━━
🔥 *YOU'RE ALL SET!*
━━━━━━━━━━━━━━━━━━
📍 *ARENA LOCATION*
🗺️ *Google Maps:* ${arenaMapLink}

🚗 Tap the link to navigate directly to our gaming arena.

━━━━━━━━━━━━━━━━━━
💡 *Pro Tip:* Arrive 10 minutes early so you don't miss a minute of gaming!

🏁 *GAME ON. LEVEL UP.*

Thanks for choosing *LEVEL X Gaming Arena*! 💜

_See you at the arena!_ 🎮`;

  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

  window.open(url, "_blank", "noopener,noreferrer");
}
  window.addEventListener("load", adminLogin);
