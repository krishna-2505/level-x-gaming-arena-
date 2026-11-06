
require("dotenv").config();

const express = require("express");
const session = require("express-session");
const path = require("path");
const Holidays = require("date-holidays");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(express.json());
app.use(session({
  name: "levelx.admin.sid",
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 2 * 60 * 60 * 1000
  }
}));
app.use(express.static(path.join(__dirname, "public")));

const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const missing = required.filter(k => !process.env[k]);

if (missing.length) {
  console.warn("Missing environment variables:", missing.join(", "));
}

const supabase = missing.length === 0
  ? createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  : null;

// Indian public holidays for Maharashtra
const holidays = new Holidays("IN", "MH");

// LEVEL X official rate card
const packages = [
  {
    id: "solo",
    name: "Solo",
    players: 1,
    morningRate: 80,
    regularRate: 100
  },
  {
    id: "duo",
    name: "Duo",
    players: 2,
    morningRate: 120,
    regularRate: 160
  },
  {
    id: "trio",
    name: "Trio",
    players: 3,
    morningRate: 140,
    regularRate: 200
  },
  {
    id: "squad",
    name: "Squad",
    players: 4,
    morningRate: 160,
    regularRate: 240
  }
];

const stationGames = {
  "PS5 Station 1": [
    "Cricket 24",
    "EA Sports FC 26",
    "WWE 2K26",
    "Fortnite",
    "It Takes Two",
    "Marvel's Wolverine",
    "Split Fiction",
    "Mortal Kombat 1",
    "Stick Fight: The Game"
  ],

  "PS5 Station 2": [
    "A Way Out",
    "Asphalt Legends",
    "Dirt 5",
    "Grand Theft Auto V",
    "Marvel's Spider-Man 2",
    "WWE 2K26",
    "Tekken 8",
    "EA Sports FC 26",
    "Mortal Kombat 1"
  ],

  "PS5 Station 3": [
    "WWE 2K26",
    "EA Sports FC 26",
    "Asphalt Legends",
    "Black Myth Wukong",
    "Ghost of Tsushima",
    "Reanimal",
    "Jump Force",
    "F1 Racing",
    "Stick Fight: The Game"
  ]
};

const allGames = [
  ...new Set(Object.values(stationGames).flat())
].sort();

function ensureDb(req, res, next) {
  if (!supabase) {
    return res.status(503).json({
      error: "Database not configured. Check .env file."
    });
  }
  next();
}

function adminOnly(req, res, next) {
  const sessionAuthorized = req.session?.isAdmin === true;

  const tokenAuthorized =
    Boolean(process.env.ADMIN_TOKEN) &&
    req.headers["x-admin-token"] === process.env.ADMIN_TOKEN;

  if (!sessionAuthorized && !tokenAuthorized) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }

  next();
}
app.post("/api/admin/login", (req, res) => {
  const password = req.body?.password;

  if (
    typeof password !== "string" ||
    !process.env.ADMIN_TOKEN ||
    password !== process.env.ADMIN_TOKEN
  ) {
    return res.status(401).json({
      error: "Invalid admin password"
    });
  }

  req.session.regenerate((err) => {
    if (err) {
      return res.status(500).json({
        error: "Login failed"
      });
    }

    req.session.isAdmin = true;

    req.session.save((err) => {
      if (err) {
        return res.status(500).json({
          error: "Could not save login session"
        });
      }

      res.json({
        success: true,
        message: "Admin login successful"
      });
    });
  });
});

function validDate(date) {
  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    return false;
  }

  const [y, m, d] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));

  return (
    parsed.getUTCFullYear() === y &&
    parsed.getUTCMonth() === m - 1 &&
    parsed.getUTCDate() === d
  );
}

function validTime(time) {
  return (
    typeof time === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  );
}

function isWeekend(date) {
  const day = new Date(
    `${date}T12:00:00+05:30`
  ).getUTCDay();

  return day === 0 || day === 6;
}

function isPublicHoliday(date) {
  const result = holidays.isHoliday(
    new Date(`${date}T12:00:00+05:30`)
  );

  if (!result) return false;

  return result.some(holiday => holiday.type === "public");
}

