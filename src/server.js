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

app.post("/api/auth/google", async (req, res) => {
  try {
    const { email, name, credential } = req.body;
    let userEmail = email;
    let userName = name || "Google Pet Parent";

    if (credential && !userEmail) {
      try {
        const parts = credential.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
          userEmail = payload.email;
          userName = payload.name || userName;
        }
      } catch (e) {}
    }

    if (!userEmail) {
      return res.status(400).json({ message: "Google OAuth payload missing email address" });
    }

    let u = await db.findUserByEmail(userEmail);
    if (!u) {
      u = await db.createUser({
        name: userName,
        email: userEmail,
        passwordHash: await bcrypt.hash("GOOGLE_AUTH_" + Date.now(), 10),
        role: "patient",
        petName: "Milo",
        petType: "Dog"
      });
    }

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

// Intelligent AI Chatbot Endpoint with Comprehensive Medical Intent Matching
app.post("/api/ai-chat", async (req, res) => {
  try {
    const { question, petType } = req.body;
    const rawQ = (question || "").trim();
    const q = rawQ.toLowerCase();

    let category = "General Pet Care";
    let urgency = "routine";
    let answer = "";

    // Helper fuzzy test
    const matchesAny = (words) => words.some(w => q.includes(w));

    // 1. Dermatology & Skin Allergy (matches: dermatitis, allergy, allergic, alleric, eczema, rash, itch, scratch, flea, tick, hot spot, fur, hair loss, scab, mange, ringworm)
    if (matchesAny(["dermatitis", "allerg", "alleric", "eczema", "skin", "rash", "itch", "scratch", "flea", "tick", "hot spot", "fur", "hair loss", "scab", "mange", "ringworm", "paws"])) {
      category = "Dermatology & Skin Care";
      answer = `Hello! Regarding your query on skin health & dermatitis:\n\n` +
        `• **Clinical Overview**: Allergic dermatitis, hot spots, or skin rashes in pets are commonly triggered by flea bite hypersensitivity, environmental pollen/dust allergens, or food sensitivities.\n` +
        `• **Immediate Home Care**: Inspect fur base for flea dirt. Bathe your pet using a soothing hypoallergenic oat-based pet shampoo, avoid hot water, and prevent self-trauma by using an e-collar if necessary.\n` +
        `• **Veterinary Care**: A licensed veterinarian can evaluate skin scrapings and prescribe targeted topical anti-itch creams, antihistamines, or monthly spot-on parasite preventives to bring fast relief.`;
    }
    // 2. Ears & Otitis Externa (matches: otitis, externa, ear, ears, aural, head shake, smell, discharge, wax, canal)
    else if (matchesAny(["otitis", "externa", "ear", "ears", "aural", "head shake", "shaking head", "smell", "discharge", "wax", "canal"])) {
      category = "Ears & Otitis Externa";
      answer = `Hello! Regarding ear inflammation & Otitis Externa:\n\n` +
        `• **Clinical Overview**: Frequent head shaking, ear scratching, dark waxy buildup, or foul odor typically indicates Otitis Externa (bacterial or yeast ear infection) or ear mite infestation.\n` +
        `• **Immediate Home Care**: Never insert cotton swabs deep into ear canals as this risks rupturing the eardrum. Gently wipe only the visible outer ear flap with a pet-approved ear cleansing wipe.\n` +
        `• **Veterinary Care**: An otoscopic exam by a vet is necessary to evaluate eardrum integrity, identify yeast vs. bacterial microbes, and prescribe targeted medicated ear drops.`;
    }
    // 3. Gastrointestinal Distress (matches: gastroenteritis, gastro, stomach, vomit, puking, puke, diarrhea, diarrhoea, stool, poop, nausea, bloat, digestive)
    else if (matchesAny(["gastro", "stomach", "vomit", "puking", "puke", "diarrhea", "diarrhoea", "stool", "poop", "nausea", "bloat", "digestive"])) {
      category = "Gastrointestinal Health";
      answer = `Hello! Regarding gastroenteritis & digestive distress:\n\n` +
        `• **Clinical Overview**: Acute vomiting or loose stools can stem from dietary indiscretion, sudden food changes, bacterial gastroenteritis, intestinal parasites, or viral infections.\n` +
        `• **Immediate Home Care**: Withhold solid food for 6–8 hours while keeping fresh clean water accessible in small frequent amounts to prevent dehydration. Reintroduce a bland diet of boiled chicken breast and plain white rice in small portions.\n` +
        `• **Urgent Red Flags**: If there is blood in vomit or stool, black tarry stool, repeated retching, extreme lethargy, or if symptoms persist beyond 24 hours, consult a veterinarian immediately.`;
      if (matchesAny(["blood", "black", "lethargy", "collapse", "severe"])) urgency = "urgent";
    }
    // 4. Dental & Oral Health (matches: dental, teeth, tooth, gum, gums, tartar, plaque, halitosis, breath, chewing)
    else if (matchesAny(["dental", "teeth", "tooth", "gum", "gums", "tartar", "plaque", "halitosis", "breath", "chewing"])) {
      category = "Dental & Oral Care";
      answer = `Hello! Regarding dental health and periodontal care:\n\n` +
        `• **Clinical Overview**: Bad breath, yellow-brown tartar, or inflamed gums indicate periodontal disease, which can lead to tooth root infections and systemic bacterial spread.\n` +
        `• **Immediate Home Care**: Introduce daily brushing using animal-safe enzymatic toothpaste (never human toothpaste). Provide vet-approved dental chews.\n` +
        `• **Veterinary Care**: Schedule a professional dental scaling exam to remove hardened subgingival tartar safely.`;
    }
    // 5. Urinary & FLUTD (matches: flutd, urinary, pee, urinating, bladder, crystal, cystitis, strain)
    else if (matchesAny(["flutd", "urinary", "pee", "urinating", "bladder", "crystal", "cystitis", "strain"])) {
      category = "Urinary & FLUTD Care";
      answer = `Hello! Regarding urinary health & lower urinary tract issues:\n\n` +
        `• **Clinical Overview**: Straining to urinate, frequent small attempts, or blood in urine can signal urinary tract infections, bladder crystals, or life-threatening urethral blockage (especially in male cats).\n` +
        `• **Immediate Home Care**: Encourage high water intake through pet water fountains and transition to wet urinary prescription diets.\n` +
        `• **Emergency Red Flag**: If your pet is straining and CANNOT pass any urine, this is a fatal medical emergency requiring immediate vet hospital admission!`;
      if (matchesAny(["cannot", "block", "strain", "crying"])) urgency = "urgent";
    }
    // 6. Joint & Mobility (matches: arthritis, joint, limp, limping, stiff, stiffness, hip, mobility, leg)
    else if (matchesAny(["arthritis", "joint", "limp", "limping", "stiff", "stiffness", "hip", "mobility", "leg"])) {
      category = "Joint & Mobility Health";
      answer = `Hello! Regarding joint mobility and osteoarthritis:\n\n` +
        `• **Clinical Overview**: Stiffness when rising, reluctance to climb stairs, or altered gait are classic signs of canine/feline osteoarthritis or joint cartilage wear.\n` +
        `• **Immediate Home Care**: Provide soft orthopedic pet bedding, prevent slipping on tiled floors with rugs, and maintain a lean body weight to reduce joint load.\n` +
        `• **Veterinary Care**: Vets can prescribe safe anti-inflammatory medications (NSAIDs), joint supplements (Glucosamine/Chondroitin), and Omega-3 fatty acid therapy.`;
    }
    // 7. Toxicology & Poison Emergency (matches: toxic, poison, chocolate, grape, raisin, onion, garlic, xylitol, chemical, plant)
    else if (matchesAny(["toxic", "poison", "chocolate", "grape", "raisin", "onion", "garlic", "xylitol", "chemical", "plant"])) {
      category = "Toxicology Emergency";
      urgency = "urgent";
      answer = `⚠️ **TOXIC INGESTION EMERGENCY ALERT**:\n\n` +
        `• **Warning**: Chocolate, grapes, raisins, onions, garlic, macadamia nuts, lilies (in cats), and xylitol sweetener are highly poisonous and cause acute kidney, liver, or cardiac toxicity.\n` +
        `• **Immediate Action**: Note the exact substance, estimated weight consumed, and time of ingestion. Do NOT induce vomiting without direct vet approval.\n` +
        `• **Emergency Step**: Seek emergency veterinary care or connect with our tele-vet doctor right away for triage instructions!`;
    }
    // 8. Respiratory Health (matches: cough, coughing, sneezing, pant, panting, wheez, kennel cough, respiratory, breath)
    else if (matchesAny(["cough", "coughing", "sneezing", "pant", "panting", "wheez", "kennel cough", "respiratory", "breath"])) {
      category = "Respiratory Health";
      answer = `Hello! Regarding respiratory symptoms & breathing:\n\n` +
        `• **Clinical Overview**: Dry honking coughs often point to Kennel Cough or tracheal irritation. Open-mouth breathing or panting in cats is a severe respiratory distress flag.\n` +
        `• **Immediate Home Care**: Keep your pet in a humidified, cool, well-ventilated environment away from household dust, incense, or smoke.\n` +
        `• **Red Flag**: If gums appear pale or blue, or breathing appears labored, seek immediate emergency veterinary medical attention.`;
      if (matchesAny(["blue", "pale", "gasp", "labor"])) urgency = "urgent";
    }
    // 9. Preventive Care & Vaccines (matches: vaccine, vaccination, shot, shots, deworm, deworming, rabies, parvo, booster, puppy, kitten)
    else if (matchesAny(["vaccine", "vaccination", "shot", "shots", "deworm", "deworming", "rabies", "parvo", "booster", "puppy", "kitten"])) {
      category = "Preventive Health & Vaccines";
      answer = `Hello! Regarding preventive care, vaccines & deworming:\n\n` +
        `• **Core Vaccines**: Essential core shots protect pets against deadly viral diseases (Rabies, Parvovirus, Distemper, DHPP for dogs; Rabies & FVRCP for cats).\n` +
        `• **Deworming Schedule**: Puppies/kittens require deworming starting at 2–3 weeks of age, followed by routine quarterly adult deworming.\n` +
        `• **Digital Health Portal**: Store and view all your pet's official vaccination logs inside your VetPulse medical portal.`;
    }
    // 10. Nutrition & Feeding (matches: food, diet, eat, feed, nutrition, weight, treat, fruit, raw)
    else if (matchesAny(["food", "diet", "eat", "feed", "nutrition", "weight", "treat", "fruit", "raw"])) {
      category = "Diet & Nutrition";
      answer = `Hello! Regarding animal diet and nutrition:\n\n` +
        `• **Diet Guidelines**: Feed balanced, high-quality pet food formulated for your animal's specific life stage (Puppy/Kitten, Adult, Senior).\n` +
        `• **Safe Treats**: Plain boiled chicken, carrots, blueberries, and seedless apple slices make healthy treats in moderation.\n` +
        `• **Hydration**: Ensure a clean bowl of fresh water is available at all times.`;
    }
    // 11. Behavior & Training (matches: bark, bite, aggressive, anxiety, litter, train, sleep, stress, behavior)
    else if (matchesAny(["bark", "bite", "aggressive", "anxiety", "litter", "train", "sleep", "stress", "behavior"])) {
      category = "Pet Behavior & Training";
      answer = `Hello! Regarding pet behavior and training:\n\n` +
        `• **Behavioral Insight**: Sudden changes in behavior (such as nocturnal vocalization, litter box avoidance, or anxiety) often stem from underlying physical pain or stress.\n` +
        `• **Management**: Maintain regular daily feeding and exercise routines, use positive reinforcement rewards, and provide mental enrichment toys.\n` +
        `• **Vet Tip**: Always consult a vet to rule out underlying medical issues (like urinary crystals or joint pain) before treating as a pure behavioral problem.`;
    }
    // 12. Dynamic Prompt Contextualizer for ANY specific question
    else {
      category = "General Veterinary Guidance";
      answer = `Hello! Thank you for consulting VetPulse AI regarding your question about "${rawQ}":\n\n` +
        `• **Veterinary Assessment**: For optimal health, monitor your pet's daily activity level, appetite, hydration, coat condition, and stool consistency.\n` +
        `• **General At-Home Wellness**: Ensure clean drinking water is always accessible, maintain a routine feeding schedule, and prevent exposure to toxic items.\n` +
        `• **Consultation Recommendation**: If your pet displays persistent physical symptoms, discomfort, or abnormal behavior, schedule a 1-on-1 video consultation with Dr. Ananya Nair for a personalized clinical evaluation and digital prescription (Rx).`;
    }

    res.json({
      answer,
      category,
      urgency,
      recommendedAction: "Book a 1-on-1 video consultation with Dr. Ananya Nair for personalized diagnosis and digital prescription."
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
    const roomKey = String(appointmentId);
    socket.join(roomKey);
    const room = io.sockets.adapter.rooms.get(roomKey);
    const count = room ? room.size : 1;
    io.to(roomKey).emit("room-status", { count, socketId: socket.id, user: socket.user });
    socket.to(roomKey).emit("peer-joined", { socketId: socket.id, user: socket.user });
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

  socket.on("webrtc-signal", ({ appointmentId, data }) => {
    socket.to(String(appointmentId)).emit("webrtc-signal", { from: socket.id, data, senderUser: socket.user });
  });

  socket.on("presence", ({ appointmentId, present }) => {
    socket.to(String(appointmentId)).emit("peer-presence", { socketId: socket.id, present, user: socket.user });
  });

  socket.on("disconnecting", () => {
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        socket.to(room).emit("peer-left", { socketId: socket.id, user: socket.user });
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`PawCare API server running on port ${PORT}`);
  db.initDB();
});

