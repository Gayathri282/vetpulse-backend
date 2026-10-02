require("dotenv").config();
const express = require("express"), http = require("http"), cors = require("cors"), jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs"), multer = require("multer");
const { Server } = require("socket.io");
const db = require("./db");

const app = express(), server = http.createServer(app);
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json());
const upload = multer({ dest: "uploads/" });
app.use("/uploads", express.static("uploads"));

const io = new Server(server, { cors: { origin: process.env.CLIENT_URL || "http://localhost:5173" } });

function auth(req, res, next) {
  try {
    const p = jwt.verify((req.headers.authorization || "").replace("Bearer ", ""), process.env.JWT_SECRET || "pawcare_secret_jwt_key_12345");
    req.user = p;
    next();
  } catch (e) {
    res.status(401).json({ message: "Unauthorized" });
  }
}

function token(u) {
  return jwt.sign(
    { id: u._id, role: u.role, name: u.name },
    process.env.JWT_SECRET || "pawcare_secret_jwt_key_12345",
    { expiresIn: "2d" }
  );
}

app.get("/api/health", (req, res) => res.json({ ok: true, fallback: db.isFallback() }));

app.post("/api/auth/login", async (req, res) => {
  try {
    const u = await db.findUserByEmail(req.body.email);
    if (!u || !(await bcrypt.compare(req.body.password, u.passwordHash))) {
      return res.status(401).json({ message: "Invalid login credentials" });
    }
    const userWithoutPass = await db.findUserById(u._id);
    res.json({ token: token(u), user: userWithoutPass });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const exists = await db.findUserByEmail(req.body.email);
    if (exists) return res.status(409).json({ message: "Email already registered" });
    const u = await db.createUser({
      name: req.body.name,
      email: req.body.email,
      passwordHash: await bcrypt.hash(req.body.password, 10),
      role: "patient",
      petName: req.body.petName,
      petType: req.body.petType
    });
    const userWithoutPass = await db.findUserById(u._id);
    res.json({ token: token(u), user: userWithoutPass });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

function adminOnly(req, res, next) {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ message: "Access denied. Admin rights required." });
  }
}

