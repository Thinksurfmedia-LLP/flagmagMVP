import mongoose from "mongoose";

const GameDetailsSchema = new mongoose.Schema({
    team1: { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },
    team2: { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },
    field: { type: String, default: "" },
    date: { type: String, default: "" },
    time: { type: String, default: "" },
    gameType: { type: String, enum: ["main", "practice"], default: "main" },
    gameRef: { type: mongoose.Schema.Types.ObjectId, ref: "Game", default: null },
});

const WeekSchema = new mongoose.Schema({
    name: { type: String, required: true },
    games: { type: [GameDetailsSchema], default: [] }
});

const ScheduleSchema = new mongoose.Schema(
    {
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
        },
        scheduleLabel: {
            type: String,
            required: [true, "Schedule label is required"],
            trim: true,
        },
        leagueId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "League",
            default: null,
        },
        locationName: {
            type: String,
            required: [true, "Location name is required"],
            trim: true,
        },
        locationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Venue",
            default: null,
        },
        status: {
            type: String,
            enum: ["Active", "Inactive"],
            default: "Active",
        },
        weeks: {
            type: [WeekSchema],
            default: [],
        },
    },
    {
        timestamps: true,
    }
);

ScheduleSchema.index({ organization: 1 });

function getScheduleModel() {
    if (mongoose.models.Schedule) {
        const existing = mongoose.models.Schedule;
        if (!existing.schema.paths.weeks || !existing.schema.paths.leagueId || !existing.schema.path('weeks.0.games.0.gameRef')) {
            delete mongoose.models.Schedule;
            return mongoose.model("Schedule", ScheduleSchema);
        }
        return existing;
    }
    return mongoose.model("Schedule", ScheduleSchema);
}

export default getScheduleModel();
