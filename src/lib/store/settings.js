// Server-only helpers for the store settings singleton.
import dbConnect from "@/lib/dbConnect";
import StoreSettings from "@/models/StoreSettings";

const SETTINGS_KEY = "store";

const pick = (doc) => ({
    refundPolicy: doc?.refundPolicy || "",
    sizeGuideText: doc?.sizeGuideText || "",
    sizeGuideImage: doc?.sizeGuideImage || "",
});

export async function getStoreSettings() {
    await dbConnect();
    return pick(await StoreSettings.findOne({ key: SETTINGS_KEY }).lean());
}

export async function saveStoreSettings(values) {
    await dbConnect();
    const doc = await StoreSettings.findOneAndUpdate(
        { key: SETTINGS_KEY },
        { $set: values, $setOnInsert: { key: SETTINGS_KEY } },
        { upsert: true, new: true, runValidators: true }
    ).lean();
    return pick(doc);
}