app.get("/api/admin/stats", auth, adminOnly, async (req, res) => {
  try {
    const stats = await db.getAdminStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/admin/users", auth, adminOnly, async (req, res) => {
  try {
    const users = await db.getAllUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/admin/appointments", auth, adminOnly, async (req, res) => {
  try {
    const apps = await db.getAllAppointmentsAdmin();
    res.json(apps);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/admin/doctors/create", auth, adminOnly, async (req, res) => {
  try {
    const { name, email, password, specialty, bio, rating, experienceYears, avatar } = req.body;
    const exists = await db.findUserByEmail(email);
    if (exists) return res.status(409).json({ message: "User with this email already exists" });

    const passwordHash = await bcrypt.hash(password || "doctor123", 10);
    const newDoc = await db.createUser({
      name,
      email,
      passwordHash,
      role: "doctor",
      specialty: specialty || "General Tele-Veterinary Care",
      bio: bio || "Licensed veterinary practitioner.",
      rating: Number(rating) || 4.9,
      reviewsCount: 1,
      experienceYears: Number(experienceYears) || 5,
      avatar: avatar || "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=400&q=80"
    });

    for (let day = 1; day <= 5; day++) {
      await db.createAvailability({ doctorId: newDoc._id, dayOfWeek: day, start: "09:00", end: "13:00", duration: 30, price: 500 });
      await db.createAvailability({ doctorId: newDoc._id, dayOfWeek: day, start: "14:00", end: "18:00", duration: 45, price: 750 });
    }

    const userWithoutPass = await db.findUserById(newDoc._id);
    res.json(userWithoutPass);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/doctors", async (req, res) => {
  try {
    const list = await db.getDoctors();
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/doctor", async (req, res) => {
  try {
    const d = await db.findDoctor(req.query.id);
    res.json(d);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/availability", async (req, res) => {
  try {
    const list = await db.getAvailabilities(req.query);
    if (req.query.doctorId) {
      return res.json(list.filter(a => String(a.doctorId) === String(req.query.doctorId)));
    }
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// AI Chatbot endpoint for general questions
app.post("/api/ai-chat", async (req, res) => {
  try {
    const { question, petType } = req.body;
    const q = (question || "").toLowerCase();

    let answer = "";
    let category = "General Advice";
    let urgency = "routine";

    if (q.includes("vomit") || q.includes("puking") || q.includes("upset stomach") || q.includes("diarrhea")) {
      category = "Gastrointestinal Health";
      answer = `**Gastrointestinal Distress Symptoms**\n\n- **What it means**: Vomiting or loose stools can stem from dietary indiscretion, parasites, viral infections, or sudden food changes.\n- **What to do at home**: Fasting for 6–12 hours (with water available), followed by a mild bland diet (boiled chicken & plain white rice).\n- **When to seek immediate vet care**: If there is blood in vomit/stool, persistent vomiting for >24 hours, extreme lethargy, or signs of severe dehydration.`;
      if (q.includes("blood") || q.includes("lethargic") || q.includes("collapse")) urgency = "urgent";
    } else if (q.includes("ear") || q.includes("scratching ear") || q.includes("head shake") || q.includes("smell")) {
      category = "Ears & Otitis";
      answer = `**Ear Inflammation / Otitis Externa**\n\n- **What it means**: Frequent head shaking, ear redness, or dark discharge usually indicates a bacterial, yeast, or mite infection.\n- **What to do**: Do not insert Q-tips deep inside the ear canal. Gently wipe the outer flap with a pet-safe ear wipe.\n- **Next Steps**: A vet should examine the ear canal with an otoscope and prescribe targeted medicated ear drops.`;
    } else if (q.includes("skin") || q.includes("itch") || q.includes("rash") || q.includes("hair loss") || q.includes("flea")) {
      category = "Dermatology & Skin";
      answer = `**Skin Rash & Allergies**\n\n- **What it means**: Persistent scratching or red patches are commonly caused by flea bite allergies, environmental allergens, or food sensitivities.\n- **What to do**: Check for fleas or ticks, use a hypoallergenic soothing pet shampoo, and prevent self-trauma.\n- **Vet Guidance**: Topical creams, antihistamines, or targeted allergy medications can provide fast relief.`;
    } else if (q.includes("food") || q.includes("diet") || q.includes("eat") || q.includes("nutrition")) {
      category = "Diet & Nutrition";
      answer = `**Nutritional Guidance**\n\n- Ensure balanced meals appropriate for your animal's age, weight, and activity level.\n- **Toxic Foods to Avoid**: Chocolate, grapes/raisins, onions, garlic, xylitol sweetener, and cooked hollow bones.\n- Fresh clean water should always be available 24/7.`;
    } else if (q.includes("vaccine") || q.includes("shot") || q.includes("deworm")) {
      category = "Preventive Care";
      answer = `**Vaccination & Preventive Schedule**\n\n- Essential core vaccines protect against fatal viral diseases (Rabies, Parvovirus, Distemper, Feline Leukemia).\n- Deworming should be performed quarterly or as advised by your vet.\n- Keep an up-to-date digital vaccine record in your VetPulse portal.`;
    } else {
      answer = `Thank you for reaching out to **VetPulse AI Assistant**!\n\nFor general wellness: ensure your pet stays hydrated, maintains a regular feeding schedule, and receives routine health checkups.\n\n*Note: This AI assistant provides general informational guidance. If your pet shows acute pain, difficulty breathing, or severe lethargy, please book a consultation with our licensed veterinarian right away.*`;
    }

    res.json({
      answer,
      category,
      urgency,
      recommendedAction: "You can book a 1-on-1 video consultation with Dr. Ananya Nair or Dr. Vikram Rao for personalized diagnosis."
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/availability", auth, async (req, res) => {
  try {
    if (req.user.role !== "doctor") return res.sendStatus(403);
    const item = await db.createAvailability({ ...req.body, doctorId: req.user.id });
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/appointments", auth, async (req, res) => {
  try {
    const list = await db.getAppointments(req.user);
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/appointments/book", auth, async (req, res) => {
  try {
    if (req.user.role !== "patient") return res.sendStatus(403);
    const { startAt, duration, price, doctorId } = req.body;
    const start = new Date(startAt), end = new Date(start.getTime() + duration * 60000);
    const conflict = await db.findConflictingAppointment(doctorId, start, end);
    if (conflict) return res.status(409).json({ message: "That slot was just booked. Please choose another." });
    const ap = await db.createAppointment({
      patientId: req.user.id,
      doctorId: doctorId,
      startAt: start,
      endAt: end,
      duration,
      price,
      status: "booked",
      paymentStatus: "paid",
      paymentId: "DEMO_" + Date.now()
    });
    res.json(ap);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/appointments/:id/reschedule", auth, async (req, res) => {
  try {
    const ap = await db.findAppointmentById(req.params.id);
    if (!ap) return res.sendStatus(404);
    if (String(ap.patientId) !== req.user.id && String(ap.doctorId) !== req.user.id) return res.sendStatus(403);
    const start = new Date(req.body.startAt), end = new Date(start.getTime() + Number(req.body.duration) * 60000);
    const conflict = await db.findConflictingAppointment(ap.doctorId, start, end, ap._id);
    if (conflict) return res.status(409).json({ message: "Slot unavailable" });
    ap.startAt = start;
    ap.endAt = end;
    ap.duration = req.body.duration;
    ap.price = req.body.price;
    ap.status = "rescheduled";
    await ap.save();
    res.json(ap);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/appointments/:id/cancel", auth, async (req, res) => {
  try {
    const ap = await db.findAppointmentById(req.params.id);
    if (!ap) return res.sendStatus(404);
    if (String(ap.patientId) !== req.user.id && String(ap.doctorId) !== req.user.id) return res.sendStatus(403);
    ap.status = "cancelled";
    await ap.save();
    res.json(ap);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/appointments/:id/payment-demo", auth, async (req, res) => {
  try {
    const ap = await db.findAppointmentById(req.params.id);
    if (!ap || String(ap.patientId) !== req.user.id) return res.sendStatus(403);
    ap.paymentStatus = "paid";
    ap.status = "booked";
    ap.paymentId = "DEMO_" + Date.now();
    await ap.save();
    res.json({ success: true, appointment: ap });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/appointments/:id/complete", auth, async (req, res) => {
  try {
    const ap = await db.findAppointmentById(req.params.id);
    if (!ap || String(ap.doctorId) !== req.user.id) return res.sendStatus(403);
    ap.status = req.body.completed ? "completed" : "uncompleted";
    ap.completedBy = req.user.id;
    await ap.save();
    io.to(String(ap._id)).emit("appointment-status", { status: ap.status });
    res.json(ap);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/appointments/:id/documents", auth, async (req, res) => {
  try {
    const ap = await db.findAppointmentById(req.params.id);
    if (!ap) return res.sendStatus(404);
    if (String(ap.patientId) !== req.user.id && String(ap.doctorId) !== req.user.id) return res.sendStatus(403);
    const docs = await db.getDocuments(ap._id);
    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/appointments/:id/documents", auth, upload.single("file"), async (req, res) => {
  try {
    const ap = await db.findAppointmentById(req.params.id);
    if (!ap || String(ap.patientId) !== req.user.id) return res.sendStatus(403);
    const d = await db.createDocument({
      appointmentId: ap._id,
      patientId: req.user.id,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size
    });
    io.to(String(ap._id)).emit("document-added", d);
    res.json(d);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/appointments/:id/messages", auth, async (req, res) => {
  try {
    const ap = await db.findAppointmentById(req.params.id);
    if (!ap) return res.sendStatus(404);
    if (String(ap.patientId) !== req.user.id && String(ap.doctorId) !== req.user.id) return res.sendStatus(403);
    const msgs = await db.getMessages(ap._id);
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/appointments/:id/prescription", auth, async (req, res) => {
  try {
    if (req.user.role !== "doctor") return res.sendStatus(403);
    const ap = await db.findAppointmentById(req.params.id);
    if (!ap || String(ap.doctorId) !== req.user.id) return res.sendStatus(403);
    const p = await db.createPrescription({
      appointmentId: ap._id,
      doctorId: ap.doctorId,
      patientId: ap.patientId,
      medicines: req.body.medicines || [],
      advice: req.body.advice || ""
    });
    const m = await db.createMessage({
      appointmentId: ap._id,
      senderId: req.user.id,
      type: "prescription",
      text: "Prescription sent by the veterinarian.",
      prescriptionId: p._id
    });
    const full = await db.getMessageFull(m._id);
    io.to(String(ap._id)).emit("new-message", full);
    res.json(p);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

io.use((socket, next) => {
  try {
    socket.user = jwt.verify(socket.handshake.auth.token, process.env.JWT_SECRET || "pawcare_secret_jwt_key_12345");
    next();
  } catch (e) {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", socket => {
  socket.on("join-appointment", async ({ appointmentId }) => {
    socket.join(String(appointmentId));
  });
  socket.on("chat-message", async ({ appointmentId, text }) => {
    const ap = await db.findAppointmentById(appointmentId);
    if (!ap) return;
    if (String(ap.patientId) !== socket.user.id && String(ap.doctorId) !== socket.user.id) return;
    if (ap.paymentStatus !== "paid") return;
    const m = await db.createMessage({ appointmentId, senderId: socket.user.id, text });
    const full = await db.getMessageFull(m._id);
    io.to(String(appointmentId)).emit("new-message", full);
  });
  socket.on("webrtc-signal", ({ appointmentId, data }) =>
    socket.to(String(appointmentId)).emit("webrtc-signal", { from: socket.id, data })
  );
  socket.on("presence", ({ appointmentId, present }) =>
    socket.to(String(appointmentId)).emit("peer-presence", { socketId: socket.id, present })
  );
});

server.listen(PORT, () => {
  console.log(`PawCare API server running on port ${PORT}`);
  db.initDB();
});

