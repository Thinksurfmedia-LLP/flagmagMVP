import mongoose from "mongoose";

const ProductCategorySchema = new mongoose.Schema(
    {
        name: { type: String, required: [true, "Category name is required"], trim: true, unique: true },
        slug: { type: String, required: true, trim: true, unique: true },
        image: { type: String, default: "", trim: true },
        sortOrder: { type: Number, default: 0 },
    },
    { timestamps: true }
);

export default mongoose.models.ProductCategory || mongoose.model("ProductCategory", ProductCategorySchema);
