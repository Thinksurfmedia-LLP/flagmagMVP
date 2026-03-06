import mongoose from "mongoose";

const OrganizationSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Organization name is required"],
            trim: true,
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        logo: {
            type: String,
            default: "",
        },
        bannerImage: {
            type: String,
            default: "",
        },
        rating: {
            type: Number,
            default: 0,
            min: 0,
            max: 5,
        },
        memberCount: {
            type: Number,
            default: 0,
        },
        foundedYear: {
            type: Number,
        },
        description: {
            type: String,
            default: "",
        },
        locationsDescription: {
            type: String,
            default: "",
        },
        tags: {
            type: [String],
            default: [],
        },
        location: {
            type: String,
            default: "",
        },
        scheduleDays: {
            type: [String],
            default: [],
        },
        sport: {
            type: String,
            default: "",
        },
        contactInfo: {
            phone: { type: String, default: "" },
            email: { type: String, default: "" },
            website: { type: String, default: "" },
        },
        socialLinks: {
            facebook: { type: String, default: "" },
            twitter: { type: String, default: "" },
            instagram: { type: String, default: "" },
        },
        venues: [
            {
                name: { type: String },
                image: { type: String },
                amenities: { type: [String], default: [] },
            },
        ],
        galleryImages: {
            type: [String],
            default: [],
        },
        testimonials: [
            {
                title: { type: String },
                body: { type: String },
                author: { type: String },
                rating: { type: Number, default: 5 },
            },
        ],
    },
    {
        timestamps: true,
    }
);

export default mongoose.models.Organization ||
    mongoose.model("Organization", OrganizationSchema);
