import mongoose from "mongoose";

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    city: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now }
  },
  {
    versionKey: false
  }
);

export const Company = mongoose.model("Company", companySchema);
