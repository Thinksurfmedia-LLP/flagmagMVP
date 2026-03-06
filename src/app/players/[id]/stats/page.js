import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PlayerProfileHeader from "@/components/PlayerProfileHeader";
import dbConnect from "@/lib/dbConnect";
import Player from "@/models/Player";

async function getPlayer(id) {
    await dbConnect();
    const player = await Player.findById(id).lean();
    if (!player) return null;
    return JSON.parse(JSON.stringify(player));
}

function StatsColumn({ title, stats }) {
    return (
        <div className="col-md-4">
            <div className="stats-area">
                <h5>{title}</h5>
                {stats && stats.map((stat, i) => (
                    <div key={i} className="stats-item">
                        <span>{stat.label}</span><span>{stat.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default async function PlayerStatsPage({ params }) {
    const { id } = await params;
    const player = await getPlayer(id);

    if (!player) {
        return (
            <><Header /><section className="innerpage-section type2"><div className="container py-5 text-center"><h1>Player not found</h1></div></section><Footer /></>
        );
    }

    const statCards = [
        { label: "Total Kills", value: player.stats?.totalKills || 0 },
        { label: "Total Deaths", value: player.stats?.totalDeaths || 0 },
        { label: "Total Assists", value: player.stats?.totalAssists || 0 },
        { label: "Total Wins", value: player.stats?.totalWins || 0 },
    ];

    const progressPct = player.seasonProgress
        ? Math.round((player.seasonProgress.current / player.seasonProgress.max) * 100)
        : 0;

    return (
        <>
            <Header />
            <PlayerProfileHeader player={player} activeTab="stats" />

            <section className="leagues-section" style={{ paddingTop: 0 }}>
                <div className="container">
                    <div className="players-info-section">
                        <div className="row stats">
                            {statCards.map((stat, i) => (
                                <div key={i} className="col-sm-6 col-lg-4 col-xl-3 mb-4">
                                    <div className="card">
                                        <div className="card-body">
                                            <p>{stat.label}</p>
                                            <h5>{stat.value}</h5>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="season-progress">
                        <div className="heading">
                            <h5>Season Progress</h5>
                            <span>{player.seasonProgress?.current || 0}/{player.seasonProgress?.max || 100}</span>
                        </div>
                        <div className="progress">
                            <div className="progress-bar" role="progressbar" style={{ width: `${progressPct}%` }} aria-valuenow={progressPct} aria-valuemin="0" aria-valuemax="100"></div>
                        </div>

                        <div className="row">
                            <StatsColumn title="Offense Stats" stats={player.offenseStats} />
                            <StatsColumn title="Defense Stats" stats={player.defenseStats} />
                            <StatsColumn title="Special Stats" stats={player.specialStats} />
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </>
    );
}
