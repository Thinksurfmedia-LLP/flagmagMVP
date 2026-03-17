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
        categories: {
            type: [String],
            default: [],
            validate: {
                validator: (v) => v && v.length > 0,
                message: "At least one category is required",
            },
        },
        locations: {
            type: [
                {
                    state: { type: mongoose.Schema.Types.ObjectId, ref: "State" },
                    county: { type: mongoose.Schema.Types.ObjectId, ref: "County" },
                    location: { type: mongoose.Schema.Types.ObjectId, ref: "Venue" },
                    stateName: { type: String, default: "" },
                    stateAbbr: { type: String, default: "" },
                    countyName: { type: String, default: "" },
                    cityName: { type: String, default: "" },
                    locationName: { type: String, default: "" },
                },
            ],
            default: [],
            validate: {
                validator: (v) => v && v.length > 0,
                message: "At least one operating location is required",
            },
        },
        categories: {
            type: [String],
            default: [],
            validate: {
                validator: (v) => v && v.length > 0,
                message: "At least one category is required",
            },
        },
        location: {
            type: String,
            default: "",
        },
        scheduleDays: {
            type: [String],
            default: [],
            validate: {
                validator: (v) => v && v.length > 0,
                message: "At least one schedule day is required",
            },
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

function getOrganizationModel() {
    const existing = mongoose.models.Organization;
    if (existing) {
        const locationsSchema = existing.schema.path("locations");
        const subdocPaths = locationsSchema?.schema?.paths || {};
        if (!subdocPaths.cityName) {
            delete mongoose.models.Organization;
        }
    }
    return mongoose.models.Organization || mongoose.model("Organization", OrganizationSchema);
}

export default getOrganizationModel();