// Calculate the price using server-side rules
function calculatePrice(packageId, date, startTime, hours) {
  const pkg = packages.find(p => p.id === packageId);

  if (!pkg) {
    throw new Error("Invalid package.");
  }

  if (!validDate(date) || !validTime(startTime)) {
    throw new Error("Invalid date or time.");
  }

  const duration = Number(hours);

  if (
    !Number.isInteger(duration) ||
    duration < 1 ||
    duration > 6
  ) {
    throw new Error("Duration must be between 1 and 6 hours.");
  }

  const [hour, minute] = startTime.split(":").map(Number);

  const startMinutes = hour * 60 + minute;
  const endMinutes = startMinutes + duration * 60;

  if (
    startMinutes < 8 * 60 ||
    endMinutes > 23 * 60
  ) {
    throw new Error(
      "Bookings must be between 8 AM and 11 PM."
    );
  }

  const weekend = isWeekend(date);
  const publicHoliday = isPublicHoliday(date);

  let cursor = startMinutes;
  let total = 0;

  const breakdown = [];

  while (cursor < endMinutes) {
    const morning =
      !weekend &&
      !publicHoliday &&
      cursor < 12 * 60;

    const segmentEnd = morning
      ? Math.min(endMinutes, 12 * 60)
      : endMinutes;

    const minutes = segmentEnd - cursor;

    const rate = morning
      ? pkg.morningRate
      : pkg.regularRate;

    const amount = rate * minutes / 60;

    breakdown.push({
      from:
        `${String(Math.floor(cursor / 60)).padStart(2, "0")}:` +
        `${String(cursor % 60).padStart(2, "0")}`,
      to:
        `${String(Math.floor(segmentEnd / 60)).padStart(2, "0")}:` +
        `${String(segmentEnd % 60).padStart(2, "0")}`,
      rate,
      amount
    });

    total += amount;
    cursor = segmentEnd;
  }

  return {
    packageId: pkg.id,
    packageName: pkg.name,
    date,
    startTime,
    hours: duration,
    weekend,
    publicHoliday,
    breakdown,
    subtotal: total,
    discount: 0,
    total
  };
}

// Arena contact and payment configuration
app.get("/api/config", (req, res) => {
  res.json({
    upiId: process.env.UPI_ID || "9168310367@ptsbi",
    payeeName:
      process.env.UPI_PAYEE_NAME || "Abhi Nilesh Kurlawala",
    phone:
      process.env.ARENA_PHONE || "+91 91755 10367",
    address:
      process.env.ARENA_ADDRESS ||
      "Shop 9, Everest Heights, Evershine City, Vasai East"
  });
});

// Packages, stations and games
app.get("/api/catalog", (req, res) => {
  res.json({
    packages,
    stations: Object.keys(stationGames).map(
      (name, i) => ({
        id: `station-${i + 1}`,
        name
      })
    ),
    stationGames,
    games: allGames
  });
});

