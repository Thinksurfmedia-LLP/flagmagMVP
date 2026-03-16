/**
 * Seed script to populate MongoDB with sample data.
 *
 * Usage: node scripts/seed.mjs
 *
 * Make sure MongoDB is running locally before executing.
 */

import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const MONGODB_URI = "mongodb://localhost:27017/flagmag";

// ── Schema definitions (inline to avoid ESM import issues with Next.js models) ──

const UserSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        phone: { type: String, trim: true },
        password: { type: String, required: true, minlength: 6 },
        role: { type: String, enum: ["player", "organizer", "admin", "viewer"], default: "player" },
        organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", default: null },
    },
    { timestamps: true }
);

const OrganizationSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
        logo: { type: String, default: "" },
        bannerImage: { type: String, default: "" },
        rating: { type: Number, default: 0 },
        memberCount: { type: Number, default: 0 },
        foundedYear: { type: Number },
        description: { type: String, default: "" },
        locationsDescription: { type: String, default: "" },
        tags: { type: [String], default: [] },
        location: { type: String, default: "" },
        scheduleDays: { type: [String], default: [] },
        sport: { type: String, default: "" },
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
        galleryImages: { type: [String], default: [] },
        testimonials: [
            {
                title: { type: String },
                body: { type: String },
                author: { type: String },
                rating: { type: Number, default: 5 },
            },
        ],
    },
    { timestamps: true }
);

const SeasonSchema = new mongoose.Schema(
    {
        organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
        name: { type: String, required: true, trim: true },
        slug: { type: String, required: true, lowercase: true, trim: true },
        type: { type: String, enum: ["active", "past"], default: "active" },
        category: { type: String, default: "" },
        location: { type: String, default: "" },
        startDate: { type: Date },
        time: { type: String, default: "" },
        divisions: [
            {
                name: { type: String },
                teams: [
                    {
                        name: { type: String },
                        logo: { type: String },
                        wins: { type: Number, default: 0 },
                        losses: { type: Number, default: 0 },
                        pct: { type: Number, default: 0 },
                        pf: { type: Number, default: 0 },
                        pa: { type: Number, default: 0 },
                        diff: { type: Number, default: 0 },
                    },
                ],
            },
        ],
        gameRecords: [
            {
                playerName: { type: String },
                playerImage: { type: String },
                seasonLabel: { type: String },
                statValue: { type: Number },
                statLabel: { type: String },
            },
        ],
    },
    { timestamps: true }
);

const GameSchema = new mongoose.Schema(
    {
        season: { type: mongoose.Schema.Types.ObjectId, ref: "Season", required: true },
        date: { type: Date, required: true },
        time: { type: String, default: "" },
        teamA: { name: { type: String }, logo: { type: String }, score: { type: Number, default: null } },
        teamB: { name: { type: String }, logo: { type: String }, score: { type: Number, default: null } },
        location: { type: String, default: "" },
        status: { type: String, enum: ["upcoming", "in_progress", "completed"], default: "upcoming" },
    },
    { timestamps: true }
);

const PlayerSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        name: { type: String, required: true, trim: true },
        photo: { type: String, default: "" },
        bannerImage: { type: String, default: "" },
        rating: { type: Number, default: 0 },
        memberCount: { type: Number, default: 0 },
        joinYear: { type: Number },
        location: { type: String, default: "" },
        about: { type: String, default: "" },
        locationsDescription: { type: String, default: "" },
        socialLinks: {
            facebook: { type: String, default: "" },
            instagram: { type: String, default: "" },
            youtube: { type: String, default: "" },
        },
        presentTeam: { name: { type: String, default: "" }, logo: { type: String, default: "" } },
        overallRating: { type: Number, default: 0 },
        defenseRating: { type: Number, default: 0 },
        quarterbackRating: { type: Number, default: 0 },
        wideReceiverRating: { type: Number, default: 0 },
        stats: {
            totalKills: { type: Number, default: 0 },
            totalDeaths: { type: Number, default: 0 },
            totalAssists: { type: Number, default: 0 },
            totalWins: { type: Number, default: 0 },
        },
        seasonProgress: { current: { type: Number, default: 0 }, max: { type: Number, default: 100 } },
        offenseStats: [{ label: { type: String }, value: { type: String } }],
        defenseStats: [{ label: { type: String }, value: { type: String } }],
        specialStats: [{ label: { type: String }, value: { type: String } }],
        teams: [
            {
                name: { type: String },
                logo: { type: String },
                record: { type: String },
                pf: { type: Number, default: 0 },
                pa: { type: Number, default: 0 },
                diff: { type: Number, default: 0 },
                season: { type: String },
            },
        ],
    },
    { timestamps: true }
);

