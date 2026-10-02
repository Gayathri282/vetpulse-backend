const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { User, Availability, Appointment, Message, Prescription, Document } = require("./models");

let useFallback = false;

const memoryDB = {
  users: [],
  availabilities: [],
  appointments: [],
  messages: [],
  prescriptions: [],
  documents: []
};

async function seedInitialData(isMemory = false) {
  const doctorHash = await bcrypt.hash("doctor123", 10);
  const doctor2Hash = await bcrypt.hash("doctor123", 10);
  const doctor3Hash = await bcrypt.hash("doctor123", 10);
  const adminHash = await bcrypt.hash("admin123", 10);
  const patientHash = await bcrypt.hash("patient123", 10);

  if (isMemory) {
    if (memoryDB.users.length === 0) {
      const doctorId = "doc_demo_id_1";
      const doctor2Id = "doc_demo_id_2";
      const doctor3Id = "doc_demo_id_3";
      const adminId = "admin_demo_id";
      const patientId = "pat_demo_id";

      const doc = {
        _id: doctorId,
        name: "Dr. Ananya Nair",
        email: "doctor@vetpulse.demo",
        passwordHash: doctorHash,
        role: "doctor",
        specialty: "Veterinary Specialist · General Care · Dermatology",
        rating: 4.9,
        reviewsCount: 124,
        experienceYears: 10,
        avatar: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=400&q=80",
        bio: "Expert in internal medicine, dermatology, and preventive wellness care for all pets and domestic animals.",
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const doc2 = {
        _id: doctor2Id,
        name: "Dr. Vikram Rao",
        email: "vikram@vetpulse.demo",
        passwordHash: doctor2Hash,
        role: "doctor",
        specialty: "Veterinary Surgeon · Orthopedics · Emergency Care",
        rating: 4.8,
        reviewsCount: 98,
        experienceYears: 12,
        avatar: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=400&q=80",
        bio: "Specialist in trauma care, surgical interventions, and emergency animal critical care.",
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const doc3 = {
        _id: doctor3Id,
        name: "Dr. Sophia Chen",
        email: "sophia@vetpulse.demo",
        passwordHash: doctor3Hash,
        role: "doctor",
        specialty: "Avian & Exotic Pet Specialist · Critical Care",
        rating: 4.95,
        reviewsCount: 142,
        experienceYears: 14,
        avatar: "https://images.unsplash.com/photo-1594824813566-78a9c336b9e2?auto=format&fit=crop&w=400&q=80",
        bio: "Specialist in avian health, exotic pet medicine, small mammals, and feline critical care.",
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const admin = {
        _id: adminId,
        name: "System Administrator",
        email: "admin@vetpulse.demo",
        passwordHash: adminHash,
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const pat = {
        _id: patientId,
        name: "Demo Pet Parent",
        email: "patient@vetpulse.demo",
        passwordHash: patientHash,
        role: "patient",
        petName: "Milo",
        petType: "Dog",
        createdAt: new Date(),
        updatedAt: new Date()
      };
      memoryDB.users.push(doc, doc2, doc3, admin, pat);

      // Seed slots for doctor 1
      for (let day = 1; day <= 5; day++) {
        memoryDB.availabilities.push({
          _id: "av_1_" + day + "_1", doctorId: doctorId, dayOfWeek: day, start: "09:00", end: "13:00", duration: 30, price: 500, active: true
        });
        memoryDB.availabilities.push({
          _id: "av_1_" + day + "_2", doctorId: doctorId, dayOfWeek: day, start: "14:00", end: "18:00", duration: 45, price: 750, active: true
        });
      }

      // Seed slots for doctor 2
      for (let day = 1; day <= 5; day++) {
        memoryDB.availabilities.push({
          _id: "av_2_" + day + "_1", doctorId: doctor2Id, dayOfWeek: day, start: "10:00", end: "14:00", duration: 30, price: 600, active: true
        });
      }

      // Seed slots for doctor 3
      for (let day = 1; day <= 5; day++) {
        memoryDB.availabilities.push({
          _id: "av_3_" + day + "_1", doctorId: doctor3Id, dayOfWeek: day, start: "11:00", end: "16:00", duration: 30, price: 700, active: true
        });
      }
      console.log("[DB] Memory DB seeded with Doctors, Admin (admin@vetpulse.demo), and Patient accounts.");
    }
  } else {
    try {
      const userCount = await User.countDocuments();
      if (userCount === 0) {
        const doctor1 = await User.create({
          name: "Dr. Ananya Nair",
          email: "doctor@vetpulse.demo",
          passwordHash: doctorHash,
          role: "doctor",
          specialty: "Veterinary Specialist · General Care · Dermatology",
          rating: 4.9,
          reviewsCount: 124,
          experienceYears: 10,
          avatar: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=400&q=80",
          bio: "Expert in internal medicine, dermatology, and preventive wellness care."
        });
        const doctor2 = await User.create({
          name: "Dr. Vikram Rao",
          email: "vikram@vetpulse.demo",
          passwordHash: doctor2Hash,
          role: "doctor",
          specialty: "Veterinary Surgeon · Orthopedics · Emergency Care",
          rating: 4.8,
          reviewsCount: 98,
          experienceYears: 12,
          avatar: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=400&q=80",
          bio: "Specialist in trauma care, surgical interventions, and emergency animal critical care."
        });
        const doctor3 = await User.create({
          name: "Dr. Sophia Chen",
          email: "sophia@vetpulse.demo",
          passwordHash: doctor3Hash,
          role: "doctor",
          specialty: "Avian & Exotic Pet Specialist · Critical Care",
          rating: 4.95,
          reviewsCount: 142,
          experienceYears: 14,
          avatar: "https://images.unsplash.com/photo-1594824813566-78a9c336b9e2?auto=format&fit=crop&w=400&q=80",
          bio: "Specialist in avian health, exotic pet medicine, small mammals, and feline critical care."
        });
        await User.create({
          name: "System Administrator",
          email: "admin@vetpulse.demo",
          passwordHash: adminHash,
          role: "admin"
        });
        await User.create({
          name: "Demo Pet Parent",
          email: "patient@vetpulse.demo",
          passwordHash: patientHash,
          role: "patient",
          petName: "Milo",
          petType: "Dog"
        });
        const rows = [];
        for (let day = 1; day <= 5; day++) {
          rows.push({ doctorId: doctor1._id, dayOfWeek: day, start: "09:00", end: "13:00", duration: 30, price: 500 });
          rows.push({ doctorId: doctor1._id, dayOfWeek: day, start: "14:00", end: "18:00", duration: 45, price: 750 });
          rows.push({ doctorId: doctor2._id, dayOfWeek: day, start: "10:00", end: "14:00", duration: 30, price: 600 });
          rows.push({ doctorId: doctor3._id, dayOfWeek: day, start: "11:00", end: "16:00", duration: 30, price: 700 });
        }
        await Availability.insertMany(rows);
        console.log("[DB] MongoDB seeded successfully with Admin and Doctors.");
      }
    } catch (err) {
      console.error("[DB] Error seeding MongoDB:", err);
    }
  }
}

async function initDB() {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/vetpulse";
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
    console.log("[DB] Connected to MongoDB:", uri);
    await seedInitialData(false);
  } catch (err) {
    console.warn(`[DB] Local MongoDB connection failed (${err.message}). Using in-memory fallback database.`);
    useFallback = true;
    await seedInitialData(true);
  }
}

const db = {
  initDB,
  isFallback: () => useFallback,

  findUserByEmail: async (email) => {
    // Normalise email check for pawcare.demo -> vetpulse.demo backward compatibility
    const cleanEmail = email ? email.replace("@pawcare.demo", "@vetpulse.demo") : email;
    if (!useFallback) return User.findOne({ email: { $in: [email, cleanEmail] } });
    return memoryDB.users.find(u => u.email === email || u.email === cleanEmail) || null;
  },
  findUserById: async (id) => {
    if (!useFallback) return User.findById(id).select("-passwordHash");
    const u = memoryDB.users.find(u => String(u._id) === String(id));
    if (!u) return null;
    const { passwordHash, ...rest } = u;
    return rest;
  },
  findDoctor: async (doctorId) => {
    if (!useFallback) {
      if (doctorId) return User.findById(doctorId).select("-passwordHash");
      return User.findOne({ role: "doctor" }).select("-passwordHash");
    }
    let u = null;
    if (doctorId) {
      u = memoryDB.users.find(x => String(x._id) === String(doctorId) && x.role === "doctor");
    }
    if (!u) u = memoryDB.users.find(x => x.role === "doctor");
    if (!u) return null;
    const { passwordHash, ...rest } = u;
    return rest;
  },
  getDoctors: async () => {
    if (!useFallback) {
      return User.find({ role: "doctor" }).select("-passwordHash");
    }
    return memoryDB.users.filter(u => u.role === "doctor").map(u => {
      const { passwordHash, ...rest } = u;
      return rest;
    });
  },
  createUser: async (userData) => {
    if (!useFallback) return User.create(userData);
    const nu = {
      _id: "user_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      ...userData,
      role: userData.role || "patient",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    memoryDB.users.push(nu);
    return nu;
  },

  getAvailabilities: async (query = {}) => {
    if (!useFallback) {
      const q = { active: true };
      if (query.date) q.date = query.date;
      return Availability.find(q).sort({ dayOfWeek: 1, start: 1 });
    }
    let list = memoryDB.availabilities.filter(a => a.active);
    if (query.date) list = list.filter(a => a.date === query.date);
    return list.sort((a, b) => (a.dayOfWeek - b.dayOfWeek) || a.start.localeCompare(b.start));
  },
  createAvailability: async (data) => {
    if (!useFallback) return Availability.create(data);
    const item = { _id: "av_" + Date.now(), active: true, ...data };
    memoryDB.availabilities.push(item);
    return item;
  },

  getAppointments: async (user) => {
    if (!useFallback) {
      const q = user.role === "doctor" ? { doctorId: user.id } : { patientId: user.id };
      return Appointment.find(q).populate("patientId doctorId", "name email petName petType").sort({ startAt: -1 });
    }
    const qKey = user.role === "doctor" ? "doctorId" : "patientId";
    const filtered = memoryDB.appointments.filter(a => String(a[qKey]) === String(user.id));
    const populated = filtered.map(ap => {
      const pat = memoryDB.users.find(u => String(u._id) === String(ap.patientId));
      const doc = memoryDB.users.find(u => String(u._id) === String(ap.doctorId));
      return {
        ...ap,
        patientId: pat ? { _id: pat._id, name: pat.name, email: pat.email, petName: pat.petName, petType: pat.petType } : ap.patientId,
        doctorId: doc ? { _id: doc._id, name: doc.name, email: doc.email } : ap.doctorId
      };
    });
    return populated.sort((a, b) => new Date(b.startAt) - new Date(a.startAt));
  },
  findAppointmentById: async (id) => {
    if (!useFallback) return Appointment.findById(id);
    const ap = memoryDB.appointments.find(a => String(a._id) === String(id));
    if (!ap) return null;
    return {
      ...ap,
      save: async function() {
        const idx = memoryDB.appointments.findIndex(a => String(a._id) === String(id));
        if (idx !== -1) memoryDB.appointments[idx] = { ...this };
        return this;
      }
    };
  },
  findConflictingAppointment: async (doctorId, start, end, excludeId = null) => {
    if (!useFallback) {
      const q = {
        doctorId,
        status: { $in: ["booked", "rescheduled"] },
        startAt: { $lt: end },
        endAt: { $gt: start }
      };
      if (excludeId) q._id = { $ne: excludeId };
      return Appointment.findOne(q);
    }
    return memoryDB.appointments.find(a => {
      if (excludeId && String(a._id) === String(excludeId)) return false;
      if (String(a.doctorId) !== String(doctorId)) return false;
      if (!["booked", "rescheduled"].includes(a.status)) return false;
      const aStart = new Date(a.startAt), aEnd = new Date(a.endAt);
      return aStart < end && aEnd > start;
    });
  },
  createAppointment: async (data) => {
    if (!useFallback) return Appointment.create(data);
    const ap = {
      _id: "ap_" + Date.now(),
      status: "pending_payment",
      paymentStatus: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
      save: async function() {
        const idx = memoryDB.appointments.findIndex(a => String(a._id) === String(this._id));
        if (idx !== -1) memoryDB.appointments[idx] = { ...this };
        return this;
      }
    };
    memoryDB.appointments.push(ap);
    return ap;
  },

  getDocuments: async (appointmentId) => {
    if (!useFallback) return Document.find({ appointmentId }).sort({ createdAt: -1 });
    return memoryDB.documents
      .filter(d => String(d.appointmentId) === String(appointmentId))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },
  createDocument: async (data) => {
    if (!useFallback) return Document.create(data);
    const doc = { _id: "doc_" + Date.now(), createdAt: new Date(), ...data };
    memoryDB.documents.push(doc);
    return doc;
  },

  getMessages: async (appointmentId) => {
    if (!useFallback) {
      return Message.find({ appointmentId }).populate("senderId", "name role").populate("prescriptionId").sort({ createdAt: 1 });
    }
    const msgs = memoryDB.messages.filter(m => String(m.appointmentId) === String(appointmentId));
    return msgs.map(m => {
      const sender = memoryDB.users.find(u => String(u._id) === String(m.senderId));
      const presc = memoryDB.prescriptions.find(p => String(p._id) === String(m.prescriptionId));
      return {
        ...m,
        senderId: sender ? { _id: sender._id, name: sender.name, role: sender.role } : m.senderId,
        prescriptionId: presc || m.prescriptionId
      };
    }).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  },
  createMessage: async (data) => {
    if (!useFallback) return Message.create(data);
    const msg = { _id: "msg_" + Date.now(), createdAt: new Date(), ...data };
    memoryDB.messages.push(msg);
    return msg;
  },
  getMessageFull: async (msgId) => {
    if (!useFallback) return Message.findById(msgId).populate("senderId", "name role").populate("prescriptionId");
    const m = memoryDB.messages.find(msg => String(msg._id) === String(msgId));
    if (!m) return null;
    const sender = memoryDB.users.find(u => String(u._id) === String(m.senderId));
    const presc = memoryDB.prescriptions.find(p => String(p._id) === String(m.prescriptionId));
    return {
      ...m,
      senderId: sender ? { _id: sender._id, name: sender.name, role: sender.role } : m.senderId,
      prescriptionId: presc || m.prescriptionId
    };
  },
  createPrescription: async (data) => {
    if (!useFallback) return Prescription.create(data);
    const p = { _id: "rx_" + Date.now(), createdAt: new Date(), ...data };
    memoryDB.prescriptions.push(p);
    return p;
  },

  // Admin Helper Methods
  getAllUsers: async () => {
    if (!useFallback) return User.find().select("-passwordHash").sort({ createdAt: -1 });
    return memoryDB.users.map(u => {
      const { passwordHash, ...rest } = u;
      return rest;
    });
  },
  getAllAppointmentsAdmin: async () => {
    if (!useFallback) {
      return Appointment.find().populate("patientId doctorId", "name email petName petType role specialty").sort({ createdAt: -1 });
    }
    return memoryDB.appointments.map(ap => {
      const pat = memoryDB.users.find(u => String(u._id) === String(ap.patientId));
      const doc = memoryDB.users.find(u => String(u._id) === String(ap.doctorId));
      return {
        ...ap,
        patientId: pat ? { _id: pat._id, name: pat.name, email: pat.email, petName: pat.petName, petType: pat.petType } : ap.patientId,
        doctorId: doc ? { _id: doc._id, name: doc.name, email: doc.email, specialty: doc.specialty } : ap.doctorId
      };
    }).sort((a, b) => new Date(b.createdAt || b.startAt) - new Date(a.createdAt || a.startAt));
  },
  getAdminStats: async () => {
    let doctorsCount = 0, patientsCount = 0, appointmentsCount = 0, totalRevenue = 0;
    if (!useFallback) {
      doctorsCount = await User.countDocuments({ role: "doctor" });
      patientsCount = await User.countDocuments({ role: "patient" });
      appointmentsCount = await Appointment.countDocuments();
      const paidApps = await Appointment.find({ paymentStatus: "paid" });
      totalRevenue = paidApps.reduce((acc, curr) => acc + (curr.price || 0), 0);
    } else {
      doctorsCount = memoryDB.users.filter(u => u.role === "doctor").length;
      patientsCount = memoryDB.users.filter(u => u.role === "patient").length;
      appointmentsCount = memoryDB.appointments.length;
      totalRevenue = memoryDB.appointments
        .filter(a => a.paymentStatus === "paid")
        .reduce((acc, curr) => acc + (curr.price || 0), 0);
    }
    return { doctorsCount, patientsCount, appointmentsCount, totalRevenue };
  }
};

module.exports = db;
