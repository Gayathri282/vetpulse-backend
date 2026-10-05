const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  passwordHash: String,
  role: { type: String, enum: ["patient", "doctor", "admin"], default: "patient" },
  phone: String,
  petName: String,
  petType: String,
  specialty: String,
  bio: String,
  rating: Number,
  reviewsCount: Number,
  experienceYears: Number,
  avatar: String
}, { timestamps: true });

const AvailabilitySchema = new mongoose.Schema({
  doctorId: { type: mongoose.Schema.Types.Mixed, ref: "User" },
  dayOfWeek: Number,
  date: String,
  start: String,
  end: String,
  duration: { type: Number, enum: [30, 45] },
  price: Number,
  active: { type: Boolean, default: true }
});

const AppointmentSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.Mixed, ref: "User" },
  doctorId: { type: mongoose.Schema.Types.Mixed, ref: "User" },
  startAt: Date,
  endAt: Date,
  duration: Number,
  price: Number,
  status: { type: String, enum: ["pending_payment", "booked", "rescheduled", "cancelled", "completed", "uncompleted"], default: "pending_payment" },
  paymentStatus: { type: String, enum: ["pending", "paid", "failed"], default: "pending" },
  paymentId: String,
  notes: String,
  callStartedAt: Date,
  bothPresentAt: Date,
  bothPresentSeconds: Number,
  completedBy: { type: mongoose.Schema.Types.Mixed, ref: "User" }
}, { timestamps: true });

const MessageSchema = new mongoose.Schema({
  appointmentId: { type: mongoose.Schema.Types.Mixed, ref: "Appointment" },
  senderId: { type: mongoose.Schema.Types.Mixed, ref: "User" },
  type: { type: String, enum: ["text", "prescription", "system"], default: "text" },
  text: String,
  prescriptionId: { type: mongoose.Schema.Types.Mixed, ref: "Prescription" }
}, { timestamps: true });

const PrescriptionSchema = new mongoose.Schema({
  appointmentId: { type: mongoose.Schema.Types.Mixed, ref: "Appointment" },
  doctorId: { type: mongoose.Schema.Types.Mixed, ref: "User" },
  patientId: { type: mongoose.Schema.Types.Mixed, ref: "User" },
  medicines: [{ name: String, dose: String, frequency: String, duration: String, instructions: String }],
  advice: String
}, { timestamps: true });

const DocumentSchema = new mongoose.Schema({
  appointmentId: { type: mongoose.Schema.Types.Mixed, ref: "Appointment" },
  patientId: { type: mongoose.Schema.Types.Mixed, ref: "User" },
  filename: String,
  originalName: String,
  mimeType: String,
  size: Number
}, { timestamps: true });

module.exports = {
  User: mongoose.model("User", UserSchema),
  Availability: mongoose.model("Availability", AvailabilitySchema),
  Appointment: mongoose.model("Appointment", AppointmentSchema),
  Message: mongoose.model("Message", MessageSchema),
  Prescription: mongoose.model("Prescription", PrescriptionSchema),
  Document: mongoose.model("Document", DocumentSchema)
};
