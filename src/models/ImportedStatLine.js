import mongoose from "mongoose";

// Per-player, per-game stat TOTALS imported from the legacy XFlag system,
// for historical games whose play-by-play no longer exists. Read alongside
// Play documents by statsAggregation.js (see lib/importedStats.js for the
// conversion), so box scores, league stats and leaderboards include them.
// A game is expected to have EITHER plays OR imported lines, never both.

const PassingSchema = new mongoose.Schema(
    {
        atts: { type: Number, default: 0 },
        comp: { type: Number, default: 0 },
        yards: { type: Number, default: 0 },
        tds: { type: Number, default: 0 },
        pat: { type: Number, default: 0 }, // points (1 or 2 per conversion)
        ints: { type: Number, default: 0 },
        sacks: { type: Number, default: 0 },
        safety: { type: Number, default: 0 },
    },
    { _id: false }
);

const ReceivingSchema = new mongoose.Schema(
    {
        receptions: { type: Number, default: 0 },
        yards: { type: Number, default: 0 },
        tds: { type: Number, default: 0 },
        pat: { type: Number, default: 0 },
    },
    { _id: false }
);

const RushingSchema = new mongoose.Schema(
    {
        atts: { type: Number, default: 0 },
        yards: { type: Number, default: 0 },
        tds: { type: Number, default: 0 },
        pat: { type: Number, default: 0 },
    },
    { _id: false }
);

const DefensiveSchema = new mongoose.Schema(
    {
        dint: { type: Number, default: 0 },
        dintTD: { type: Number, default: 0 },
        dtd: { type: Number, default: 0 },
        dpat: { type: Number, default: 0 },
        dsacks: { type: Number, default: 0 },
        dsafety: { type: Number, default: 0 },
        fumbles: { type: Number, default: 0 },
        flagPulls: { type: Number, default: 0 },
    },
    { _id: false }
);

const ImportedStatLineSchema = new mongoose.Schema(
    {
        game: { type: mongoose.Schema.Types.ObjectId, ref: "Game", required: true },
        league: { type: mongoose.Schema.Types.ObjectId, ref: "League", required: true },
        player: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true },
        // Which side of the game the player was on. The displayed team name
        // is read from game.teamA/teamB at query time, same as for plays.
        side: { type: String, enum: ["A", "B"], required: true },
        jerseyNumber: { type: String, default: "" },
        passing: { type: PassingSchema, default: () => ({}) },
        receiving: { type: ReceivingSchema, default: () => ({}) },
        rushing: { type: RushingSchema, default: () => ({}) },
        defensive: { type: DefensiveSchema, default: () => ({}) },
        // Provenance — lets the importer be re-run without duplicating lines.
        source: {
            system: { type: String, default: "xflag-legacy" },
            recordId: { type: Number, default: null }, // legacy `stats`.id
        },
    },
    { timestamps: true }
);

ImportedStatLineSchema.index({ game: 1 });
ImportedStatLineSchema.index({ league: 1 });
ImportedStatLineSchema.index(
    { "source.system": 1, "source.recordId": 1 },
    { unique: true, partialFilterExpression: { "source.recordId": { $type: "number" } } }
);

if (mongoose.models.ImportedStatLine) mongoose.deleteModel("ImportedStatLine");
export default mongoose.model("ImportedStatLine", ImportedStatLineSchema);
