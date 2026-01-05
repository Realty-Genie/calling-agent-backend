import mongoose from "mongoose";
import bcrypt from "bcrypt";

const superAdminSchema = new mongoose.Schema({
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
});

superAdminSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

export const superAdminModel = mongoose.model("SuperAdminModel", superAdminSchema);
