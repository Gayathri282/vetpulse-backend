require("dotenv").config();
const mongoose=require("mongoose");
const bcrypt=require("bcryptjs");
const {User,Availability}=require("./models");
(async()=>{
 await mongoose.connect(process.env.MONGO_URI);
 await User.deleteMany({});
 await Availability.deleteMany({});
 const doctor=await User.create({name:"Dr. Ananya Nair",email:"doctor@pawcare.demo",passwordHash:await bcrypt.hash("doctor123",10),role:"doctor"});
 const patient=await User.create({name:"Demo Pet Parent",email:"patient@pawcare.demo",passwordHash:await bcrypt.hash("patient123",10),role:"patient",petName:"Milo",petType:"Dog"});
 const rows=[];
 for(let day=1;day<=5;day++){
   rows.push({doctorId:doctor._id,dayOfWeek:day,start:"09:00",end:"13:00",duration:30,price:500});
   rows.push({doctorId:doctor._id,dayOfWeek:day,start:"14:00",end:"18:00",duration:45,price:750});
 }
 await Availability.insertMany(rows);
 console.log("Seeded:",doctor.email,patient.email);
 await mongoose.disconnect();
})();
