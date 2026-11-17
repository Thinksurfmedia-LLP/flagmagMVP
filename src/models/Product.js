import mongoose from "mongoose";
import "@/models/ProductCategory";

const VariantSchema = new mongoose.Schema(
    {
        sku: { type: String, default: "", trim: true },
        size: { type: String, default: "", trim: true },
        color: { type: String, default: "", trim: true },
        colorHex: { type: String, default: "", trim: true },
        stock: { type: Number, default: 0, min: 0 },
    },
    { _id: true }
);

const ProductSchema = new mongoose.Schema(
    {
        name: { type: String, required: [true, "Product name is required"], trim: true },
        slug: { type: String, required: true, trim: true, unique: true },
        category: { type: mongoose.Schema.Types.ObjectId, ref: "ProductCategory", required: true },
        shortDescription: { type: String, default: "", trim: true },
        description: { type: String, default: "", trim: true },
        images: { type: [String], default: [] },
        price: { type: Number, required: true, min: 0 },
        compareAtPrice: { type: Number, default: null },
        variants: { type: [VariantSchema], default: [] },
        status: { type: String, enum: ["draft", "active", "archived"], default: "draft" },
        isFeatured: { type: Boolean, default: false },
        organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", default: null },
    },
    { timestamps: true }
);

ProductSchema.index({ status: 1, category: 1, createdAt: -1 });
ProductSchema.index({ status: 1, price: 1 });

export default mongoose.models.Product || mongoose.model("Product", ProductSchema);