// Dynamic pricing API
app.get("/api/pricing", (req, res) => {
  try {
    const {
      packageId,
      date,
      startTime,
      hours
    } = req.query;

    const result = calculatePrice(
      packageId,
      date,
      startTime,
      hours
    );

    res.json(result);

  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

// Create booking
app.post("/api/bookings", ensureDb, async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      packageId,
      stationName,
      game,
      date,
      startTime,
      hours,
      utr
    } = req.body;

    const pkg = packages.find(
      p => p.id === packageId
    );

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof phone !== "string" ||
      !phone.trim() ||
      !pkg ||
      !Object.prototype.hasOwnProperty.call(
        stationGames,
        stationName
      ) ||
      !stationGames[stationName].includes(game)
    ) {
      return res.status(400).json({
        error: "Please complete all required booking details."
      });
    }

    const price = calculatePrice(
      packageId,
      date,
      startTime,
      hours
    );

    const start = new Date(
      `${date}T${startTime}:00+05:30`
    );

    if (start <= new Date()) {
      return res.status(400).json({
        error: "Choose a future date and time."
      });
    }

    const end = new Date(
      start.getTime() +
      price.hours * 60 * 60 * 1000
    );

    const { data: overlap, error: overlapError } =
      await supabase
        .from("bookings")
        .select("id")
        .eq("station_name", stationName)
        .in("status", [
          "pending_verification",
          "confirmed"
        ])
        .lt("start_at", end.toISOString())
        .gt("end_at", start.toISOString());

    if (overlapError) {
      throw overlapError;
    }

    if (overlap && overlap.length > 0) {
      return res.status(409).json({
        error:
          "This station is already booked for that time."
      });
    }

    const averageRate = price.total / price.hours;

    const { data, error } = await supabase
      .from("bookings")
      .insert({
        customer_name: name.trim(),
        phone: phone.trim(),
        email: email || null,
        package_id: pkg.id,
        package_name: pkg.name,
        station_name: stationName,
        game,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        hours: price.hours,
        hourly_rate: averageRate,
        subtotal: price.subtotal,
        discount: 0,
        total: price.total,
        utr: utr || null,
        payment_status: utr
          ? "submitted"
          : "not_submitted",
        status: "pending_verification"
      })
      .select("id, status, total")
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      message:
        "Booking submitted. Payment verification is pending.",
      booking: data
    });

  } catch (error) {
    console.error(error);

    if (
      error.message?.startsWith("Invalid") ||
      error.message?.startsWith("Duration") ||
      error.message?.startsWith("Bookings must")
    ) {
      return res.status(400).json({
        error: error.message
      });
    }

    if (error.code === "23P01") {
      return res.status(409).json({
        error:
          "This station is already booked for that time."
      });
    }
console.error("BOOKING DATABASE ERROR:", error);

    res.status(500).json({
      error:
        "Could not create booking. Please try again."
    });
  }
});

// Get station availability
app.get("/api/availability", ensureDb, async (req, res) => {
  try {
    const { date } = req.query;

    if (!validDate(date)) {
      return res.status(400).json({
        error: "Valid date is required."
      });
    }

    const from = new Date(
      `${date}T00:00:00+05:30`
    );

    const to = new Date(
      from.getTime() + 24 * 60 * 60 * 1000
    );

    const { data, error } = await supabase
      .from("bookings")
      .select(
        "station_name,start_at,end_at,status"
      )
      .in("status", [
        "pending_verification",
        "confirmed"
      ])
      .lt("start_at", to.toISOString())
      .gt("end_at", from.toISOString());

    if (error) {
      throw error;
    }

    res.json({
      bookings: data || []
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Could not load availability."
    });
  }
});

/* ADMIN: GET ALL BOOKINGS */

app.get(
  "/api/admin/bookings",
  ensureDb,
  adminOnly,
  async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .order("created_at", {
          ascending: false
        })
        .limit(200);

      if (error) {
        throw error;
      }

      res.json({
        bookings: data || []
      });

    } catch (error) {
      console.error("ADMIN BOOKINGS ERROR:", error);

      res.status(500).json({
        error: "Could not load admin bookings."
      });
    }
  }
);

// Admin verifies payment manually
app.patch(
  "/api/admin/bookings/:id",
  ensureDb,
  adminOnly,
  async (req, res) => {
    const { status } = req.body;

    if (
      !["confirmed", "rejected"].includes(status)
    ) {
      return res.status(400).json({
        error:
          "Status must be confirmed or rejected."
      });
    }

    const { data, error } = await supabase
      .from("bookings")
      .update({
        status,
        payment_status:
          status === "confirmed"
            ? "verified"
            : "rejected"
      })
      .eq("id", req.params.id)
      .select("id,status,payment_status")
      .single();

    if (error) {
      return res.status(500).json({
        error: "Could not update booking."
      });
    }

    res.json({
      booking: data
    });
  }
);

// Website homepage fallback
app.get("*", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );
});

const port = Number(
  process.env.PORT || 3000
);

app.listen(port, () => {
  console.log(
    `LEVEL X server running at http://localhost:${port}`
  );
});
