import mongoose from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    agents: [
        { type: mongoose.Schema.Types.ObjectId, ref: "AgentModel" }
    ],
    credits: {
        type: Number,
        default: 0
    }
});

userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

export const userModel = mongoose.model("UserModel", userSchema);