const AwardSchema = new mongoose.Schema(
    {
        player: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true },
        name: { type: String, required: true, trim: true },
        image: { type: String, default: "" },
        season: { type: String, default: "" },
    },
    { timestamps: true }
);

// ── Register models ──
const User = mongoose.models.User || mongoose.model("User", UserSchema);
const Organization = mongoose.models.Organization || mongoose.model("Organization", OrganizationSchema);
const Season = mongoose.models.Season || mongoose.model("Season", SeasonSchema);
const Game = mongoose.models.Game || mongoose.model("Game", GameSchema);
const Player = mongoose.models.Player || mongoose.model("Player", PlayerSchema);
const Award = mongoose.models.Award || mongoose.model("Award", AwardSchema);

// ── Seed Data ──

async function seed() {
    console.log("🌱 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);

    // Clear existing data
    console.log("🗑️  Clearing existing data...");
    await Promise.all([
        User.deleteMany({}),
        Organization.deleteMany({}),
        Season.deleteMany({}),
        Game.deleteMany({}),
        Player.deleteMany({}),
        Award.deleteMany({}),
    ]);

    // ── Users ──
    console.log("👤 Creating users...");
    const hashedPassword = await bcrypt.hash("password123", 10);
    const hashedAdmin = await bcrypt.hash("admin123", 10);
    const users = await User.insertMany([
        { name: "Justin Blake", email: "justin@example.com", phone: "+1-555-0101", password: hashedPassword, role: "player" },
        { name: "Sarah Mitchell", email: "sarah@example.com", phone: "+1-555-0102", password: hashedPassword, role: "player" },
        { name: "Mike Johnson", email: "mike@example.com", phone: "+1-555-0103", password: hashedPassword, role: "organizer" },
        { name: "Admin User", email: "admin@flagmag.com", phone: "+1-555-0100", password: hashedAdmin, role: "admin" },
    ]);

    // ── Organizations ──
    console.log("🏢 Creating organizations...");
    const orgs = await Organization.insertMany([
        {
            name: "xFlag Football",
            slug: "xflag-football",
            logo: "/assets/images/teamlogo1.png",
            bannerImage: "/assets/images/inner-banner2.jpg",
            rating: 4.8,
            memberCount: 342,
            foundedYear: 2018,
            description: "Join the most competitive and fun flag football organization in Southern California. We offer leagues for all skill levels and age groups, with professional refs, quality equipment, and a vibrant community of players.",
            locationsDescription: "Multiple locations across Southern California including Los Angeles, San Diego, and Orange County. We partner with top-tier facilities to ensure the best playing experience.",
            tags: ["Coed", "Women's", "Youth", "Men's"],
            location: "New York, NY",
            scheduleDays: ["THU", "FRI", "SAT", "MON", "SUN"],
            sport: "Flag Football",
            contactInfo: { phone: "+1-555-1234", email: "info@xflagfootball.com", website: "www.xflagfootball.com" },
            socialLinks: { facebook: "https://facebook.com/xflagfootball", twitter: "https://twitter.com/xflagfootball", instagram: "https://instagram.com/xflagfootball" },
            venues: [
                { name: "Robb Field", image: "/assets/images/venues-img.jpg", amenities: ["Parking availability", "Seating/viewing areas", "Number of fields (multi-field complex)", "Locker rooms", "Restrooms", "Surface type (turf)"] },
            ],
            galleryImages: ["/assets/images/gallery1.jpg"],
            testimonials: [
                { title: "Operations Relief", body: "Before FLAGMAG, everything lived in spreadsheets and WhatsApp threads. Scheduling changes, registrations, payments—nothing was in one place. After switching, our admin load dropped massively.", author: "League Owner, Regional Flag Football League", rating: 5 },
                { title: "Game Changer", body: "The platform has completely transformed how we manage our league. Stats tracking, scheduling, and communication are now seamless.", author: "League Director & Owner, Competitive Sports League", rating: 5 },
                { title: "Youth League Success", body: "Our youth league participation has grown 40% since using FLAGMAG. Parents love the transparency and real-time updates.", author: "Founder, Multi-City Youth League", rating: 5 },
            ],
        },
        {
            name: "SoCal Flag League",
            slug: "socal-flag-league",
            logo: "/assets/images/teamlogo2.png",
            bannerImage: "/assets/images/inner-banner1.jpg",
            rating: 4.5,
            memberCount: 256,
            foundedYear: 2020,
            description: "SoCal Flag League is the premier destination for recreational and competitive flag football in the greater Los Angeles area.",
            locationsDescription: "Based in Los Angeles with venues across the metro area.",
            tags: ["Coed", "Men's", "Youth"],
            location: "Los Angeles, CA",
            scheduleDays: ["SAT", "SUN"],
            sport: "Flag Football",
            contactInfo: { phone: "+1-555-5678", email: "info@socalflag.com", website: "www.socalflag.com" },
            socialLinks: { facebook: "#", twitter: "#", instagram: "#" },
            venues: [],
            galleryImages: [],
            testimonials: [
                { title: "Great Experience", body: "Amazing organization with professional staff and well-run leagues.", author: "Team Captain", rating: 5 },
            ],
        },
        {
            name: "East Coast Flag Co",
            slug: "east-coast-flag-co",
            logo: "/assets/images/teamlogo1.png",
            bannerImage: "/assets/images/inner-banner2.jpg",
            rating: 4.6,
            memberCount: 189,
            foundedYear: 2019,
            description: "East Coast Flag Co brings premier flag football competitions to the Eastern seaboard. Leagues available in NYC, Boston, and Philadelphia.",
            locationsDescription: "Operating across major East Coast cities.",
            tags: ["Coed", "Women's", "Men's"],
            location: "Boston, MA",
            scheduleDays: ["FRI", "SAT", "SUN"],
            sport: "Flag Football",
            contactInfo: { phone: "+1-555-9012", email: "play@ecflagco.com", website: "www.ecflagco.com" },
            socialLinks: { facebook: "#", twitter: "#", instagram: "#" },
            venues: [],
            galleryImages: [],
            testimonials: [],
        },
        {
            name: "Midwest Soccer United",
            slug: "midwest-soccer-united",
            logo: "/assets/images/teamlogo2.png",
            bannerImage: "/assets/images/inner-banner1.jpg",
            rating: 4.3,
            memberCount: 410,
            foundedYear: 2015,
            description: "The largest recreational soccer organization in the Midwest, serving players of all ages and skill levels.",
            locationsDescription: "Facilities in Chicago, Detroit, Minneapolis, and Milwaukee.",
            tags: ["Coed", "Women's", "Youth", "Men's"],
            location: "Chicago, IL",
            scheduleDays: ["TUE", "THU", "SAT"],
            sport: "Soccer",
            contactInfo: { phone: "+1-555-3456", email: "info@midwestsoccer.com", website: "www.midwestsoccer.com" },
            socialLinks: { facebook: "#", twitter: "#", instagram: "#" },
            venues: [],
            galleryImages: [],
            testimonials: [],
        },
        {
            name: "Bay Area Basketball",
            slug: "bay-area-basketball",
            logo: "/assets/images/teamlogo1.png",
            bannerImage: "/assets/images/inner-banner2.jpg",
            rating: 4.7,
            memberCount: 305,
            foundedYear: 2017,
            description: "From pickup games to full competitive seasons, Bay Area Basketball has something for every baller in the SF Bay Area.",
            locationsDescription: "Courts across San Francisco, Oakland, and San Jose.",
            tags: ["Coed", "Men's"],
            location: "San Francisco, CA",
            scheduleDays: ["MON", "WED", "SAT"],
            sport: "Basketball",
            contactInfo: { phone: "+1-555-7890", email: "info@bayareaball.com", website: "www.bayareaball.com" },
            socialLinks: { facebook: "#", twitter: "#", instagram: "#" },
            venues: [],
            galleryImages: [],
            testimonials: [],
        },
        {
            name: "Sunshine Pickleball Club",
            slug: "sunshine-pickleball-club",
            logo: "/assets/images/teamlogo2.png",
            bannerImage: "/assets/images/inner-banner1.jpg",
            rating: 4.9,
            memberCount: 178,
            foundedYear: 2022,
            description: "Florida's fastest-growing pickleball community. Year-round leagues under the sunshine.",
            locationsDescription: "Courts in Miami, Tampa, Orlando, and Jacksonville.",
            tags: ["Coed", "Senior", "Youth"],
            location: "Miami, FL",
            scheduleDays: ["WED", "SAT", "SUN"],
            sport: "Pickleball",
            contactInfo: { phone: "+1-555-4321", email: "play@sunshinepickleball.com", website: "www.sunshinepickleball.com" },
            socialLinks: { facebook: "#", twitter: "#", instagram: "#" },
            venues: [],
            galleryImages: [],
            testimonials: [],
        },
    ]);

    // ── Assign organizer to organization ──
    await User.updateOne({ _id: users[2]._id }, { organization: orgs[0]._id });
    console.log("🔗 Assigned Mike Johnson to xFlag Football");

    // ── Seasons ──
    console.log("📅 Creating seasons...");
    const seasons = await Season.insertMany([
        {
            organization: orgs[0]._id,
            name: "2026 D1VA Winter",
            slug: "d1va-winter-2026",
            type: "active",
            category: "women",
            location: "New York, NY",
            startDate: new Date("2026-01-04"),
            time: "5:10 PM",
            divisions: [
                {
                    name: "DIVISION 1",
                    teams: [
                        { name: "DARKSIDE", logo: "/assets/images/t-logo.jpg", wins: 8, losses: 2, pct: 99.1, pf: 245, pa: 180, diff: 65 },
                        { name: "GOAT", logo: "/assets/images/t-logo.jpg", wins: 7, losses: 3, pct: 88.5, pf: 230, pa: 195, diff: 35 },
                        { name: "APEX", logo: "/assets/images/t-logo.jpg", wins: 6, losses: 4, pct: 75.0, pf: 210, pa: 200, diff: 10 },
                        { name: "VENOM", logo: "/assets/images/t-logo.jpg", wins: 5, losses: 5, pct: 62.5, pf: 195, pa: 205, diff: -10 },
                        { name: "STORM", logo: "/assets/images/t-logo.jpg", wins: 3, losses: 7, pct: 37.5, pf: 175, pa: 230, diff: -55 },
                    ],
                },
                {
                    name: "DIVISION 2",
                    teams: [
                        { name: "THUNDER", logo: "/assets/images/t-logo.jpg", wins: 9, losses: 1, pct: 99.5, pf: 260, pa: 150, diff: 110 },
                        { name: "BLAZE", logo: "/assets/images/t-logo.jpg", wins: 6, losses: 4, pct: 75.0, pf: 215, pa: 200, diff: 15 },
                        { name: "WOLVES", logo: "/assets/images/t-logo.jpg", wins: 5, losses: 5, pct: 62.5, pf: 200, pa: 200, diff: 0 },
                        { name: "EAGLES", logo: "/assets/images/t-logo.jpg", wins: 4, losses: 6, pct: 50.0, pf: 190, pa: 215, diff: -25 },
                        { name: "HAWKS", logo: "/assets/images/t-logo.jpg", wins: 2, losses: 8, pct: 25.0, pf: 165, pa: 245, diff: -80 },
                    ],
                },
            ],
            gameRecords: [
                { playerName: "Joey De La Torre", playerImage: "/assets/images/record1.jpg", seasonLabel: "Cypress D1VA Summer 2022", statValue: 9, statLabel: "Passing Touchdowns" },
                { playerName: "Sarah Mitchell", playerImage: "/assets/images/record1.jpg", seasonLabel: "Cypress D1VA Winter 2023", statValue: 12, statLabel: "Rushing Touchdowns" },
                { playerName: "Mike Chen", playerImage: "/assets/images/record1.jpg", seasonLabel: "D1VA Spring 2024", statValue: 7, statLabel: "Interceptions" },
                { playerName: "Lisa Park", playerImage: "/assets/images/record1.jpg", seasonLabel: "D1VA Fall 2025", statValue: 320, statLabel: "Passing Yards" },
            ],
        },
        {
            organization: orgs[0]._id,
            name: "2025 D1A Summer",
            slug: "d1a-summer-2025",
            type: "past",
            category: "men",
            location: "New York, NY",
            startDate: new Date("2025-06-01"),
            time: "6:00 PM",
            divisions: [
                {
                    name: "DIVISION 1",
                    teams: [
                        { name: "GOAT", logo: "/assets/images/t-logo.jpg", wins: 10, losses: 0, pct: 100, pf: 280, pa: 140, diff: 140 },
                        { name: "DARKSIDE", logo: "/assets/images/t-logo.jpg", wins: 7, losses: 3, pct: 88.5, pf: 240, pa: 190, diff: 50 },
                        { name: "VENOM", logo: "/assets/images/t-logo.jpg", wins: 5, losses: 5, pct: 62.5, pf: 200, pa: 200, diff: 0 },
                    ],
                },
            ],
            gameRecords: [],
        },
        {
            organization: orgs[1]._id,
            name: "2026 Spring League",
            slug: "spring-league-2026",
            type: "active",
            category: "coed",
            location: "Los Angeles, CA",
            startDate: new Date("2026-03-15"),
            time: "4:00 PM",
            divisions: [
                {
                    name: "DIVISION A",
                    teams: [
                        { name: "LA TITANS", logo: "/assets/images/t-logo.jpg", wins: 5, losses: 1, pct: 83.3, pf: 180, pa: 120, diff: 60 },
                        { name: "WESTSIDE", logo: "/assets/images/t-logo.jpg", wins: 4, losses: 2, pct: 66.7, pf: 160, pa: 140, diff: 20 },
                    ],
                },
            ],
            gameRecords: [],
        },
    ]);

    // ── Games ──
    console.log("🏈 Creating games...");
    await Game.insertMany([
        {
            season: seasons[0]._id,
            date: new Date("2026-02-15"),
            time: "17:00",
            teamA: { name: "Cake Walk F25", logo: "/assets/images/team1.png", score: null },
            teamB: { name: "Code Yellow F25", logo: "/assets/images/team2.png", score: null },
            location: "Field 1 – New York, NY",
            status: "upcoming",
        },
        {
            season: seasons[0]._id,
            date: new Date("2026-02-15"),
            time: "18:00",
            teamA: { name: "DARKSIDE", logo: "/assets/images/team1.png", score: null },
            teamB: { name: "GOAT", logo: "/assets/images/team2.png", score: null },
            location: "Field 2 – New York, NY",
            status: "upcoming",
        },
        {
            season: seasons[0]._id,
            date: new Date("2026-02-15"),
            time: "19:00",
            teamA: { name: "APEX", logo: "/assets/images/team1.png", score: null },
            teamB: { name: "STORM", logo: "/assets/images/team2.png", score: null },
            location: "Field 1 – New York, NY",
            status: "upcoming",
        },
        {
            season: seasons[0]._id,
            date: new Date("2026-02-15"),
            time: "20:00",
            teamA: { name: "THUNDER", logo: "/assets/images/team1.png", score: null },
            teamB: { name: "VENOM", logo: "/assets/images/team2.png", score: null },
            location: "Field 2 – New York, NY",
            status: "upcoming",
        },
        {
            season: seasons[0]._id,
            date: new Date("2026-02-08"),
            time: "17:00",
            teamA: { name: "DARKSIDE", logo: "/assets/images/team1.png", score: 28 },
            teamB: { name: "STORM", logo: "/assets/images/team2.png", score: 14 },
            location: "Field 1 – New York, NY",
            status: "completed",
        },
        {
            season: seasons[0]._id,
            date: new Date("2026-02-08"),
            time: "18:00",
            teamA: { name: "GOAT", logo: "/assets/images/team1.png", score: 35 },
            teamB: { name: "VENOM", logo: "/assets/images/team2.png", score: 21 },
            location: "Field 2 – New York, NY",
            status: "completed",
        },
    ]);

    // ── Players ──
    console.log("🏃 Creating players...");
    const players = await Player.insertMany([
        {
            user: users[0]._id,
            name: "Justin Blake",
            photo: "/assets/images/player1.jpg",
            bannerImage: "/assets/images/player-banner.jpg",
            rating: 4.8,
            memberCount: 342,
            joinYear: 2025,
            location: "New York, NY",
            about: "Join the most competitive and fun flag football organization in Southern California. We offer leagues for all skill levels and age groups, with professional refs, quality equipment, and a vibrant community of players.",
            locationsDescription: "Active in New York and New Jersey leagues with year-round availability.",
            socialLinks: { facebook: "#", instagram: "#", youtube: "#" },
            presentTeam: { name: "GOAT", logo: "/assets/images/team1.jpg" },
            overallRating: 85,
            defenseRating: 85,
            quarterbackRating: 85,
            wideReceiverRating: 85,
            stats: { totalKills: 2847, totalDeaths: 1203, totalAssists: 956, totalWins: 187 },
            seasonProgress: { current: 30, max: 100 },
            offenseStats: [
                { label: "Headshot %", value: "50%" },
                { label: "Completion Rate", value: "72%" },
                { label: "Pass Yards/Game", value: "245" },
                { label: "TD/INT Ratio", value: "3.2" },
            ],
            defenseStats: [
                { label: "Interceptions", value: "12" },
                { label: "Sacks", value: "8" },
                { label: "Tackles", value: "45" },
                { label: "Forced Fumbles", value: "3" },
            ],
            specialStats: [
                { label: "Return Yards", value: "340" },
                { label: "Return TDs", value: "2" },
                { label: "Punt Average", value: "42.5" },
                { label: "Field Goal %", value: "85%" },
            ],
            teams: [
                { name: "JFA", logo: "/assets/images/teamlogo2.png", record: "2-6", pf: 162, pa: 162, diff: 122, season: "2026 D1A WINTER" },
                { name: "GOAT", logo: "/assets/images/teamlogo2.png", record: "7-3", pf: 230, pa: 195, diff: 35, season: "2025 D1A SUMMER" },
                { name: "APEX", logo: "/assets/images/teamlogo2.png", record: "6-4", pf: 210, pa: 200, diff: 10, season: "2025 D1VA SPRING" },
                { name: "DARKSIDE", logo: "/assets/images/teamlogo2.png", record: "8-2", pf: 245, pa: 180, diff: 65, season: "2024 D1VA WINTER" },
            ],
        },
        {
            user: users[1]._id,
            name: "Sarah Mitchell",
            photo: "/assets/images/player1.jpg",
            bannerImage: "/assets/images/player-banner.jpg",
            rating: 4.5,
            memberCount: 218,
            joinYear: 2023,
            location: "Los Angeles, CA",
            about: "Versatile flag football player with experience in both offensive and defensive roles. Team captain and league MVP 2024.",
            locationsDescription: "Playing in LA area leagues.",
            socialLinks: { facebook: "#", instagram: "#", youtube: "#" },
            presentTeam: { name: "DARKSIDE", logo: "/assets/images/team1.jpg" },
            overallRating: 82,
            defenseRating: 88,
            quarterbackRating: 75,
            wideReceiverRating: 80,
            stats: { totalKills: 1923, totalDeaths: 845, totalAssists: 678, totalWins: 142 },
            seasonProgress: { current: 55, max: 100 },
            offenseStats: [
                { label: "Headshot %", value: "45%" },
                { label: "Completion Rate", value: "68%" },
                { label: "Pass Yards/Game", value: "198" },
                { label: "TD/INT Ratio", value: "2.8" },
            ],
            defenseStats: [
                { label: "Interceptions", value: "18" },
                { label: "Sacks", value: "5" },
                { label: "Tackles", value: "62" },
                { label: "Forced Fumbles", value: "7" },
            ],
            specialStats: [
                { label: "Return Yards", value: "210" },
                { label: "Return TDs", value: "1" },
                { label: "Punt Average", value: "38.0" },
                { label: "Field Goal %", value: "78%" },
            ],
            teams: [
                { name: "DARKSIDE", logo: "/assets/images/teamlogo2.png", record: "8-2", pf: 245, pa: 180, diff: 65, season: "2026 D1VA WINTER" },
                { name: "STORM", logo: "/assets/images/teamlogo2.png", record: "5-5", pf: 195, pa: 205, diff: -10, season: "2025 D1A SUMMER" },
            ],
        },
    ]);

    // ── Awards ──
    console.log("🏆 Creating awards...");
    await Award.insertMany([
        { player: players[0]._id, name: "League MVP 2025", image: "/assets/images/award1.png", season: "2025 D1A Summer" },
        { player: players[0]._id, name: "Best Quarterback", image: "/assets/images/award2.png", season: "2025 D1VA Winter" },
        { player: players[0]._id, name: "All-Star Selection", image: "/assets/images/award1.png", season: "2024 D1VA Fall" },
        { player: players[0]._id, name: "Rookie of the Year", image: "/assets/images/award1.png", season: "2023 D1A Spring" },
        { player: players[0]._id, name: "Sportsmanship Award", image: "/assets/images/award1.png", season: "2024 D1VA Summer" },
        { player: players[1]._id, name: "Defensive MVP 2024", image: "/assets/images/award2.png", season: "2024 D1VA Winter" },
        { player: players[1]._id, name: "Most Interceptions", image: "/assets/images/award1.png", season: "2025 D1A Summer" },
    ]);

    console.log("\n✅ Seed complete! Data summary:");
    console.log(`   👤 Users: ${await User.countDocuments()}`);
    console.log(`   🏢 Organizations: ${await Organization.countDocuments()}`);
    console.log(`   📅 Seasons: ${await Season.countDocuments()}`);
    console.log(`   🏈 Games: ${await Game.countDocuments()}`);
    console.log(`   🏃 Players: ${await Player.countDocuments()}`);
    console.log(`   🏆 Awards: ${await Award.countDocuments()}`);

    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB.");
}

seed().catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
});
